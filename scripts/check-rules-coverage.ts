// scripts/check-rules-coverage.ts
// Проверка покрытия всех возможных комбинаций ответов правилами

import { prisma } from '../lib/db';
import { calculateSkinAxes, type QuestionnaireAnswers } from '../lib/skin-analysis-engine';

// Все возможные значения из схемы БД
const POSSIBLE_VALUES = {
  skinType: ['dry', 'oily', 'combo', 'normal', 'sensitive'],
  sensitivityLevel: ['low', 'medium', 'high'],
  acneLevel: [0, 1, 2, 3, 4, 5],
  dehydrationLevel: [0, 1, 2, 3, 4, 5],
  rosaceaRisk: ['none', 'low', 'medium', 'high'],
  pigmentationRisk: ['none', 'low', 'medium', 'high'],
  ageGroup: ['18_25', '26_30', '31_40', '41_50', '50_plus'],
  hasPregnancy: [false, true],
};

// Функция проверки соответствия правила профилю (та же логика, что в API)
function matchesRule(profile: any, rule: any): boolean {
  const conditions = rule.conditionsJson as any;

  for (const [key, condition] of Object.entries(conditions)) {
    const profileValue = profile[key];

    // Если поле отсутствует в профиле, правило не соответствует
    if (profileValue === undefined || profileValue === null) {
      if (typeof condition === 'object' && condition !== null && ('gte' in condition || 'lte' in condition)) {
        return false;
      }
      if (typeof condition !== 'object' || condition === null) {
        return false;
      }
      if (Array.isArray(condition)) {
        return false;
      }
    }

    if (Array.isArray(condition)) {
      if (!condition.includes(profileValue)) {
        return false;
      }
    } else if (typeof condition === 'object' && condition !== null) {
      if ('gte' in condition && typeof profileValue === 'number') {
        if (profileValue < condition.gte!) return false;
      }
      if ('lte' in condition && typeof profileValue === 'number') {
        if (profileValue > condition.lte!) return false;
      }
      if ('hasSome' in condition && Array.isArray(condition.hasSome)) {
        const profileArray = Array.isArray(profileValue) ? profileValue : [];
        const hasMatch = condition.hasSome.some((item: any) => profileArray.includes(item));
        if (!hasMatch) return false;
      }
      if ('in' in condition && Array.isArray(condition.in)) {
        if (!condition.in.includes(profileValue)) return false;
      }
    } else if (condition !== profileValue) {
      return false;
    }
  }

  return true;
}

// Создает профиль с вычисленными scores
function createProfileWithScores(
  skinType: string,
  sensitivityLevel: string,
  acneLevel: number,
  dehydrationLevel: number,
  ageGroup: string,
  hasPregnancy: boolean = false,
  concerns: string[] = [],
  diagnoses: string[] = []
): any {
  const questionnaireAnswers: QuestionnaireAnswers = {
    skinType,
    age: ageGroup === '18_25' ? '18-25' :
         ageGroup === '26_30' ? '25-34' :
         ageGroup === '31_40' ? '35-44' :
         ageGroup === '41_50' ? '35-44' :
         ageGroup === '50_plus' ? '45+' : '25-34',
    concerns,
    diagnoses,
    allergies: [],
    sensitivityLevel: sensitivityLevel as any,
    acneLevel,
  };

  const skinScores = calculateSkinAxes(questionnaireAnswers);

  return {
    skinType,
    skin_type: skinType,
    sensitivityLevel,
    sensitivity_level: sensitivityLevel,
    acneLevel,
    dehydrationLevel,
    ageGroup,
    age_group: ageGroup,
    age: ageGroup,
    hasPregnancy,
    pregnant: hasPregnancy,
    rosaceaRisk: 'none',
    pigmentationRisk: 'none',
    // Вычисленные scores
    inflammation: skinScores.find(s => s.axis === 'inflammation')?.value || 0,
    oiliness: skinScores.find(s => s.axis === 'oiliness')?.value || 0,
    hydration: skinScores.find(s => s.axis === 'hydration')?.value || 0,
    barrier: skinScores.find(s => s.axis === 'barrier')?.value || 0,
    pigmentation: skinScores.find(s => s.axis === 'pigmentation')?.value || 0,
    photoaging: skinScores.find(s => s.axis === 'photoaging')?.value || 0,
  };
}

