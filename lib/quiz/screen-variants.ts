// lib/quiz/screen-variants.ts
// Клиентская часть вариативных инфо-экранов анкеты (таблица quiz_screen_variants).
//
// Ключ варианта — focusKey из lib/focus-keys.ts: тот же словарь, которым план
// нормализует лейблы целей и беспокойств. Благодаря этому экран и план говорят
// об одном и том же фокусе, а не о двух разных классификациях.

import { deriveFocusKeys } from '@/lib/focus-keys';

export interface QuizScreenVariant {
  focusKey: string;
  imageUrl: string;
  eyebrow: string;
  quote: string;
  bodyTitle: string;
  bodyText: string;
  priority: number;
}

export const AI_COMPARISON_SOURCE_IMAGE =
  '/8021bb63ed1a45fc96c1ec64a6575f9b_img_4K.png';
export const AI_COMPARISON_MIRROR_IMAGE = '/ai-comparison-mirror.jpg';

/**
 * Вшитый дефолт экрана ai_comparison. Нужен на случай, когда БД недоступна или
 * сид ещё не прогнали: анкета не должна вставать из-за отсутствия текста.
 * Держать в синхроне со строкой focus_key = 'default' в scripts/seed-quiz-screen-variants.ts.
 */
export const AI_COMPARISON_FALLBACK: QuizScreenVariant = {
  focusKey: 'default',
  imageUrl: AI_COMPARISON_MIRROR_IMAGE,
  eyebrow: 'Ваша цель: здоровая кожа',
  quote: 'Средств много, но эффекта нет',
  bodyTitle: 'Проблема не в вашей коже. Проблема в случайном подборе.',
  bodyText: 'Ваш план соберётся на основе ваших ответов и особенностей кожи.',
  priority: 0,
};

/**
 * Выбирает вариант под цели пользователя.
 *
 * Целей можно отметить несколько, поэтому побеждает вариант с наибольшим priority
 * среди совпавших — так «акне» перебивает «увлажнение», а не побеждает тот, кто
 * первым лежит в массиве. Если совпадений нет, берём строку 'default', и только
 * если и её нет — вшитый фолбэк.
 */
export function pickScreenVariant(
  variants: QuizScreenVariant[],
  goalLabels: Array<string | null | undefined>,
  fallback: QuizScreenVariant = AI_COMPARISON_FALLBACK
): QuizScreenVariant {
  if (!variants.length) return fallback;

  const focusKeys = deriveFocusKeys(goalLabels);
  const matched = variants
    .filter((v) => focusKeys.has(v.focusKey))
    .sort((a, b) => b.priority - a.priority);

  return matched[0] || variants.find((v) => v.focusKey === 'default') || fallback;
}

/** Тянет варианты экрана. На любой ошибке отдаёт пустой список — вызывающий падает на фолбэк. */
export async function fetchScreenVariants(screenId: string): Promise<QuizScreenVariant[]> {
  try {
    const res = await fetch(`/api/quiz/screen-variants?screenId=${encodeURIComponent(screenId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.variants) ? data.variants : [];
  } catch {
    return [];
  }
}
