// scripts/test-rules-with-profiles.ts
// Улучшенные тесты правил с проверкой соответствия профилям

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Функция проверки соответствия правила профилю (та же логика, что в API)
function matchesRule(profile: any, rule: any): boolean {
  const conditions = rule.conditionsJson as any;

  for (const [key, condition] of Object.entries(conditions)) {
    const profileValue = profile[key];

    if (Array.isArray(condition)) {
      if (!condition.includes(profileValue)) {
        return false;
      }
    } else if (typeof condition === 'object' && condition !== null) {
      const conditionObj = condition as Record<string, unknown>;
      if (typeof profileValue === 'number') {
        if ('gte' in conditionObj && typeof conditionObj.gte === 'number') {
          if (profileValue < conditionObj.gte) return false;
        }
        if ('lte' in conditionObj && typeof conditionObj.lte === 'number') {
          if (profileValue > conditionObj.lte) return false;
        }
      }
    } else if (condition !== profileValue) {
      return false;
    }
  }

  return true;
}

// Тестовые профили для проверки правил
const testProfiles = [
  {
    name: 'Жирная кожа + акне 18-30',
    profile: {
      skinType: 'oily',
      acneLevel: 3,
      ageGroup: '18_25',
    },
    expectedRule: 'Жирная кожа + акне 18-30',
  },
  {
    name: 'Сухая кожа + чувствительность',
    profile: {
      skinType: 'dry',
      sensitivityLevel: 'high',
    },
    expectedRule: 'Сухая кожа + чувствительность',
  },
  {
    name: 'Комбинированная кожа (базовый уход)',
    profile: {
      skinType: 'combo',
    },
    expectedRule: 'Комбинированная кожа (базовый уход)',
  },
  {
    name: 'Нормальная кожа (поддерживающий уход)',
    profile: {
      skinType: 'normal',
    },
    expectedRule: 'Нормальная кожа (поддерживающий уход)',
  },
  {
    name: 'Акне 1-2 степени',
    profile: {
      skinType: 'oily',
      acneLevel: 2,
    },
    expectedRule: 'Акне 1–2 степени (папулы + пустулы)',
  },
  {
    name: 'Акне 3-4 степени',
    profile: {
      skinType: 'oily',
      acneLevel: 4,
    },
    expectedRule: 'Акне 3–4 степени (узлы, кисты)',
  },
  {
    name: 'Беременность и ГВ',
    profile: {
      skinType: 'normal',
      hasPregnancy: true,
    },
    expectedRule: 'Беременность и ГВ — безопасный уход',
  },
  {
    name: 'Чувствительная кожа + пигментация',
    profile: {
      skinType: 'sensitive',
      pigmentationRisk: 'medium',
    },
    expectedRule: 'Чувствительная кожа + пигментация',
  },
  {
    name: 'Жирная кожа + акне + пигментация',
    profile: {
      skinType: 'oily',
      acneLevel: 2,
      pigmentationRisk: 'medium',
    },
    expectedRule: 'Жирная кожа + акне + пигментация',
  },
  {
    name: 'Комбинированная кожа + акне + пигментация',
    profile: {
      skinType: 'combo',
      acneLevel: 2,
      pigmentationRisk: 'medium',
    },
    expectedRule: 'Комбинированная кожа + акне + пигментация',
  },
];

async function testRulesWithProfiles() {
  console.log('=== Тестирование правил с реальными профилями ===\n');

  // Получаем все активные правила
  const rules = await prisma.recommendationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
  });

  console.log(`Всего активных правил: ${rules.length}\n`);

  const results: Array<{
    profileName: string;
    matched: boolean;
    matchedRuleName?: string;
    expectedRuleName?: string;
    errors: string[];
  }> = [];

  for (const testProfile of testProfiles) {
    console.log(`\n🧪 Тестирую профиль: ${testProfile.name}`);
    console.log(`   Параметры:`, testProfile.profile);

    let matchedRule: any = null;

    // Ищем подходящее правило
    for (const rule of rules) {
      if (matchesRule(testProfile.profile, rule)) {
        matchedRule = rule;
        break;
      }
    }

    const matched = !!matchedRule;
    const matchesExpected = matchedRule?.name === testProfile.expectedRule;

    if (matched) {
      if (matchesExpected) {
        console.log(`   ✅ Найдено правило: "${matchedRule.name}" (ожидалось)`);
      } else {
        console.log(`   ⚠️  Найдено правило: "${matchedRule.name}" (ожидалось: "${testProfile.expectedRule}")`);
      }
    } else {
      console.log(`   ❌ Правило не найдено (ожидалось: "${testProfile.expectedRule}")`);
    }

    results.push({
      profileName: testProfile.name,
      matched,
      matchedRuleName: matchedRule?.name,
      expectedRuleName: testProfile.expectedRule,
      errors: matched && !matchesExpected ? [`Найдено "${matchedRule.name}" вместо "${testProfile.expectedRule}"`] : [],
    });
  }

  console.log('\n\n=== ИТОГОВЫЕ РЕЗУЛЬТАТЫ ===\n');

  const matchedCount = results.filter(r => r.matched).length;
  const correctMatches = results.filter(r => r.matched && r.matchedRuleName === r.expectedRuleName).length;

  console.log(`✅ Профилей с найденными правилами: ${matchedCount}/${results.length}`);
  console.log(`✅ Профилей с правильными правилами: ${correctMatches}/${results.length}\n`);

  if (correctMatches < results.length) {
    console.log('⚠️  Профили с проблемами:');
    results
      .filter(r => !r.matched || r.matchedRuleName !== r.expectedRuleName)
      .forEach(r => {
        console.log(`\n   Профиль: ${r.profileName}`);
        if (!r.matched) {
          console.log(`   ❌ Правило не найдено`);
        } else {
          console.log(`   ⚠️  Найдено: "${r.matchedRuleName}"`);
          console.log(`   Ожидалось: "${r.expectedRuleName}"`);
        }
      });
  }

  console.log('\n✅ Тестирование завершено!\n');

  await prisma.$disconnect();

  process.exit(correctMatches < results.length ? 1 : 0);
}

testRulesWithProfiles().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});

