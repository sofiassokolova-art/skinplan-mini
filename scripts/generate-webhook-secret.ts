// scripts/generate-webhook-secret.ts
// Генерация секретного токена для Telegram webhook

import crypto from 'crypto';

const secret = crypto.randomBytes(32).toString('hex');

console.log('='.repeat(60));
console.log('🔐 Секретный токен для Telegram webhook:');
console.log('='.repeat(60));
console.log(secret);
console.log('='.repeat(60));
console.log('\n📝 Добавьте эту переменную в Vercel:');
console.log('   Имя: TELEGRAM_SECRET_TOKEN');
console.log('   Значение: (скопируйте строку выше)');
console.log('\n💡 Затем переустановите webhook:');
console.log('   https://skinplan-mini.vercel.app/api/telegram/webhook?action=set-webhook');
console.log('='.repeat(60));

