// lib/api-types.ts
// Типы для API ответов

import type { Plan28 } from './plan-types';

export interface PlanWeek {
  week: number;
  days?: any[]; // Для совместимости со старым форматом
  summary: {
    focus: string[];
    productsCount: number;
  };
}

export interface SkinScore {
  axis: string;
  value: number;
  level: string;
  title: string;
  description: string;
  color: string;
}

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
  category: string;
  price: number;
  available: string;
  imageUrl?: string;
  ingredients?: string[];
}

export interface PlanProfile {
  skinType: string;
  sensitivityLevel?: string | null;
  acneLevel?: number | null;
  primaryFocus: string;
  concerns: string[];
  ageGroup: string;
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
}

export interface WishlistResponse {
  items: Array<{
    id: string;
    productId: number;
    product?: {
      id: number;
      name: string;
      brand: { name: string };
      price: number | null;
      imageUrl: string | null;
      description?: string;
    };
    createdAt: string;
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
      brand: { name: string };
      price: number | null;
      imageUrl: string | null;
      description?: string;
    };
    createdAt: string;
  }>;
}

export interface AnalysisResponse {
  issues: Array<{
    id: string;
    name: string;
    severity: 'low' | 'medium' | 'high';
    description?: string;
  }>;
  gender?: 'male' | 'female';
  age?: number;
  recommendations?: string[];
}

