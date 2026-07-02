// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createSkinProfile } from '@/lib/profile-calculator';

function answer(questionCode: string, selected: string | string[], labels: Record<string, string>) {
  return {
    questionId: Math.floor(Math.random() * 100000),
    answerValue: Array.isArray(selected) ? null : selected,
    answerValues: Array.isArray(selected) ? selected : null,
    question: {
      code: questionCode,
      answerOptions: Object.entries(labels).map(([value, label], index) => ({
        value,
        label,
        position: index + 1,
        scoreJson: {},
      })),
    },
  };
}

describe('profile-calculator: medical/sensitivity risk signals', () => {
  it('does not lose rosacea diagnosis when scoreJson is empty', () => {
    const profile = createSkinProfile('user-1', 1, [
      answer('skin_type', 'normal', {
        normal: 'Тип 3 - Нормальная\nНет ощущения стянутости и сухости кожи',
      }),
      answer('medical_diagnoses', ['rosacea'], {
        rosacea: 'Розацеа',
      }),
    ] as any);

    expect(profile.sensitivityLevel).toBe('high');
    expect(profile.rosaceaRisk).toBe('high');
  });

  it('strong persistent redness makes sensitivity high and rosacea risk visible', () => {
    const profile = createSkinProfile('user-2', 1, [
      answer('skin_type', 'normal', {
        normal: 'Тип 3 - Нормальная\nНет ощущения стянутости и сухости кожи',
      }),
      answer('skin_sensitivity', 'strong_redness', {
        strong_redness: 'Сильное и стойкое покраснение, возможны диагнозы (розацеа, дерматит)',
      }),
    ] as any);

    expect(profile.sensitivityLevel).toBe('high');
    expect(profile.rosaceaRisk).toBe('medium');
  });

  it('atopic and seborrheic dermatitis raise sensitivity from medical_diagnoses', () => {
    const profile = createSkinProfile('user-3', 1, [
      answer('skin_type', 'normal', {
        normal: 'Тип 3 - Нормальная\nНет ощущения стянутости и сухости кожи',
      }),
      answer('medical_diagnoses', ['atopic', 'seborrheic'], {
        atopic: 'Атопический дерматит / сухая кожа',
        seborrheic: 'Себорейный дерматит',
      }),
    ] as any);

    expect(profile.sensitivityLevel).toBe('high');
    expect(profile.dehydrationLevel).toBeGreaterThanOrEqual(3);
  });
});
