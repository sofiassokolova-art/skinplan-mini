#!/bin/bash
echo "📥 Скачивание переменных окружения из Vercel..."
echo ""
echo "1. Сначала войдите в Vercel:"
echo "   npx vercel login"
echo ""
echo "2. Затем привяжите проект (если нужно):"
echo "   npx vercel link"
echo ""
echo "3. Скачайте переменные:"
echo "   npx vercel env pull .env"
echo ""
echo "Или просто выполните все команды подряд:"
echo ""
read -p "Выполнить команды? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx vercel login
    npx vercel link
    npx vercel env pull .env
    echo ""
    echo "✅ Переменные окружения скачаны в .env"
else
    echo "Отменено. Выполните команды вручную."
fi
