import { describe, it, expect } from 'vitest';
import { ageIntensity, calculateSkinAxes } from '@/lib/skin-analysis-engine';

// Регрессия: возраст приходит сырым кодом опции ("age_4"), число 4 отсекалось
// (>=10), и ageIntensity возвращал 10 → photoaging ≈ возраст/2 = 5 даже у возрастных.
describe('ageIntensity: коды опций анкеты', () => {
  it('маппит age_1..age_5 в интенсивность', () => {
    expect(ageIntensity('age_1')).toBe(10);
    expect(ageIntensity('age_2')).toBe(10);
    expect(ageIntensity('age_3')).toBe(40);
    expect(ageIntensity('age_4')).toBe(70);
    expect(ageIntensity('age_5')).toBe(90);
  });

  it('по-прежнему понимает диапазоны/группы', () => {
    expect(ageIntensity('35-44')).toBe(70);
    expect(ageIntensity(undefined, '35_44')).toBe(70);
    expect(ageIntensity('45+')).toBe(90);
    expect(ageIntensity(undefined, '25_34')).toBe(40);
  });

  it('нет данных → 10', () => {
    expect(ageIntensity(undefined, undefined)).toBe(10);
  });
});

describe('photoaging axis: возрастной сигнал не теряется на кодах', () => {
  it('возрастной юзер с жалобой на морщины получает высокий photoaging', () => {
    const scores = calculateSkinAxes({
      age: 'age_5',
      concerns: ['Морщины и возрастные изменения'],
    } as any);
    const photo = scores.find((s) => s.axis === 'photoaging');
    expect(photo).toBeDefined();
    // age_5 (90)/2 + 40 за морщины
    expect(photo!.value).toBeGreaterThanOrEqual(80);
  });

  it('сырой код возраста больше не даёт photoaging ≈ 5', () => {
    const scores = calculateSkinAxes({ age: 'age_4', concerns: [] } as any);
    const photo = scores.find((s) => s.axis === 'photoaging');
    expect(photo!.value).toBeGreaterThanOrEqual(30); // 70/2
  });
});
