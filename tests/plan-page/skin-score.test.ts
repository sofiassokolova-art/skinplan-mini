// tests/plan-page/skin-score.test.ts
// Юнит-тесты на calcSkinScore — чистая функция, не трогает БД.

import { describe, it, expect } from 'vitest';
import { calcSkinScore } from '@/lib/plan-page/skin-score';
import type { SkinProfile } from '@prisma/client';

/**
 * Минимальный фабрикуемый SkinProfile для тестов.
 * Заполняем только поля, которые читает calcSkinScore — остальное оставляем nullable.
 */
function makeProfile(overrides: Partial<SkinProfile> = {}): SkinProfile {
  return {
    id: 'test-profile',
    userId: 'test-user',
    version: 1,
    skinType: null,
    sensitivityLevel: null,
    dehydrationLevel: null,
    acneLevel: null,
    rosaceaRisk: null,
    pigmentationRisk: null,
    ageGroup: null,
    hasPregnancy: false,
    medicalMarkers: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as SkinProfile;
}

describe('calcSkinScore', () => {
  it('даёт 100 при полностью чистом профиле', () => {
    const result = calcSkinScore(makeProfile());
    expect(result.score).toBe(100);
    expect(result.label).toBe('высокая');
  });

  it('режет 12 баллов за каждый уровень acneLevel', () => {
    expect(calcSkinScore(makeProfile({ acneLevel: 1 })).score).toBe(88);
    expect(calcSkinScore(makeProfile({ acneLevel: 2 })).score).toBe(76);
    expect(calcSkinScore(makeProfile({ acneLevel: 3 })).score).toBe(64);
  });

  it('режет за чувствительность по таблице', () => {
    expect(calcSkinScore(makeProfile({ sensitivityLevel: 'low' })).score).toBe(100);
    expect(calcSkinScore(makeProfile({ sensitivityLevel: 'medium' })).score).toBe(92);
    expect(calcSkinScore(makeProfile({ sensitivityLevel: 'high' })).score).toBe(84);
    expect(calcSkinScore(makeProfile({ sensitivityLevel: 'very_high' })).score).toBe(78);
  });

  it('режет за обезвоженность (−5 за уровень)', () => {
    expect(calcSkinScore(makeProfile({ dehydrationLevel: 1 })).score).toBe(95);
    expect(calcSkinScore(makeProfile({ dehydrationLevel: 3 })).score).toBe(85);
  });

  it('режет за rosacea и pigmentation', () => {
    expect(calcSkinScore(makeProfile({ rosaceaRisk: 'high' })).score).toBe(90);
    expect(calcSkinScore(makeProfile({ rosaceaRisk: 'medium' })).score).toBe(95);
    expect(calcSkinScore(makeProfile({ pigmentationRisk: 'high' })).score).toBe(94);
    expect(calcSkinScore(makeProfile({ pigmentationRisk: 'medium' })).score).toBe(97);
  });

  it('комбинированные срезы складываются', () => {
    const p = makeProfile({
      acneLevel: 2,           // −24
      sensitivityLevel: 'high', // −16
      dehydrationLevel: 1,    // −5
      pigmentationRisk: 'high', // −6
    });
    expect(calcSkinScore(p).score).toBe(49);
  });

  it('клампит снизу до 20', () => {
    const p = makeProfile({
      acneLevel: 3,             // −36
      sensitivityLevel: 'very_high', // −22
      dehydrationLevel: 3,      // −15
      rosaceaRisk: 'high',      // −10
      pigmentationRisk: 'high', // −6
    });
    // 100 − 89 = 11 → клампится в 20
    expect(calcSkinScore(p).score).toBe(20);
    expect(calcSkinScore(p).label).toBe('критичная');
  });

  it('границы лейблов: 80, 60, 40', () => {
    // 80 → "высокая"
    expect(calcSkinScore(makeProfile({ dehydrationLevel: 1 })).label).toBe('высокая'); // 95
    // 60..79 → "средняя"
    expect(calcSkinScore(makeProfile({ acneLevel: 2 })).label).toBe('средняя'); // 76
    expect(calcSkinScore(makeProfile({
      acneLevel: 2, sensitivityLevel: 'medium',
    })).label).toBe('средняя'); // 68
    // 40..59 → "низкая"
    expect(calcSkinScore(makeProfile({
      acneLevel: 3, sensitivityLevel: 'high',
    })).label).toBe('низкая'); // 48
    // <40 → "критичная"
    expect(calcSkinScore(makeProfile({
      acneLevel: 3, sensitivityLevel: 'very_high', dehydrationLevel: 3,
    })).label).toBe('критичная'); // 27
  });

  it('генерирует описание с триггерами под профиль', () => {
    const withAcne = calcSkinScore(makeProfile({ acneLevel: 2 }));
    expect(withAcne.description).toMatch(/выраженные воспаления и постакне/i);

    const withSensitive = calcSkinScore(makeProfile({ sensitivityLevel: 'high' }));
    expect(withSensitive.description).toMatch(/защитного барьера/i);

    const withPigmentation = calcSkinScore(makeProfile({ pigmentationRisk: 'high' }));
    expect(withPigmentation.description).toMatch(/пигментации/i);
  });

  it('описание содержит стратегию плана, согласованную со скором', () => {
    const high = calcSkinScore(makeProfile());
    expect(high.description).toMatch(/профилактик/i);

    const mid = calcSkinScore(makeProfile({ acneLevel: 2 }));
    expect(mid.description).toMatch(/восстановления барьера/i);

    const low = calcSkinScore(makeProfile({
      acneLevel: 3, sensitivityLevel: 'high',
    }));
    expect(low.description).toMatch(/не с агрессивных активов/i);
  });

  it('terpит null/undefined без падения', () => {
    expect(() => calcSkinScore(makeProfile({
      acneLevel: null,
      sensitivityLevel: null,
      dehydrationLevel: null,
    }))).not.toThrow();
  });

  it('обрабатывает уровень за пределами 0..3 (клампит)', () => {
    expect(calcSkinScore(makeProfile({ acneLevel: 99 })).score).toBe(64); // как acneLevel = 3
    expect(calcSkinScore(makeProfile({ acneLevel: -5 })).score).toBe(100); // как acneLevel = 0
  });
});
