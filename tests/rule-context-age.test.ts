import { describe, it, expect } from 'vitest';
import { buildRuleContext } from '@/lib/rule-context';

// Регрессия на формат возраста: профиль хранит ageGroup в underscore ("35_44"),
// а часть recommendation rules (включая anti-age) задаёт age в дефисах ("35-44").
// Ключ `age` должен нормализоваться, иначе возрастные правила молча не матчатся.
const mk = (ageGroup: string | null) =>
  buildRuleContext({ ageGroup, medicalMarkers: null } as any, [], 'combination_oily', 'low', []);

describe('buildRuleContext: нормализация возраста', () => {
  it('ключ `age` переводит underscore → hyphen (для дефисных правил)', () => {
    expect(mk('35_44').age).toBe('35-44');
    expect(mk('25_34').age).toBe('25-34');
    expect(mk('18_24').age).toBe('18-24');
  });

  it('`age_group`/`ageGroup` остаются в исходном underscore-формате', () => {
    const c = mk('35_44');
    expect(c.age_group).toBe('35_44');
    expect(c.ageGroup).toBe('35_44');
  });

  it('null не падает', () => {
    expect(mk(null).age).toBeNull();
  });
});
