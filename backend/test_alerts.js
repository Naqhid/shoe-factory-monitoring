const db = require('./config/database');
const { runChecks: runAlertChecks } = require('./src/controllers/alertController');

async function testAlerts() {
  try {
    console.log('Testing alert generation...');
    const today = new Date().toISOString().split('T')[0];
    console.log('Running checks for date:', today);
    
    // Check if there's efficiency data for today
    const [effData] = await db.execute(`
      SELECT work_centre_id, machine_id, avg_efficiency_percent
      FROM machine_centre_summary 
      WHERE prod_date = ?
      ORDER BY avg_efficiency_percent
    `, [today]);
    
    console.log('Efficiency data for today:', effData.length, 'records');
    effData.forEach(row => {
      console.log(`  WC ${row.work_centre_id}, Machine ${row.machine_id}: ${row.avg_efficiency_percent}%`);
    });
    
    // Run alert checks
    const generated = await runAlertChecks(today);
    console.log('Alerts generated:', generated);
    
    // Check what alerts were created
    const [alerts] = await db.execute(`
      SELECT alert_type, severity, work_centre_id, machine_id, message, created_at
      FROM production_alerts 
      WHERE alert_date = ?
      ORDER BY created_at DESC
    `, [today]);
    
    console.log('Total alerts for today:', alerts.length);
    alerts.forEach(alert => {
      console.log(`  ${alert.alert_type} (${alert.severity}): ${alert.message}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testAlerts();
