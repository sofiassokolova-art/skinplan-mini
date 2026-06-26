// scripts/update-rule-condition-coverage.ts
// Чинит conditionsJson правил, чьи токены условий рассинхронизированы с тем, что
// реально кладёт RuleContext (см. lib/rule-context.ts).
//
// Идемпотентно. DRY=1 — превью без записи.
//
// Что нормализуем:
// - skin_type/skinType: "combo" -> combination_oily/combination_dry
// - skin_type/skinType: "sensitive" -> sensitivity_level: "high"
// - age/age_group/ageGroup: старые бакеты 18-25/18_25/26_30 -> age-токены правил
// - acne_level -> acneLevel
// - точечные исторические фиксы: antiage 45-54 и freckles Fitzpatrick I_II
import { prisma } from '../lib/db';

const DRY = process.env.DRY === '1';
const INCLUDE_INACTIVE = process.env.INCLUDE_INACTIVE === '1';

type Conditions = Record<string, any>;

const COMBO_RULE_TYPES = ['combination_oily', 'combination_dry'];

const AGE_VALUE_MAP: Record<string, string> = {
  '18-25': 'under_25',
  '18_25': 'under_25',
  '18_24': 'under_25',
  'under-25': 'under_25',
  '26_30': '25-34',
  '25_34': '25-34',
  '31_40': '35-44',
  '35_44': '35-44',
  '41_50': '45-54',
  '45_54': '45-54',
  '55_plus': '55+',
  '55-plus': '55+',
  over_55: '55+',
};

const EXACT_PATCHES: Array<{ name: string; conditions: Conditions }> = [
  {
    name: 'Активный анти-эйдж 35–45 лет',
    conditions: { age: { in: ['35-44', '45-54'] } },
  },
  {
    name: 'Веснушки + фототип I–II',
    conditions: { skinTone: { in: ['I_II'] } },
  },
];

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function normalizeAgeValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return AGE_VALUE_MAP[value] ?? value;
}

function normalizeAgeCondition(condition: any): any {
  if (typeof condition === 'string') return normalizeAgeValue(condition);
  if (Array.isArray(condition)) {
    return { in: unique(condition.map((value) => String(normalizeAgeValue(value)))) };
  }
  if (condition && typeof condition === 'object') {
    if (Array.isArray(condition.in)) {
      return {
        ...condition,
        in: unique(condition.in.map((value: unknown) => String(normalizeAgeValue(value)))),
      };
    }
    if ('equals' in condition) {
      return { ...condition, equals: normalizeAgeValue(condition.equals) };
    }
  }
  return condition;
}

function expandComboValue(value: unknown): string[] {
  if (value === 'combo') return COMBO_RULE_TYPES;
  return [String(value)];
}

function normalizeSkinCondition(condition: any): any {
  if (condition === 'combo') return { in: COMBO_RULE_TYPES };
  if (Array.isArray(condition)) {
    if (!condition.includes('combo')) return condition;
    return { in: unique(condition.flatMap(expandComboValue)) };
  }
  if (condition && typeof condition === 'object') {
    if (Array.isArray(condition.in)) {
      if (!condition.in.includes('combo')) return condition;
      return { ...condition, in: unique(condition.in.flatMap(expandComboValue)) };
    }
    if (condition.equals === 'combo') return { in: COMBO_RULE_TYPES };
  }
  return condition;
}

function onlySensitiveSkinCondition(condition: any): boolean {
  if (condition === 'sensitive') return true;
  if (Array.isArray(condition)) return condition.length === 1 && condition[0] === 'sensitive';
  if (condition && typeof condition === 'object') {
    if (condition.equals === 'sensitive') return true;
    if (Array.isArray(condition.in)) {
      return condition.in.length === 1 && condition.in[0] === 'sensitive';
    }
  }
  return false;
}

function normalizeConditions(input: Conditions): Conditions {
  const next: Conditions = {};

  for (const [key, condition] of Object.entries(input || {})) {
    if (key === 'acne_level') {
      next.acneLevel = condition;
      continue;
    }

    if (key === 'age_group' || key === 'ageGroup') {
      next.age = normalizeAgeCondition(condition);
      continue;
    }

    if (key === 'age') {
      next.age = normalizeAgeCondition(condition);
      continue;
    }

    if (key === 'skin_type' || key === 'skinType') {
      if (onlySensitiveSkinCondition(condition)) {
        next.sensitivity_level = next.sensitivity_level ?? 'high';
        continue;
      }
      next[key] = normalizeSkinCondition(condition);
      continue;
    }

    next[key] = condition;
  }

  return next;
}

async function main() {
  console.log(`${DRY ? 'DRY' : 'APPLY'} recommendation rule condition coverage`);
  console.log(`scope: ${INCLUDE_INACTIVE ? 'all rules' : 'active rules'}\n`);

  const exactPatchByName = new Map(EXACT_PATCHES.map((patch) => [patch.name, patch.conditions]));
  const rules = await prisma.recommendationRule.findMany({
    where: INCLUDE_INACTIVE ? {} : { isActive: true },
    select: { id: true, name: true, conditionsJson: true },
    orderBy: { id: 'asc' },
  });

  let changed = 0;
  for (const rule of rules) {
    const baseConditions = exactPatchByName.get(rule.name) ?? (rule.conditionsJson as Conditions);
    const normalized = normalizeConditions(baseConditions);

    if (sameJson(rule.conditionsJson, normalized)) continue;
    changed += 1;

    console.log(`#${rule.id} "${rule.name}"`);
    console.log(`  OLD: ${JSON.stringify(rule.conditionsJson)}`);
    console.log(`  NEW: ${JSON.stringify(normalized)}`);

    if (!DRY) {
      await prisma.recommendationRule.update({
        where: { id: rule.id },
        data: { conditionsJson: normalized as any },
      });
      console.log('  updated');
    }
    console.log('');
  }

  console.log(`changed: ${changed}/${rules.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
