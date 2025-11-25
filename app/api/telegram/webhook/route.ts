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
    throw new Error('TELEGRAM_BOT_TOKEN not configured');
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
      console.error('Telegram API error:', response.status, error);
      throw new Error(`Telegram API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log('Message sent successfully:', result.ok);
    return result;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Проверка секретного токена (опционально, но рекомендуется)
    // Только если TELEGRAM_SECRET_TOKEN установлен - проверяем его
    const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
    if (TELEGRAM_SECRET_TOKEN && TELEGRAM_SECRET_TOKEN !== 'not-set' && secretToken !== TELEGRAM_SECRET_TOKEN) {
      console.warn('⚠️ Неверный секретный токен вебхука');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!TELEGRAM_BOT_TOKEN) {
      console.error('❌ TELEGRAM_BOT_TOKEN не настроен');
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    const update: TelegramUpdate = await request.json();
    console.log('📥 Получено обновление от Telegram:', update.update_id);

    // Обработка команды /start
    if (update.message?.text === '/start' || update.message?.text?.startsWith('/start')) {
      const chatId = update.message.chat.id;
      const firstName = update.message.from.first_name || 'друг';

      console.log(`📨 Processing /start command from user ${firstName} (chatId: ${chatId})`);
      console.log(`🌐 Mini App URL: ${MINI_APP_URL}`);
      console.log(`🤖 Bot Token configured: ${!!TELEGRAM_BOT_TOKEN}`);

      const welcomeText = `👋 Привет, ${firstName}!

Добро пожаловать в <b>SkinIQ</b> — ваш персональный помощник по уходу за кожей!

✨ <b>Что умеет SkinIQ:</b>
• 📋 Анализ вашей кожи через анкету
• 🎯 Персональные рекомендации по уходу
• 📅 Ежедневный план ухода на 12 недель
• 💡 Советы от экспертов-дерматологов
• 📸 Фото-анализ состояния кожи с помощью ИИ

<b>🎁 Начните прямо сейчас!</b>
Пройти анкету займёт всего 5 минут, и вы получите персонализированный план ухода, подобранный специально для вашей кожи.

Нажмите на кнопку ниже, чтобы открыть приложение:`;

      const replyMarkup = {
        inline_keyboard: [
          [
            {
              text: '🚀 Открыть SkinIQ Mini App',
              web_app: { url: MINI_APP_URL },
            },
          ],
        ],
      };

      try {
        console.log(`📤 Sending welcome message to chat ${chatId}...`);
        const result = await sendMessage(chatId, welcomeText, replyMarkup);
        console.log(`✅ Welcome message sent successfully to chat ${chatId}:`, result.ok);
      } catch (error: any) {
        console.error(`❌ Failed to send welcome message to chat ${chatId}:`, error);
        console.error(`   Error details:`, error.message || error);
        // Все равно возвращаем успех, чтобы Telegram не повторял запрос
      }
      
      return NextResponse.json({ ok: true });
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

// GET для установки и проверки webhook
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action');

  console.log('🔍 GET webhook request:', { action, url: request.url });

  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not configured');
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_TOKEN not configured' },
      { status: 500 }
    );
  }

  // Проверка статуса вебхука
  if (action === 'check') {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`,
        { method: 'GET' }
      );
      const data = await response.json();
      return NextResponse.json(data);
    } catch (error: any) {
      return NextResponse.json(
        { error: 'Failed to check webhook', details: error.message },
        { status: 500 }
      );
    }
  }

  // Установка вебхука
  if (action === 'set-webhook') {
    const webhookUrl = searchParams.get('url') || `${request.nextUrl.origin}/api/telegram/webhook`;
    const secretToken = TELEGRAM_SECRET_TOKEN;

    try {
      const url = new URL(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`);
      url.searchParams.set('url', webhookUrl);
      if (secretToken) {
        url.searchParams.set('secret_token', secretToken);
      }
      url.searchParams.set('allowed_updates', JSON.stringify(['message']));

      const response = await fetch(url.toString(), { method: 'GET' });
      const data = await response.json();
      return NextResponse.json(data);
    } catch (error: any) {
      return NextResponse.json(
        { error: 'Failed to set webhook', details: error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ message: 'Telegram webhook endpoint. Use ?action=check or ?action=set-webhook' });
}

