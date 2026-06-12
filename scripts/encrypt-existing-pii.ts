// scripts/encrypt-existing-pii.ts
// Одноразовая миграция: шифрует уже существующие ПДн в БД
// (SkinProfile.medicalMarkers, User.phoneNumber).
//
// Идемпотентно: прозрачный слой lib/db при чтении возвращает расшифрованное
// значение (legacy plaintext проходит как есть), а при записи шифрует заново.
// Уже зашифрованные строки определяются по префиксу и пропускаются.
//
// Запуск:  PII_ENCRYPTION_KEY=<hex32> tsx scripts/encrypt-existing-pii.ts [--confirm]

import { prisma } from '../lib/db';
import { isEncrypted } from '../lib/crypto/pii';

async function main() {
  if (!process.env.PII_ENCRYPTION_KEY) {
    console.error('❌ PII_ENCRYPTION_KEY не задан — нечем шифровать. Прерываю.');
    process.exit(1);
  }
  const confirm = process.argv.includes('--confirm');
  if (!confirm) {
    console.log('ℹ️  Dry-run. Добавь --confirm чтобы применить изменения.');
  }

  // --- SkinProfile.medicalMarkers ---
  // Читаем «сырое» значение в обход слоя — отдельным запросом, чтобы понять,
  // что реально лежит в БД. Слой lib/db при findMany уже расшифрует, поэтому
  // используем $queryRaw для проверки префикса.
  const rawProfiles = await prisma.$queryRaw<Array<{ id: string; medical_markers: unknown }>>`
    SELECT id, medical_markers FROM skin_profiles WHERE medical_markers IS NOT NULL
  `;
  let profEnc = 0;
  let profSkip = 0;
  for (const row of rawProfiles) {
    const stored = row.medical_markers;
    if (isEncrypted(stored)) {
      profSkip++;
      continue;
    }
    if (confirm) {
      // Читаем через слой (расшифровка/passthrough), пишем через слой (шифрование).
      const profile = await prisma.skinProfile.findUnique({ where: { id: row.id }, select: { medicalMarkers: true } });
      await prisma.skinProfile.update({
        where: { id: row.id },
        data: { medicalMarkers: profile?.medicalMarkers ?? undefined },
      });
    }
    profEnc++;
  }

  // --- User.phoneNumber ---
  const rawUsers = await prisma.$queryRaw<Array<{ id: string; phone_number: string | null }>>`
    SELECT id, phone_number FROM users WHERE phone_number IS NOT NULL
  `;
  let userEnc = 0;
  let userSkip = 0;
  for (const row of rawUsers) {
    if (isEncrypted(row.phone_number)) {
      userSkip++;
      continue;
    }
    if (confirm) {
      const user = await prisma.user.findUnique({ where: { id: row.id }, select: { phoneNumber: true } });
      await prisma.user.update({ where: { id: row.id }, data: { phoneNumber: user?.phoneNumber ?? undefined } });
    }
    userEnc++;
  }

  console.log('—'.repeat(40));
  console.log(`SkinProfile.medicalMarkers: ${profEnc} ${confirm ? 'зашифровано' : 'будет зашифровано'}, ${profSkip} уже зашифровано`);
  console.log(`User.phoneNumber:           ${userEnc} ${confirm ? 'зашифровано' : 'будет зашифровано'}, ${userSkip} уже зашифровано`);
  if (!confirm) console.log('\nЭто dry-run. Запусти с --confirm для применения.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
