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

  async getOverallEfficiency(date) {
    const query = `
      SELECT 
        COUNT(DISTINCT machine_id) as total_machines,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as total_run_minutes,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as total_idle_minutes,
        COUNT(*) as total_events,
        COALESCE(
          ROUND(
            (SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100, 2
          ), 0
        ) as overall_efficiency
      FROM stitching_events
      WHERE DATE(event_time) = ?
    `;
    
    const [rows] = await pool.execute(query, [date]);
    const result = rows[0];
    
    // Return default values if no data
    return {
      total_machines: result.total_machines || 0,
      total_run_minutes: result.total_run_minutes || 0,
      total_idle_minutes: result.total_idle_minutes || 0,
      total_events: result.total_events || 0,
      overall_efficiency: result.overall_efficiency || 0
    };
  }
}

module.exports = new StitchingEventRepository();