// tests/plan-page/profile-cards.test.ts
// Юнит-тесты на buildProfileCards — приоритеты, лимит 4, корректные value/description.

import { describe, it, expect } from 'vitest';
import { buildProfileCards } from '@/lib/plan-page/profile-cards';
import type { SkinProfile } from '@prisma/client';

function makeProfile(overrides: Partial<SkinProfile> = {}): SkinProfile {
  return {
    id: 'p',
    userId: 'u',
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

describe('buildProfileCards', () => {
  it('всегда показывает Тип кожи и Барьер первыми', () => {
    const cards = buildProfileCards(makeProfile({
      skinType: 'combo',
      sensitivityLevel: 'high',
    }));
    expect(cards[0]?.key).toBe('skinType');
    expect(cards[1]?.key).toBe('barrier');
  });

  it('никогда не возвращает больше 4 карточек', () => {
    const cards = buildProfileCards(makeProfile({
      skinType: 'oily',
      sensitivityLevel: 'high',
      acneLevel: 3,
      dehydrationLevel: 3,
      pigmentationRisk: 'high',
      rosaceaRisk: 'high',
      ageGroup: '25_34',
    }));
    expect(cards.length).toBeLessThanOrEqual(4);
  });

  it('Барьер: high → ослаблен, medium → нормальный, low → крепкий', () => {
    expect(buildProfileCards(makeProfile({ skinType: 'oily', sensitivityLevel: 'high' }))[1]?.value).toBe('ослаблен');
    expect(buildProfileCards(makeProfile({ skinType: 'oily', sensitivityLevel: 'medium' }))[1]?.value).toBe('нормальный');
    expect(buildProfileCards(makeProfile({ skinType: 'oily', sensitivityLevel: 'low' }))[1]?.value).toBe('крепкий');
  });

  it('high acne получает более высокий приоритет, чем возраст', () => {
    const cards = buildProfileCards(makeProfile({
      skinType: 'oily',
      sensitivityLevel: 'medium',
      acneLevel: 3,
      ageGroup: '25_34',
    }));
    // 4 карточки: skinType, barrier, acne (приоритет = 3*10+30 = 60), age (10).
    expect(cards.map((c) => c.key)).toContain('acne');
    const acneIdx = cards.findIndex((c) => c.key === 'acne');
    const ageIdx = cards.findIndex((c) => c.key === 'age');
    if (ageIdx !== -1) {
      expect(acneIdx).toBeLessThan(ageIdx);
    }
  });

  it('не показывает Акне при acneLevel=0', () => {
    const cards = buildProfileCards(makeProfile({
      skinType: 'oily',
      sensitivityLevel: 'medium',
      acneLevel: 0,
      ageGroup: '25_34',
    }));
    expect(cards.find((c) => c.key === 'acne')).toBeUndefined();
  });

  it('не показывает Пигментацию при low/null', () => {
    const cards = buildProfileCards(makeProfile({
      skinType: 'oily',
      sensitivityLevel: 'medium',
      pigmentationRisk: 'low',
    }));
    expect(cards.find((c) => c.key === 'pigmentation')).toBeUndefined();
  });

  it('Возраст u18 даёт молодёжное описание', () => {
    const cards = buildProfileCards(makeProfile({
      skinType: 'oily',
      sensitivityLevel: 'medium',
      ageGroup: 'u18',
    }));
    const age = cards.find((c) => c.key === 'age');
    expect(age?.description).toMatch(/молодая кожа/i);
  });

  it('возвращает только Тип кожи + Барьер, если нет других флагов', () => {
    const cards = buildProfileCards(makeProfile({
      skinType: 'dry',
      sensitivityLevel: 'low',
      acneLevel: 0,
      dehydrationLevel: 0,
    }));
    expect(cards).toHaveLength(2);
  });

  it('пропускает Тип кожи, если поле пустое', () => {
    const cards = buildProfileCards(makeProfile({
      skinType: null,
      sensitivityLevel: 'high',
    }));
    expect(cards.find((c) => c.key === 'skinType')).toBeUndefined();
    expect(cards[0]?.key).toBe('barrier');
  });

  it('Акне уровни 1/2/3 дают разные value', () => {
    const v1 = buildProfileCards(makeProfile({ skinType: 'oily', sensitivityLevel: 'medium', acneLevel: 1 }))
      .find((c) => c.key === 'acne');
    const v2 = buildProfileCards(makeProfile({ skinType: 'oily', sensitivityLevel: 'medium', acneLevel: 2 }))
      .find((c) => c.key === 'acne');
    const v3 = buildProfileCards(makeProfile({ skinType: 'oily', sensitivityLevel: 'medium', acneLevel: 3 }))
      .find((c) => c.key === 'acne');
    expect(v1?.value).toBe('лёгкая степень');
    expect(v2?.value).toBe('умеренная');
    expect(v3?.value).toBe('выраженная');
  });
});
