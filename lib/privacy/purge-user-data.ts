// lib/privacy/purge-user-data.ts
// Единая логика удаления персональных данных пользователя (152-ФЗ).
// Используется при самостоятельном удалении (по запросу субъекта) и при
// автоматическом удалении по истечении срока хранения (retention cron).
//
// Платежи (Payment) и Entitlement НЕ удаляются — Оператор обязан хранить
// сведения о платежах для бухгалтерского/налогового учёта (54-ФЗ).
// Поэтому строка User не удаляется полностью, а обезличивается.

import { prisma } from '@/lib/db';

export async function purgeUserPersonalData(userId: string): Promise<void> {
  // Снимаем ссылку на текущий профиль, чтобы удаление профилей не упёрлось в FK.
  try {
    await prisma.user.update({ where: { id: userId }, data: { currentProfileId: null }, select: { id: true } });
  } catch {
    // не критично
  }

  await Promise.allSettled([
    prisma.recommendationSession.deleteMany({ where: { userId } }),
    prisma.planProgress.deleteMany({ where: { userId } }),
    prisma.userAnswer.deleteMany({ where: { userId } }),
    prisma.skinProfile.deleteMany({ where: { userId } }),
    prisma.planFeedback.deleteMany({ where: { userId } }),
    prisma.wishlist.deleteMany({ where: { userId } }),
    prisma.wishlistFeedback.deleteMany({ where: { userId } }),
    prisma.cart.deleteMany({ where: { userId } }),
    prisma.plan28.deleteMany({ where: { userId } }),
    prisma.clientLog.deleteMany({ where: { userId } }),
    prisma.questionnaireProgress.deleteMany({ where: { userId } }),
    prisma.questionnaireSubmission.deleteMany({ where: { userId } }),
    prisma.productReplacement.deleteMany({ where: { userId } }),
    prisma.supportChat.deleteMany({ where: { userId } }),
    prisma.botMessage.deleteMany({ where: { userId } }),
  ]);

  try {
    await prisma.userPreferences.updateMany({
      where: { userId },
      data: { hasPlanProgress: false, isRetakingQuiz: false, extra: {} },
    });
  } catch {
    // не критично
  }

  try {
    await prisma.consent.updateMany({
      where: { userId, revokedAt: null },
      data: { accepted: false, revokedAt: new Date() },
    });
  } catch {
    // не критично
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { firstName: null, lastName: null, username: null, phoneNumber: null, tags: { set: [] } },
      select: { id: true },
    });
  } catch {
    // не критично
  }
}
