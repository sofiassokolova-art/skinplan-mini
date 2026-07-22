// tests/quiz-info-flows.test.ts
// Юнит-тесты для связки: вопросы анкеты ↔ инфо-экраны ↔ цепочки экранов.
// ОБНОВЛЕНО под новую структуру воронки (после оптимизации конверсии):
// — удалены: current_care_intro, ai_showcase, habits_matter, motivation_focus,
//   created_for_you, вопросы spf_frequency/sun_exposure/lifestyle_habits;
// — добавлен gate-вопрос has_avoid_ingredients;
// — УДАЛЕНЫ полностью: general_info_intro, skin_features_intro, health_data,
//   preferences_intro — были progress-step без UI и давали белую вспышку при переходе.
//   Шаги (1..4) теперь показываются только в QUESTION_STEP_MAP над прогресс-баром вопросов;
// — health_trust удалён как отдельный экран и перенесён в информер medical_diagnoses;
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

    // welcome/how_it_works. personal_analysis удалён как третий подряд вводный
    // экран до первого вопроса (дублировал how_it_works по смыслу).
    const initialIds = initial.map((s) => s.id);
    expect(initialIds).toEqual(['welcome', 'how_it_works']);

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
      // Срез дублирующих по смыслу экранов:
      'personal_analysis', // третий вводный экран до первого вопроса
      'simple_care',       // буквальный дубликат ai_comparison
      'health_trust',      // перенесён в информер первого медицинского вопроса
      'recognize_yourself_1', // tinder «Вы узнаёте себя?» — удалён
      'recognize_yourself_2', // tinder-экраны убраны целиком
    ];
    for (const id of removed) {
      expect(INFO_SCREENS.find((s) => s.id === id)).toBeUndefined();
    }
  });

  it('skin_preview идёт после fitzpatrick_type и цепочку дальше не тянет (simple_care удалён)', () => {
    const first = getInfoScreenAfterQuestion('fitzpatrick_type');
    expect(first?.id).toBe('skin_preview');

    const chain = first ? walkInfoScreenChain(first) : [];
    const ids = chain.map((s) => s.id);
    expect(ids).toEqual(['skin_preview']);
    expect(getInfoScreenAfterQuestion('seasonal_changes')).toBeUndefined();
  });

  it('health_trust больше не показывается отдельным экраном после медицинского блока', () => {
    expect(getInfoScreenAfterQuestion('has_avoid_ingredients')).toBeUndefined();
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

  it('финальная цепочка после budget: no_mistakes → want_improve', () => {
    // tinder-экраны recognize_yourself_1/2 удалены целиком; want_improve перецеплен
    // напрямую на no_mistakes и рендерится через ImproveSkinScreen (transformation-визуал
    // и CTA «Получить план»).
    const first = getInfoScreenAfterQuestion('budget');
    expect(first?.id).toBe('no_mistakes');

    const chain = first ? walkInfoScreenChain(first) : [];
    const ids = chain.map((s) => s.id);
    expect(ids).toEqual([
      'no_mistakes',
      'want_improve',
    ]);

    // tinder-экраны «Вы узнаёте себя?» больше не существуют.
    expect(INFO_SCREENS.find((s) => s.id === 'recognize_yourself_1')).toBeUndefined();
    expect(INFO_SCREENS.find((s) => s.id === 'recognize_yourself_2')).toBeUndefined();

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
      { originQuestionCode: 'oral_medications', midScreenId: 'ai_comparison' },
      { originQuestionCode: 'budget', midScreenId: 'no_mistakes' },
      // recognize_yourself_1 удалён; skin_transformation слит с want_improve.
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
