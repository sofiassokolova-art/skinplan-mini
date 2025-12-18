// scripts/update-rules-ingredients.ts
// Обновление правил: замена русских названий ингредиентов на английские

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Маппинг русских названий на английские
const ingredientMapping: Record<string, string> = {
  'транексамовая кислота': 'tranexamic_acid',
  'гидрохинон 4% (курс)': 'hydroquinone',
  'гидрохинон': 'hydroquinone',
  'гиалуронка': 'hyaluronic_acid',
  'азелаиновая кислота до 10%': 'azelaic_acid_10',
  'азелаиновая кислота 15%': 'azelaic_acid_15',
  'азелаиновая 15%': 'azelaic_acid_15',
  'азелаиновая кислота': 'azelaic_acid',
  'витамин С 15–20%': 'vitamin_c15',
  'витамин С': 'vitamin_c10',
  'Melasyl': 'melasyl',
  'адапален 0.1%': 'adapalene',
  'адапален': 'adapalene',
  'бензоила пероксид 5%': 'benzoyl_peroxide',
  'бензоила пероксид': 'benzoyl_peroxide',
  'бензоил пероксид': 'benzoyl_peroxide',
  'пантенол': 'panthenol',
  'глицерин': 'glycerin',
  'салициловая кислота': 'salicylic_acid',
  'салициловая >2%': 'salicylic_acid',
  'ниацинамид': 'niacinamide',
  'ретинол': 'retinol',
};

async function updateRulesIngredients() {
  console.log('🔄 Обновление правил: замена русских названий ингредиентов на английские\n');

  // Получаем все активные правила
  const rules = await prisma.recommendationRule.findMany({
    where: { isActive: true },
  });

  console.log(`Всего активных правил: ${rules.length}\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const rule of rules) {
    const stepsJson = rule.stepsJson as Record<string, any>;
    let needsUpdate = false;
    const updatedSteps: Record<string, any> = {};

    for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
      const step = stepConfig as any;
      const updatedStep = { ...step };

      // Обновляем active_ingredients, если они есть
      if (step.active_ingredients && Array.isArray(step.active_ingredients)) {
        const updatedIngredients = step.active_ingredients.map((ing: string) => {
          // Проверяем точное совпадение
          if (ingredientMapping[ing]) {
            needsUpdate = true;
            return ingredientMapping[ing];
          }
          
          // Проверяем частичное совпадение (на случай, если есть дополнительные символы)
          for (const [russian, english] of Object.entries(ingredientMapping)) {
            if (ing.includes(russian) || ing.toLowerCase().includes(russian.toLowerCase())) {
              needsUpdate = true;
              // Заменяем русское название на английское, сохраняя остальной текст
              return ing.replace(new RegExp(russian, 'gi'), english);
            }
          }
          
          return ing;
        });

        if (needsUpdate) {
          updatedStep.active_ingredients = updatedIngredients;
        }
      }

      updatedSteps[stepName] = updatedStep;
    }

    if (needsUpdate) {
      await prisma.recommendationRule.update({
        where: { id: rule.id },
        data: {
          stepsJson: updatedSteps,
        },
      });

      updatedCount++;
      console.log(`✅ Обновлено правило ${rule.id}: ${rule.name}`);
      
      // Показываем изменения
      for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
        const step = stepConfig as any;
        const updatedStep = updatedSteps[stepName];
        
        if (step.active_ingredients && updatedStep.active_ingredients) {
          const oldIngredients = step.active_ingredients.join(', ');
          const newIngredients = updatedStep.active_ingredients.join(', ');
          
          if (oldIngredients !== newIngredients) {
            console.log(`   Шаг ${stepName}:`);
            console.log(`     Было: [${oldIngredients}]`);
            console.log(`     Стало: [${newIngredients}]`);
          }
        }
      }
    } else {
      skippedCount++;
    }
  }

  console.log(`\n🎉 Обновление завершено!`);
  console.log(`   ✅ Обновлено: ${updatedCount} правил`);
  console.log(`   ⏭️  Пропущено: ${skippedCount} правил (не требуют обновления)`);
}

updateRulesIngredients()
  .catch((error) => {
    console.error('❌ Ошибка при обновлении правил:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

