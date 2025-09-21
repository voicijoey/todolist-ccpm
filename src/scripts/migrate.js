const Database = require('../models/database');

async function runMigrations() {
  const db = new Database();

  try {
    await db.connect();
    await db.migrate();
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;