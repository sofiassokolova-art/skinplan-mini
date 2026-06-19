// scripts/check-elena-logs.ts
// Поиск пользователя по username и дамп его клиентских логов (вкл. анонимные по telegramId).
// Запуск: tsx scripts/check-elena-logs.ts <username>

import { prisma } from '../lib/db';

const rawArg = process.argv[2] || 'Elena_Surkina';
const username = rawArg.replace(/^@/, '');

async function main() {
  console.log(`🔍 Ищу пользователя по username: "${username}"`);

  const users = await prisma.user.findMany({
    where: { username: { equals: username, mode: 'insensitive' } },
    select: {
      id: true,
      telegramId: true,
      username: true,
      firstName: true,
      createdAt: true,
      lastActive: true,
      currentProfileId: true,
    },
  });

  if (users.length === 0) {
    console.log('❌ Пользователь с таким username не найден в БД.');
    console.log('   Попробую поискать частичное совпадение...');
    const partial = await prisma.user.findMany({
      where: { username: { contains: username.slice(0, 5), mode: 'insensitive' } },
      select: { id: true, telegramId: true, username: true, firstName: true },
      take: 20,
    });
    console.log(`   Найдено похожих: ${partial.length}`);
    partial.forEach((u) => console.log(`   - @${u.username} (tg:${u.telegramId}, name:${u.firstName})`));
    return;
  }

  for (const user of users) {
    console.log('\n===================================================');
    console.log('✅ Пользователь:', {
      userId: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      createdAt: user.createdAt.toISOString(),
      lastActive: user.lastActive?.toISOString() ?? null,
      hasProfile: !!user.currentProfileId,
    });

    // Логи и по userId, и по telegramId (анонимные логи пишутся до сопоставления userId).
    const logs = await prisma.clientLog.findMany({
      where: {
        OR: [{ userId: user.id }, { telegramId: user.telegramId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    });

    console.log(`\n📊 Клиентских логов (по userId + telegramId): ${logs.length}`);
    logs.forEach((log, idx) => {
      const time = new Date(log.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
      const anon = log.userId ? '' : ' [ANON/no-userId]';
      console.log(`\n${idx + 1}. [${time}] ${log.level.toUpperCase()}${anon}`);
      console.log(`   ${log.message}`);
      if (log.context) console.log(`   context: ${JSON.stringify(log.context)}`);
      if (log.url) console.log(`   url: ${log.url}`);
      if (log.userAgent) console.log(`   ua: ${log.userAgent}`);
    });

    // Состояние воронки: профиль, сессия рекомендаций, прогресс анкеты, план.
    const [profilesCount, sessionsCount, progress, plan, lastAnswers] = await Promise.all([
      prisma.skinProfile.count({ where: { userId: user.id } }),
      prisma.recommendationSession.count({ where: { userId: user.id } }),
      prisma.questionnaireProgress.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.plan28.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
      prisma.userAnswer.count({ where: { userId: user.id } }),
    ]);

    console.log('\n🧭 Состояние воронки:');
    console.log(`   профилей: ${profilesCount}`);
    console.log(`   ответов в анкете: ${lastAnswers}`);
    console.log(`   прогресс анкеты: ${progress ? JSON.stringify({ updatedAt: progress.updatedAt, ...progress }) : 'нет'}`);
    console.log(`   recommendationSessions: ${sessionsCount}`);
    console.log(`   plan28: ${plan ? `есть (создан ${plan.createdAt.toISOString()})` : 'нет'}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .then(() => { console.log('\n✅ Готово'); process.exit(0); })
  .catch(async (e) => { console.error('❌ Ошибка:', e); await prisma.$disconnect(); process.exit(1); });
