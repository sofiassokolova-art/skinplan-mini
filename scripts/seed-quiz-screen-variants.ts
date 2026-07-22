// scripts/seed-quiz-screen-variants.ts
// Заливает варианты экрана ai_comparison («Зеркало») под цели ухода.
//
// Ключ варианта — focusKey из lib/focus-keys.ts, тот же словарь, которым план
// нормализует лейблы целей и беспокойств. Свой словарь заводить нельзя: разъедется
// с движком, и экран начнёт показывать одно, а план собирать другое.
//
// Тексты написаны от первого лица про конкретное утро человека, а не про пользу
// сервиса: экран должен читаться как узнавание, объяснение идёт нижним блоком.
//
// Один вертикальный mirror-кадр используется для всех вариантов: тексты меняются
// по цели ухода, а визуальный якорь остаётся стабильным и не спорит с заголовком.
//
// Идемпотентно (upsert по screenId+focusKey). DRY=1 — превью без записи.
import { prisma } from '../lib/db';

const DRY = process.env.DRY === '1';
const SCREEN_ID = 'ai_comparison';
const MIRROR_IMAGE_URL = '/ai-comparison-mirror.jpg';

/**
 * Канал до Neon с локальной машины рвётся («fetch failed» / connect timeout), а сид
 * идёт девятью отдельными запросами — без ретраев он падает на середине и оставляет
 * половину вариантов незалитой. Upsert идемпотентный, так что повтор безопасен.
 */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      console.log(`     ↻ ${label}: попытка ${i}/${attempts} (${e?.message?.slice(0, 60)})`);
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
  throw lastError;
}

type Variant = {
  focusKey: string;
  imageUrl: string;
  eyebrow: string;
  quote: string;
  bodyTitle: string;
  bodyText: string;
  priority: number;
};

// priority: чем больше, тем раньше вариант выбирается, если целей отмечено несколько.
// Акне и постакне бьют сильнее остальных, поэтому идут первыми; «default» — последний.
const VARIANTS: Variant[] = [
  {
    focusKey: 'acne',
    imageUrl: MIRROR_IMAGE_URL,
    eyebrow: 'Ваша цель: чистая кожа',
    quote: 'Высыпания возвращаются без предупреждения',
    bodyTitle: 'Знакомо? Тогда проблема не в силе воли и не в новой банке.',
    bodyText:
      'Прыщи возвращаются, если уход хаотичен и не продуман. Важно разработать план, учитывая причину проблемы.',
    priority: 100,
  },
  {
    focusKey: 'pores',
    imageUrl: MIRROR_IMAGE_URL,
    eyebrow: 'Ваша цель: чистые поры',
    quote: 'После чистки поры становятся более заметными',
    bodyTitle: 'Дело не в том, что вы плохо очищаете лицо.',
    bodyText:
      'Агрессивное очищение не делает поры чище. Важно работать с причиной, а не только с последствиями.',
    priority: 80,
  },
  {
    focusKey: 'wrinkles',
    imageUrl: MIRROR_IMAGE_URL,
    eyebrow: 'Ваша цель: упругость кожи',
    quote: 'На фото кожа выглядит уставшей',
    bodyTitle: 'Крем с «омолаживающим эффектом» этого не остановит.',
    bodyText:
      'План требует определенных активов, правильно подобранных и расположенных в нужном порядке.',
    priority: 70,
  },
  {
    focusKey: 'pigmentation',
    imageUrl: MIRROR_IMAGE_URL,
    eyebrow: 'Ваша цель: ровный тон',
    quote: 'Приходится использовать плотный тональный крем',
    bodyTitle: 'Осветляющие средства эффективны только в сочетании с солнцезащитными.',
    bodyText:
      'Без SPF пятна вернутся через пару недель. План включает оба этапа и контролирует процесс.',
    priority: 75,
  },
  {
    focusKey: 'dehydration',
    imageUrl: MIRROR_IMAGE_URL,
    eyebrow: 'Ваша цель: увлажнённая кожа',
    quote: 'После нанесения крема стянутость вернулась',
    bodyTitle: 'Использование более жирного крема не решает проблему.',
    bodyText:
      'План подбирает текстуры, основываясь на проверенных составах, а не на отзывах.',
    priority: 60,
  },
  {
    focusKey: 'barrier',
    imageUrl: MIRROR_IMAGE_URL,
    eyebrow: 'Ваша цель: спокойная кожа',
    quote: 'Кожа снова реагирует на новое средство',
    bodyTitle: 'Так бывает, когда барьер уже нарушен.',
    bodyText:
      'Сначала его восстанавливают, а потом вводят активы. Эта последовательность шагов уже есть в плане.',
    priority: 65,
  },
  {
    focusKey: 'oiliness',
    imageUrl: MIRROR_IMAGE_URL,
    eyebrow: 'Ваша цель: матовая кожа',
    quote: 'Матовая кожа держится только до обеда',
    bodyTitle: 'Матирующие средства работают несколько часов.',
    bodyText:
      'Но если пересушить кожу, она начинает выделять больше себума. Наш план прерывает этот замкнутый круг.',
    priority: 55,
  },
  {
    focusKey: 'dark_circles',
    imageUrl: MIRROR_IMAGE_URL,
    eyebrow: 'Ваша цель: свежий взгляд',
    quote: 'Даже после хорошего сна лицо выглядит усталым',
    bodyTitle: 'Патчи маскируют проблему, но не решают её.',
    bodyText:
      'Тонкая кожа вокруг глаз нуждается в особом уходе. Поэтому мы выделили его в отдельный этап.',
    priority: 50,
  },
  {
    // Обязательная строка: на неё падаем, если цель не распознана или под фокус
    // нет своего варианта. Формулировки нейтральные, без указания на проблему.
    focusKey: 'default',
    imageUrl: MIRROR_IMAGE_URL,
    eyebrow: 'Ваша цель: здоровая кожа',
    quote: 'Средств много, но эффекта нет',
    bodyTitle: 'Проблема не в вашей коже. Проблема в случайном подборе.',
    bodyText:
      'Ваш план соберётся на основе ваших ответов и особенностей кожи.',
    priority: 0,
  },
];

async function main() {
  console.log(`${DRY ? '🧪 DRY' : '🚀 APPLY'} — ${VARIANTS.length} вариантов экрана ${SCREEN_ID}\n`);

  for (const v of VARIANTS) {
    console.log(`  ${v.focusKey.padEnd(14)} ${v.imageUrl.padEnd(24)} «${v.quote.slice(0, 46)}…»`);
    if (DRY) continue;

    await withRetry(v.focusKey, () =>
      prisma.quizScreenVariant.upsert({
        where: { screenId_focusKey: { screenId: SCREEN_ID, focusKey: v.focusKey } },
        create: { screenId: SCREEN_ID, isActive: true, ...v },
        update: {
          imageUrl: v.imageUrl,
          eyebrow: v.eyebrow,
          quote: v.quote,
          bodyTitle: v.bodyTitle,
          bodyText: v.bodyText,
          priority: v.priority,
          isActive: true,
        },
      })
    );
  }

  if (!DRY) {
    const total = await withRetry('count', () =>
      prisma.quizScreenVariant.count({ where: { screenId: SCREEN_ID } })
    );
    console.log(`\n✅ В БД ${total} вариантов для ${SCREEN_ID}`);
  }
}

main()
  .catch((e) => {
    console.error('⛔', e);
    process.exit(1);
  })
  .finally(() => {
    if (!DRY) return prisma.$disconnect();
  });
