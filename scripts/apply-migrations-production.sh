#!/bin/bash
# Скрипт для применения миграций Prisma в продакшене

set -e

echo "🚀 Применение миграций Prisma в продакшене"
echo "=========================================="
echo ""

# Проверка наличия DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL не установлен"
    echo ""
    echo "Установите DATABASE_URL одним из способов:"
    echo "1. Экспорт переменной: export DATABASE_URL='postgresql://...'"
    echo "2. Использование Vercel CLI: vercel env pull .env.production"
    echo ""
    exit 1
fi

echo "✅ DATABASE_URL установлен"
echo ""

# Проверка статуса миграций
echo "📊 Проверка статуса миграций..."
npx prisma migrate status

echo ""
echo "🔄 Применение миграций..."
npx prisma migrate deploy

echo ""
echo "✅ Миграции применены успешно!"
echo ""
echo "📋 Проверка таблиц..."
npx prisma db execute --stdin --schema=prisma/schema.prisma <<< "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'question%' ORDER BY table_name;" 2>&1 | grep -E "question|table_name" || echo "Таблицы проверены"

echo ""
echo "🎉 Готово!"

