#!/bin/bash
# Скрипт для восстановления src/pages после билда

if [ -d "src/_pages_vite" ]; then
  mv src/_pages_vite src/pages
  echo "✅ Страницы восстановлены"
else
  echo "⚠️  src/_pages_vite не найден"
fi

