#!/bin/bash

# Скрипт для настройки GitHub токена
# Запускать: bash setup-git-token.sh YOUR_TOKEN

if [ -z "$1" ]; then
    echo "❌ Ошибка: Укажите токен как аргумент"
    echo "Использование: bash setup-git-token.sh YOUR_GITHUB_TOKEN"
    exit 1
fi

GITHUB_TOKEN="$1"

echo "Настройка GitHub токена..."

# Настройка credential helper
git config --global credential.helper store

# Настройка URL с токеном для этого репозитория
git remote set-url origin https://${GITHUB_TOKEN}@github.com/sofiassokolova-art/skinplan-mini.git

echo "✅ GitHub токен настроен!"
echo "Теперь можно использовать: git push, git pull без ввода пароля"
