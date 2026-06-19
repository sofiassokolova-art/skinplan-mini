// lib/plan-page/types.ts
// Типы для страницы плана (UI-ориентированные)

import type { GoalKey } from '@/lib/concern-taxonomy';
import type { PlanPhases } from '@/lib/plan-types';

/** Hero: фаза + день */
export interface PlanHeroInfo {
  /** "Адаптация" | "Активная фаза" | "Поддержка" */
  phaseLabel: string;
  /** "adaptation" | "active" | "support" */
  phaseKey: PlanPhases;
  /** День внутри фазы — 1..7 / 1..14 / 1..7 */
  dayInPhase: number;
  /** Общее число дней в текущей фазе */
  daysInPhase: number;
  /** Текущий день плана 1..28 */
  currentDay: number;
}

/** Стрик */
export interface PlanStreakInfo {
  currentStreak: number;
  /** "6 дней подряд" / "1 день" / "0 дней" — готовая строка для UI */
  label: string;
}

/** Оценка кожи 0..100 + текст */
export interface SkinScoreInfo {
  score: number;          // 20..100
  /** "высокая" | "средняя" | "низкая" | "критичная" */
  label: 'высокая' | 'средняя' | 'низкая' | 'критичная';
  /** Персонализированное объяснение оценки (2-3 предложения) */
  description: string;
}

/** Карточка карусели "Профиль кожи" */
export interface ProfileCard {
  /** Стабильный ключ для React */
  key: 'skinType' | 'barrier' | 'sensitivity' | 'acne' | 'dehydration'
       | 'pigmentation' | 'rosacea' | 'age';
  /** "Тип кожи" / "Барьер" / ... */
  label: string;
  /** "комбинированная" / "ослаблен" / "лёгкая степень" */
  value: string;
  /** Описание (1-2 предложения) */
  description: string;
}

/** Одна фаза в секции "3 фазы плана" */
export interface PhaseUI {
  phase: PlanPhases;
  phaseLabel: string;       // "Адаптация"
  daysLabel: string;        // "Дни 1–7" / "Дни 8–21" / "Дни 22–28"
  description: string;
  tags: string[];           // ['очищение', 'крем', 'SPF']
  state: 'past' | 'current' | 'upcoming';
}

/** Действие, которое уже сделано пользователем для продукта */
export interface ProductState {
  inCart: boolean;
  inWishlist: boolean;
  /** ID продукта, которым пользователь заменил оригинал (если есть). */
  replacedByProductId: number | null;
}

/** Продукт для UI */
export interface ProductCard {
  id: number;
  name: string;
  brand: string;
  /** Категория продукта из БД (cleanser/toner/serum/treatment/moisturizer/mask/spf) — для выбора иконки-заглушки */
  category: string | null;
  /** descriptionUser ?? description ?? null */
  shortDescription: string | null;
  /** Цена в рублях */
  price: number | null;
  imageUrl: string | null;
  /** Теги фаз: "Адаптация" / "Активная фаза" / "Поддержка" / "Все фазы" */
  phaseTags: string[];
  /** Состояние пользователя */
  state: ProductState;
  /** Сколько есть альтернатив (для индикации "Заменить") */
  replacementsCount: number;
}

/** Совет в "Советах дерматолога" */
export interface ExpertNote {
  /** "01" / "02" — порядковый номер */
  number: string;
  title: string;
  text: string;
}

/** Полный контекст страницы плана — то, что отдаёт API */
export interface PlanPageContext {
  user: {
    firstName: string;
  };
  /** "Соня, ваш персональный протокол ухода" */
  heading: string;
  hero: PlanHeroInfo;
  streak: PlanStreakInfo;
  skinScore: SkinScoreInfo;
  profileCards: ProfileCard[];     // 2..4
  phases: PhaseUI[];                // всегда 3
  /** mainGoals из Plan28 (для UI-чипов / отладки) */
  mainGoals: GoalKey[];
  products: ProductCard[];
  expertNotes: ExpertNote[];        // 2 шт
  /** План просрочен (>28 дней) */
  planExpired: boolean;
}
