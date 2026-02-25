const pool = require('../../config/database');

class StitchingEventRepository {
  async insertEvents(events, sourceFile) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const query = `
        INSERT INTO stitching_events (machine_id, status, event_time, source_file, created_at)
        VALUES (?, ?, CONVERT_TZ(NOW(), '+00:00', '+05:30'), ?, CONVERT_TZ(NOW(), '+00:00', '+05:30'))
      `;
      
      for (const event of events) {
        await connection.execute(query, [event.machine_id, event.status, sourceFile]);
      }
      
      await connection.commit();
      return { success: true, insertedCount: events.length };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async insertEvent(machineId, status, eventTime, sourceFile) {
    const query = `
      INSERT INTO stitching_events (machine_id, status, event_time, source_file, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;
    
    await pool.execute(query, [machineId, status, eventTime, sourceFile]);
  }

  async getLatestMachineStatus() {
    const query = `
      SELECT 
        machine_id,
        status,
        event_time,
        source_file,
        created_at
      FROM stitching_events se1
      WHERE event_time = (
        SELECT MAX(event_time) 
        FROM stitching_events se2 
        WHERE se2.machine_id = se1.machine_id
      )
      ORDER BY machine_id
    `;
    
    const [rows] = await pool.execute(query);
    return rows;
  }

  async getRunIdleReport(date) {
    const query = `
      SELECT 
        machine_id,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as run_minutes,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as idle_minutes,
        COUNT(*) as total_events
      FROM stitching_events
      WHERE DATE(event_time) = ?
      GROUP BY machine_id
      ORDER BY machine_id
    `;
    
    const [rows] = await pool.execute(query, [date]);
    return rows;
  }

  async getHourlyReport(date) {
    const query = `
      SELECT 
        machine_id,
        HOUR(event_time) as hour,
        COUNT(*) as event_count,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as run_events,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as idle_events
      FROM stitching_events
      WHERE DATE(event_time) = ?
      GROUP BY machine_id, HOUR(event_time)
      ORDER BY machine_id, hour
    `;
    
    const [rows] = await pool.execute(query, [date]);
    return rows;
  }

  async getEfficiencyReport(date) {
    const query = `
      SELECT 
        machine_id,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as run_minutes,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as idle_minutes,
        COUNT(*) as total_events,
        ROUND(
          (SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2
        ) as efficiency_percentage
      FROM stitching_events
      WHERE DATE(event_time) = ?
      GROUP BY machine_id
      ORDER BY efficiency_percentage DESC
    `;
    
    const [rows] = await pool.execute(query, [date]);
    return rows;
  }

  async getDailyDashboardData(date) {
    // Get production plan data
    const planQuery = `
      SELECT 
        pp.work_centre_id,
        wc.name as work_centre_name,
        SUM(pp.target_pairs_per_day) as total_target,
        SUM(pp.man_hours_minutes) as total_man_hours
      FROM production_plan pp
      LEFT JOIN work_centres wc ON pp.work_centre_id = wc.id
      WHERE pp.plan_date = ?
      GROUP BY pp.work_centre_id, wc.name
    `;
    
    const [planRows] = await pool.execute(planQuery, [date]);
    
    // Get actual output by work centre
    const outputQuery = `
      SELECT 
        mc.work_centre_id,
        wc.name as work_centre_name,
        COUNT(*) as output
      FROM stitching_events se
      LEFT JOIN machine_centres mc ON se.machine_id = mc.machine_id
      LEFT JOIN work_centres wc ON mc.work_centre_id = wc.id
      WHERE DATE(se.event_time) = ? AND se.status = 1
      GROUP BY mc.work_centre_id, wc.name
    `;
    
    const [outputRows] = await pool.execute(outputQuery, [date]);
    
    // Get SMV data from line setup (assuming average SMV per work centre)
    const smvQuery = `
      SELECT 
        ls.work_centre_id,
        AVG(ls.smv_per_pair) as avg_smv
      FROM line_setup ls
      WHERE DATE(ls.login_date_time) <= ? 
      AND (ls.logout_date_time IS NULL OR DATE(ls.logout_date_time) >= ?)
      GROUP BY ls.work_centre_id
    `;
    
    const [smvRows] = await pool.execute(smvQuery, [date, date]);
    
    // Get employee count per work centre
    const employeeQuery = `
      SELECT 
        ls.work_centre_id,
        COUNT(DISTINCT ls.employee_id) as employee_count
      FROM line_setup ls
      WHERE DATE(ls.login_date_time) <= ? 
      AND (ls.logout_date_time IS NULL OR DATE(ls.logout_date_time) >= ?)
      GROUP BY ls.work_centre_id
    `;
    
    const [employeeRows] = await pool.execute(employeeQuery, [date, date]);
    
    // Combine data
    const workCentreMap = new Map();
    
    // Initialize with plan data
    planRows.forEach(plan => {
      workCentreMap.set(plan.work_centre_id, {
        work_centre_id: plan.work_centre_id,
        work_centre_name: plan.work_centre_name,
        target: plan.total_target || 0,
        output: 0,
        output_percentage: 0,
        efficiency_percentage: 0,
        man_hours: plan.total_man_hours || 0,
        smv: 0,
        employees: 0
      });
    });
    
    // Add output data
    outputRows.forEach(output => {
      const existing = workCentreMap.get(output.work_centre_id);
      if (existing) {
        existing.output = output.output;
        existing.output_percentage = existing.target > 0 ? (output.output / existing.target) * 100 : 0;
      } else {
        workCentreMap.set(output.work_centre_id, {
          work_centre_id: output.work_centre_id,
          work_centre_name: output.work_centre_name,
          target: 0,
          output: output.output,
          output_percentage: 0,
          efficiency_percentage: 0,
          man_hours: 0,
          smv: 0,
          employees: 0
        });
      }
    });
    
    // Add SMV data
    smvRows.forEach(smv => {
      const existing = workCentreMap.get(smv.work_centre_id);
      if (existing) {
        existing.smv = smv.avg_smv || 0;
      }
    });
    
    // Add employee data
    employeeRows.forEach(emp => {
      const existing = workCentreMap.get(emp.work_centre_id);
      if (existing) {
        existing.employees = emp.employee_count || 0;
        // Calculate efficiency: (Output * SMV) / (Employees * Man Hours in minutes)
        if (existing.output > 0 && existing.smv > 0 && existing.employees > 0 && existing.man_hours > 0) {
          existing.efficiency_percentage = (existing.output * existing.smv) / (existing.employees * existing.man_hours) * 100;
        }
      }
    });
    
    return Array.from(workCentreMap.values());
  }

  async getOverallDailyData(date) {
    // Get total target from production_planning
    const targetQuery = `
      SELECT SUM(pairs_per_tray) as total_target
      FROM production_planning 
      WHERE plan_date = ?
    `;
    
    const [targetRows] = await pool.execute(targetQuery, [date]);
    const totalTarget = targetRows[0]?.total_target || 0;
    
    // Get total output from machine_centre_app
    const outputQuery = `
      SELECT SUM(output_pairs) as total_output
      FROM machine_centre_app 
      WHERE prod_date = ?
    `;
    
    const [outputRows] = await pool.execute(outputQuery, [date]);
    const totalOutput = outputRows[0]?.total_output || 0;
    
    // Get average efficiency from pivot_data
    const efficiencyQuery = `
      SELECT AVG(avg_efficiency) as overall_efficiency
      FROM pivot_data 
      WHERE prod_date = ?
    `;
    
    const [efficiencyRows] = await pool.execute(efficiencyQuery, [date]);
    const overallEfficiency = efficiencyRows[0]?.overall_efficiency || 0;
    
    const outputPercentage = totalTarget > 0 ? (totalOutput / totalTarget) * 100 : 0;
    
    return {
      todays_target: totalTarget,
      output: totalOutput,
      output_percentage: outputPercentage,
      overall_efficiency_percentage: overallEfficiency
    };
  }
}

module.exports = new StitchingEventRepository();