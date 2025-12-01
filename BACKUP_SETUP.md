# Настройка автоматических бэкапов БД

## 📦 Ручной бэкап

### Создание бэкапа

```bash
npm run backup:db
```

Скрипт создаст бэкап в директории `backups/` (по умолчанию) с именем вида:
`backup-{database}-{timestamp}.sql.gz`

### Восстановление из бэкапа

```bash
npm run restore:db backups/backup-skinplan-2025-01-15T10-30-00.sql.gz
```

⚠️ **ВНИМАНИЕ**: Восстановление перезапишет текущую базу данных!

## ⚙️ Переменные окружения

Добавьте в `.env` или настройте в Vercel:

```env
# Обязательно
DATABASE_URL="postgresql://user:password@host:port/database"

# Опционально
BACKUP_DIR="./backups"              # Директория для бэкапов (по умолчанию: ./backups)
MAX_BACKUPS=7                       # Количество бэкапов для хранения (по умолчанию: 7)
COMPRESS_BACKUP=true                 # Сжимать ли бэкап (по умолчанию: true)
```

## 🤖 Автоматические бэкапы

### Вариант 1: Vercel Cron Jobs (рекомендуется)

1. Создайте файл `vercel.json` (если его нет) или обновите существующий:

```json
{
  "crons": [
    {
      "path": "/api/cron/backup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

2. Создайте API route `app/api/cron/backup/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createBackup } from '@/scripts/backup-db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // Проверяем секретный ключ для безопасности
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not set');
    }

    const backupDir = process.env.BACKUP_DIR || './backups';
    const maxBackups = process.env.MAX_BACKUPS ? parseInt(process.env.MAX_BACKUPS, 10) : 7;

    const backupPath = await createBackup({
      databaseUrl,
      backupDir,
      maxBackups,
      compress: true,
    });

    return NextResponse.json({
      success: true,
      backupPath,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

3. Добавьте `CRON_SECRET` в переменные окружения Vercel

4. Расписание: `0 2 * * *` = каждый день в 2:00 UTC

### Вариант 2: GitHub Actions

Создайте `.github/workflows/backup.yml`:

```yaml
name: Database Backup

on:
  schedule:
    - cron: '0 2 * * *'  # Каждый день в 2:00 UTC
  workflow_dispatch:     # Ручной запуск

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Create backup
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          BACKUP_DIR: ./backups
          MAX_BACKUPS: 7
        run: npm run backup:db
      
      - name: Upload backup to artifact
        uses: actions/upload-artifact@v3
        with:
          name: database-backup
          path: backups/*.sql.gz
          retention-days: 30
```

### Вариант 3: Локальный cron (для собственного сервера)

Добавьте в crontab (`crontab -e`):

```bash
# Бэкап каждый день в 2:00
0 2 * * * cd /path/to/skinplan-mini && npm run backup:db >> /var/log/db-backup.log 2>&1
```

## 📤 Загрузка бэкапов в облачное хранилище

### AWS S3

Добавьте в скрипт бэкапа после создания:

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async function uploadToS3(backupPath: string) {
  const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  const fileContent = fs.readFileSync(backupPath);
  const fileName = path.basename(backupPath);

  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BACKUP_BUCKET,
    Key: `backups/${fileName}`,
    Body: fileContent,
  }));

  console.log(`✅ Uploaded to S3: s3://${process.env.AWS_S3_BACKUP_BUCKET}/backups/${fileName}`);
}
```

### Google Cloud Storage

Аналогично можно использовать GCS или любой другой S3-совместимый сервис.

## 🔍 Мониторинг бэкапов

Рекомендуется настроить уведомления о:
- Успешных бэкапах (опционально)
- Ошибках бэкапа (обязательно)
- Размере бэкапов (для контроля роста)

Можно использовать:
- Vercel Logs
- Sentry
- Email уведомления
- Telegram бот

## 📊 Рекомендации

1. **Частота бэкапов**: 
   - Production: ежедневно
   - Staging: еженедельно

2. **Хранение**:
   - Локально: последние 7 бэкапов
   - Облако: последние 30 дней

3. **Тестирование восстановления**:
   - Тестируйте восстановление на staging окружении
   - Проверяйте целостность данных после восстановления

4. **Безопасность**:
   - Храните бэкапы в зашифрованном виде
   - Ограничьте доступ к бэкапам
   - Не храните бэкапы в репозитории

