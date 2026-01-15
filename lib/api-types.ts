// lib/api-types.ts
// ИСПРАВЛЕНО: Типы для API ответов с доменными ошибками и версионированием

import type { Plan28 } from './plan-types';
import type { SkinScore } from './skin-analysis-engine';
import type { GoalKey } from './concern-taxonomy';
import type { SkinProfile } from './skinprofile-types';
import type { StepCategory } from './step-category-rules';
import type { ConcernKey } from './concern-taxonomy';

// РЕФАКТОРИНГ P2: Тип для ссылок на маркетплейсы
export interface MarketLink {
  url: string;
  marketplace: 'ozon' | 'wildberries' | 'yandex' | 'sber' | 'other' | string;
  price?: number;
  available?: boolean;
}

export type MarketLinks = MarketLink[] | Record<string, string> | null;

/**
 * ИСПРАВЛЕНО (P0): Доменные коды ошибок API
 * Позволяет фронту точно знать, что произошло
 */
export type ApiErrorCode =
  | 'PLAN_EMPTY'
  | 'PLAN_INVALID'
  | 'PLAN_HAS_NO_DAYS'
  | 'PLAN_HAS_NO_STEPS'
  | 'PLAN_HAS_NO_PRODUCTS'
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_INVALID'
  | 'RECOMMENDATIONS_EMPTY'
  | 'RECOMMENDATIONS_NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'QUESTIONNAIRE_NOT_FOUND'
  | 'QUESTIONNAIRE_INCOMPLETE'
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'DB_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * ИСПРАВЛЕНО (P0): Типизированный ответ API с discriminated union
 * success: true + data: T - успешный ответ
 * success: false + error: ApiErrorCode - ошибка с доменным кодом
 */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiErrorCode; details?: string; message?: string };

// ИСПРАВЛЕНО: Тип для legacy формата дней плана
export interface PlanDayLegacy {
  morning: number[];
  evening: number[];
}

export interface PlanWeek {
  week: number;
  days?: PlanDayLegacy[]; // ИСПРАВЛЕНО: Заменили any[] на PlanDayLegacy[]
  summary: {
    focus: GoalKey[]; // ИСПРАВЛЕНО: Используем GoalKey вместо string[]
    productsCount: number;
  };
}

// ИСПРАВЛЕНО: Используем SkinScore из skin-analysis-engine вместо дублирования
export type { SkinScore } from './skin-analysis-engine';

/**
 * ИСПРАВЛЕНО (P1): Типизированное ограничение mustHave
 * Поддерживает два формата:
 * 1. MustHaveConstraint - для правил валидации
 * 2. MustHaveProduct - для рекомендаций с конкретными продуктами
 */
export interface MustHaveConstraint {
  category: StepCategory;
  reason?: string;
  minCount?: number; // Минимальное количество продуктов этой категории
}

export interface MustHaveProduct {
  name: string;
  brand: string;
  price: number;
  category?: string; // Для обратной совместимости с getDermatologistRecommendations
}

export interface DermatologistRecommendations {
  heroActives: string[];
  mustHave: MustHaveProduct[]; // ИСПРАВЛЕНО (P1): Типизировано вместо any[], но сохраняет совместимость с getDermatologistRecommendations
  avoid: string[];
}

export interface InfographicProgress {
  week: number;
  acne: number;
  pores: number;
  hydration: number;
  pigmentation: number;
  wrinkles: number;
  inflammation?: number;
  photoaging?: number;
  oiliness?: number;
}

// РЕФАКТОРИНГ P2: Типизация ChartConfig
export interface ChartDataset {
  label?: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  fill?: boolean;
}

export interface ChartData {
  labels?: string[];
  datasets?: ChartDataset[];
}

export interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  plugins?: Record<string, unknown>;
  scales?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | string;
  data: ChartData;
  options: ChartOptions;
}

export interface PlanProduct {
  id: number;
  name: string;
  brand: string;
  category: StepCategory; // ИСПРАВЛЕНО: Используем StepCategory вместо string
  price: number;
  available: string;
  imageUrl?: string;
  ingredients?: string[];
  skinTypes?: SkinProfile["skinType"][]; // ИСПРАВЛЕНО: Используем union тип из SkinProfile
  concerns?: ConcernKey[]; // ИСПРАВЛЕНО: Используем ConcernKey вместо string[]
  step?: StepCategory; // ИСПРАВЛЕНО: Используем StepCategory вместо string
}

export interface PlanProfile {
  skinType: SkinProfile["skinType"]; // ИСПРАВЛЕНО: Используем union тип из SkinProfile
  sensitivityLevel?: SkinProfile["sensitivity"] | null; // ИСПРАВЛЕНО: Используем union тип
  acneLevel?: number | null;
  primaryFocus: GoalKey; // ИСПРАВЛЕНО: Используем GoalKey вместо string
  concerns: ConcernKey[]; // ИСПРАВЛЕНО: Используем ConcernKey вместо string[]
  ageGroup: SkinProfile["ageGroup"] | null; // ИСПРАВЛЕНО: Используем union тип
}

export interface GeneratedPlan {
  profile: PlanProfile;
  skinScores?: SkinScore[];
  dermatologistRecommendations?: DermatologistRecommendations;
  weeks: PlanWeek[];
  infographic: {
    progress: InfographicProgress[];
    chartConfig: ChartConfig;
  };
  products: PlanProduct[];
  warnings?: string[];
  plan28?: Plan28;
  formatVersion: "legacy" | "v2"; // ИСПРАВЛЕНО (P0): Обязательное поле версии формата
  // ИСПРАВЛЕНО (P2): Статус рендеринга плана
  planStatus?: PlanProgressStatus;
}

