// scripts/check-rule-matching-643160759.ts
// Проверка матчинга правил для пользователя 643160759

import { prisma } from '../lib/db';
import { calculateSkinAxes, type QuestionnaireAnswers } from '../lib/skin-analysis-engine';
import { normalizeSkinTypeForRules, normalizeSensitivityForRules } from '../lib/skin-type-normalizer';
import { buildRuleContext } from '../lib/rule-context';

const telegramId = '643160759';

function matchesRule(profile: any, rule: any): boolean {
  const conditions = rule.conditionsJson;

  for (const [key, condition] of Object.entries(conditions)) {
    let profileValue = profile[key];
    if (key === 'diagnoses' && (profileValue === undefined || profileValue === null)) {
      profileValue = (profile.medicalMarkers as any)?.diagnoses || [];
    }

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

async function checkRuleMatching() {
  console.log(`🔍 Проверяю матчинг правил для пользователя: ${telegramId}\n`);
  
  try {
    const user = await prisma.user.findFirst({
      where: { telegramId },
      select: { id: true },
    });
    
    if (!user) {
      console.log('❌ Пользователь не найден');
      await prisma.$disconnect();
      return;
    }
    
    const profile = await prisma.skinProfile.findFirst({
      where: { userId: user.id },
      orderBy: { version: 'desc' },
    });
    
    if (!profile) {
      console.log('❌ Профиль не найден');
      await prisma.$disconnect();
      return;
    }
    
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
    });
    
    if (!questionnaire) {
      console.log('❌ Активная анкета не найдена');
      await prisma.$disconnect();
      return;
    }
    
    const userAnswers = await prisma.userAnswer.findMany({
      where: {
        userId: user.id,
        questionnaireId: questionnaire.id,
      },
      include: {
        question: true,
      },
    });
    
    const answers: Record<string, any> = {};
    userAnswers.forEach((answer) => {
      const code = answer.question?.code || '';
      if (answer.answerValue) {
        answers[code] = answer.answerValue;
      } else if (answer.answerValues) {
        answers[code] = JSON.parse(JSON.stringify(answer.answerValues));
      }
    });
    
    const questionnaireAnswers: QuestionnaireAnswers = {
      skinType: answers.skin_type || answers.skinType || profile.skinType || 'normal',
      age: answers.age || answers.age_group || answers.ageGroup || profile.ageGroup || '25-34',
      concerns: Array.isArray(answers.skin_concerns) ? answers.skin_concerns : [],
      diagnoses: Array.isArray(answers.diagnoses) ? answers.diagnoses : [],
      allergies: Array.isArray(answers.allergies) ? answers.allergies : [],
      seasonChange: answers.season_change || answers.seasonChange,
      habits: Array.isArray(answers.habits) ? answers.habits : [],
      retinolReaction: answers.retinol_reaction || answers.retinolReaction,
      pregnant: answers.pregnant || answers.has_pregnancy || profile.hasPregnancy || false,
      spfFrequency: answers.spf_frequency || answers.spfFrequency,
      sunExposure: answers.sun_exposure || answers.sunExposure,
      sensitivityLevel: answers.sensitivity_level || answers.sensitivityLevel || profile.sensitivityLevel || 'low',
      acneLevel: answers.acne_level || (typeof answers.acneLevel === 'number' ? answers.acneLevel : profile.acneLevel || 0),
      ...answers,
    };
    
    const skinScores = calculateSkinAxes(questionnaireAnswers);
    const normalizedSkinType = normalizeSkinTypeForRules(profile.skinType, { userId: user.id });
    const normalizedSensitivity = normalizeSensitivityForRules(profile.sensitivityLevel);
    
    const ruleContext = buildRuleContext(profile as any, skinScores, normalizedSkinType, normalizedSensitivity);
    
    console.log('📊 RuleContext:');
    console.log(JSON.stringify(ruleContext, null, 2));
    console.log(`\n⚠️ concerns в RuleContext: ${ruleContext.concerns !== undefined ? 'ЕСТЬ' : 'ОТСУТСТВУЕТ'}`);
    
    const profileWithScores: any = {
      ...profile,
      ...ruleContext,
    };
    
    // Получаем правило "Рубцы постакне"
    const rule = await prisma.recommendationRule.findFirst({
      where: { name: 'Рубцы постакне' },
    });
    
    if (!rule) {
      console.log('❌ Правило "Рубцы постакне" не найдено');
      await prisma.$disconnect();
      return;
    }
    
    console.log(`\n🔍 Правило: ${rule.name} (ID: ${rule.id}, Priority: ${rule.priority})`);
    console.log(`   Условия: ${JSON.stringify(rule.conditionsJson, null, 2)}`);
    
    const matches = matchesRule(profileWithScores, rule);
    console.log(`\n${matches ? '✅' : '❌'} Правило матчится: ${matches}`);
    
    if (!matches) {
      console.log('\n🔍 Детальная проверка условий:');
      const conditions = rule.conditionsJson as any;
      for (const [key, condition] of Object.entries(conditions)) {
        const profileValue = profileWithScores[key];
        console.log(`   ${key}:`);
        console.log(`     Значение в профиле: ${JSON.stringify(profileValue)}`);
        console.log(`     Условие: ${JSON.stringify(condition)}`);
        
        if (key === 'concerns') {
          if (profileValue === undefined || profileValue === null) {
            console.log(`     ❌ ПРОБЛЕМА: concerns отсутствует в профиле!`);
          } else if (typeof condition === 'object' && condition !== null && 'hasSome' in condition) {
            const profileArray = Array.isArray(profileValue) ? profileValue : [];
            const hasMatch = condition.hasSome.some((item: any) => profileArray.includes(item));
            console.log(`     Матчинг: ${hasMatch ? '✅' : '❌'} (ищем ${JSON.stringify(condition.hasSome)} в ${JSON.stringify(profileArray)})`);
          }
        }
      }
    }
    
    // Проверяем, какое правило было применено
    const session = await prisma.recommendationSession.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        rule: {
          select: { name: true, id: true },
        },
      },
    });
    
    if (session) {
      console.log(`\n💾 Примененное правило: ${session.rule?.name} (ID: ${session.ruleId})`);
      if (session.ruleId !== rule.id) {
        console.log(`   ⚠️ Это НЕ правило "Рубцы постакне"!`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkRuleMatching()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });

