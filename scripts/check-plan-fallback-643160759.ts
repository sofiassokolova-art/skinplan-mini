// scripts/check-plan-fallback-643160759.ts
// Проверка фолбека генерации плана для пользователя 643160759

import { prisma } from '../lib/db';
import { calculateSkinIssues } from '../app/api/analysis/route';
import { calculateSkinAxes, type QuestionnaireAnswers } from '../lib/skin-analysis-engine';

const telegramId = '643160759';

async function checkPlanFallback() {
  console.log(`🔍 Проверяю фолбек генерации плана для пользователя: ${telegramId}\n`);
  
  try {
    // Находим пользователя
    const user = await prisma.user.findFirst({
      where: { telegramId },
      select: { id: true, telegramId: true, firstName: true },
    });
    
    if (!user) {
      console.log('❌ Пользователь не найден');
      await prisma.$disconnect();
      return;
    }
    
    console.log('✅ Пользователь найден:', {
      userId: user.id,
      telegramId: user.telegramId,
      name: user.firstName,
    });
    
    // Получаем последний профиль
    const profile = await prisma.skinProfile.findFirst({
      where: { userId: user.id },
      orderBy: { version: 'desc' },
    });
    
    if (!profile) {
      console.log('❌ Профиль не найден');
      await prisma.$disconnect();
      return;
    }
    
    console.log(`\n👤 Профиль: Version ${profile.version}, SkinType: ${profile.skinType}`);
    
    // Получаем активную анкету
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
    });
    
    if (!questionnaire) {
      console.log('❌ Активная анкета не найдена');
      await prisma.$disconnect();
      return;
    }
    
    // Получаем все ответы пользователя
    const userAnswers = await prisma.userAnswer.findMany({
      where: {
        userId: user.id,
        questionnaireId: questionnaire.id,
      },
      include: {
        question: {
          select: { code: true, text: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    
    console.log(`\n📝 Ответы пользователя (${userAnswers.length}):`);
    const answersMap: Record<string, any> = {};
    userAnswers.forEach(answer => {
      const code = answer.question?.code || 'unknown';
      const value = answer.answerValue || 
        (Array.isArray(answer.answerValues) ? answer.answerValues : null);
      answersMap[code] = value;
      console.log(`   ${code}: ${JSON.stringify(value)}`);
    });
    
    // Формируем QuestionnaireAnswers из ответов
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
    
    // Вычисляем skin scores
    const skinScores = calculateSkinAxes(questionnaireAnswers);
    console.log(`\n📊 Skin Scores:`);
    skinScores.forEach(score => {
      console.log(`   ${score.title} (${score.axis}): ${score.value} (${score.level})`);
    });
    
    // Вычисляем проблемы
    const issues = calculateSkinIssues(profile, userAnswers, skinScores);
    console.log(`\n🔍 Вычисленные проблемы (${issues.length}):`);
    issues.forEach(issue => {
      console.log(`   - ${issue.name}: ${issue.severity_label} (score: ${issue.severity_score})`);
    });
    
    // Определяем keyProblems (критичные и плохие)
    const keyProblems = issues
      .filter((i: any) => i.severity_label === 'критично' || i.severity_label === 'плохо')
      .map((i: any) => i.name);
    
    console.log(`\n⚠️ Key Problems (критично/плохо): ${keyProblems.length}`);
    if (keyProblems.length > 0) {
      keyProblems.forEach(problem => {
        console.log(`   - ${problem}`);
      });
    } else {
      console.log('   ❌ Key Problems пустые - будет использован фолбек!');
    }
    
    // Проверяем goals и concerns из ответов
    const goals = Array.isArray(answersMap.skin_goals) ? answersMap.skin_goals : [];
    const concerns = Array.isArray(answersMap.skin_concerns) ? answersMap.skin_concerns : [];
    
    console.log(`\n🎯 Goals из ответов: ${goals.length}`);
    goals.forEach(goal => console.log(`   - ${goal}`));
    
    console.log(`\n💭 Concerns из ответов: ${concerns.length}`);
    concerns.forEach(concern => console.log(`   - ${concern}`));
    
    // Определяем primaryFocus (как в plan-generator.ts)
    const { normalizePrimaryFocus, normalizeConcerns } = await import('../lib/concern-taxonomy');
    const normalizedConcerns = normalizeConcerns(concerns);
    
    let primaryFocus = 'general';
    if (goals.includes('Акне и высыпания') || normalizedConcerns.includes('acne')) {
      primaryFocus = 'acne';
    } else if (goals.includes('Сократить видимость пор') || normalizedConcerns.includes('pores')) {
      primaryFocus = 'pores';
    } else if (normalizedConcerns.includes('dryness') || normalizedConcerns.includes('dehydration')) {
      primaryFocus = 'dryness';
    } else if (goals.includes('Выровнять пигментацию') || normalizedConcerns.includes('pigmentation')) {
      primaryFocus = 'pigmentation';
    } else if (goals.includes('Морщины и мелкие линии') || normalizedConcerns.includes('wrinkles')) {
      primaryFocus = 'wrinkles';
    } else if (normalizedConcerns.includes('barrier') || normalizedConcerns.includes('sensitivity')) {
      primaryFocus = 'barrier';
    }
    
    primaryFocus = normalizePrimaryFocus(primaryFocus, normalizedConcerns);
    console.log(`\n🎯 Primary Focus: ${primaryFocus}`);
    
    // Маппим keyProblems в mainGoals (как в plan-generator.ts)
    const mainGoals: string[] = [];
    
    for (const problem of keyProblems) {
      const problemLower = problem.toLowerCase();
      if (problemLower.includes('акне') || problemLower.includes('acne') || problemLower.includes('высыпания')) {
        if (!mainGoals.includes('acne')) mainGoals.push('acne');
      }
      if (problemLower.includes('пигментация') || problemLower.includes('pigmentation') || problemLower.includes('пятна')) {
        if (!mainGoals.includes('pigmentation')) mainGoals.push('pigmentation');
      }
      if (problemLower.includes('морщин') || problemLower.includes('wrinkle') || problemLower.includes('старение') || problemLower.includes('age')) {
        if (!mainGoals.includes('antiage')) mainGoals.push('antiage');
      }
      if (problemLower.includes('барьер') || problemLower.includes('barrier') || problemLower.includes('чувствительность') || problemLower.includes('sensitivity')) {
        if (!mainGoals.includes('barrier')) mainGoals.push('barrier');
      }
      if (problemLower.includes('обезвоженность') || problemLower.includes('dehydration') || problemLower.includes('сухость') || problemLower.includes('dryness')) {
        if (!mainGoals.includes('dehydration')) mainGoals.push('dehydration');
      }
      if (problemLower.includes('темные круги') || problemLower.includes('dark circles') || problemLower.includes('круги под глазами')) {
        if (!mainGoals.includes('dark_circles')) mainGoals.push('dark_circles');
      }
    }
    
    // Проверяем concerns для темных кругов
    if (concerns.some((c: string) => 
      c.toLowerCase().includes('темные круги') || 
      c.toLowerCase().includes('dark circles') ||
      c.toLowerCase().includes('круги под глазами')
    )) {
      if (!mainGoals.includes('dark_circles')) mainGoals.push('dark_circles');
    }
    
    console.log(`\n📋 Main Goals из keyProblems: ${mainGoals.length}`);
    if (mainGoals.length > 0) {
      mainGoals.forEach(goal => console.log(`   - ${goal}`));
    }
    
    // Проверяем фолбек
    const usedFallback = mainGoals.length === 0;
    console.log(`\n${usedFallback ? '⚠️' : '✅'} Фолбек: ${usedFallback ? 'ДА - используется fallback на основе primaryFocus и concerns' : 'НЕТ - используются keyProblems'}`);
    
    if (usedFallback) {
      const fallbackGoals: string[] = [];
      if (primaryFocus === 'acne') fallbackGoals.push('acne');
      if (primaryFocus === 'pigmentation') fallbackGoals.push('pigmentation');
      if (primaryFocus === 'wrinkles') fallbackGoals.push('antiage');
      if (concerns.includes('Барьер') || concerns.includes('Чувствительность')) {
        fallbackGoals.push('barrier');
      }
      if (concerns.includes('Обезвоженность') || concerns.includes('Сухость')) {
        fallbackGoals.push('dehydration');
      }
      
      console.log(`\n🔄 Fallback Goals: ${fallbackGoals.length}`);
      fallbackGoals.forEach(goal => console.log(`   - ${goal}`));
      
      console.log(`\n❌ ПРОБЛЕМА: Проблемы отображаются не по ответам!`);
      console.log(`   Key Problems пустые, поэтому используется fallback на основе:`);
      console.log(`   - primaryFocus: ${primaryFocus}`);
      console.log(`   - concerns: ${JSON.stringify(concerns)}`);
    }
    
    // Проверяем RecommendationSession
    const session = await prisma.recommendationSession.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        rule: {
          select: { name: true },
        },
      },
    });
    
    if (session) {
      console.log(`\n💾 RecommendationSession:`);
      console.log(`   Rule: ${session.rule?.name || 'N/A'}`);
      console.log(`   RuleID: ${session.ruleId}`);
      console.log(`   Products: ${Array.isArray(session.products) ? session.products.length : 0}`);
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkPlanFallback()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });

