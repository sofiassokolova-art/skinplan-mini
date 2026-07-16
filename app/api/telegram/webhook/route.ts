// Webhook для Telegram бота

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromTelegramId } from '@/lib/get-user-from-telegram-id';
import { verifyAdmin } from '@/lib/admin-auth';
import { timingSafeEqual } from '@/lib/timing-safe';
import {
  CARE_REMINDER_SETUP_CONFIRM_TYPE,
  formatCareReminderSettingsSummary,
  parseCareReminderCallback,
  withCareReminderSettings,
} from '@/lib/care-reminders';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Секретный токен опционален - используется только если установлен в переменных окружения
// Для генерации токена: node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex'))"
const TELEGRAM_SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN;
/** Секрет для установки webhook без входа в админку (curl / CI). Задайте WEBHOOK_SET_SECRET в Cloudflare. */
const WEBHOOK_SET_SECRET = process.env.WEBHOOK_SET_SECRET;
const MINI_APP_URL = process.env.NEXT_PUBLIC_MINI_APP_URL || 'https://skinplan-mini.vercel.app';

interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
        type: string;
      };
      text?: string;
    };
    data?: string;
  };
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

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  if (!TELEGRAM_BOT_TOKEN) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: false,
      }),
    });
    if (!response.ok) {
      const error = await response.text().catch(() => '');
      console.error('Telegram answerCallbackQuery error:', response.status, error);
    }
  } catch (error) {
    console.error('Error answering callback query:', error);
  }
}

