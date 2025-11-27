// app/api/telegram/webhook/route.ts
// Webhook для Telegram бота

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { getUserIdFromTelegramId } from '@/lib/get-user-from-telegram-id';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Секретный токен опционален - используется только если установлен в переменных окружения
// Для генерации токена: node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex'))"
const TELEGRAM_SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN;
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

// Сохранение сообщения в БД
async function saveBotMessage(
  userId: string,
  telegramId: string,
  chatId: string,
  direction: 'incoming' | 'outgoing',
  messageType: 'text' | 'command' | 'callback' | 'photo' | 'document',
  content?: string,
  rawData?: any
) {
  try {
    await prisma.botMessage.create({
      data: {
        userId,
        telegramId,
        chatId,
        direction,
        messageType,
        content: content || null,
        rawData: rawData || null,
      },
    });
  } catch (error) {
    console.error('Error saving bot message:', error);
    // Не блокируем выполнение, если не удалось сохранить сообщение
  }
}

// Отправка сообщения через Telegram Bot API
async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: any,
  userId?: string
) {
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
    
    // Сохраняем исходящее сообщение в БД
    if (userId && result.ok && result.result) {
      await saveBotMessage(
        userId,
        result.result.message_id.toString(),
        chatId.toString(),
        'outgoing',
        'text',
        text,
        result
      );
    }
    
    console.log('Message sent successfully:', result.ok);
    return result;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // ВАЖНО: Webhook должен быть доступен без аутентификации, так как Telegram отправляет запросы напрямую
    // Проверка секретного токена опциональна и выполняется только если токен явно установлен
    // Если нужна дополнительная безопасность, используйте секретный токен через TELEGRAM_SECRET_TOKEN
    
    if (!TELEGRAM_BOT_TOKEN) {
      console.error('❌ TELEGRAM_BOT_TOKEN не настроен');
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    const update: TelegramUpdate = await request.json();
    console.log('📥 Получено обновление от Telegram:', {
      updateId: update.update_id,
      hasMessage: !!update.message,
      messageText: update.message?.text,
      chatId: update.message?.chat?.id,
      fromId: update.message?.from?.id,
      fromUsername: update.message?.from?.username,
    });

    // Сохраняем входящее сообщение в БД и создаем чат поддержки
    if (update.message && !update.message.from.is_bot) {
      const telegramId = update.message.from.id;
      const userId = await getUserIdFromTelegramId(telegramId, {
        firstName: update.message.from.first_name,
        lastName: update.message.from.last_name,
        username: update.message.from.username,
        languageCode: update.message.from.language_code,
      });

      if (userId) {
        const messageType = update.message.text?.startsWith('/') ? 'command' : 'text';
        await saveBotMessage(
          userId,
          update.message.message_id.toString(),
          update.message.chat.id.toString(),
          'incoming',
          messageType,
          update.message.text || undefined,
          update.message
        );

        // Если это не команда, создаем/обновляем чат поддержки и отправляем автоответ
        if (messageType === 'text' && update.message.text) {
          try {
            // Ищем существующий активный чат
            let chat = await prisma.supportChat.findFirst({
              where: {
                userId,
                status: { in: ['active', 'open'] },
              },
            });

            // Если чата нет, создаем новый
            if (!chat) {
              chat = await prisma.supportChat.create({
                data: {
                  userId,
                  lastMessage: update.message.text,
                  unread: 0,
                  status: 'active',
                  autoReplySent: false, // Новое обращение - автоответ еще не отправлен
                },
              });
            }

            // Сохраняем сообщение в SupportMessage
            await prisma.supportMessage.create({
              data: {
                chatId: chat.id,
                text: update.message.text,
                isAdmin: false,
              },
            });

            // Обновляем чат
            await prisma.supportChat.update({
              where: { id: chat.id },
              data: {
                lastMessage: update.message.text,
                unread: { increment: 1 }, // Увеличиваем счетчик непрочитанных для админа
                updatedAt: new Date(),
              },
            });

            console.log(`✅ Support chat created/updated for user ${userId}`);

            // Отправляем автоответ ТОЛЬКО если он еще не был отправлен для этого обращения
            if (!chat.autoReplySent) {
              try {
                const now = new Date();
                // Получаем время в МСК
                const moscowTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
                const hour = moscowTime.getHours();
                const day = moscowTime.getDay(); // 0 = воскресенье, 6 = суббота
                const isWeekend = day === 0 || day === 6;

                let autoReplyText = '';

                if (hour < 9 || hour >= 18 || isWeekend) {
                  // Нерабочее время
                  autoReplyText = `Привет! Сейчас за пределами рабочего времени

Поддержка работает с 9:00 до 18:00 по МСК в будние дни.

Ваше сообщение сохранено — ответим сразу, как только выйдем онлайн (ближайшее время — завтра с 9 утра).

Хорошего вечера/выходных!`;
                } else {
                  // Рабочее время
                  autoReplyText = `Привет! Это поддержка SkinIQ

Сейчас мы онлайн и скоро ответим

Работаем с 9:00 до 18:00 по МСК в будние дни.

По вечерам и выходным отвечаем чуть медленнее, но обязательно читаем все сообщения и вернёмся к вам в рабочее время.

Спасибо за терпение!`;
                }

                // Отправляем автоответ
                const autoReplyResult = await sendMessage(
                  update.message.chat.id,
                  autoReplyText,
                  undefined,
                  userId
                );

                // Сохраняем автоответ в SupportMessage и помечаем, что автоответ отправлен
                if (autoReplyResult.ok && autoReplyResult.result) {
                  await prisma.supportMessage.create({
                    data: {
                      chatId: chat.id,
                      text: autoReplyText,
                      isAdmin: true,
                    },
                  });

                  // Помечаем, что автоответ отправлен
                  await prisma.supportChat.update({
                    where: { id: chat.id },
                    data: {
                      autoReplySent: true,
                    },
                  });
                }

                console.log(`✅ Auto-reply sent to user ${userId}`);
              } catch (autoReplyError) {
                console.error('Error sending auto-reply:', autoReplyError);
                // Не блокируем выполнение, если автоответ не отправился
              }
            } else {
              console.log(`ℹ️ Auto-reply already sent for chat ${chat.id}, skipping`);
            }
          } catch (error) {
            console.error('Error creating support chat:', error);
            // Не блокируем выполнение, если не удалось создать чат
          }
        }
      }
    }

    // Обработка команды /start
    if (update.message?.text && (update.message.text === '/start' || update.message.text.startsWith('/start'))) {
      const chatId = update.message.chat.id;
      const firstName = update.message.from.first_name || 'друг';
      const telegramId = update.message.from.id;
      
      // Получаем userId для сохранения исходящего сообщения
      const userId = await getUserIdFromTelegramId(telegramId, {
        firstName: update.message.from.first_name,
        lastName: update.message.from.last_name,
        username: update.message.from.username,
        languageCode: update.message.from.language_code,
      });

      console.log(`📨 Processing /start command from user ${firstName} (chatId: ${chatId})`);
      console.log(`🌐 Mini App URL: ${MINI_APP_URL}`);
      console.log(`🤖 Bot Token configured: ${!!TELEGRAM_BOT_TOKEN}`);
      console.log(`🔑 Bot Token length: ${TELEGRAM_BOT_TOKEN?.length || 0}`);

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
        console.log(`📝 Message text length: ${welcomeText.length}`);
        console.log(`🔘 Reply markup:`, JSON.stringify(replyMarkup));
        
        const result = await sendMessage(chatId, welcomeText, replyMarkup, userId || undefined);
        
        console.log(`✅ Welcome message sent successfully to chat ${chatId}:`, {
          ok: result.ok,
          messageId: result.result?.message_id,
          chatId: result.result?.chat?.id,
        });
      } catch (error: any) {
        console.error(`❌ Failed to send welcome message to chat ${chatId}:`, error);
        console.error(`   Error message:`, error.message);
        console.error(`   Error stack:`, error.stack);
        console.error(`   Error response:`, error.response);
        
        // Пытаемся отправить простое сообщение без кнопки
        try {
          const simpleText = `👋 Привет, ${firstName}!\n\nДобро пожаловать в SkinIQ!\n\nОткройте приложение по ссылке: ${MINI_APP_URL}`;
          await sendMessage(chatId, simpleText);
          console.log(`✅ Fallback message sent successfully`);
        } catch (fallbackError: any) {
          console.error(`❌ Failed to send fallback message:`, fallbackError);
        }
      }
      
      return NextResponse.json({ ok: true, processed: 'start_command' });
    }

    // Обработка команды /admin
    else if (update.message?.text === '/admin') {
      const chatId = update.message.chat.id;
      const telegramId = update.message.from.id;
      
      // Проверяем, есть ли пользователь в whitelist
      const isAdmin = await prisma.adminWhitelist.findFirst({
        where: {
          OR: [
            { telegramId: telegramId.toString() },
            { phoneNumber: update.message.from.id.toString() },
          ],
          isActive: true,
        },
      });

      if (!isAdmin) {
        const errorText = `❌ <b>Доступ запрещён</b>\n\nВы не в списке администраторов.`;
        try {
          await sendMessage(chatId, errorText);
        } catch (error: any) {
          console.error(`❌ Failed to send admin error message:`, error);
        }
        return NextResponse.json({ ok: true, processed: 'admin_command_denied' });
      }

      const adminText = `🔐 <b>Вход в админ-панель</b>\n\nНажмите на кнопку ниже, чтобы открыть админ-панель:`;

      const replyMarkup = {
        inline_keyboard: [
          [
            {
              text: '🚀 Открыть админку',
              web_app: { url: MINI_APP_URL + '/admin' },
            },
          ],
        ],
      };

      try {
        await sendMessage(chatId, adminText, replyMarkup);
        console.log(`✅ Admin command processed for chat ${chatId}`);
      } catch (error: any) {
        console.error(`❌ Failed to send admin message:`, error);
      }
      
      return NextResponse.json({ ok: true, processed: 'admin_command' });
    }

    // Обработка команды /help
    else if (update.message?.text === '/help') {
      const chatId = update.message.chat.id;
      const telegramId = update.message.from.id;
      const userId = await getUserIdFromTelegramId(telegramId, {
        firstName: update.message.from.first_name,
        lastName: update.message.from.last_name,
        username: update.message.from.username,
        languageCode: update.message.from.language_code,
      });
      const helpText = `📖 <b>Помощь по SkinIQ</b>

<b>Команды:</b>
/start - Начать работу с ботом
/help - Показать эту справку

<b>Что дальше?</b>
Нажмите на кнопку "Открыть SkinIQ" в сообщении /start, чтобы открыть мини-приложение и начать пользоваться всеми возможностями SkinIQ!`;

      try {
        await sendMessage(chatId, helpText, undefined, userId || undefined);
        console.log(`✅ Help message sent to chat ${chatId}`);
      } catch (error: any) {
        console.error(`❌ Failed to send help message:`, error);
      }
      
      return NextResponse.json({ ok: true, processed: 'help_command' });
    }

    // Если это сообщение, но не команда - логируем для отладки
    if (update.message) {
      console.log(`📩 Received message (not a command):`, {
        text: update.message.text,
        chatId: update.message.chat.id,
        fromId: update.message.from.id,
      });
    }

    return NextResponse.json({ ok: true, processed: 'none' });
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

    console.log('🔧 Setting webhook:', {
      webhookUrl,
      hasSecretToken: !!secretToken,
      origin: request.nextUrl.origin,
    });

    try {
      const url = new URL(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`);
      url.searchParams.set('url', webhookUrl);
      if (secretToken && secretToken !== 'not-set') {
        url.searchParams.set('secret_token', secretToken);
      }
      url.searchParams.set('allowed_updates', JSON.stringify(['message']));

      console.log('📡 Sending setWebhook request to Telegram API...');
      const response = await fetch(url.toString(), { method: 'GET' });
      const data = await response.json();
      
      console.log('📊 Telegram API response:', {
        ok: data.ok,
        description: data.description,
        error_code: data.error_code,
      });
      
      return NextResponse.json(data);
    } catch (error: any) {
      console.error('❌ Error setting webhook:', error);
      return NextResponse.json(
        { error: 'Failed to set webhook', details: error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ message: 'Telegram webhook endpoint. Use ?action=check or ?action=set-webhook' });
}

