// lib/domain-context-builder.ts
// ИСПРАВЛЕНО: Функция buildDomainContext для создания единого доменного контекста
// Все правила, оси, план работают ТОЛЬКО через DomainContext

import type { DomainContext, AnswersMap, ContextMeta } from './domain-context';
import type { Questionnaire, Question } from './questionnaire-types';
import type { SkinProfile, SkinAxes, MedicalMarkers, Preferences } from './skinprofile-types';
import type { Product } from './plan-types';
import { calculateSkinAxes, type QuestionnaireAnswers } from './skin-analysis-engine';
import { logger } from './logger';

export interface BuildDomainContextInput {
  meta: ContextMeta;
  questionnaire: Questionnaire;
  allQuestionsRaw: Question[];
  answers: AnswersMap;
  profileSnapshot: SkinProfile; // Снимок профиля из БД
  products?: Product[]; // Опционально: каталог продуктов
}

/**
 * Строит единый доменный контекст из ответов и профиля
 * ИСПРАВЛЕНО: Центральная функция для создания DomainContext
 * Все правила, фильтры, генераторы планов должны работать ТОЛЬКО через DomainContext
 */
export function buildDomainContext(input: BuildDomainContextInput): DomainContext {
  const {
    meta,
    questionnaire,
    allQuestionsRaw,
    answers,
    profileSnapshot,
    products = [],
  } = input;

  // ИСПРАВЛЕНО: Вычисляем axes ТОЛЬКО из answers (источник правды)
  // Profile - это snapshot, не источник для расчета axes
  const questionnaireAnswers: QuestionnaireAnswers = {};
  
  // Преобразуем answers в QuestionnaireAnswers для расчета axes
  for (const [key, value] of Object.entries(answers)) {
    const question = allQuestionsRaw.find(q => q.code === key || String(q.id) === key);
    if (!question) continue;

    const code = question.code || key;
    
    if (code === 'skin_type' || code === 'skinType') {
      questionnaireAnswers.skinType = Array.isArray(value) 
        ? (typeof value[0] === 'string' ? value[0] : String(value[0]))
        : (typeof value === 'string' ? value : String(value));
    } else if (code === 'age' || code === 'age_group') {
      questionnaireAnswers.age = Array.isArray(value) 
        ? (typeof value[0] === 'string' ? value[0] : String(value[0]))
        : (typeof value === 'string' ? value : String(value));
    } else if (code === 'concerns' || code === 'skin_concerns') {
      questionnaireAnswers.concerns = Array.isArray(value) 
        ? value.filter((v): v is string => typeof v === 'string')
        : (typeof value === 'string' ? [value] : [String(value)]);
    } else if (code === 'habits') {
      questionnaireAnswers.habits = Array.isArray(value) 
        ? value.filter((v): v is string => typeof v === 'string')
        : (typeof value === 'string' ? [value] : [String(value)]);
    } else if (code === 'diagnoses') {
      questionnaireAnswers.diagnoses = Array.isArray(value) 
        ? value.filter((v): v is string => typeof v === 'string')
        : (typeof value === 'string' ? [value] : [String(value)]);
    } else if (code === 'allergies') {
      questionnaireAnswers.allergies = Array.isArray(value) 
        ? value.filter((v): v is string => typeof v === 'string')
        : (typeof value === 'string' ? [value] : [String(value)]);
    // ИСПРАВЛЕНО: Маппинг кодов анкеты - используем правильные коды из JSON правил
    // seasonality (не season_change), spf_usage (не spf_frequency), pregnancy (не pregnancy_breastfeeding)
    } else if (code === 'seasonality' || code === 'season_change' || code === 'seasonChange') {
      questionnaireAnswers.seasonChange = Array.isArray(value) 
        ? (typeof value[0] === 'string' ? value[0] : String(value[0]))
        : (typeof value === 'string' ? value : String(value));
    } else if (code === 'retinol_reaction' || code === 'retinolReaction') {
      questionnaireAnswers.retinolReaction = Array.isArray(value) 
        ? (typeof value[0] === 'string' ? value[0] : String(value[0]))
        : (typeof value === 'string' ? value : String(value));
    } else if (code === 'spf_usage' || code === 'spf_frequency' || code === 'spfFrequency') {
      questionnaireAnswers.spfFrequency = Array.isArray(value) 
        ? (typeof value[0] === 'string' ? value[0] : String(value[0]))
        : (typeof value === 'string' ? value : String(value));
    } else if (code === 'sun_exposure' || code === 'sunExposure') {
      questionnaireAnswers.sunExposure = Array.isArray(value) 
        ? (typeof value[0] === 'string' ? value[0] : String(value[0]))
        : (typeof value === 'string' ? value : String(value));
    } else if (code === 'sensitivity_level' || code === 'sensitivityLevel') {
      questionnaireAnswers.sensitivityLevel = Array.isArray(value) 
        ? (typeof value[0] === 'string' ? value[0] : String(value[0]))
        : (typeof value === 'string' ? value : String(value)) || 'low';
    } else if (code === 'acne_level' || code === 'acneLevel') {
      const numValue = Array.isArray(value) ? parseInt(value[0] as string) : parseInt(value as string);
      questionnaireAnswers.acneLevel = isNaN(numValue) ? 0 : numValue;
    // ИСПРАВЛЕНО: pregnancy (не pregnancy_breastfeeding) - как в JSON правил
    } else if (code === 'pregnancy' || code === 'pregnant' || code === 'has_pregnancy' || code === 'pregnancy_breastfeeding') {
      const boolValue = Array.isArray(value) ? value[0] : value;
      // ИСПРАВЛЕНО: Приводим к строке для сравнения, чтобы избежать ошибки типов
      const strValue = String(boolValue).toLowerCase();
      questionnaireAnswers.pregnant = strValue === 'yes' || strValue === 'true' || (typeof boolValue === 'boolean' && boolValue === true);
    }
  }

  // ИСПРАВЛЕНО: Вычисляем axes ТОЛЬКО из answers
  // Явно указываем тип, чтобы TypeScript гарантированно видел возвращаемое значение
  const axes: SkinAxes = calculateSkinAxes(questionnaireAnswers) as SkinAxes;

  // ИСПРАВЛЕНО: Извлекаем medical markers из profileSnapshot
  const medicalMarkers = (profileSnapshot as any).medicalMarkers || {};
  const medical: MedicalMarkers = {
    diagnoses: medicalMarkers.diagnoses || profileSnapshot.diagnoses || [],
    pregnancyStatus: profileSnapshot.pregnancyStatus || medicalMarkers.pregnancyStatus || 'none',
    allergies: medicalMarkers.allergies || [],
    gender: medicalMarkers.gender || profileSnapshot.gender,
    rosaceaRisk: medicalMarkers.rosaceaRisk,
    atopyRisk: medicalMarkers.atopyRisk,
  };

  // ИСПРАВЛЕНО: Извлекаем preferences из profileSnapshot
  const preferences: Preferences = {
    budgetSegment: profileSnapshot.budgetSegment || 'any',
    routineComplexity: profileSnapshot.routineComplexity || 'any',
    carePreference: profileSnapshot.carePreference || 'any',
    dislikedIngredients: medicalMarkers.dislikedIngredients || [],
    preferredTextures: medicalMarkers.preferredTextures || [],
    brandBlacklist: medicalMarkers.brandBlacklist || [],
    brandWhitelist: medicalMarkers.brandWhitelist || [],
  };

  // ИСПРАВЛЕНО: Создаем нормализованный profile из profileSnapshot
  // Profile - это snapshot, но мы нормализуем его для использования в правилах
  const normalizedProfile: SkinProfile = {
    skinType: profileSnapshot.skinType,
    sensitivity: profileSnapshot.sensitivity,
    mainGoals: profileSnapshot.mainGoals || [],
    secondaryGoals: profileSnapshot.secondaryGoals || [],
    diagnoses: medical.diagnoses || [],
    seasonality: profileSnapshot.seasonality,
    pregnancyStatus: medical.pregnancyStatus || null, // ИСПРАВЛЕНО: Приводим undefined к null
    contraindications: profileSnapshot.contraindications || [],
    currentTopicals: profileSnapshot.currentTopicals || [],
    currentOralMeds: profileSnapshot.currentOralMeds || [],
    spfHabit: profileSnapshot.spfHabit || 'never',
    makeupFrequency: profileSnapshot.makeupFrequency || 'rarely',
    lifestyleFactors: profileSnapshot.lifestyleFactors || [],
    carePreference: preferences.carePreference || 'any', // ИСПРАВЛЕНО: Fallback для undefined
    routineComplexity: preferences.routineComplexity || 'any', // ИСПРАВЛЕНО: Fallback для undefined
    budgetSegment: preferences.budgetSegment || 'any', // ИСПРАВЛЕНО: Fallback для undefined
    ageGroup: profileSnapshot.ageGroup,
    gender: medical.gender,
  };

  // ИСПРАВЛЕНО: Создаем и возвращаем context в конце функции
  const context: DomainContext = {
    meta,
    questionnaire,
    allQuestionsRaw,
    answers,
    profile: normalizedProfile,
    axes,
    medical,
    preferences,
    catalog: {
      products,
    },
    trace: {
      flags: [],
      reasons: [],
      warnings: [],
    },
  };

  return context;
}

