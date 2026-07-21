// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aggregateAnswerScores, createSkinProfile, determineSkinType, inferAnswerScore } from '@/lib/profile-calculator';

function answer(
  questionCode: string,
  selected: string | string[],
  options: Array<{ value: string; label: string; scoreJson?: Record<string, unknown> }>
) {
  return {
    questionId: Math.floor(Math.random() * 100000),
    answerValue: Array.isArray(selected) ? null : selected,
    answerValues: Array.isArray(selected) ? selected : null,
    question: {
      code: questionCode,
      answerOptions: options.map((option, index) => ({
        value: option.value,
        label: option.label,
        position: index + 1,
        scoreJson: option.scoreJson ?? {},
      })),
    },
  };
}

describe('profile-calculator: skin type classification', () => {
  it('keeps oily-combination skin when T-zone oiliness increases without dry cheeks', () => {
    const profile = createSkinProfile('combo-oily-user', 1, [
      answer('skin_type', 'COMBO_OILY', [
        {
          value: 'COMBO_OILY',
          label: 'Тип 4 — Комбинированная (жирная)\nВ Т-зоне появляется жирный блеск',
          scoreJson: { oiliness: 3, dehydration: 1 },
        },
      ]),
      answer('skin_concerns', ['OILINESS'], [
        {
          value: 'OILINESS',
          label: 'Жирность, блеск и расширенные поры',
          scoreJson: { oiliness: 2 },
        },
      ]),
    ] as any);

    expect(profile.skinType).toBe('combination_oily');
    expect(profile.notes).toContain('Комбинированная (жирная)');
  });

  it('still classifies truly oily skin as oily when there is no mixed-zone signal', () => {
    expect(determineSkinType({ oiliness: 5, dehydration: 0 })).toBe('oily');
  });

  it('uses explicit combination skinType from scoreJson before numeric oiliness overrides it', () => {
    expect(determineSkinType({ skinType: 'combination_oily', oiliness: 5, dehydration: 0 })).toBe('combination_oily');
  });

  it('infers current and legacy oily labels without confusing type numbers', () => {
    expect(inferAnswerScore('skin_type', 'Тип 4 — Жирная\nЖирный блеск присутствует во всех зонах лица')).toMatchObject({
      skinType: 'oily',
      oiliness: 5,
      dehydration: 0,
    });
    expect(
      inferAnswerScore('skin_type', 'Тип 4 — Комбинированная (жирная)\nВ Т-зоне появляется жирный блеск')
    ).toMatchObject({
      skinType: 'combination_oily',
      oiliness: 3,
      dehydration: 1,
    });
  });

  it('preserves the inferred combination hint through aggregation', () => {
    const scores = aggregateAnswerScores([
      inferAnswerScore('skin_type', 'Тип 3 — Комбинированная (жирная)\nВ области щёк кожа нормальная'),
      { oiliness: 2 },
    ]);

    expect(determineSkinType(scores)).toBe('combination_oily');
  });
});
