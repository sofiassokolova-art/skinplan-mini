// lib/get-user-from-initdata.ts
// Утилита для получения userId из Telegram initData
// ИСПРАВЛЕНО: Использует единый слой валидации validateTelegramInitDataUnified

import { validateTelegramInitDataUnified, getUserFromTelegramId } from './telegram-validation';
import { prisma } from './db';

/**
 * Извлекает userId из initData и создает/обновляет пользователя
 * Возвращает userId для использования в запросах
 */
export async function getUserIdFromInitData(initData: string | null): Promise<string | null> {
  if (!initData) {
    console.warn('⚠️ getUserIdFromInitData: initData is null or empty');
    return null;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('❌ getUserIdFromInitData: Bot token not configured');
    return null;
  }

  // ИСПРАВЛЕНО: Используем единый слой валидации
  const validation = await validateTelegramInitDataUnified(initData);
  
  if (!validation.valid || !validation.telegramId || !validation.payload?.user) {
    return null;
  }

  const { user } = validation.payload;
  const telegramId = validation.telegramId;
  
  // ИСПРАВЛЕНО: Создаем или обновляем пользователя с обработкой race condition
  // При параллельных запросах может возникнуть P2002 (unique constraint violation)
  // Добавляем retry-loop для безопасной обработки
  const now = new Date();
  const telegramIdStr = user.id.toString();
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const dbUser = await prisma.user.upsert({
        where: { telegramId: telegramIdStr },
        // ВАЖНО: ограничиваем select, чтобы не падать, если в БД нет новых колонок
        // (например users.current_profile_id при рассинхроне миграций)
        select: { id: true },
        update: {
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          language: user.language_code || 'ru',
          lastActive: now, // Обновляем lastActive при каждом запросе
          updatedAt: now,
        },
        create: {
          telegramId: telegramIdStr,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          language: user.language_code || 'ru',
          lastActive: now, // Устанавливаем lastActive при создании
        },
      });

      return dbUser.id;
    } catch (dbError: any) {
      // ИСПРАВЛЕНО: Обрабатываем race condition (P2002 - unique constraint violation)
      // Если два запроса одновременно пытаются создать пользователя, один получит P2002
      // В этом случае повторяем попытку с findUnique
      if (dbError?.code === 'P2002' && dbError?.meta?.target?.includes('telegramId')) {
        retryCount++;
        if (retryCount >= maxRetries) {
          // Если после retries все еще ошибка, пробуем найти существующего пользователя
          try {
            const existingUser = await prisma.user.findUnique({
              where: { telegramId: telegramIdStr },
              select: { id: true },
            });
            if (existingUser) {
              // Пользователь был создан другим запросом - обновляем его
              const updatedUser = await prisma.user.update({
                where: { telegramId: telegramIdStr },
                data: {
                  username: user.username,
                  firstName: user.first_name,
                  lastName: user.last_name,
                  language: user.language_code || 'ru',
                  lastActive: now,
                  updatedAt: now,
                },
                select: { id: true },
              });
              return updatedUser.id;
            }
          } catch (findError: any) {
            console.error('❌ getUserIdFromInitData: Error finding user after P2002:', {
              error: findError?.message,
              telegramId: telegramIdStr,
            });
          }
          // Если не нашли - логируем и возвращаем null
          console.error('❌ getUserIdFromInitData: Failed to create/find user after race condition', {
            telegramId: telegramIdStr,
            retryCount,
          });
          return null;
        }
        // Небольшая задержка перед повтором (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 10 * retryCount));
        continue; // Повторяем попытку
      }
      
      // Детальное логирование других ошибок БД
      console.error('❌ getUserIdFromInitData: Database error:', {
        error: dbError?.message,
        code: dbError?.code,
        meta: dbError?.meta,
        stack: dbError?.stack,
        telegramId: telegramIdStr,
        hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
      });
      // Возвращаем null вместо выброса ошибки, чтобы API мог обработать это корректно
      return null;
    }
  }
  
  return null;
}

