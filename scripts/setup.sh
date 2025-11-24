#!/bin/bash
# Скрипт для быстрой настройки проекта

echo "🚀 Настройка SkinIQ Next.js проекта..."
echo ""

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Установите Node.js 18+ и попробуйте снова."
    exit 1
fi

echo "✅ Node.js найден: $(node --version)"

# Установка зависимостей
echo ""
echo "📦 Установка зависимостей Next.js..."
npm install next@latest @prisma/client jsonwebtoken --save
npm install prisma @types/jsonwebtoken tsx --save-dev

# Проверка .env файла
echo ""
if [ ! -f .env ]; then
    echo "📝 Создание .env файла..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ .env файл создан из .env.example"
        echo "⚠️  ВАЖНО: Заполните DATABASE_URL и TELEGRAM_BOT_TOKEN в .env файле!"
    else
        cat > .env << EOL
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/skiniq?schema=public"

# Telegram Bot Token
TELEGRAM_BOT_TOKEN="your_bot_token_here"

# JWT Secret
JWT_SECRET="$(openssl rand -hex 32)"

# Environment
NODE_ENV="development"
EOL
        echo "✅ .env файл создан"
        echo "⚠️  ВАЖНО: Заполните DATABASE_URL и TELEGRAM_BOT_TOKEN в .env файле!"
    fi
else
    echo "✅ .env файл уже существует"
fi

# Генерация Prisma Client
echo ""
echo "🔧 Генерация Prisma Client..."
npx prisma generate

echo ""
echo "✅ Настройка завершена!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Заполните DATABASE_URL в .env (получите на https://neon.tech)"
echo "2. Заполните TELEGRAM_BOT_TOKEN в .env (получите у @BotFather)"
echo "3. Выполните: npm run db:push"
echo "4. Выполните: npm run seed:all"
echo "5. Запустите: npm run dev"
echo ""
