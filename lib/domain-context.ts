// lib/domain-context.ts
// Единый доменный контекст (DomainContext) — источник правды для правил, генерации плана и фильтров
//
// ВАЖНО: UI никогда не "достраивает смысл".
// Любая бизнес‑логика (фильтры, rules engine, генератор плана, дерматологические проверки)
// должна работать ТОЛЬКО через DomainContext.

import type { Questionnaire, Question } from './questionnaire-types';
import type { SkinProfile, SkinAxes, MedicalMarkers, Preferences } from './skinprofile-types';
import type { Product } from './plan-types';

export type AnswersMap = Record<string, string | string[]>;

export type ContextMeta = {
  userId: string;
  telegramId?: string;
  locale?: string;
  timezone?: string;
  isRetake?: boolean;
  retakeTopicId?: string;   // если перепроходят только тему
  isFullRetake?: boolean;   // если “пройти заново”
  hasResumed?: boolean;     // если “продолжить”
};

export type DomainContext = {
  meta: ContextMeta;

  // 1) Источник фактов (сырые данные анкеты)
  questionnaire: Questionnaire;
  allQuestionsRaw: Question[];
  answers: AnswersMap;

  // 2) Нормализованные доменные сущности
  profile: SkinProfile;        // нормализованный “тип кожи + проблемы + цели”
  axes: SkinAxes;              // оси/скоринги (barrier, sensitivity, acne, pigmentation...)
  medical: MedicalMarkers;     // беременность/лактация/розацеа/атопия/и т.п.
  preferences: Preferences;    // “не хочу брокколи” в мире SkinIQ: без отдушек/эко/бюджет/текстуры

  // 3) Данные для построения плана/подбора
  catalog: {
    products: Product[];
    ingredientsIndex?: Record<string, unknown>; // опционально: индекс по ингредиентам/INCI
  };

  // 4) Отладка/трассировка
  trace: {
    flags: string[];
    reasons: string[];
    warnings: string[];
  };
};

/**
 * ИСПРАВЛЕНО: Экспортируем buildDomainContext для использования во всех бизнес-логиках
 */
export { buildDomainContext } from './domain-context-builder';
export type { BuildDomainContextInput } from './domain-context-builder';


