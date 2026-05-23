// tests/plan-page/phase-content.test.ts
// Юнит-тесты на buildPhasesUI и buildHeroInfo.

import { describe, it, expect } from 'vitest';
import { buildPhasesUI, buildHeroInfo } from '@/lib/plan-page/phase-content';

describe('buildHeroInfo', () => {
  it('фаза adaptation на дне 1', () => {
    const hero = buildHeroInfo(1);
    expect(hero.phaseKey).toBe('adaptation');
    expect(hero.dayInPhase).toBe(1);
    expect(hero.daysInPhase).toBe(7);
  });

  it('границы фаз: 7 → adaptation, 8 → active, 21 → active, 22 → support', () => {
    expect(buildHeroInfo(7).phaseKey).toBe('adaptation');
    expect(buildHeroInfo(8).phaseKey).toBe('active');
    expect(buildHeroInfo(21).phaseKey).toBe('active');
    expect(buildHeroInfo(22).phaseKey).toBe('support');
    expect(buildHeroInfo(28).phaseKey).toBe('support');
  });

  it('правильно считает dayInPhase для активной фазы', () => {
    expect(buildHeroInfo(8).dayInPhase).toBe(1);
    expect(buildHeroInfo(8).daysInPhase).toBe(14);
    expect(buildHeroInfo(21).dayInPhase).toBe(14);
  });

  it('фаза поддержки: dayInPhase 1..7', () => {
    expect(buildHeroInfo(22).dayInPhase).toBe(1);
    expect(buildHeroInfo(22).daysInPhase).toBe(7);
    expect(buildHeroInfo(28).dayInPhase).toBe(7);
  });
});

describe('buildPhasesUI', () => {
  it('всегда возвращает 3 фазы в правильном порядке', () => {
    const phases = buildPhasesUI(1, []);
    expect(phases).toHaveLength(3);
    expect(phases.map((p) => p.phase)).toEqual(['adaptation', 'active', 'support']);
  });

  it('подсвечивает текущую фазу как current, остальные правильно', () => {
    const day15 = buildPhasesUI(15, []);
    expect(day15.find((p) => p.phase === 'adaptation')?.state).toBe('past');
    expect(day15.find((p) => p.phase === 'active')?.state).toBe('current');
    expect(day15.find((p) => p.phase === 'support')?.state).toBe('upcoming');
  });

  it('теги активной фазы зависят от mainGoals (acne → BHA)', () => {
    const phases = buildPhasesUI(10, ['acne']);
    const active = phases.find((p) => p.phase === 'active');
    expect(active?.tags).toContain('BHA');
    expect(active?.tags).toContain('ниацинамид');
  });

  it('теги для pigmentation включают витамин C', () => {
    const phases = buildPhasesUI(10, ['pigmentation']);
    const active = phases.find((p) => p.phase === 'active');
    expect(active?.tags).toContain('витамин C');
  });

  it('несколько целей объединяют теги (уникальные)', () => {
    const phases = buildPhasesUI(10, ['acne', 'pores']);
    const active = phases.find((p) => p.phase === 'active');
    expect(active?.tags).toContain('BHA');
    // дубликатов нет
    expect(new Set(active?.tags).size).toBe(active?.tags.length);
  });

  it('лимит тегов 3 даже при многих целях', () => {
    const phases = buildPhasesUI(10, ['acne', 'pores', 'pigmentation', 'wrinkles']);
    const active = phases.find((p) => p.phase === 'active');
    expect(active?.tags.length).toBeLessThanOrEqual(3);
  });

  it('пустой mainGoals → общий fallback', () => {
    const phases = buildPhasesUI(10, []);
    const active = phases.find((p) => p.phase === 'active');
    expect(active?.tags.length).toBeGreaterThan(0);
    expect(active?.description).toMatch(/общего улучшения/i);
  });

  it('описание активной фазы упоминает цели', () => {
    const phases = buildPhasesUI(10, ['acne']);
    const active = phases.find((p) => p.phase === 'active');
    expect(active?.description).toMatch(/воспалениями и постакне/i);
  });

  it('phaseLabel и daysLabel — на русском', () => {
    const phases = buildPhasesUI(1, []);
    expect(phases[0]?.phaseLabel).toBe('Адаптация');
    expect(phases[0]?.daysLabel).toBe('Дни 1–7');
    expect(phases[1]?.phaseLabel).toBe('Активная фаза');
    expect(phases[1]?.daysLabel).toBe('Дни 8–21');
    expect(phases[2]?.phaseLabel).toBe('Поддержка');
    expect(phases[2]?.daysLabel).toBe('Дни 22–28');
  });
});