// РЕФАКТОРИНГ P2: Типизация ProfileResponse
export interface ProfileScore {
  key: string;
  value: number;
  label?: string;
}

export interface ProfileResponse {
  id: string; // Всегда строка для совместимости с PlanData
  version: number;
  skinType: string;
  skinTypeRu?: string;
  primaryConcernRu?: string;
  sensitivityLevel?: string | null;
  acneLevel?: number | null;
  ageGroup?: string | null;
  scores?: ProfileScore[];
  createdAt?: string;
  updatedAt?: string;
  // РЕФАКТОРИНГ: Убран [key: string]: any для лучшей типизации
  // Дополнительные поля добавляются явно при необходимости
  concerns?: ConcernKey[];
  primaryFocus?: GoalKey;
  notes?: string | null;
}

// Типы для API ответов
export interface UserProfileResponse {
  id: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  language: string;
  phoneNumber: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastActive: string | null;
}

/**
 * ИСПРАВЛЕНО (P0): PlanResponse с версионированием формата
 */
export interface PlanResponse {
  plan28?: Plan28;
  weeks?: PlanWeek[];
  products?: PlanProduct[];
  profile?: PlanProfile;
  warnings?: string[];
  expired?: boolean; // Флаг истечения плана (28+ дней)
  daysSinceCreation?: number; // Количество дней с момента создания плана
  formatVersion: 'legacy' | 'v2'; // ИСПРАВЛЕНО (P0): Обязательное поле версии формата
  // ИСПРАВЛЕНО (P2): Статус рендеринга плана
  isPlanRenderable?: boolean; // Можно ли рендерить план
  missingReasons?: string[]; // Причины, почему план нельзя рендерить
}

export interface WishlistResponse {
  items: Array<{
    id: string;
    productId: number;
    product?: {
      id: number;
      name: string;
      brand: { id?: number; name: string };
      price: number | null;
      imageUrl: string | null;
      description?: string;
      link?: string | null;
      marketLinks?: MarketLinks;
    };
    createdAt: string;
    feedback?: string | null;
  }>;
}

export interface CartResponse {
  items: Array<{
    id: string;
    productId: number;
    quantity: number;
    product?: {
      id: number;
      name: string;
      brand: { id?: number; name: string };
      price: number | null;
      imageUrl: string | null;
      description?: string;
      link?: string | null;
      marketLinks?: MarketLinks;
    };
    createdAt: string;
  }>;
}

export interface SkinIssue {
  id: string;
  name: string;
  severity_score: number;
  severity_label: 'критично' | 'плохо' | 'умеренно' | 'хорошо' | 'отлично';
  description: string;
  tags: string[];
  image_url?: string;
}

export interface CareStep {
  stepNumber: number;
  stepName: string;
  stepDescription: string;
  stepTags: string[];
  products: Array<{
    id: number;
    name: string;
    brand: { name: string };
    price?: number | null;
    imageUrl?: string | null;
    description?: string;
    tags?: string[];
  }>;
}

export interface AnalysisResponse {
  profile: {
    gender?: string | null;
    age?: number | null;
    skinType: string;
    skinTypeRu: string;
    keyProblems: string[];
  };
  issues: SkinIssue[];
  morningSteps: CareStep[];
  eveningSteps: CareStep[];
}

export interface QuizProgressResponse {
  progress?: {
    questionnaireId: number;
    currentQuestionId?: number;
    currentQuestionIndex?: number;
    currentInfoScreenIndex?: number;
    answers: Record<string, string | string[]>;
  };
  isCompleted?: boolean;
  hasAnswers?: boolean;
}

/**
 * ИСПРАВЛЕНО (P2): Статус прогресса плана с детальной информацией
 */
export interface PlanProgressStatus {
  isPlanRenderable: boolean; // Можно ли рендерить план
  missingReasons: string[]; // Причины, почему план нельзя рендерить
  hasDays: boolean;
  hasSteps: boolean;
  hasProducts: boolean;
  hasRequiredSteps: boolean; // Есть ли обязательные шаги (cleanser, moisturizer)
  daysCount: number;
  stepsCount: number;
  productsCount: number;
  coverage: number; // 0-100, процент покрытия обязательных категорий
}

export interface SubmitAnswersResponse {
  success: boolean;
  profile?: {
    id: string;
    version: number;
  };
  answersCount?: number;
  error?: string;
}

export interface RecommendationsResponse {
  profile_summary: {
    skinType: string;
    sensitivityLevel: string | null;
    acneLevel: number | null;
    notes: string | null;
  };
  rule: {
    name: string;
  };
  steps: Record<string, Array<{
    id: number;
    name: string;
    brand: string;
    line: string;
    category: string;
    step: string;
    description: string;
    marketLinks?: MarketLinks;
    imageUrl: string | null;
  }>>;
}

/**
 * ИСПРАВЛЕНО (P1): RecommendationBuildResponse с информацией о статусе
 */
export interface RecommendationBuildResponse {
  recommendationSessionId: string; // ИСПРАВЛЕНО: Переименовано для ясности
  ruleId: number | null;
  products: number[];
  isExisting: boolean;
  productCount: number; // ИСПРАВЛЕНО (P1): Количество продуктов
  status: 'ok' | 'empty'; // ИСПРАВЛЕНО (P1): Статус (ok если есть продукты, empty если нет)
}

export interface ProductFromBatch {
  id: number;
  name: string;
  brand: {
    id: number;
    name: string;
  };
  price: number | null;
  volume: string | null;
  imageUrl: string | null;
  description?: string;
  descriptionUser?: string;
  step: string;
  category: string;
  skinTypes: string[];
  concerns: string[];
  activeIngredients?: string[];
}

