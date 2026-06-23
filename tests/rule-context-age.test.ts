import { describe, it, expect } from 'vitest';
import { buildRuleContext, normalizeAgeToRuleToken } from '@/lib/rule-context';

// Регрессия на формат возраста: профиль хранит ageGroup в underscore ("35_44"),
// а recommendation rules задают age разными токенами ("35-44", "55+", "under_25").
// Ключ `age` должен мапиться к токену правила, иначе возрастные правила молча не
// матчатся (раньше слепой replace(_, -) ломал "55_plus"→"55-plus" и "under_25").
const mk = (ageGroup: string | null) =>
  buildRuleContext({ ageGroup, medicalMarkers: null } as any, [], 'combination_oily', 'low', []);

describe('buildRuleContext: нормализация возраста', () => {
  it('ключ `age` мапится к дефисным токенам правил', () => {
    expect(mk('35_44').age).toBe('35-44');
    expect(mk('25_34').age).toBe('25-34');
  });

  it('спец-токены сохраняются как ждут правила ("55+"/"under_25")', () => {
    expect(mk('55_plus').age).toBe('55+');
    expect(mk('under_25').age).toBe('under_25');
    expect(mk('18_24').age).toBe('under_25');
  });

  it('группа 45_54 покрыта токеном "45-54"', () => {
    expect(mk('45_54').age).toBe('45-54');
  });

  it('`age_group`/`ageGroup` остаются в исходном underscore-формате', () => {
    const c = mk('35_44');
    expect(c.age_group).toBe('35_44');
    expect(c.ageGroup).toBe('35_44');
  });

  it('неизвестный бакет фолбэчит на replace(_, -)', () => {
    expect(normalizeAgeToRuleToken('99_plus')).toBe('99-plus');
  });

  it('null не падает', () => {
    expect(mk(null).age).toBeNull();
    expect(normalizeAgeToRuleToken(null)).toBeNull();
  });
});
