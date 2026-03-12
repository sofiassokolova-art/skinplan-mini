import { INFO_SCREENS, getInfoScreenAfterQuestion, walkInfoScreenChain, findChainOriginQuestionCode } from '@/app/(miniapp)/quiz/info-screens';

describe('quiz info flows', () => {
  it('после allergies идёт цепочка health_trust → current_care_intro', () => {
    const first = getInfoScreenAfterQuestion('allergies');
    expect(first?.id).toBe('health_trust');
    const chain = first ? walkInfoScreenChain(first) : [];
    const ids = chain.map((s) => s.id);
    expect(ids).toEqual(['health_trust', 'current_care_intro']);
  });

  it('origin для current_care_intro — allergies', () => {
    const currentCare = INFO_SCREENS.find((s) => s.id === 'current_care_intro')!;
    expect(findChainOriginQuestionCode(currentCare)).toBe('allergies');
  });

  it('после avoid_ingredients идёт цепочка ai_showcase → habits_matter', () => {
    const first = getInfoScreenAfterQuestion('avoid_ingredients');
    expect(first?.id).toBe('ai_showcase');
    const chain = first ? walkInfoScreenChain(first) : [];
    const ids = chain.map((s) => s.id);
    expect(ids).toEqual(['ai_showcase', 'habits_matter']);
  });

  it('origin для habits_matter — avoid_ingredients', () => {
    const habits = INFO_SCREENS.find((s) => s.id === 'habits_matter')!;
    expect(findChainOriginQuestionCode(habits)).toBe('avoid_ingredients');
  });
});

// tests/quiz-info-flows.test.ts
// Юнит-тесты для связки: вопросы анкеты ↔ инфо-экраны ↔ цепочки экранов.
// Тестируем только чистые функции и конфиги, без React-хуков.

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

  it('после allergies всегда идёт цепочка health_trust → current_care_intro', () => {
    const chain = getChainForQuestion('allergies');
    const ids = chain.map((s) => s.id);

    expect(ids[0]).toBe('health_trust');
    // current_care_intro должен быть сразу после health_trust
    expect(ids).toContain('current_care_intro');
    expect(ids[1]).toBe('current_care_intro');

    // origin для current_care_intro — allergies
    const currentCare = chain.find((s) => s.id === 'current_care_intro')!;
    expect(findChainOriginQuestionCode(currentCare)).toBe('allergies');
  });

  it('цепочка avoid_ingredients → ai_showcase → habits_matter корректно описана и привязана к вопросу', () => {
    const chain = getChainForQuestion('avoid_ingredients');
    const ids = chain.map((s) => s.id);

    // Первый экран после avoid_ingredients
    expect(ids[0]).toBe('ai_showcase');

    // Следующий в цепочке — habits_matter
    expect(ids[1]).toBe('habits_matter');

    const habits = chain[1];
    expect(habits.id).toBe('habits_matter');
    // origin для habits_matter — именно avoid_ingredients
    expect(findChainOriginQuestionCode(habits)).toBe('avoid_ingredients');
  });

  it('цепочка lifestyle_habits → ai_comparison → preferences_intro корректно описана и привязана к вопросу', () => {
    const chain = getChainForQuestion('lifestyle_habits');
    const ids = chain.map((s) => s.id);

    expect(ids[0]).toBe('ai_comparison');
    expect(ids[1]).toBe('preferences_intro');

    const preferences = chain[1];
    expect(preferences.id).toBe('preferences_intro');
    expect(findChainOriginQuestionCode(preferences)).toBe('lifestyle_habits');
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
      { originQuestionCode: 'allergies', midScreenId: 'health_trust' },
      { originQuestionCode: 'allergies', midScreenId: 'current_care_intro' },
      { originQuestionCode: 'avoid_ingredients', midScreenId: 'ai_showcase' },
      { originQuestionCode: 'avoid_ingredients', midScreenId: 'habits_matter' },
      { originQuestionCode: 'lifestyle_habits', midScreenId: 'ai_comparison' },
      { originQuestionCode: 'lifestyle_habits', midScreenId: 'preferences_intro' },
      { originQuestionCode: 'budget', midScreenId: 'no_mistakes' },
    ];

    for (const { originQuestionCode, midScreenId } of pairs) {
      const screen = INFO_SCREENS.find((s) => s.id === midScreenId);
      expect(screen).toBeDefined();
      const foundOrigin = findChainOriginQuestionCode(screen!);
      expect(foundOrigin).toBe(
        originQuestionCode,
      );
    }
  });
});

