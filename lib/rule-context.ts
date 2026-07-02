// lib/rule-context.ts
// Типизированный RuleContext для нормализации полей профиля для правил рекомендаций
// Обеспечивает единую точку маппинга полей (age_group vs ageGroup, skin_type vs skinType, etc.)

import type { SkinProfile } from '@prisma/client';
import { currentSeason } from './seasonality';

export interface RuleContext {
  // Основные поля профиля
  skinType: string | null;
  skin_type: string | null; // Алиас для совместимости
  sensitivity: string | null;
  sensitivityLevel: string | null;
  sensitivity_level: string | null; // Алиас для совместимости
  ageGroup: string | null;
  age_group: string | null; // Алиас для совместимости
  age: string | null; // Алиас для совместимости

  // Дискретные уровни/риски (реальные колонки SkinProfile).
  // Правила вида { acneLevel: { gte: 3 } } / { pigmentationRisk: ['medium','high'] }
  // молча не матчились, т.к. RuleContext их не отдавал — добавлено.
  acneLevel: number | null;
  dehydrationLevel: number | null;
  pigmentationRisk: string | null;
  rosaceaRisk: string | null;

  // Вычисленные оси кожи
  inflammation: number;
  oiliness: number;
  hydration: number;
  barrier: number;
  pigmentation: number;
  photoaging: number;

  // Контекст окружения / предпочтений.
  // Правила { season: 'winter' } / { skinTone: {...} } / { budget: ... } /
  // { preferences: { hasSome: [...] } } раньше были «мёртвыми» — ключей не было.
  season: string;
  skinTone: string | null;
  budget: string | null;
  preferences: string[];

  // Медицинские маркеры
  diagnoses: string[]; // ИСПРАВЛЕНО: Всегда на корневом уровне для консистентности
  allergies?: string[];
  contraindications?: string[];

  // Concerns из ответов пользователя (для правил, которые проверяют concerns: { hasSome: [...] })
  concerns?: string[];

  // Goals (skin_goals) пользователя в виде GoalKey-токенов (antiage/pores/…).
  // ВАЖНО: цели — отдельный сигнал от concerns. Раньше движок их вообще не видел,
  // и молодой пользователь с целью antiage/pores проваливался в сезонный фолбэк.
  goals?: string[];

  // Дополнительные поля
  hasPregnancy?: boolean;
  pregnant?: boolean;
}

// Каноническая карта возрастных групп профиля (underscore) -> токен, которым
// оперируют recommendation rules. Раньше делался слепой replace(_, -), из-за чего
// спец-токены ломались: "55_plus"→"55-plus" ≠ правило "55+"; "under_25"→"under-25"
// ≠ правило "under_25". А группа 45_54 не покрывалась ни одним правилом.
// Карта приводит любые встречавшиеся варианты бакетов к токену правила.
const AGE_GROUP_TO_RULE_TOKEN: Record<string, string> = {
  under_25: 'under_25',
  '18_24': 'under_25',
  '18_25': 'under_25',
  '25_34': '25-34',
  '26_30': '25-34',
  '31_40': '35-44',
  '35_44': '35-44',
  '41_50': '45-54',
  '45_54': '45-54',
  '55_plus': '55+',
  over_55: '55+',
};

/** Нормализует ageGroup профиля к токену правил (см. AGE_GROUP_TO_RULE_TOKEN). */
export function normalizeAgeToRuleToken(ageGroup: string | null | undefined): string | null {
  if (!ageGroup) return null;
  return AGE_GROUP_TO_RULE_TOKEN[ageGroup] ?? ageGroup.replace(/_/g, '-');
}

/**
 * Создает нормализованный RuleContext из профиля и вычисленных scores
 * ИСПРАВЛЕНО: Единая точка маппинга полей для всех правил
 */