async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: any,
) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured');
  }

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => '');
    throw new Error(`Telegram editMessageText error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function POST(request: NextRequest) {
  let update: TelegramUpdate | null = null;
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      console.error('❌ TELEGRAM_BOT_TOKEN не настроен');
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    // Если задан TELEGRAM_SECRET_TOKEN — проверяем заголовок ОБЯЗАТЕЛЬНО
    const headerToken = request.headers.get('x-telegram-bot-api-secret-token');
    if (TELEGRAM_SECRET_TOKEN && TELEGRAM_SECRET_TOKEN !== 'not-set') {
      if (!headerToken) {
        console.warn('⚠️ Webhook: отсутствует X-Telegram-Bot-Api-Secret-Token');
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (!timingSafeEqual(TELEGRAM_SECRET_TOKEN, headerToken)) {
        console.warn('⚠️ Webhook: неверный X-Telegram-Bot-Api-Secret-Token');
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    update = await request.json() as TelegramUpdate;
    if (!update) {
      return NextResponse.json({ ok: false, error: 'Empty update' }, { status: 200 });
    }
    console.log('📥 Получено обновление от Telegram:', {
      updateId: update.update_id,
      hasMessage: !!update.message,
      hasCallback: !!update.callback_query,
      messageText: update.message?.text,
      callbackData: update.callback_query?.data,
      chatId: update.message?.chat?.id,
      fromId: update.message?.from?.id,
      fromUsername: update.message?.from?.username,
    });

    // Сохраняем входящее сообщение в БД и создаем чат поддержки (не блокируем обработку команд при ошибке)
    if (update.message && !update.message.from.is_bot) {
      try {
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
                  autoReplyText = `Привет! Поддержка на связи с 9:00 до 18:00 по МСК в будни. Мы сохранили ваше сообщение и ответим в ближайшее рабочее время.

${isWeekend ? 'Хороших выходных!' : 'Хорошего вечера!'}`;
                } else {
                  // Рабочее время
                  autoReplyText = `Привет! Это поддержка skiniq.

Мы онлайн и ответим в течение рабочего дня (9:00–18:00 МСК, будни).`;
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
      } catch (dbError) {
        console.error('Error saving message or support chat (continuing to process commands):', dbError);
      }
    }

    const reminderOption = parseCareReminderCallback(update.callback_query?.data);
    if (update.callback_query && reminderOption) {
      const callback = update.callback_query;
      const chatId = callback.message?.chat.id ?? callback.from.id;
      const telegramId = callback.from.id;

      const userId = await getUserIdFromTelegramId(telegramId, {
        firstName: callback.from.first_name,
        lastName: callback.from.last_name,
        username: callback.from.username,
        languageCode: callback.from.language_code,
      });

      if (!userId) {
        await answerCallbackQuery(callback.id, 'Не удалось сохранить настройки');
        return NextResponse.json({ ok: true, processed: 'care_reminder_callback_error' });
      }

      await saveBotMessage(
        userId,
        callback.id,
        chatId.toString(),
        'incoming',
        'callback',
        callback.data,
        callback,
      );

      const preferences = await prisma.userPreferences.findUnique({
        where: { userId },
        select: { extra: true },
      });
      const extra = withCareReminderSettings(preferences?.extra, reminderOption.settings, 'telegram');

      await prisma.userPreferences.upsert({
        where: { userId },
        create: { userId, extra: extra as any },
        update: { extra: extra as any },
      });

      const summary = formatCareReminderSettingsSummary(reminderOption.settings);
      const confirmText = reminderOption.settings.enabled
        ? `Готово, буду напоминать ${summary} по МСК.`
        : 'Готово, ежедневные напоминания выключены.';
      const finalText = `${confirmText}\n\nИзменить время можно в профиле.`;
      const replyMarkup = {
        inline_keyboard: [[{ text: 'Открыть план', web_app: { url: MINI_APP_URL + '/plan' } }]],
      };

      await answerCallbackQuery(callback.id, 'Настройки сохранены');

      try {
        if (callback.message?.message_id) {
          await editMessageText(chatId, callback.message.message_id, finalText, replyMarkup);
        } else {
          await sendMessage(chatId, finalText, replyMarkup, userId);
        }
      } catch (error) {
        console.error('Failed to edit care reminder setup message:', error);
        await sendMessage(chatId, finalText, replyMarkup, userId);
      }

      await prisma.botMessage.create({
        data: {
          userId,
          telegramId: telegramId.toString(),
          chatId: chatId.toString(),
          direction: 'outgoing',
          messageType: CARE_REMINDER_SETUP_CONFIRM_TYPE,
          content: finalText,
          rawData: {
            callbackData: callback.data,
            optionId: reminderOption.id,
          },
        },
      }).catch((error) => console.error('Error saving care reminder setup confirmation:', error));

      return NextResponse.json({ ok: true, processed: 'care_reminder_callback' });
    }

    if (update.callback_query) {
      await answerCallbackQuery(update.callback_query.id);
      return NextResponse.json({ ok: true, processed: 'callback_ignored' });
    }

    // Обработка команды /start
    if (update.message?.text && (update.message.text === '/start' || update.message.text.startsWith('/start'))) {
      const chatId = update.message.chat.id;
      const firstName = update.message.from.first_name || 'друг';
      const telegramId = update.message.from.id;
      
      let userId: string | null = null;
      try {
        userId = await getUserIdFromTelegramId(telegramId, {
          firstName: update.message.from.first_name,
          lastName: update.message.from.last_name,
          username: update.message.from.username,
          languageCode: update.message.from.language_code,
        });
      } catch (e) {
        console.error('getUserIdFromTelegramId failed (will still send welcome):', e);
      }

      console.log(`📨 Processing /start command from user ${firstName} (chatId: ${chatId})`);
      console.log(`🌐 Mini App URL: ${MINI_APP_URL}`);
      console.log(`🤖 Bot Token configured: ${!!TELEGRAM_BOT_TOKEN}`);
      console.log(`🔑 Bot Token length: ${TELEGRAM_BOT_TOKEN?.length || 0}`);

      const welcomeText = `Добро пожаловать в <b>skiniq</b> — вашего помощника в уходе за кожей!

Что умеет <b>skiniq</b>:
• Составляет персональный план ухода под вашу кожу
• Помогает отслеживать прогресс
• Опирается на рекомендации дерматологов

Анкета займёт 5 минут — и вы получите план ухода, собранный именно под вашу кожу.

💚 Доступ на 28 дней <b>всего за 199 ₽</b>.

Нажмите на кнопку ниже, чтобы открыть приложение:`;

      const replyMarkup = {
        inline_keyboard: [
          [
            {
              text: 'skiniq',
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
        
        // Fallback: то же приветствие, но с кнопкой открытия Mini App (без ссылки в тексте)
        try {
          const fallbackText = `Добро пожаловать в <b>skiniq</b> — вашего помощника в уходе за кожей!\n\nЧто умеет <b>skiniq</b>:\n• Составляет персональный план ухода под вашу кожу\n• Помогает отслеживать прогресс\n• Опирается на рекомендации дерматологов\n\nАнкета займёт 5 минут — и вы получите план ухода, собранный именно под вашу кожу.\n\n💚 Доступ на 28 дней <b>всего за 199 ₽</b>.\n\nНажмите на кнопку ниже, чтобы открыть приложение:`;
          const fallbackMarkup = {
            inline_keyboard: [[{ text: 'skiniq', web_app: { url: MINI_APP_URL } }]],
          };
          await sendMessage(chatId, fallbackText, fallbackMarkup, userId || undefined);
          console.log(`✅ Fallback message with button sent successfully`);
        } catch (fallbackError: any) {
          console.error(`❌ Failed to send fallback message:`, fallbackError);
        }
      }
      
      return NextResponse.json({ ok: true, processed: 'start_command' });
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
    const chatId = update?.message?.chat?.id;
    if (chatId && TELEGRAM_BOT_TOKEN) {
      try {
        await sendMessage(chatId, 'Произошла временная ошибка. Попробуйте команду /start ещё раз или позже.');
      } catch (sendErr) {
        console.error('Failed to send error fallback to user:', sendErr);
      }
    }
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 200 });
  }
}

// GET для установки и проверки webhook
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action');

  console.log('🔍 GET webhook request:', { action, url: request.url });

  // Для check/set-webhook/set-menu-button: допуск по админ-сессии ИЛИ по секрету WEBHOOK_SET_SECRET (curl без браузера)
  if (action === 'check' || action === 'set-webhook' || action === 'set-menu-button') {
    const secret = searchParams.get('secret') ?? request.headers.get('x-webhook-set-secret') ?? '';
    const allowedBySecret = !!(WEBHOOK_SET_SECRET && secret && timingSafeEqual(WEBHOOK_SET_SECRET, secret));
    if (!allowedBySecret) {
      const adminAuth = await verifyAdmin(request);
      if (!adminAuth.valid) {
        return NextResponse.json(
          { error: 'Unauthorized. Use admin session or ?secret=WEBHOOK_SET_SECRET (or header X-Webhook-Set-Secret).' },
          { status: 401 }
        );
      }
    }
  }

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

  // Установка системной кнопки-меню бота: «Мой план» → /plan
  if (action === 'set-menu-button') {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setChatMenuButton`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menu_button: {
              type: 'web_app',
              text: 'Мой план',
              web_app: { url: `${MINI_APP_URL}/plan` },
            },
          }),
        }
      );
      const data = await response.json();
      console.log('📊 setChatMenuButton response:', { ok: data.ok, description: data.description });
      return NextResponse.json(data);
    } catch (error: any) {
      console.error('❌ Error setting menu button:', error);
      return NextResponse.json(
        { error: 'Failed to set menu button', details: error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ message: 'Telegram webhook endpoint. Use ?action=check, ?action=set-webhook or ?action=set-menu-button' });
}
