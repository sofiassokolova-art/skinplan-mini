# Настройка Git для автоматического push

## Текущая настройка
GitHub токен уже настроен и сохранен в конфигурации git.

## Если нужно перенастроить токен:

1. **Запустить скрипт настройки:**
   ```bash
   bash setup-git-token.sh YOUR_GITHUB_TOKEN
   ```

2. **Или настроить вручную:**
   ```bash
   git config --global credential.helper store
   git remote set-url origin https://YOUR_TOKEN@github.com/sofiassokolova-art/skinplan-mini.git
   ```

## Безопасность
⚠️ **Важно**: Никогда не коммитьте токены в код! Используйте переменные окружения или передавайте токен как аргумент.

## Проверка настройки:
```bash
git remote -v
```

## Использование:
```bash
git add .
git commit -m "your message"
git push
```

Токен будет автоматически использоваться для всех операций с GitHub.
