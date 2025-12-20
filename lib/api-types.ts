// lib/api-types.ts
// Типы для API ответов

import type { Plan28 } from './plan-types';
import type { SkinScore } from './skin-analysis-engine';
import type { GoalKey } from './concern-taxonomy';
import type { SkinProfile } from './skinprofile-types';
import type { StepCategory } from './step-category-rules';
import type { ConcernKey } from './concern-taxonomy';

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

export interface DermatologistRecommendations {
  heroActives: string[];
  mustHave: any[];
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

export interface ChartConfig {
  type: string;
  data: any;
  options: any;
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
  formatVersion?: "legacy" | "v2"; // ИСПРАВЛЕНО: Добавлен формат версии для совместимости
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
  scores?: any[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
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

export interface PlanResponse {
  plan28?: Plan28;
  weeks?: PlanWeek[];
  products?: PlanProduct[];
  profile?: PlanProfile;
  warnings?: string[];
  expired?: boolean; // Флаг истечения плана (28+ дней)
  daysSinceCreation?: number; // Количество дней с момента создания плана
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
      marketLinks?: any;
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
    product: {
      id: number;
      name: string;
      brand: { id?: number; name: string };
      price: number | null;
      imageUrl: string | null;
      description?: string;
      link?: string | null;
      marketLinks?: any;
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
    marketLinks?: any;
    imageUrl: string | null;
  }>>;
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

