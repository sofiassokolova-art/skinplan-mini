// @vitest-environment node
// tests/random-users-plan-invariants.test.ts
// Property-based прогон: N сид-рандомных пользователей проходят РЕАЛЬНЫЙ пайплайн
// (POST /api/questionnaire/answers → generate28DayPlan) против живой БД, затем
// план проверяется на инварианты безопасности:
//   1. структура: 28 дней, непустые утро/вечер;
//   2. контра-фильтр: ни один продукт плана (включая альтернативы) не нарушает
//      medicalMarkers.contraindications (no_strong_acids и т.п.);
//   3. беременность → никаких ретиноидов;
//   4. Rx-терапия (Эффезел/Базирон/Дифферин) → без кислотных шагов + шаг-инструкция;
//   5. SPF-продукт никогда не стоит в cleanser-слоте (регрессия _oil/_oily);
//   6. все productId существуют в каталоге;
//   7. дерм-протокол: ни один продукт плана не содержит актив из
//      protocol.forbiddenIngredients (розацеа → без AHA/BHA/ретиноидов/vitC/BPO).
//
// Запуск (нужна БД, лучше стейджинг; последовательный режим и большие таймауты):
//   DATABASE_URL=... npx vitest run tests/random-users-plan-invariants.test.ts \
//     --fileParallelism=false --testTimeout=900000 --hookTimeout=120000
// Параметры: RANDOM_USERS=5 (кол-во юзеров), RANDOM_SEED=12345 (репро конкретного прогона),
// RANDOM_VERBOSE=1 (не глушить логи приложения), RANDOM_TEST_TIMEOUT_MS=... (для больших батчей).
// Сид печатается в начале — упавший прогон воспроизводится тем же RANDOM_SEED.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createPrismaTestClient, isPrismaTestDatabaseAvailable } from '@/tests/helpers/prisma-test-client';

let currentUserId = '';
let currentTelegramId = '';

vi.mock('@/lib/auth/telegram-auth', () => ({
  requireTelegramAuth: vi.fn(async () => ({
    ok: true,
    ctx: {
      userId: currentUserId,
      telegramId: currentTelegramId,
      user: { id: 999, first_name: 'Random' },
    },
  })),
}));

import { POST as postAnswers } from '@/app/api/questionnaire/answers/route';
import { generate28DayPlan } from '@/lib/plan-generator';
import { productViolatesContraindications } from '@/lib/contraindication-product-filter';
import { determineProtocol } from '@/lib/dermatology-protocols';
import { getProtocolForbiddenIngredients } from '@/lib/dermatology-product-filter';
import { RX_TOPICAL_CONFLICT_STEPS, isOnStrongRxTopicals } from '@/lib/rx-topicals';
import type { DayStep } from '@/lib/plan-types';

const prismaTest = createPrismaTestClient();
let hasDatabase = !!process.env.DATABASE_URL;

const USERS_N = Number(process.env.RANDOM_USERS) || 5;
const SEED = (Number(process.env.RANDOM_SEED) || Date.now()) >>> 0;
const VERBOSE = process.env.RANDOM_VERBOSE === '1';
const REQUIRE_DB =
  process.env.RANDOM_USERS_REQUIRE_DB === '1' ||
  process.env.RANDOM_USERS !== undefined ||
  process.env.RANDOM_SEED !== undefined;
const TEST_TIMEOUT_MS =
  Number(process.env.RANDOM_TEST_TIMEOUT_MS) || Math.max(900_000, 120_000 + USERS_N * 75_000);
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

let consoleSpies: Array<{ mockRestore: () => void }> = [];

function testLog(message: string) {
  originalConsole.log(message);
}

function muteAppLogsUnlessVerbose() {
  if (VERBOSE || consoleSpies.length > 0) return;
  consoleSpies = [
    vi.spyOn(console, 'log').mockImplementation(() => {}),
    vi.spyOn(console, 'info').mockImplementation(() => {}),
    vi.spyOn(console, 'warn').mockImplementation(() => {}),
    vi.spyOn(console, 'error').mockImplementation(() => {}),
  ];
}

// Детерминированный PRNG: один и тот же RANDOM_SEED → те же анкеты.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type QuestionWithOptions = {
  id: number;
  code: string | null;
  type: string;
  answerOptions: Array<{ value: string; label: string | null }>;
};

function buildRandomAnswers(
  questions: QuestionWithOptions[],
  rand: () => number
): Array<{ questionId: number; answerValue?: string; answerValues?: string[] }> {
  const answers: Array<{ questionId: number; answerValue?: string; answerValues?: string[] }> = [];
  for (const q of questions) {
    if (q.type === 'free_text') {
      answers.push({ questionId: q.id, answerValue: 'Рандомный Тест' });
      continue;
    }
    if (q.answerOptions.length === 0) continue;
    if (q.type === 'multi_choice') {
      // 1..3 случайные опции без повторов
      const count = 1 + Math.floor(rand() * Math.min(3, q.answerOptions.length));
      const shuffled = [...q.answerOptions].sort(() => rand() - 0.5);
      answers.push({ questionId: q.id, answerValues: shuffled.slice(0, count).map((o) => o.value) });
    } else {
      const option = q.answerOptions[Math.floor(rand() * q.answerOptions.length)];
      answers.push({ questionId: q.id, answerValue: option.value });
    }
  }
  return answers;
}

