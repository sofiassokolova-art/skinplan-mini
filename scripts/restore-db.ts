// scripts/restore-db.ts
// Скрипт для восстановления базы данных из бэкапа

import { restoreBackup } from './backup-db';

async function main() {
  const backupPath = process.argv[2];
  
  if (!backupPath) {
    console.error('❌ Usage: npm run restore:db <backup-path>');
    console.error('   Example: npm run restore:db backups/backup-skinplan-2025-01-15T10-30-00.sql.gz');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('⚠️  WARNING: This will overwrite the current database!');
  console.log(`   Backup: ${backupPath}`);
  console.log(`   Database: ${new URL(databaseUrl).pathname.slice(1)}`);
  console.log('\n   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  // Даем 5 секунд на отмену
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    await restoreBackup(databaseUrl, backupPath);
    console.log('\n✅ Database restored successfully');
  } catch (error) {
    console.error('\n❌ Restore failed:', error);
    process.exit(1);
  }
}

main();

