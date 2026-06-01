// tests/quiz-info-flows.test.ts
// Юнит-тесты для связки: вопросы анкеты ↔ инфо-экраны ↔ цепочки экранов.
// ОБНОВЛЕНО под новую структуру воронки (после оптимизации конверсии):
// — удалены: current_care_intro, ai_showcase, habits_matter, motivation_focus,
//   created_for_you, вопросы spf_frequency/sun_exposure/lifestyle_habits;
// — добавлен gate-вопрос has_avoid_ingredients;
// — УДАЛЕНЫ полностью: general_info_intro, skin_features_intro, health_data,
//   preferences_intro — были progress-step без UI и давали белую вспышку при переходе.
//   Шаги (1..4) теперь показываются только в QUESTION_STEP_MAP над прогресс-баром вопросов;
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

    // Должны быть хотя бы welcome/how_it_works/personal_analysis
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
      // Progress-step филлеры, удалённые из-за белой вспышки при auto-advance:
      'general_info_intro',
      'skin_features_intro',
      'health_data',
      'preferences_intro',
      // Удалённый филлер перед вопросом про цели:
      'goals_intro',
    ];
    for (const id of removed) {
      expect(INFO_SCREENS.find((s) => s.id === id)).toBeUndefined();
    }
  });

  it('skin_preview идёт после fitzpatrick_type и тянет цепочку до simple_care (health_data удалён)', () => {
    const first = getInfoScreenAfterQuestion('fitzpatrick_type');
    expect(first?.id).toBe('skin_preview');

    const chain = first ? walkInfoScreenChain(first) : [];
    const ids = chain.map((s) => s.id);
    expect(ids).toEqual(['skin_preview', 'simple_care']);
    expect(getInfoScreenAfterQuestion('seasonal_changes')).toBeUndefined();
  });

  it('health_trust теперь анкорится на has_avoid_ingredients (был avoid_ingredients/allergies)', () => {
    const first = getInfoScreenAfterQuestion('has_avoid_ingredients');
    expect(first?.id).toBe('health_trust');

    // А на старые якоря health_trust больше НЕ привязан
    expect(getInfoScreenAfterQuestion('allergies')).toBeUndefined();
    expect(getInfoScreenAfterQuestion('avoid_ingredients')).toBeUndefined();
  });

  it('ai_comparison идёт после oral_medications (preferences_intro удалён)', () => {
    const first = getInfoScreenAfterQuestion('oral_medications');
    expect(first?.id).toBe('ai_comparison');

    const chain = first ? walkInfoScreenChain(first) : [];
    const ids = chain.map((s) => s.id);
    expect(ids).toEqual(['ai_comparison']);
  });

  it('после testimonials больше нет вложенной цепочки (general_info_intro удалён)', () => {
    const testimonials = INFO_SCREENS.find((s) => s.id === 'testimonials');
    expect(testimonials).toBeDefined();
    const next = getNextInfoScreenAfterScreen('testimonials');
    expect(next).toBeUndefined();
  });

  it('в INFO_SCREENS не осталось progress-step экранов (stepNumber/totalSteps удалены)', () => {
    const stepScreens = INFO_SCREENS.filter(
      (s) => s.stepNumber !== undefined || s.totalSteps !== undefined,
    );
    expect(stepScreens).toEqual([]);
  });

  it('финальная цепочка после budget: no_mistakes → recognize_yourself_1 → recognize_yourself_2 → want_improve', () => {
    // ФИКС #5 (PR #75): skin_transformation объединён с want_improve в один финальный экран.
    // want_improve теперь анкорится на recognize_yourself_2 напрямую и рендерится
    // через ImproveSkinScreen (совмещает transformation-визуал и CTA «Получить план»).
    const first = getInfoScreenAfterQuestion('budget');
    expect(first?.id).toBe('no_mistakes');

    const chain = first ? walkInfoScreenChain(first) : [];
    const ids = chain.map((s) => s.id);
    expect(ids).toEqual([
      'no_mistakes',
      'recognize_yourself_1',
      'recognize_yourself_2',
      'want_improve',
    ]);

    // И гарантируем, что старый отдельный skin_transformation больше не существует.
    expect(INFO_SCREENS.find((s) => s.id === 'skin_transformation')).toBeUndefined();
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
      { originQuestionCode: 'fitzpatrick_type', midScreenId: 'skin_preview' },
      { originQuestionCode: 'fitzpatrick_type', midScreenId: 'simple_care' },
      { originQuestionCode: 'has_avoid_ingredients', midScreenId: 'health_trust' },
      { originQuestionCode: 'oral_medications', midScreenId: 'ai_comparison' },
      { originQuestionCode: 'budget', midScreenId: 'no_mistakes' },
      { originQuestionCode: 'budget', midScreenId: 'recognize_yourself_1' },
      { originQuestionCode: 'budget', midScreenId: 'recognize_yourself_2' },
      // skin_transformation удалён в PR #75 (слит с want_improve в ImproveSkinScreen).
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
