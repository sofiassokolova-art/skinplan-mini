// tests/quiz-info-flows.test.ts
// Юнит-тесты для связки: вопросы анкеты ↔ инфо-экраны ↔ цепочки экранов.
// ОБНОВЛЕНО под новую структуру воронки (после оптимизации конверсии):
// — удалены: current_care_intro, ai_showcase, habits_matter, motivation_focus,
//   created_for_you, вопросы spf_frequency/sun_exposure/lifestyle_habits/retinoid_reaction;
// — добавлен gate-вопрос has_avoid_ingredients;
// — health_data/general_info_intro/skin_features_intro/preferences_intro переведены
//   в формат mini-progress-step (поля stepNumber/totalSteps/stepLabel);
// — health_trust теперь анкорится на has_avoid_ingredients, а не на allergies/avoid_ingredients;
// — ai_comparison переанкорен на oral_medications.

import { describe, it, expect } from 'vitest';
import {
  INFO_SCREENS,
  getInitialInfoScreens,
  getInfoScreenAfterQuestion,
  getNextInfoScreenAfterScreen,
  walkInfoScreenChain,
  findChainOriginQuestionCode,
  type InfoScreen,
} from '@/app/(miniapp)/quiz/info-screens';

// Вспомогательная функция: достать цепочку экранов, которая начинается после вопроса с givenCode.
function getChainForQuestion(questionCode: string): InfoScreen[] {
  const first = getInfoScreenAfterQuestion(questionCode);
  if (!first) return [];
  return walkInfoScreenChain(first);
}

describe('Quiz info screens config & chains', () => {
  it('начальные инфо-экраны корректно определяются (нет showAfterQuestionCode/showAfterInfoScreenId)', () => {
    const initial = getInitialInfoScreens();

    // Должны быть хотя бы welcome/how_it_works/personal_analysis/goals_intro
    const initialIds = initial.map((s) => s.id);
    expect(initialIds.length).toBeGreaterThanOrEqual(3);

    // Ни один начальный экран не должен иметь триггеры
    for (const screen of initial) {
      expect(screen.showAfterQuestionCode).toBeUndefined();
      expect(screen.showAfterInfoScreenId).toBeUndefined();
    }
  });

  it('удалённые экраны больше не существуют в INFO_SCREENS', () => {
    const removed = [
      'current_care_intro',
      'ai_showcase',
      'habits_matter',
      'motivation_focus',
      'created_for_you',
    ];
    for (const id of removed) {
      expect(INFO_SCREENS.find((s) => s.id === id)).toBeUndefined();
    }
  });

  it('skin_preview шёл после seasonal_changes и тянет цепочку simple_care → health_data', () => {
    const first = getInfoScreenAfterQuestion('seasonal_changes');
    expect(first?.id).toBe('skin_preview');

    const chain = first ? walkInfoScreenChain(first) : [];
    const ids = chain.map((s) => s.id);
    expect(ids).toEqual(['skin_preview', 'simple_care', 'health_data']);
  });

  it('health_data — это mini-progress-step (Шаг 3 из 4)', () => {
    const screen = INFO_SCREENS.find((s) => s.id === 'health_data');
    expect(screen).toBeDefined();
    expect(screen!.stepNumber).toBe(3);
    expect(screen!.totalSteps).toBe(4);
    expect(screen!.stepLabel).toBe('Данные о здоровье');
  });

  it('health_trust теперь анкорится на has_avoid_ingredients (был avoid_ingredients/allergies)', () => {
    const first = getInfoScreenAfterQuestion('has_avoid_ingredients');
    expect(first?.id).toBe('health_trust');

    // А на старые якоря health_trust больше НЕ привязан
    expect(getInfoScreenAfterQuestion('allergies')).toBeUndefined();
    expect(getInfoScreenAfterQuestion('avoid_ingredients')).toBeUndefined();
  });

  it('ai_comparison переанкорен на oral_medications и тянет preferences_intro', () => {
    const first = getInfoScreenAfterQuestion('oral_medications');
    expect(first?.id).toBe('ai_comparison');

    const chain = first ? walkInfoScreenChain(first) : [];
    const ids = chain.map((s) => s.id);
    expect(ids).toEqual(['ai_comparison', 'preferences_intro']);

    // origin для preferences_intro — именно oral_medications
    const prefs = INFO_SCREENS.find((s) => s.id === 'preferences_intro');
    expect(prefs).toBeDefined();
    expect(findChainOriginQuestionCode(prefs!)).toBe('oral_medications');
  });

  it('preferences_intro и general_info_intro и skin_features_intro — все mini-progress-step', () => {
    const progressSteps: Array<[string, number, number]> = [
      ['general_info_intro', 1, 4],
      ['skin_features_intro', 2, 4],
      ['health_data', 3, 4],
      ['preferences_intro', 4, 4],
    ];
    for (const [id, expectedNum, expectedTotal] of progressSteps) {
      const screen = INFO_SCREENS.find((s) => s.id === id);
      expect(screen, `screen ${id} should exist`).toBeDefined();
      expect(screen!.stepNumber).toBe(expectedNum);
      expect(screen!.totalSteps).toBe(expectedTotal);
    }
  });

  it('финальная цепочка после budget: no_mistakes → recognize_yourself_1 → recognize_yourself_2 → skin_transformation → want_improve', () => {
    const first = getInfoScreenAfterQuestion('budget');
    expect(first?.id).toBe('no_mistakes');

    const chain = first ? walkInfoScreenChain(first) : [];
    const ids = chain.map((s) => s.id);
    expect(ids).toEqual([
      'no_mistakes',
      'recognize_yourself_1',
      'recognize_yourself_2',
      'skin_transformation',
      'want_improve',
    ]);
  });

  it('walkInfoScreenChain не зацикливается и всегда возвращает последовательность без повторов', () => {
    for (const screen of INFO_SCREENS) {
      const chain = walkInfoScreenChain(screen);
      const ids = chain.map((s) => s.id);

      // В цепочке нет повторяющихся id
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    }
  });

  it('findChainOriginQuestionCode корректно находит origin для любого экрана цепочки', () => {
    const pairs: Array<{ originQuestionCode: string; midScreenId: string }> = [
      { originQuestionCode: 'skin_goals', midScreenId: 'testimonials' },
      { originQuestionCode: 'seasonal_changes', midScreenId: 'skin_preview' },
      { originQuestionCode: 'seasonal_changes', midScreenId: 'simple_care' },
      { originQuestionCode: 'seasonal_changes', midScreenId: 'health_data' },
      { originQuestionCode: 'has_avoid_ingredients', midScreenId: 'health_trust' },
      { originQuestionCode: 'oral_medications', midScreenId: 'ai_comparison' },
      { originQuestionCode: 'oral_medications', midScreenId: 'preferences_intro' },
      { originQuestionCode: 'budget', midScreenId: 'no_mistakes' },
      { originQuestionCode: 'budget', midScreenId: 'recognize_yourself_1' },
      { originQuestionCode: 'budget', midScreenId: 'recognize_yourself_2' },
      { originQuestionCode: 'budget', midScreenId: 'skin_transformation' },
      { originQuestionCode: 'budget', midScreenId: 'want_improve' },
    ];

    for (const { originQuestionCode, midScreenId } of pairs) {
      const screen = INFO_SCREENS.find((s) => s.id === midScreenId);
      expect(screen, `screen ${midScreenId} should exist`).toBeDefined();
      const foundOrigin = findChainOriginQuestionCode(screen!);
      expect(foundOrigin, `${midScreenId} → origin`).toBe(originQuestionCode);
    }
  });
});