export function buildRuleContext(
  profile: SkinProfile & { medicalMarkers?: any },
  skinScores: Array<{ axis: string; value: number }>,
  normalizedSkinType: string | null,
  normalizedSensitivity: string | null,
  concerns?: string[], // ИСПРАВЛЕНО: Добавлен параметр concerns для правил, которые проверяют concerns: { hasSome: [...] }
  goals?: string[] // Цели (skin_goals) как GoalKey-токены, для правил { goals: { hasSome: [...] } }
): RuleContext {
  const medicalMarkers = (profile.medicalMarkers as Record<string, any> | null) || {};

  // ИСПРАВЛЕНО: Нормализуем diagnoses - всегда на корневом уровне
  const diagnoses = Array.isArray(medicalMarkers.diagnoses) ? medicalMarkers.diagnoses : [];

  // skinTone берём из fitzpatrickType (единственный собираемый прокси тона кожи).
  // budget/preferences пока не собираются анкетой в стабильном виде — читаем из
  // профиля/маркеров «как есть», иначе null. Плумбинг готов: как только данные
  // появятся, соответствующие правила (freckles/minimalist/budget) оживут без
  // правок движка.
  const skinTone =
    (medicalMarkers.skinTone as string | undefined) ??
    (medicalMarkers.fitzpatrickType as string | undefined) ??
    null;
  const budget =
    ((profile as any).budgetSegment as string | undefined) ??
    (medicalMarkers.budget as string | undefined) ??
    null;
  const preferences = Array.isArray(medicalMarkers.preferences) ? medicalMarkers.preferences : [];

  return {
    // Основные поля с алиасами для совместимости
    skinType: normalizedSkinType || null,
    skin_type: normalizedSkinType || null,
    sensitivity: normalizedSensitivity || null,
    sensitivityLevel: normalizedSensitivity || null,
    sensitivity_level: normalizedSensitivity || null,
    ageGroup: profile.ageGroup || null,
    age_group: profile.ageGroup || null,
    // ВАЖНО: ключ `age` нормализуем к токену правил через явную карту
    // (см. normalizeAgeToRuleToken). Спец-токены "55+"/"under_25" и группа 45_54
    // раньше ломались на слепом replace(_, -). `age_group`/`ageGroup` оставляем в
    // исходном (underscore) формате для правил, которые ссылаются на них.
    age: normalizeAgeToRuleToken(profile.ageGroup),

    // Дискретные уровни/риски — реальные колонки профиля.
    acneLevel: typeof (profile as any).acneLevel === 'number' ? (profile as any).acneLevel : null,
    dehydrationLevel: typeof (profile as any).dehydrationLevel === 'number' ? (profile as any).dehydrationLevel : null,
    pigmentationRisk: (profile as any).pigmentationRisk ?? null,
    rosaceaRisk: (profile as any).rosaceaRisk ?? null,

    // Вычисленные оси кожи
    inflammation: skinScores.find(s => s.axis === 'inflammation')?.value || 0,
    oiliness: skinScores.find(s => s.axis === 'oiliness')?.value || 0,
    // ВАЖНО: ось 'hydration' хранит severity ОБЕЗВОЖЕННОСТИ (value = 100 - уровень
    // увлажнения; 0 = увлажнена, 100 = глубоко обезвожена — см. skin-analysis-engine.ts).
    // Но conditions_json правил написаны в семантике УРОВНЯ увлажнения (high=хорошо:
    // dehydration-all hydration<=40, normal-perfect hydration>=70). Конвертируем
    // severity -> level здесь, иначе правила инвертируются (ловят увлажнённых,
    // пропускают сухих). Отсутствие оси -> 100 (нет данных = протокол сухости не триггерим).
    hydration: 100 - (skinScores.find(s => s.axis === 'hydration')?.value ?? 0),
    barrier: skinScores.find(s => s.axis === 'barrier')?.value || 0,
    pigmentation: skinScores.find(s => s.axis === 'pigmentation')?.value || 0,
    photoaging: skinScores.find(s => s.axis === 'photoaging')?.value || 0,

    // Контекст окружения / предпочтений
    season: currentSeason(),
    skinTone,
    budget,
    preferences,

    // Медицинские маркеры - всегда на корневом уровне
    diagnoses: diagnoses,
    allergies: Array.isArray(medicalMarkers.allergies) ? medicalMarkers.allergies : undefined,
    contraindications: Array.isArray(medicalMarkers.contraindications) ? medicalMarkers.contraindications : undefined,
    
    // Concerns из ответов пользователя (для правил, которые проверяют concerns: { hasSome: [...] })
    concerns: concerns,

    // Goals (skin_goals) как GoalKey-токены
    goals: goals ?? [],

    // Дополнительные поля
    hasPregnancy: profile.hasPregnancy || false,
    pregnant: profile.hasPregnancy || false,
  };
}