async function checkCoverage() {
  console.log('🔍 Проверка покрытия правилами всех возможных комбинаций ответов...\n');

  // Получаем все активные правила
  const rules = await prisma.recommendationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
    select: {
      id: true,
      name: true,
      priority: true,
      conditionsJson: true,
    },
  });

  console.log(`📋 Всего активных правил: ${rules.length}\n`);

  // Проверяем базовые комбинации (без учета scores)
  const uncovered: any[] = [];
  const covered: any[] = [];

  // Проверяем комбинации по основным полям
  for (const skinType of POSSIBLE_VALUES.skinType) {
    for (const sensitivityLevel of POSSIBLE_VALUES.sensitivityLevel) {
      for (const acneLevel of POSSIBLE_VALUES.acneLevel) {
        for (const ageGroup of POSSIBLE_VALUES.ageGroup) {
          // Проверяем обычные комбинации
          const profile = createProfileWithScores(
            skinType,
            sensitivityLevel,
            acneLevel,
            1, // dehydrationLevel = 1 (средний)
            ageGroup,
            false,
            [],
            []
          );

          // Проверяем, есть ли правило для этого профиля
          let matched = false;
          for (const rule of rules) {
            if (matchesRule(profile, rule)) {
              matched = true;
              covered.push({
                profile: { skinType, sensitivityLevel, acneLevel, ageGroup },
                ruleId: rule.id,
                ruleName: rule.name,
              });
              break;
            }
          }

          if (!matched) {
            uncovered.push({
              skinType,
              sensitivityLevel,
              acneLevel,
              ageGroup,
              profile,
            });
          }
        }
      }
    }
  }

  console.log(`✅ Покрыто правилами: ${covered.length} комбинаций`);
  console.log(`❌ Не покрыто правилами: ${uncovered.length} комбинаций\n`);

  if (uncovered.length > 0) {
    console.log('📊 Непокрытые комбинации (первые 20):\n');
    uncovered.slice(0, 20).forEach((item, i) => {
      console.log(`${i + 1}. ${item.skinType} / ${item.sensitivityLevel} / акне ${item.acneLevel} / ${item.ageGroup}`);
      console.log(`   Scores: inflammation=${item.profile.inflammation}, oiliness=${item.profile.oiliness}, hydration=${item.profile.hydration}, barrier=${item.profile.barrier}`);
    });

    if (uncovered.length > 20) {
      console.log(`\n... и еще ${uncovered.length - 20} комбинаций\n`);
    }
  }

  // Группируем непокрытые по типам кожи
  const uncoveredBySkinType: Record<string, number> = {};
  uncovered.forEach(item => {
    uncoveredBySkinType[item.skinType] = (uncoveredBySkinType[item.skinType] || 0) + 1;
  });

  console.log('\n📊 Непокрытые комбинации по типам кожи:');
  Object.entries(uncoveredBySkinType).forEach(([skinType, count]) => {
    console.log(`   ${skinType}: ${count} комбинаций`);
  });

  // Проверяем покрытие по возрастным группам
  const uncoveredByAge: Record<string, number> = {};
  uncovered.forEach(item => {
    uncoveredByAge[item.ageGroup] = (uncoveredByAge[item.ageGroup] || 0) + 1;
  });

  console.log('\n📊 Непокрытые комбинации по возрастным группам:');
  Object.entries(uncoveredByAge).forEach(([ageGroup, count]) => {
    console.log(`   ${ageGroup}: ${count} комбинаций`);
  });

  // Проверяем специальные случаи
  console.log('\n\n🔍 Проверка специальных случаев...\n');

  const specialCases = [
    // Беременность
    { name: 'Беременность + комбинированная кожа', profile: createProfileWithScores('combo', 'medium', 0, 1, '31_40', true) },
    { name: 'Беременность + сухая кожа', profile: createProfileWithScores('dry', 'high', 0, 2, '26_30', true) },
    
    // Диагнозы
    { name: 'Атопический дерматит + сухая кожа', profile: createProfileWithScores('dry', 'high', 0, 3, '31_40', false, [], ['atopic_dermatitis']) },
    { name: 'Розацеа + чувствительная кожа', profile: createProfileWithScores('sensitive', 'high', 0, 1, '41_50', false, [], ['rosacea']) },
    { name: 'Мелазма + комбинированная кожа', profile: createProfileWithScores('combo', 'medium', 0, 1, '31_40', false, [], ['melasma']) },
    { name: 'Себорейный дерматит + жирная кожа', profile: createProfileWithScores('oily', 'medium', 2, 1, '26_30', false, [], ['seborrheic_dermatitis']) },
    
    // Concerns
    { name: 'Рубцы постакне + комбинированная кожа', profile: createProfileWithScores('combo', 'medium', 0, 1, '26_30', false, ['postacne_scars'], []) },
    
    // Экстремальные значения scores
    { name: 'Очень высокий inflammation (90)', profile: createProfileWithScores('oily', 'low', 5, 1, '18_25', false, ['Акне'], ['acne']) },
    { name: 'Очень низкий barrier (30)', profile: createProfileWithScores('sensitive', 'high', 0, 4, '31_40', false, ['Чувствительность'], ['atopic_dermatitis']) },
    { name: 'Очень низкая hydration (20)', profile: createProfileWithScores('dry', 'medium', 0, 5, '41_50', false, ['Сухость'], []) },
    
    // Нормальная кожа без проблем
    { name: 'Нормальная кожа, низкий акне, средний возраст', profile: createProfileWithScores('normal', 'low', 0, 1, '31_40', false) },
    { name: 'Нормальная кожа, молодой возраст', profile: createProfileWithScores('normal', 'low', 1, 1, '18_25', false) },
  ];

  const uncoveredSpecial: any[] = [];
  const coveredSpecial: any[] = [];

  for (const testCase of specialCases) {
    let matched = false;
    let matchedRule: any = null;

    for (const rule of rules) {
      if (matchesRule(testCase.profile, rule)) {
        matched = true;
        matchedRule = rule;
        break;
      }
    }

    if (matched) {
      coveredSpecial.push({ ...testCase, ruleId: matchedRule.id, ruleName: matchedRule.name });
    } else {
      uncoveredSpecial.push(testCase);
    }
  }

  console.log(`✅ Специальные случаи покрыты: ${coveredSpecial.length}/${specialCases.length}`);
  if (coveredSpecial.length > 0) {
    console.log('\nПокрытые специальные случаи:');
    coveredSpecial.forEach(item => {
      console.log(`   ✅ ${item.name} → Правило ${item.ruleId}: ${item.ruleName}`);
    });
  }

  if (uncoveredSpecial.length > 0) {
    console.log(`\n❌ Непокрытые специальные случаи: ${uncoveredSpecial.length}`);
    uncoveredSpecial.forEach(item => {
      console.log(`   ❌ ${item.name}`);
      console.log(`      Профиль: ${JSON.stringify({
        skinType: item.profile.skinType,
        sensitivityLevel: item.profile.sensitivityLevel,
        acneLevel: item.profile.acneLevel,
        inflammation: item.profile.inflammation,
        barrier: item.profile.barrier,
        hydration: item.profile.hydration,
      }, null, 2)}`);
    });
  }

  // Итоговая статистика
  console.log('\n\n📊 ИТОГОВАЯ СТАТИСТИКА:');
  console.log(`   Всего правил: ${rules.length}`);
  console.log(`   Базовых комбинаций проверено: ${covered.length + uncovered.length}`);
  console.log(`   Базовых комбинаций покрыто: ${covered.length} (${Math.round(covered.length / (covered.length + uncovered.length) * 100)}%)`);
  console.log(`   Базовых комбинаций не покрыто: ${uncovered.length}`);
  console.log(`   Специальных случаев проверено: ${specialCases.length}`);
  console.log(`   Специальных случаев покрыто: ${coveredSpecial.length} (${Math.round(coveredSpecial.length / specialCases.length * 100)}%)`);
  console.log(`   Специальных случаев не покрыто: ${uncoveredSpecial.length}`);

  await prisma.$disconnect();
}

checkCoverage().catch(console.error);
