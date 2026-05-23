// tests/plan-page/expert-notes.test.ts
// Юнит-тесты на pickExpertNotes — приоритет goal-specific, ротация, формат.

import { describe, it, expect } from 'vitest';
import { pickExpertNotes } from '@/lib/plan-page/expert-notes';
import { DAILY_TIPS } from '@/lib/plan-page/daily-tips-data';

describe('pickExpertNotes', () => {
  it('возвращает ровно 2 совета (если они есть в фазе)', () => {
    const notes = pickExpertNotes(1, []);
    expect(notes).toHaveLength(2);
  });

  it('форматирует номера как "01", "02"', () => {
    const notes = pickExpertNotes(1, []);
    expect(notes[0]?.number).toBe('01');
    expect(notes[1]?.number).toBe('02');
  });

  it('каждый совет содержит title и text', () => {
    const notes = pickExpertNotes(1, []);
    for (const n of notes) {
      expect(n.title.length).toBeGreaterThan(0);
      expect(n.text.length).toBeGreaterThan(0);
    }
  });

  it('советы для активной фазы (день 10) отличаются от адаптации', () => {
    const dayInAdaptation = pickExpertNotes(3, []);
    const dayInActive = pickExpertNotes(10, []);
    expect(dayInAdaptation[0]?.title).not.toBe(dayInActive[0]?.title);
  });

  it('приоритезирует goal-specific советы над универсальными', () => {
    // День 10, активная фаза, цель = acne. Должен попасть совет с goalKey: 'acne'.
    const notes = pickExpertNotes(10, ['acne']);
    const acneTip = DAILY_TIPS.find((t) =>
      t.phase === 'active' &&
      t.goalKey === 'acne' &&
      notes.some((n) => n.title === t.title),
    );
    expect(acneTip).toBeDefined();
  });

  it('ротирует советы по дню — разный первый совет в разных днях', () => {
    const d1 = pickExpertNotes(1, []);
    const d2 = pickExpertNotes(2, []);
    // Если в фазе adaptation больше 1 универсального совета, ротация даст разный first.
    // (В нашей библиотеке 3 универсальных совета для adaptation.)
    expect(d1[0]?.title).not.toBe(d2[0]?.title);
  });

  it('две карточки никогда не дублируются между собой', () => {
    for (let day = 1; day <= 28; day++) {
      const notes = pickExpertNotes(day, ['acne', 'pigmentation']);
      if (notes.length === 2) {
        expect(notes[0]!.title).not.toBe(notes[1]!.title);
      }
    }
  });

  it('пустые mainGoals — берёт только универсальные', () => {
    const notes = pickExpertNotes(10, []);
    // Все два совета должны быть с goalKey === null
    const tipsByTitle = new Map(DAILY_TIPS.map((t) => [t.title, t]));
    for (const n of notes) {
      const tip = tipsByTitle.get(n.title);
      expect(tip?.goalKey).toBeNull();
    }
  });

  it('не падает на дне за пределами 1..28', () => {
    expect(() => pickExpertNotes(0, [])).not.toThrow();
    expect(() => pickExpertNotes(100, [])).not.toThrow();
  });
});

describe('DAILY_TIPS data integrity', () => {
  it('каждая фаза имеет хотя бы один универсальный совет', () => {
    const phases = ['adaptation', 'active', 'support'] as const;
    for (const phase of phases) {
      const universal = DAILY_TIPS.filter((t) => t.phase === phase && t.goalKey === null);
      expect(universal.length).toBeGreaterThan(0);
    }
  });

  it('каждый совет имеет уникальный id', () => {
    const ids = DAILY_TIPS.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('title и text — непустые строки', () => {
    for (const t of DAILY_TIPS) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.text.length).toBeGreaterThan(0);
    }
  });
});
