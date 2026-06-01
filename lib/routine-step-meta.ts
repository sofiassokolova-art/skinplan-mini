// lib/routine-step-meta.ts
//
// Единый источник метаданных шага рутины — заголовок, иконка, как наносить.
// Раньше эти 6 if/else дублировались в home/page.tsx (buildRoutineFromPlan
// + loadRecommendations, ~120 строк суммарно). Любая правка копи приходилось
// делать в обоих местах — иначе render-цепочки расходились.
//
// Использование:
//   import { getStepMeta, type BaseStep, type RoutineTime } from '@/lib/routine-step-meta';
//   const meta = getStepMeta('cleanser', 'AM');
//   meta.title  // 'Очищение'
//   meta.icon   // '/icons/clean/cleanser_true.png'
//   meta.howto  // { steps, volume, tip }
//
// Если getStepMeta получает неизвестный baseStep — вернёт null. Раньше
// неизвестные шаги тихо пропускались — поведение сохранено.

export type BaseStep =
  | 'cleanser'
  | 'toner'
  | 'serum'
  | 'treatment'
  | 'moisturizer'
  | 'spf'
  | 'lip_care';

export type RoutineTime = 'AM' | 'PM';

export interface StepHowTo {
  steps: string[];
  volume: string;
  tip: string;
}

export interface StepMeta {
  /** Заголовок шага в карточке рутины («Очищение», «Тонер», ...). */
  title: string;
  /** Путь к иконке (PNG в public/icons/clean/...). */
  icon: string;
  /** Инструкция «как использовать» для деталей шага. */
  howto: StepHowTo;
}

const ICONS = {
  cleanser: '/icons/clean/cleanser_true.png',
  toner: '/icons/clean/toner_true.png',
  serum: '/icons/clean/serum_true.png',
  cream: '/icons/clean/cream_true.png',
  spf: '/icons/clean/spf_true.png',
  treatment: '/icons/clean/treatment_true.png',
  lip: '/icons/clean/lipbalm_true.png',
} as const;

/**
 * Получить метаданные шага рутины. Возвращает null для неизвестных шагов
 * (это сознательное поведение — раньше такие шаги выбрасывались из render).
 */
export function getStepMeta(baseStep: string, time: RoutineTime): StepMeta | null {
  switch (baseStep) {
    case 'cleanser':
      return {
        title: 'Очищение',
        icon: ICONS.cleanser,
        howto: {
          steps: [
            'Смочите лицо тёплой водой',
            '1–2 нажатия геля в ладони',
            'Массируйте 30–40 сек',
            'Смойте, промокните полотенцем',
          ],
          volume: '1–2 нажатия',
          tip: 'Если кожа сухая утром — можно умыться только водой.',
        },
      };

    case 'toner':
      return {
        title: 'Тонер',
        icon: ICONS.toner,
        howto: {
          steps: [
            'Нанесите 3–5 капель на руки',
            'Распределите похлопывающими движениями',
            'Дайте впитаться 30–60 сек',
          ],
          volume: '3–5 капель',
          tip: 'Избегайте ватных дисков — тратите меньше продукта.',
        },
      };

    case 'serum':
    case 'treatment':
      return {
        title: time === 'AM' ? 'Актив' : 'Сыворотка',
        icon: baseStep === 'treatment' ? ICONS.treatment : ICONS.serum,
        howto: {
          steps: [
            '3–6 капель на сухую кожу',
            'Равномерно нанесите и дайте впитаться 1–2 минуты',
          ],
          volume: '3–6 капель',
          tip: 'При раздражении сделайте паузу в использовании актива.',
        },
      };

    case 'moisturizer':
      return {
        title: 'Крем',
        icon: ICONS.cream,
        howto: {
          steps: [
            'Горох крема распределить по лицу',
            'Мягко втереть по массажным линиям',
          ],
          volume: 'Горошина',
          tip: 'Не забывайте шею и линию подбородка.',
        },
      };

    case 'spf':
      return {
        title: 'SPF-защита',
        icon: ICONS.spf,
        howto: {
          steps: [
            'Нанести 2 пальца SPF (лицо/шея)',
            'Обновлять каждые 2–3 часа на улице',
          ],
          volume: '~1.5–2 мл',
          tip: 'При UV > 3 — обязательно SPF даже в облачную погоду.',
        },
      };

    case 'lip_care':
      return {
        title: 'Бальзам для губ',
        icon: ICONS.lip,
        howto: {
          steps: [
            'Нанести на губы тонким слоем',
            'Обновлять по необходимости в течение дня',
          ],
          volume: 'Тонкий слой',
          tip: 'Регулярное использование предотвращает сухость и трещины.',
        },
      };

    default:
      return null;
  }
}

/** Иконки шагов отдельно — пригодится, если где-то нужен только icon. */
export const STEP_ICONS = ICONS;
