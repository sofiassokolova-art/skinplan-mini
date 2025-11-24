// app/api/telegram/webhook/route.ts
// Webhook для Telegram бота

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN || crypto.randomBytes(16).toString('hex');
const MINI_APP_URL = process.env.NEXT_PUBLIC_MINI_APP_URL || 'https://skinplan-mini.vercel.app';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
    entities?: Array<{
      offset: number;
      length: number;
      type: string;
    }>;
  };
}

// Отправка сообщения через Telegram Bot API
async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Telegram API error:', error);
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Проверка секретного токена (опционально, но рекомендуется)
    const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
    if (TELEGRAM_SECRET_TOKEN && secretToken !== TELEGRAM_SECRET_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const update: TelegramUpdate = await request.json();

    // Обработка команды /start
    if (update.message?.text === '/start' || update.message?.text?.startsWith('/start')) {
      const chatId = update.message.chat.id;
      const firstName = update.message.from.first_name;
      const username = update.message.from.username;

      const welcomeText = `👋 Привет, ${firstName}!

Добро пожаловать в <b>SkinIQ</b> — ваш персональный помощник по уходу за кожей!

✨ <b>Что умеет SkinIQ:</b>
• 📋 Анализ вашей кожи через анкету
• 🎯 Персональные рекомендации по уходу
• 📅 Ежедневный план ухода
• 💡 Советы от экспертов

Нажмите на кнопку ниже, чтобы начать:`;

      const replyMarkup = {
        inline_keyboard: [
          [
            {
              text: '🚀 Открыть SkinIQ',
              web_app: { url: MINI_APP_URL },
            },
          ],
        ],
      };

      await sendMessage(chatId, welcomeText, replyMarkup);
    }

    // Обработка других команд (можно расширить)
    else if (update.message?.text === '/help') {
      const chatId = update.message.chat.id;
      const helpText = `📖 <b>Помощь по SkinIQ</b>

<b>Команды:</b>
/start - Начать работу с ботом
/help - Показать эту справку

<b>Что дальше?</b>
Нажмите на кнопку "Открыть SkinIQ" в сообщении /start, чтобы открыть мини-приложение и начать пользоваться всеми возможностями SkinIQ!`;

      await sendMessage(chatId, helpText);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET для установки webhook (можно использовать отдельно)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action');

  if (action === 'set-webhook' && TELEGRAM_BOT_TOKEN) {
    const webhookUrl = searchParams.get('url') || `${request.nextUrl.origin}/api/telegram/webhook`;
    const secretToken = TELEGRAM_SECRET_TOKEN;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}&secret_token=${secretToken}`,
        { method: 'GET' }
      );

      const data = await response.json();
      return NextResponse.json(data);
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to set webhook' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ message: 'Telegram webhook endpoint' });
}

