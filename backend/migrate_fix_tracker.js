const db = require('./config/database');

async function runMigration() {
    try {
        console.log('Starting migration: Adding missing columns to prod_data...');

        // Check if columns already exist
        const [columns] = await db.execute('SHOW COLUMNS FROM prod_data');
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('target_pairs')) {
            console.log('Adding target_pairs column...');
            await db.execute('ALTER TABLE prod_data ADD COLUMN target_pairs INT DEFAULT 0 AFTER output_pairs');
        } else {
            console.log('target_pairs column already exists.');
        }

        if (!columnNames.includes('stoppage_reason')) {
            console.log('Adding stoppage_reason column...');
            await db.execute('ALTER TABLE prod_data ADD COLUMN stoppage_reason VARCHAR(255) NULL AFTER actual_time');
        } else {
            console.log('stoppage_reason column already exists.');
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
