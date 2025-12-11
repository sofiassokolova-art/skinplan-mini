// scripts/add-name-question.ts
// Скрипт для добавления вопроса об имени в анкету

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addNameQuestion() {
  console.log('🌱 Adding name question to questionnaire...');

  // Находим активную анкету
  const questionnaire = await prisma.questionnaire.findFirst({
    where: { isActive: true },
    orderBy: { version: 'desc' },
  });

  if (!questionnaire) {
    console.error('❌ No active questionnaire found');
    return;
  }

  console.log('✅ Found questionnaire:', questionnaire.id, questionnaire.name);

  // Проверяем, не существует ли уже вопрос об имени
  const existingNameQuestion = await prisma.question.findFirst({
    where: {
      questionnaireId: questionnaire.id,
      code: 'USER_NAME',
    },
  });

  if (existingNameQuestion) {
    console.log('✅ Name question already exists, skipping...');
    return;
  }

  // Находим первую группу (или создаем новую группу для имени)
  const firstGroup = await prisma.questionGroup.findFirst({
    where: {
      questionnaireId: questionnaire.id,
    },
    orderBy: { position: 'asc' },
  });

  if (!firstGroup) {
    console.error('❌ No question groups found');
    return;
  }

  // Получаем минимальную позицию среди всех вопросов
  const minPositionQuestion = await prisma.question.findFirst({
    where: {
      questionnaireId: questionnaire.id,
    },
    orderBy: { position: 'asc' },
  });

  const nameQuestionPosition = minPositionQuestion ? minPositionQuestion.position - 1 : 0;

  // Создаем вопрос об имени
  const nameQuestion = await prisma.question.create({
    data: {
      questionnaireId: questionnaire.id,
      groupId: firstGroup.id,
      code: 'USER_NAME',
      text: 'Как мы можем к вам обращаться?',
      type: 'free_text', // Используем free_text, так как в schema указан этот тип
      position: nameQuestionPosition,
      isRequired: true,
    },
  });

  console.log('✅ Name question created:', nameQuestion.id);
  console.log('   Code:', nameQuestion.code);
  console.log('   Text:', nameQuestion.text);
  console.log('   Position:', nameQuestion.position);
}

addNameQuestion()
  .catch((e) => {
    console.error('❌ Error adding name question:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
