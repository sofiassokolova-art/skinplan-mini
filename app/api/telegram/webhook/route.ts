// app/api/telegram/webhook/route.ts
// Webhook для Telegram бота

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { getUserIdFromTelegramId } from '@/lib/get-user-from-telegram-id';
import { verifyAdmin } from '@/lib/admin-auth';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Секретный токен опционален - используется только если установлен в переменных окружения
// Для генерации токена: node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex'))"
const TELEGRAM_SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN;
/** Секрет для установки webhook без входа в админку (curl / CI). Задайте WEBHOOK_SET_SECRET в Vercel. */
const WEBHOOK_SET_SECRET = process.env.WEBHOOK_SET_SECRET;
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
      const expected = Buffer.from(TELEGRAM_SECRET_TOKEN, 'utf8');
      const actual = Buffer.from(headerToken, 'utf8');
      if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
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
      messageText: update.message?.text,
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
      } catch (dbError) {
        console.error('Error saving message or support chat (continuing to process commands):', dbError);
      }
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

      const welcomeText = `Добро пожаловать в <b>SkinIQ</b> — ваш помощник в уходе за кожей!
Что умеет <b>SkinIQ</b>:
• Дает личные советы по уходу
• Предлагает план ухода на 12 недель каждый день
• Дает советы от врачей-дерматологов

🎁 Начните уже сегодня!

Заполнение анкеты займет всего 5 минут. В результате вы получите специальный план ухода, который подходит именно вашей коже.

Нажмите на кнопку ниже, чтобы открыть приложение:`;

      const replyMarkup = {
        inline_keyboard: [
          [
            {
              text: 'SkinIQ',
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
          const fallbackText = `Добро пожаловать в <b>SkinIQ</b> — ваш помощник в уходе за кожей!\n\nЧто умеет <b>SkinIQ</b>:\n• Дает личные советы по уходу\n• Предлагает план ухода на 12 недель каждый день\n• Дает советы от врачей-дерматологов\n\n🎁 Начните уже сегодня!\n\nЗаполнение анкеты займет всего 5 минут. В результате вы получите специальный план ухода, который подходит именно вашей коже.\n\nНажмите на кнопку ниже, чтобы открыть приложение:`;
          const fallbackMarkup = {
            inline_keyboard: [[{ text: 'SkinIQ', web_app: { url: MINI_APP_URL } }]],
          };
          await sendMessage(chatId, fallbackText, fallbackMarkup, userId || undefined);
          console.log(`✅ Fallback message with button sent successfully`);
        } catch (fallbackError: any) {
          console.error(`❌ Failed to send fallback message:`, fallbackError);
        }
      }
      
      return NextResponse.json({ ok: true, processed: 'start_command' });
    }

    // Обработка команды /clear
    else if (update.message?.text === '/clear' || update.message?.text === '/reset') {
      const chatId = update.message.chat.id;
      const telegramId = update.message.from.id;
      const userId = await getUserIdFromTelegramId(telegramId, {
        firstName: update.message.from.first_name,
        lastName: update.message.from.last_name,
        username: update.message.from.username,
        languageCode: update.message.from.language_code,
      });

      const clearText = `🧹 <b>Очистка данных</b>\n\nНажмите на кнопку ниже, чтобы очистить все данные анкеты из браузера.\n\nЭто удалит:\n• Прогресс анкеты\n• Сохраненные ответы\n• Кэш профиля\n\nПосле очистки вы сможете пройти анкету заново.`;

      const replyMarkup = {
        inline_keyboard: [
          [
            {
              text: '🧹 Очистить данные',
              web_app: { url: MINI_APP_URL + '/clear-storage' },
            },
          ],
        ],
      };

      try {
        await sendMessage(chatId, clearText, replyMarkup, userId || undefined);
        console.log(`✅ Clear command processed for chat ${chatId}`);
      } catch (error: any) {
        console.error(`❌ Failed to send clear message:`, error);
      }
      
      return NextResponse.json({ ok: true, processed: 'clear_command' });
    }

    // Обработка команды /logs - отправка логов пользователя
    else if (update.message?.text === '/logs' || update.message?.text?.startsWith('/logs')) {
      const chatId = update.message.chat.id;
      const telegramId = update.message.from.id;
      const userId = await getUserIdFromTelegramId(telegramId, {
        firstName: update.message.from.first_name,
        lastName: update.message.from.last_name,
        username: update.message.from.username,
        languageCode: update.message.from.language_code,
      });

      if (!userId) {
        await sendMessage(chatId, '❌ Не удалось идентифицировать пользователя', undefined);
        return NextResponse.json({ ok: true, processed: 'logs_command_error' });
      }

      try {
        // Получаем последние логи пользователя
        const logs = await prisma.clientLog.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });

        // Получаем информацию о профилях
        const profiles = await prisma.skinProfile.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });

        // Получаем информацию о планах
        const plans = await prisma.plan28.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 3,
        });

        // Получаем информацию о ответах
        const answersCount = await prisma.userAnswer.count({
          where: { userId },
        });

        // Получаем последние ответы
        const lastAnswers = await prisma.userAnswer.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            questionId: true,
            answerValue: true,
            answerValues: true,
            createdAt: true,
          },
        });

        // Получаем информацию о платежах (с обработкой ошибок, если таблица не существует)
        let payments: any[] = [];
        try {
          payments = await prisma.payment.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: {
              id: true,
              status: true,
              amount: true,
              currency: true,
              createdAt: true,
            },
          });
        } catch (paymentError: any) {
          console.warn('⚠️ Failed to fetch payments (table may not exist):', paymentError?.message);
          // Продолжаем без платежей
        }

        // Получаем информацию о entitlements (с обработкой ошибок, если таблица не существует)
        let entitlements: any[] = [];
        try {
          entitlements = await prisma.entitlement.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            select: {
              code: true,
              active: true,
              validUntil: true,
              updatedAt: true,
            },
          });
        } catch (entitlementError: any) {
          console.warn('⚠️ Failed to fetch entitlements (table may not exist):', entitlementError?.message);
          // Продолжаем без entitlements
        }

        // Получаем информацию о пользователе
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            telegramId: true,
            createdAt: true,
            tags: true,
          },
        });

        // Формируем сообщение
        let message = `📊 <b>Ваши логи и данные</b>\n\n`;
        
        // Информация о пользоватеle
        if (user) {
          const userDate = new Date(user.createdAt).toLocaleString('ru-RU');
          message += `👤 <b>Пользователь:</b>\n`;
          message += `  Telegram ID: <code>${user.telegramId}</code>\n`;
          message += `  Создан: ${userDate}\n`;
          if (user.tags && user.tags.length > 0) {
            message += `  Теги: ${user.tags.join(', ')}\n`;
          }
          message += `\n`;
        }

        message += `👤 <b>Профили:</b> ${profiles.length}\n`;
        if (profiles.length > 0) {
          profiles.forEach((p, idx) => {
            const date = new Date(p.createdAt).toLocaleString('ru-RU');
            message += `  ${idx + 1}. ID: <code>${p.id}</code>\n`;
            message += `     Version: ${p.version}, Created: ${date}\n`;
          });
        } else {
          message += `  ⚠️ Профили не найдены (это может быть проблемой)\n`;
        }

        message += `\n📋 <b>Ответы:</b> ${answersCount}\n`;
        if (lastAnswers.length > 0) {
          const lastAnswerDate = new Date(lastAnswers[0].createdAt).toLocaleString('ru-RU');
          message += `  Последний ответ: ${lastAnswerDate}\n`;
          message += `  Последние вопросы:\n`;
          lastAnswers.slice(0, 3).forEach((a, idx) => {
            const date = new Date(a.createdAt).toLocaleString('ru-RU');
            // Используем answerValue (для single/scale) или answerValues (для multi)
            const value = a.answerValue 
              ? (a.answerValue.length > 30 ? a.answerValue.substring(0, 30) + '...' : a.answerValue)
              : (a.answerValues 
                  ? (Array.isArray(a.answerValues) ? a.answerValues.join(', ') : JSON.stringify(a.answerValues))
                  : 'null');
            const displayValue = typeof value === 'string' && value.length > 30 
              ? value.substring(0, 30) + '...' 
              : String(value);
            message += `    ${idx + 1}. Q:${a.questionId} = ${displayValue}\n`;
          });
        }
        
        message += `\n📅 <b>Планы:</b> ${plans.length}\n`;
        if (plans.length > 0) {
          plans.forEach((p, idx) => {
            const date = new Date(p.createdAt).toLocaleString('ru-RU');
            message += `  ${idx + 1}. ProfileVersion: ${p.profileVersion}, Created: ${date}\n`;
          });
        }

        message += `\n💳 <b>Платежи:</b> ${payments.length}\n`;
        if (payments.length > 0) {
          payments.forEach((p, idx) => {
            const date = new Date(p.createdAt).toLocaleString('ru-RU');
            message += `  ${idx + 1}. ${p.status}: ${p.amount} ${p.currency} (${date})\n`;
          });
        }

        message += `\n🔐 <b>Доступ (Entitlements):</b> ${entitlements.length}\n`;
        if (entitlements.length > 0) {
          entitlements.forEach((e, idx) => {
            const date = new Date(e.updatedAt).toLocaleString('ru-RU');
            const validUntil = e.validUntil ? new Date(e.validUntil).toLocaleString('ru-RU') : 'без ограничений';
            message += `  ${idx + 1}. ${e.code}: ${e.active ? '✅' : '❌'} (до ${validUntil})\n`;
          });
        }

        // Подсчитываем ошибки в логах
        const errorLogs = logs.filter(l => l.level === 'error');
        const warnLogs = logs.filter(l => l.level === 'warn');

        message += `\n📝 <b>Последние логи (${logs.length}):</b>\n`;
        if (errorLogs.length > 0) {
          message += `  ⚠️ Ошибок: ${errorLogs.length}\n`;
        }
        if (warnLogs.length > 0) {
          message += `  ⚠️ Предупреждений: ${warnLogs.length}\n`;
        }
        if (logs.length === 0) {
          message += `  Логов не найдено\n`;
        } else {
          logs.slice(0, 10).forEach((log, idx) => {
            const date = new Date(log.createdAt).toLocaleString('ru-RU');
            const level = log.level.toUpperCase();
            const msg = log.message.length > 50 ? log.message.substring(0, 50) + '...' : log.message;
            const icon = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : 'ℹ️';
            message += `  ${idx + 1}. ${icon} [${date}] ${level}: ${msg}\n`;
          });
          if (logs.length > 10) {
            message += `  ... и ещё ${logs.length - 10} логов\n`;
          }
        }

        // Отправляем сообщение
        await sendMessage(chatId, message, undefined, userId);
        console.log(`✅ Logs sent to chat ${chatId} for user ${userId}`);
      } catch (error: any) {
        console.error(`❌ Failed to get/send logs:`, error);
        await sendMessage(chatId, `❌ Ошибка при получении логов: ${error.message}`, undefined, userId);
      }
      
      return NextResponse.json({ ok: true, processed: 'logs_command' });
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
/clear - Очистить данные анкеты
/payment - Установить статус оплаты (для тестирования)
/logs - Показать ваши логи и данные

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

    // Обработка команды /payment - устанавливает статус оплаты для тестирования
    else if (update.message?.text === '/payment' || update.message?.text?.startsWith('/payment')) {
      const chatId = update.message.chat.id;
      const telegramId = update.message.from.id;
      const userId = await getUserIdFromTelegramId(telegramId, {
        firstName: update.message.from.first_name,
        lastName: update.message.from.last_name,
        username: update.message.from.username,
        languageCode: update.message.from.language_code,
      });

      if (!userId) {
        await sendMessage(chatId, '❌ Не удалось идентифицировать пользователя', undefined);
        return NextResponse.json({ ok: true, processed: 'payment_command_error' });
      }

      // Устанавливаем флаг оплаты в БД через тег пользователя
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { tags: true },
        });

        const tags = user?.tags || [];
        const hasPaymentTag = tags.includes('payment_completed');

        if (!hasPaymentTag) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              tags: { push: 'payment_completed' },
            },
            // ВАЖНО: не возвращаем все поля User (может упасть при рассинхроне схемы БД)
            select: { id: true },
          });
        }

        const paymentText = `✅ <b>Статус оплаты установлен!</b>

Теперь откройте Mini App и обновите страницу - план должен отобразиться без блюра.

<b>Примечание:</b> Это команда для тестирования. В продакшене оплата обрабатывается через платежную систему.`;

        await sendMessage(chatId, paymentText, undefined, userId);
        console.log(`✅ Payment status set for user ${userId} (telegramId: ${telegramId})`);
      } catch (error: any) {
        console.error(`❌ Failed to set payment status:`, error);
        await sendMessage(chatId, '❌ Ошибка при установке статуса оплаты', undefined, userId);
      }
      
      return NextResponse.json({ ok: true, processed: 'payment_command' });
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

  // Для check/set-webhook: допуск по админ-сессии ИЛИ по секрету WEBHOOK_SET_SECRET (curl без браузера)
  if (action === 'check' || action === 'set-webhook') {
    const secret = searchParams.get('secret') ?? request.headers.get('x-webhook-set-secret') ?? '';
    const expected = WEBHOOK_SET_SECRET ? Buffer.from(WEBHOOK_SET_SECRET, 'utf8') : null;
    const actual = secret ? Buffer.from(secret, 'utf8') : null;
    const allowedBySecret = !!(
      expected &&
      actual &&
      expected.length === actual.length &&
      crypto.timingSafeEqual(expected, actual)
    );
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

  return NextResponse.json({ message: 'Telegram webhook endpoint. Use ?action=check or ?action=set-webhook' });
}

