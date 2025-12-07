// lib/api-types.ts
// Типы для API ответов

import type { Plan28 } from './plan-types';

export interface PlanWeek {
  week: number;
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
  id: number;
  version: number;
  skinType: string;
  sensitivityLevel?: string | null;
  acneLevel?: number | null;
  ageGroup?: string | null;
  [key: string]: any;
}

