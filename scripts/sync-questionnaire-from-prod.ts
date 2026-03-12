// scripts/sync-questionnaire-from-prod.ts
// Синхронизирует активную анкету из прода в локальную БД.
// Запуск: SYNC_QUESTIONNAIRE_FROM_URL=https://www.proskiniq.ru npm run sync:questionnaire-from-prod
// Или: npm run sync:questionnaire-from-prod  (по умолчанию берёт NEXT_PUBLIC_MINI_APP_URL или proskiniq.ru)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PROD_URL =
  process.env.SYNC_QUESTIONNAIRE_FROM_URL ||
  process.env.NEXT_PUBLIC_MINI_APP_URL ||
  'https://www.proskiniq.ru';

interface OptionFromApi {
  id: number;
  value: string;
  label: string;
  position: number;
}

interface QuestionFromApi {
  id: number;
  code: string;
  text: string;
  type: string;
  position: number;
  isRequired: boolean;
  options?: OptionFromApi[];
}

interface GroupFromApi {
  id: number;
  title: string;
  position: number;
  questions: QuestionFromApi[];
}

interface QuestionnaireFromApi {
  id: number;
  name: string;
  version: number;
  groups: GroupFromApi[];
  questions: QuestionFromApi[];
}

async function fetchQuestionnaireFromProd(): Promise<QuestionnaireFromApi> {
  const url = `${PROD_URL.replace(/\/$/, '')}/api/questionnaire/active`;
  console.log('Fetching questionnaire from:', url);

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error);
  }
  if (!data.groups && !Array.isArray(data.questions)) {
    throw new Error('Invalid response: missing groups/questions');
  }

  return data as QuestionnaireFromApi;
}

async function syncQuestionnaireFromProd() {
  console.log('Syncing questionnaire from prod to local DB...\n');

  const prodQuestionnaire = await fetchQuestionnaireFromProd();

  console.log('Got questionnaire:', {
    id: prodQuestionnaire.id,
    name: prodQuestionnaire.name,
    version: prodQuestionnaire.version,
    groupsCount: prodQuestionnaire.groups?.length ?? 0,
    plainQuestionsCount: prodQuestionnaire.questions?.length ?? 0,
  });

  // Деактивируем все текущие анкеты в локальной БД
  await prisma.questionnaire.updateMany({
    data: { isActive: false },
  });

  // Создаём новую анкету с теми же name/version (локальные id будут свои)
  const questionnaire = await prisma.questionnaire.create({
    data: {
      name: prodQuestionnaire.name,
      version: prodQuestionnaire.version,
      isActive: true,
    },
  });

  console.log('Created local questionnaire:', questionnaire.id);

  const groups = prodQuestionnaire.groups ?? [];
  let questionCount = 0;

  for (const group of groups) {
    const questionGroup = await prisma.questionGroup.create({
      data: {
        questionnaireId: questionnaire.id,
        title: group.title,
        position: group.position ?? 0,
      },
    });

    for (const q of group.questions ?? []) {
      const question = await prisma.question.create({
        data: {
          questionnaireId: questionnaire.id,
          groupId: questionGroup.id,
          code: q.code,
          text: q.text,
          type: q.type,
          position: q.position ?? 0,
          isRequired: q.isRequired ?? true,
        },
      });

      if (q.options?.length) {
        await prisma.answerOption.createMany({
          data: q.options.map((opt, idx) => ({
            questionId: question.id,
            value: opt.value ?? `opt_${idx + 1}`,
            label: opt.label ?? '',
            position: opt.position ?? idx + 1,
          })),
        });
      }
      questionCount++;
    }
  }

  // Вопросы без группы (plain questions)
  for (const q of prodQuestionnaire.questions ?? []) {
    const question = await prisma.question.create({
      data: {
        questionnaireId: questionnaire.id,
        groupId: null,
        code: q.code,
        text: q.text,
        type: q.type,
        position: q.position ?? 0,
        isRequired: q.isRequired ?? true,
      },
    });

    if (q.options?.length) {
      await prisma.answerOption.createMany({
        data: q.options.map((opt, idx) => ({
          questionId: question.id,
          value: opt.value ?? `opt_${idx + 1}`,
          label: opt.label ?? '',
          position: opt.position ?? idx + 1,
        })),
      });
    }
    questionCount++;
  }

  console.log('\nDone. Local questionnaire is now in sync with prod.');
  console.log('  Questionnaire ID:', questionnaire.id);
  console.log('  Groups:', groups.length);
  console.log('  Total questions:', questionCount);
}

syncQuestionnaireFromProd()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
