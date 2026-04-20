// Manual backup script
require('dotenv').config();
const { runBackup } = require('./src/services/backupService');

console.log('Starting manual database backup...');
runBackup();