function collectSteps(day: { morning: DayStep[]; evening: DayStep[]; weekly: DayStep[] }): DayStep[] {
  return [...day.morning, ...day.evening, ...day.weekly];
}

async function cleanupUser(userId: string) {
  const anyPrisma = prismaTest as any;
  await anyPrisma.plan28.deleteMany({ where: { userId } });
  await anyPrisma.planProgress.deleteMany({ where: { userId } }).catch(() => {});
  await anyPrisma.planFeedback.deleteMany({ where: { userId } }).catch(() => {});
  await anyPrisma.recommendationSession.deleteMany({ where: { userId } });
  await anyPrisma.questionnaireSubmission.deleteMany({ where: { userId } }).catch(() => {});
  await anyPrisma.userAnswer.deleteMany({ where: { userId } });
  await anyPrisma.skinProfile.deleteMany({ where: { userId } });
  await anyPrisma.user.deleteMany({ where: { id: userId } });
}

describe(`random users: инварианты плана (seed=${SEED}, n=${USERS_N})`, () => {
  let questionnaireId: number | null = null;
  let questions: QuestionWithOptions[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    muteAppLogsUnlessVerbose();

    hasDatabase = await isPrismaTestDatabaseAvailable(prismaTest);
    if (!hasDatabase && REQUIRE_DB) {
      throw new Error('DATABASE_URL is set, but test database is unavailable');
    }
    if (!hasDatabase) return;

    const questionnaire = await prismaTest.questionnaire.findFirst({
      where: { isActive: true },
      include: {
        questions: { include: { answerOptions: { orderBy: { position: 'asc' } } } },
        questionGroups: {
          include: { questions: { include: { answerOptions: { orderBy: { position: 'asc' } } } } },
        },
      },
    });
    if (!questionnaire) return;
    questionnaireId = questionnaire.id;
    const questionsById = new Map<number, QuestionWithOptions>();
    for (const question of [
      ...questionnaire.questions,
      ...questionnaire.questionGroups.flatMap((g) => g.questions),
    ] as QuestionWithOptions[]) {
      questionsById.set(question.id, question);
    }
    questions = [...questionsById.values()];
    testLog(`🎲 seed=${SEED}, users=${USERS_N}, questions=${questions.length}`);
  }, 120_000);

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await cleanupUser(userId).catch((e) =>
        originalConsole.warn(`cleanup failed for ${userId}:`, e.message)
      );
    }
    await prismaTest.$disconnect();
    for (const spy of consoleSpies) spy.mockRestore();
    consoleSpies = [];
  });

  it('каждый рандомный пользователь получает валидный и безопасный план', async () => {
    if (!hasDatabase || !questionnaireId || questions.length === 0) {
      originalConsole.warn('⚠️ Skipping: database or active questionnaire not available');
      return;
    }

    const rand = mulberry32(SEED);

    for (let i = 1; i <= USERS_N; i++) {
      const label = `[seed=${SEED} user=${i}]`;
      const telegramId = `rnd-user-${SEED}-${i}`;
      const user = await prismaTest.user.upsert({
        where: { telegramId },
        update: {},
        create: { telegramId, username: `rnd_${SEED}_${i}` },
      });
      createdUserIds.push(user.id);
      currentUserId = user.id;
      currentTelegramId = telegramId;

      const answers = buildRandomAnswers(questions, rand);

      // 1. Реальный сабмит анкеты (валидация, rules-engine, medicalMarkers — как в проде)
      const request = new NextRequest('http://localhost:3000/api/questionnaire/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': 'test_init_data' },
        body: JSON.stringify({
          questionnaireId,
          clientSubmissionId: `rnd-${SEED}-${i}`,
          answers,
        }),
      });
      const response = await postAnswers(request);
      if (response.status !== 200) {
        const body = await response.json().catch(() => ({}));
        originalConsole.error(
          `${label} submit failed:`,
          JSON.stringify(body),
          '\nanswers:',
          JSON.stringify(answers)
        );
      }
      expect(response.status, `${label} POST /questionnaire/answers`).toBe(200);

      // 2. Генерация плана
      const plan = await generate28DayPlan(user.id, 'soft');
      expect(plan.plan28, `${label} plan28 отсутствует`).toBeDefined();
      const days = plan.plan28!.days;
      expect(days.length, `${label} дней в плане`).toBe(28);

      // 3. Профиль и маркеры (свежесозданный, без ключа шифрования — плейн JSON)
      const profile = await prismaTest.skinProfile.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(profile, `${label} skinProfile не создан`).toBeTruthy();
      const markers = (profile!.medicalMarkers as Record<string, unknown> | null) || {};
      const contraindications = Array.isArray(markers.contraindications)
        ? (markers.contraindications as string[])
        : [];
      const onRx = isOnStrongRxTopicals(markers.currentTopicals);

      // 4. Все продукты плана (основные + альтернативы — юзер может свапнуть)
      const productIds = new Set<string>();
      for (const day of days) {
        expect(day.morning.length, `${label} день ${day.dayIndex}: пустое утро`).toBeGreaterThan(0);
        expect(day.evening.length, `${label} день ${day.dayIndex}: пустой вечер`).toBeGreaterThan(0);
        for (const step of collectSteps(day)) {
          if (step.productId) productIds.add(step.productId);
          for (const alt of step.alternatives || []) productIds.add(alt);
        }
      }
      const products = await prismaTest.product.findMany({
        where: { id: { in: [...productIds].map(Number).filter((n) => !Number.isNaN(n)) } },
        select: { id: true, name: true, step: true, category: true, activeIngredients: true },
      });
      const productById = new Map(products.map((p) => [String(p.id), p]));
      for (const pid of productIds) {
        expect(productById.has(String(pid)), `${label} продукт ${pid} из плана не найден в каталоге`).toBe(true);
      }

      // 5. Контра-фильтр: ни один продукт не нарушает противопоказания
      if (contraindications.length > 0) {
        for (const p of products) {
          expect(
            productViolatesContraindications(p, contraindications),
            `${label} продукт «${p.name}» (id=${p.id}) нарушает [${contraindications.join(', ')}]`
          ).toBe(false);
        }
      }

      // 6. Беременность → никаких ретиноидов
      if (profile!.hasPregnancy) {
        for (const p of products) {
          expect(
            productViolatesContraindications(p, ['no_retinol']),
            `${label} беременность, но продукт «${p.name}» (id=${p.id}) содержит ретиноид`
          ).toBe(false);
        }
      }

      // 7. Rx-терапия: без кислотных шагов, с шагом-инструкцией про препарат врача
      if (onRx) {
        let hasRxManualStep = false;
        for (const day of days) {
          for (const step of collectSteps(day)) {
            if (step.manualLabel === 'Ваше лечебное средство') hasRxManualStep = true;
            if (step.manualLabel) continue; // инструкция без продукта — не конфликт
            expect(
              RX_TOPICAL_CONFLICT_STEPS.includes(step.stepCategory),
              `${label} день ${day.dayIndex}: кислотный шаг ${step.stepCategory} поверх Rx-терапии`
            ).toBe(false);
          }
        }
        expect(hasRxManualStep, `${label} Rx-терапия, но нет шага «Ваше лечебное средство»`).toBe(true);
      }

      // 8. SPF-продукт никогда не в cleanser-слоте (регрессия _oil/_oily)
      const spfLike = /(^|_)(spf|sunscreen)(_|$|\d)/i;
      for (const day of days) {
        for (const step of collectSteps(day)) {
          if (!step.productId || !String(step.stepCategory).startsWith('cleanser')) continue;
          const p = productById.get(String(step.productId));
          if (!p) continue;
          const isSpfProduct = spfLike.test(p.step || '') || (p.category || '').toLowerCase() === 'spf';
          expect(
            isSpfProduct,
            `${label} день ${day.dayIndex}: SPF-продукт «${p.name}» в слоте ${step.stepCategory}`
          ).toBe(false);
        }
      }

      // 9. Дерм-протокол: ни один продукт плана не содержит актив из
      //    protocol.forbiddenIngredients (кейс Ольги: AHA-тонер при розацеа).
      const protocol = determineProtocol({
        diagnoses: Array.isArray(markers.diagnoses) ? (markers.diagnoses as string[]) : [],
        concerns: Array.isArray(markers.concerns) ? (markers.concerns as string[]) : [],
        skinType: profile!.skinType || undefined,
        sensitivityLevel: (profile!.sensitivityLevel || 'medium') as 'low' | 'medium' | 'high' | 'very_high',
        rosaceaRisk: profile!.rosaceaRisk || undefined,
        onIsotretinoin: markers.onIsotretinoin === true,
        currentOralMeds: Array.isArray(markers.currentOralMeds)
          ? (markers.currentOralMeds as string[])
          : [],
      });
      if (protocol.forbiddenIngredients.length > 0) {
        for (const day of days) {
          for (const step of collectSteps(day)) {
            if (!step.productId) continue;
            const p = productById.get(String(step.productId));
            if (!p) continue;
            const forbidden = getProtocolForbiddenIngredients(
              { activeIngredients: p.activeIngredients || [], step: p.step || '', category: p.category },
              protocol,
              step.stepCategory
            );
            expect(
              forbidden,
              `${label} день ${day.dayIndex}: «${p.name}» (id=${p.id}) в слоте ${step.stepCategory} нарушает протокол ${protocol.condition}`
            ).toEqual([]);
          }
        }
      }

      testLog(
        `✅ ${label} ok: contra=[${contraindications.join(',') || '—'}], rx=${onRx}, pregnancy=${profile!.hasPregnancy}, protocol=${protocol.condition}, products=${productIds.size}`
      );

      // Чистим сразу — чтобы упавший прогон оставил в БД только проблемного юзера
      await cleanupUser(user.id);
      createdUserIds.pop();
    }
  }, TEST_TIMEOUT_MS);
});
