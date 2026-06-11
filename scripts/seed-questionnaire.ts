// scripts/seed-questionnaire.ts
// Скрипт для заполнения начальной анкеты

import { createScriptPrisma } from './lib/prisma';

const prisma = createScriptPrisma();

async function seedQuestionnaire() {
  console.log('🌱 Seeding questionnaire...');

  // Проверяем, не существует ли уже анкета
  const existing = await prisma.questionnaire.findUnique({
    where: { version: 1 },
  });

  if (existing) {
    console.log('✅ Questionnaire v1 already exists, skipping...');
    return;
  }

  // Создаем анкету
  const questionnaire = await prisma.questionnaire.create({
    data: {
      name: 'Базовая анкета v1',
      version: 1,
      isActive: true,
    },
  });

  // Создаем группы
  const group1 = await prisma.questionGroup.create({
    data: {
      questionnaireId: questionnaire.id,
      title: 'Общая информация',
      position: 1,
    },
  });

  const group2 = await prisma.questionGroup.create({
    data: {
      questionnaireId: questionnaire.id,
      title: 'Тип кожи',
      position: 2,
    },
  });

  const group3 = await prisma.questionGroup.create({
    data: {
      questionnaireId: questionnaire.id,
      title: 'Проблемы кожи',
      position: 3,
    },
  });

  // Создаем вопросы в группе 1
  const q1 = await prisma.question.create({
    data: {
      questionnaireId: questionnaire.id,
      groupId: group1.id,
      code: 'AGE',
      text: 'Сколько вам лет?',
      type: 'single_choice',
      position: 1,
      isRequired: true,
    },
  });

  await prisma.answerOption.createMany({
    data: [
      { questionId: q1.id, value: '18_25', label: '18-25 лет', position: 1, scoreJson: { age_group: '18_25' } },
      { questionId: q1.id, value: '26_30', label: '26-30 лет', position: 2, scoreJson: { age_group: '26_30' } },
      { questionId: q1.id, value: '31_40', label: '31-40 лет', position: 3, scoreJson: { age_group: '31_40' } },
      { questionId: q1.id, value: '41_50', label: '41-50 лет', position: 4, scoreJson: { age_group: '41_50' } },
      { questionId: q1.id, value: '50_plus', label: '50+ лет', position: 5, scoreJson: { age_group: '50_plus' } },
    ],
  });

  const q2 = await prisma.question.create({
    data: {
      questionnaireId: questionnaire.id,
      groupId: group1.id,
      code: 'GENDER',
      text: 'Ваш пол?',
      type: 'single_choice',
      position: 2,
      isRequired: true,
    },
  });

  await prisma.answerOption.createMany({
    data: [
      { questionId: q2.id, value: 'FEMALE', label: 'Женский', position: 1, scoreJson: {} },
      { questionId: q2.id, value: 'MALE', label: 'Мужской', position: 2, scoreJson: {} },
    ],
  });

  // Создаем вопрос в группе 2
  const q3 = await prisma.question.create({
    data: {
      questionnaireId: questionnaire.id,
      groupId: group2.id,
      code: 'SKIN_TYPE',
      text: 'Какой у вас тип кожи?',
      type: 'single_choice',
      position: 1,
      isRequired: true,
    },
  });

  await prisma.answerOption.createMany({
    data: [
      {
        questionId: q3.id,
        value: 'DRY',
        label: 'Тип 1 — Сухая\nКожа ощущается стянутой и сухой по всей поверхности',
        position: 1,
        scoreJson: { oiliness: 0, dehydration: 5 },
      },
      {
        questionId: q3.id,
        value: 'COMBO_DRY',
        label: 'Тип 2 — Комбинированная (сухая)\nЕсть стянутость в области скул и щёк',
        position: 2,
        scoreJson: { oiliness: 2, dehydration: 3 },
      },
      {
        questionId: q3.id,
        value: 'NORMAL',
        label: 'Тип 3 — Нормальная\nНет ощущения стянутости и жирного блеска',
        position: 3,
        scoreJson: { oiliness: 1, dehydration: 1 },
      },
      {
        questionId: q3.id,
        value: 'COMBO_OILY',
        label: 'Тип 4 — Комбинированная (жирная)\nВ Т-зоне появляется жирный блеск',
        position: 4,
        scoreJson: { oiliness: 3, dehydration: 1 },
      },
      {
        questionId: q3.id,
        value: 'OILY',
        label: 'Тип 5 — Жирная\nЖирный блеск присутствует во всех зонах лица',
        position: 5,
        scoreJson: { oiliness: 5, dehydration: 0 },
      },
    ],
  });

  // Создаем вопрос в группе 3
  const q4 = await prisma.question.create({
    data: {
      questionnaireId: questionnaire.id,
      groupId: group3.id,
      code: 'SKIN_CONCERNS',
      text: 'Какие проблемы кожи вас беспокоят?',
      type: 'multi_choice',
      position: 1,
      isRequired: true,
    },
  });

  await prisma.answerOption.createMany({
    data: [
      { questionId: q4.id, value: 'ACNE', label: 'Акне', position: 1, scoreJson: { acne: 3, concerns: ['acne'] } },
      { questionId: q4.id, value: 'OILINESS', label: 'Жирность и блеск кожи', position: 2, scoreJson: { oiliness: 2 } },
      { questionId: q4.id, value: 'DRYNESS', label: 'Сухость и стянутость', position: 3, scoreJson: { dehydration: 3 } },
      {
        questionId: q4.id,
        value: 'PIGMENTATION',
        label: 'Пигментация',
        position: 4,
        scoreJson: { pigmentation: 2, pigmentationRisk: 'medium' },
      },
      { questionId: q4.id, value: 'AGING', label: 'Морщины, возрастные изменения', position: 5, scoreJson: {} },
      { questionId: q4.id, value: 'SENSITIVITY', label: 'Чувствительность', position: 6, scoreJson: { sensitivity: 3 } },
      { questionId: q4.id, value: 'PORES', label: 'Расширенные поры', position: 7, scoreJson: {} },
      {
        questionId: q4.id,
        value: 'NONE',
        label: 'В целом всё устраивает, хочу поддерживающий уход',
        position: 8,
        scoreJson: {},
      },
    ],
  });

  console.log('✅ Questionnaire created:', questionnaire.id);
  console.log('   Name:', questionnaire.name);
  console.log('   Version:', questionnaire.version);
}

seedQuestionnaire()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
