// scripts/backup-db.ts
// Скрипт для создания бэкапа базы данных PostgreSQL

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface BackupConfig {
  databaseUrl: string;
  backupDir: string;
  maxBackups?: number; // Максимальное количество бэкапов для хранения
  compress?: boolean; // Сжимать ли бэкап
}

/**
 * Создает бэкап PostgreSQL базы данных
 */
async function createBackup(config: BackupConfig): Promise<string> {
  const { databaseUrl, backupDir, compress = true } = config;

  // Парсим DATABASE_URL
  // Формат: postgresql://user:password@host:port/database
  const url = new URL(databaseUrl);
  const host = url.hostname;
  const port = url.port || '5432';
  const database = url.pathname.slice(1); // Убираем ведущий /
  const user = url.username;
  const password = url.password;

  // Создаем директорию для бэкапов, если её нет
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Генерируем имя файла с timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFileName = `backup-${database}-${timestamp}.sql`;
  const backupPath = path.join(backupDir, backupFileName);
  const finalPath = compress ? `${backupPath}.gz` : backupPath;

  console.log(`📦 Creating backup: ${backupFileName}...`);

  try {
    // Устанавливаем переменную окружения для пароля
    process.env.PGPASSWORD = password;

    // Создаем бэкап с помощью pg_dump
    let command: string;
    if (compress) {
      command = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F c -f ${backupPath}.dump`;
    } else {
      command = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -f ${backupPath}`;
    }

    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, PGPASSWORD: password },
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    if (stderr && !stderr.includes('WARNING')) {
      console.error('⚠️ pg_dump warnings:', stderr);
    }

    // Если нужно сжать
    if (compress && !backupPath.endsWith('.dump')) {
      await execAsync(`gzip ${backupPath}`);
    }

    // Получаем размер файла
    const stats = fs.statSync(finalPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`✅ Backup created successfully: ${finalPath} (${fileSizeMB} MB)`);

    // Очищаем старые бэкапы, если указан лимит
    if (config.maxBackups) {
      await cleanupOldBackups(backupDir, config.maxBackups);
    }

    return finalPath;
  } catch (error: any) {
    console.error('❌ Error creating backup:', error.message);
    throw error;
  } finally {
    // Удаляем пароль из переменных окружения
    delete process.env.PGPASSWORD;
  }
}

/**
 * Удаляет старые бэкапы, оставляя только последние N
 */
async function cleanupOldBackups(backupDir: string, maxBackups: number): Promise<void> {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('backup-') && (file.endsWith('.sql') || file.endsWith('.sql.gz') || file.endsWith('.dump')))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        mtime: fs.statSync(path.join(backupDir, file)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // Сортируем по дате (новые первыми)

    if (files.length > maxBackups) {
      const filesToDelete = files.slice(maxBackups);
      console.log(`🗑️  Removing ${filesToDelete.length} old backup(s)...`);
      
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        console.log(`   Deleted: ${file.name}`);
      }
    }
  } catch (error: any) {
    console.warn('⚠️ Error cleaning up old backups:', error.message);
  }
}

/**
 * Восстанавливает базу данных из бэкапа
 */
async function restoreBackup(
  databaseUrl: string,
  backupPath: string
): Promise<void> {
  const url = new URL(databaseUrl);
  const host = url.hostname;
  const port = url.port || '5432';
  const database = url.pathname.slice(1);
  const user = url.username;
  const password = url.password;

  console.log(`🔄 Restoring backup: ${backupPath}...`);

  try {
    process.env.PGPASSWORD = password;

    let command: string;
    if (backupPath.endsWith('.dump')) {
      // Custom format backup
      command = `pg_restore -h ${host} -p ${port} -U ${user} -d ${database} -c -F c ${backupPath}`;
    } else if (backupPath.endsWith('.gz')) {
      // Compressed SQL backup
      command = `gunzip -c ${backupPath} | psql -h ${host} -p ${port} -U ${user} -d ${database}`;
    } else {
      // Plain SQL backup
      command = `psql -h ${host} -p ${port} -U ${user} -d ${database} -f ${backupPath}`;
    }

    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, PGPASSWORD: password },
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stderr && !stderr.includes('WARNING')) {
      console.error('⚠️ Restore warnings:', stderr);
    }

    console.log('✅ Backup restored successfully');
  } catch (error: any) {
    console.error('❌ Error restoring backup:', error.message);
    throw error;
  } finally {
    delete process.env.PGPASSWORD;
  }
}

// Main function
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
  const maxBackups = process.env.MAX_BACKUPS ? parseInt(process.env.MAX_BACKUPS, 10) : 7; // Хранить 7 бэкапов по умолчанию
  const compress = process.env.COMPRESS_BACKUP !== 'false'; // Сжимать по умолчанию

  const config: BackupConfig = {
    databaseUrl,
    backupDir,
    maxBackups,
    compress,
  };

  try {
    const backupPath = await createBackup(config);
    console.log(`\n✅ Backup completed: ${backupPath}`);
    console.log(`\n📋 To restore this backup, run:`);
    console.log(`   npm run restore-backup ${backupPath}`);
  } catch (error) {
    console.error('\n❌ Backup failed:', error);
    process.exit(1);
  }
}

// Запускаем, если скрипт вызван напрямую
if (require.main === module) {
  main();
}

export { createBackup, restoreBackup, cleanupOldBackups };

