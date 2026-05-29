// scripts/seed-questionnaire-full.ts
// Полный перенос анкеты из Quiz.tsx в базу данных

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Маппинг типов из Quiz.tsx в типы БД
function mapQuestionType(type: string): string {
  if (type === 'single') return 'single_choice';
  if (type === 'multi') return 'multi_choice';
  if (type === 'photo') return 'free_text'; // Фото пока храним как текст
  return 'single_choice';
}

// Функция для создания scoreJson на основе вопроса и ответа
function createScoreJson(questionId: string, optionLabel: string): any {
  const scores: any = {};

  // Маппинг для типа кожи
  if (questionId === 'skin_type') {
    if (optionLabel.includes('Сухая') && !optionLabel.includes('Комбинированная')) {
      return { oiliness: 0, dehydration: 5 };
    }
    if (optionLabel.includes('Комбинированная (сухая)')) {
      return { oiliness: 2, dehydration: 3 };
    }
    if (optionLabel.includes('Нормальная')) {
      return { oiliness: 1, dehydration: 1 };
    }
    if (optionLabel.includes('Комбинированная (жирная)')) {
      return { oiliness: 3, dehydration: 1 };
    }
    if (optionLabel.includes('Жирная')) {
      return { oiliness: 5, dehydration: 0 };
    }
  }

  // Маппинг для проблем кожи
  if (questionId === 'skin_concerns') {
    if (optionLabel.includes('Акне')) {
      return { acne: 3, concerns: ['acne'] };
    }
    if (optionLabel.includes('Жирность')) {
      return { oiliness: 2 };
    }
    if (optionLabel.includes('Сухость')) {
      return { dehydration: 3 };
    }
    if (optionLabel.includes('Пигментация')) {
      return { pigmentation: 2, pigmentationRisk: 'medium' };
    }
    if (optionLabel.includes('Чувствительность')) {
      return { sensitivity: 3 };
    }
    if (optionLabel.includes('Розацеа')) {
      return { rosacea: 2, rosaceaRisk: 'medium' };
    }
  }

  // Маппинг для возраста
  if (questionId === 'age') {
    if (optionLabel.includes('До 18')) return { age_group: '18_25' };
    if (optionLabel.includes('18–24')) return { age_group: '18_25' };
    if (optionLabel.includes('25–34')) return { age_group: '26_30' };
    if (optionLabel.includes('35–44')) return { age_group: '31_40' };
    if (optionLabel.includes('45+')) return { age_group: '41_50' };
  }

  // Маппинг для беременности
  if (questionId === 'pregnancy_status') {
    if (optionLabel.includes('беременна') || optionLabel.includes('кормлю')) {
      return { has_pregnancy: true };
    }
    return { has_pregnancy: false };
  }

  return {};
}

async function seedFullQuestionnaire() {
  console.log('🌱 Seeding full questionnaire from Quiz.tsx...');

  // Проверяем, не существует ли уже анкета
  const existing = await prisma.questionnaire.findUnique({
    where: { version: 1 },
  });

  if (existing) {
    console.log('⚠️  Questionnaire v1 already exists. Deleting old version...');
    // Удаляем старую версию (каскадное удаление удалит все связанные данные)
    await prisma.questionnaire.delete({
      where: { id: existing.id },
    });
  }

  // Создаем анкету
  const questionnaire = await prisma.questionnaire.create({
    data: {
      name: 'Базовая анкета v1',
      version: 1,
      isActive: true,
    },
  });

  console.log('✅ Questionnaire created:', questionnaire.id);

  // Определяем вопросы из Quiz.tsx
  const questions = [
    // Группа 1: Цели
    {
      groupTitle: 'Цели ухода',
      groupPosition: 1,
      question: {
        code: 'SKIN_GOALS',
        text: 'Выберите ваши главные цели',
        type: 'multi_choice',
        position: 1,
        isRequired: true,
        options: [
          'Морщины и мелкие линии',
          'Акне и высыпания',
          'Сократить видимость пор',
          'Уменьшить отёчность',
          'Выровнять пигментацию',
          'Улучшить текстуру кожи',
        ],
      },
    },

    // Группа 2: Общая информация
    {
      groupTitle: 'Общая информация',
      groupPosition: 2,
      questions: [
        {
          code: 'AGE',
          text: 'Сколько вам лет?',
          type: 'single_choice',
          position: 1,
          isRequired: true,
          options: ['До 18 лет', '18–24', '25–34', '35–44', '45+'],
        },
        {
          code: 'GENDER',
          text: 'Ваш пол',
          type: 'single_choice',
          position: 2,
          isRequired: true,
          options: ['Женский', 'Мужской'],
        },
      ],
    },

    // Группа 3: Особенности кожи
    {
      groupTitle: 'Особенности кожи',
      groupPosition: 3,
      questions: [
        {
          code: 'SKIN_TYPE',
          text: 'Какой у вас тип кожи?',
          type: 'single_choice',
          position: 1,
          isRequired: true,
          options: [
          'Тип 1 — Сухая\nКожа ощущается стянутой и сухой по всей поверхности, часто вызывает дискомфорт, особенно после умывания',
          'Тип 2 — Комбинированная (сухая)\nЕсть стянутость и сухость в области скул и щёк, в Т-зоне кожа нормальная',
          'Тип 3 — Нормальная\nНет ощущения стянутости и сухости кожи, не появляется жирный блеск в Т-зоне',
          'Тип 4 — Комбинированная (жирная)\nВ области щёк и скул кожа нормальная, но в Т-зоне появляется жирный блеск',
          'Тип 5 — Жирная\nЖирный блеск присутствует во всех зонах лица. Кожа выглядит жирной и склонна к закупориванию пор',
          ],
        },
        {
          code: 'SKIN_CONCERNS',
          text: 'Какие проблемы кожи вас беспокоят?',
          type: 'multi_choice',
          position: 2,
          isRequired: true,
          options: [
            'Акне',
            'Жирность и блеск кожи',
            'Сухость и стянутость',
            'Неровный тон',
            'Пигментация',
            'Морщины, возрастные изменения',
            'Чувствительность',
            'Расширенные поры',
            'Отеки под глазами',
            'Круги под глазами',
            'В целом всё устраивает, хочу поддерживающий уход',
          ],
        },
        {
          code: 'SEASONAL_CHANGES',
          text: 'Меняется ли состояние кожи в зависимости от сезона?',
          type: 'single_choice',
          position: 3,
          isRequired: true,
          options: ['Летом становится жирнее', 'Зимой суше', 'Круглый год одинаково'],
        },
      ],
    },

    // Группа 4: Здоровье
    {
      groupTitle: 'Данные о здоровье',
      groupPosition: 4,
      questions: [
        {
          code: 'MEDICAL_DIAGNOSES',
          text: 'Есть ли у вас диагнозы, поставленные врачом?',
          type: 'multi_choice',
          position: 1,
          isRequired: false,
          options: [
            'Акне',
            'Розацеа',
            'Себорейный дерматит',
            'Атопический дерматит / сухая кожа',
            'Пигментация (мелазма)',
            'Нет',
          ],
        },
        {
          code: 'PREGNANCY_STATUS',
          text: 'Вы беременны или кормите грудью?',
          type: 'single_choice',
          position: 2,
          isRequired: true,
          options: ['Я беременна', 'Я кормлю грудью', 'Нет'],
        },
        {
          code: 'ALLERGIES',
          text: 'Отмечались ли у вас аллергические реакции на косметические или уходовые средства?',
          type: 'multi_choice',
          position: 3,
          isRequired: false,
          options: [
            'Да, на средства для ухода за кожей (кремы, сыворотки, маски и др.)',
            'Да, на декоративную косметику',
            'Да, на солнцезащитные средства',
            'Не уверен(а), но бывали раздражения',
            'Нет, реакции не отмечались',
          ],
        },
        {
          code: 'ORAL_MEDICATIONS',
          text: 'Принимаете ли вы пероральные препараты для кожи?',
          type: 'multi_choice',
          position: 4,
          isRequired: false,
          options: [
            'Нет, не принимал(а)',
            'Изотретиноин (Аккутан, Роаккутан и аналоги)',
            'Антибиотики (Доксициклин, Миноциклин, Эритромицин и др.)',
            'Гормональные препараты (Спиронолактон, оральные контрацептивы)',
          ],
        },
      ],
    },

    // Группа 5: Текущий уход
    {
      groupTitle: 'Текущий уход',
      groupPosition: 5,
      questions: [
        {
          code: 'RETINOL_EXPERIENCE',
          text: 'Использовали ли вы когда-либо ретинол или ретиноиды?\n(например, третиноин, адапален и др.)',
          type: 'single_choice',
          position: 1,
          isRequired: true,
          options: ['Да', 'Нет'],
        },
        {
          code: 'RETINOL_REACTION',
          text: 'Как кожа реагировала?',
          type: 'single_choice',
          position: 2,
          isRequired: true,
          options: ['Хорошо переносила', 'Появлялось раздражение или сухость', 'Затрудняюсь ответить'],
        },
        {
          code: 'PRESCRIPTION_CREAMS',
          text: 'Применяете ли вы рецептурные кремы или гели для кожи?',
          type: 'multi_choice',
          position: 3,
          isRequired: false,
          options: [
            'Нет, не применяю',
            'Азелаиновая кислота (Skinoren, Азелик, Finacea)',
            'Антибактериальные средства (Клиндамицин — Клиндовит, Далацин; Метронидазол — Метрогил, Розамет)',
            'Ретиноиды наружные (Адапален — Дифферин, Адаклин; Изотретиноин — Изотрекс)',
            'Бензоилпероксид (Базирон АС, Эффезел)',
            'Кортикостероидные кремы/мази (Гидрокортизон, Адвантан, Локоид)',
          ],
        },
        {
          code: 'AVOID_INGREDIENTS',
          text: 'Выберите ингредиенты, которые вы хотели бы исключить',
          type: 'multi_choice',
          position: 5,
          isRequired: false,
          options: [
            'Такие ингредиенты отсутствуют',
            'Ретинол',
            'Витамин C',
            'Гиалуроновая кислота',
            'Ниацинамид',
            'Пептиды',
            'Церамиды',
            'Кислоты AHA/BHA (гликолевая, салициловая и др.)',
            'Минеральные масла',
            'Сульфаты (SLS, SLES)',
            'Парабены',
            'Отдушки и ароматизаторы',
            'Спирт (alcohol denat.)',
          ],
        },
      ],
    },

    // Группа 6: Привычки
    {
      groupTitle: 'Привычки и образ жизни',
      groupPosition: 6,
      questions: [
        {
          code: 'MAKEUP_FREQUENCY',
          text: 'Как часто вы используете декоративную косметику?',
          type: 'single_choice',
          position: 1,
          isRequired: true,
          options: ['Ежедневно', 'Иногда', 'Почти никогда'],
        },
        {
          code: 'SPF_USE',
          text: 'Как часто используете солнцезащитный крем?',
          type: 'single_choice',
          position: 2,
          isRequired: true,
          options: ['Каждый день', 'Иногда', 'Никогда'],
        },
        {
          code: 'SUN_EXPOSURE',
          text: 'Сколько времени вы проводите на солнце?',
          type: 'single_choice',
          position: 3,
          isRequired: true,
          options: ['0–1 час в день', '1–3 часа в день', 'Более 3 часов в день', 'Не знаю'],
        },
        {
          code: 'LIFESTYLE_HABITS',
          text: 'Ваши привычки\nМожно выбрать несколько',
          type: 'multi_choice',
          position: 4,
          isRequired: false,
          options: [
            'Курю',
            'Употребляю алкоголь',
            'Часто не высыпаюсь',
            'Испытываю стресс',
            'Ем много сладкого',
            'Ем много фастфуда',
            'Часто бываю на солнце без SPF',
            'Нет, у меня нет таких привычек',
          ],
        },
      ],
    },

    // Группа 7: Предпочтения
    {
      groupTitle: 'Предпочтения в уходе',
      groupPosition: 7,
      questions: [
        {
          code: 'CARE_TYPE',
          text: 'Какой тип ухода вам ближе?',
          type: 'single_choice',
          position: 1,
          isRequired: true,
          options: [
            'Стандартные продукты популярных брендов',
            'Только натуральное / органическое',
            'Медицинские и аптечные средства',
            'Не знаю, хочу, чтобы подобрали',
          ],
        },
        {
          code: 'ROUTINE_STEPS',
          text: 'Сколько шагов в уходе для вас комфортно?',
          type: 'single_choice',
          position: 2,
          isRequired: true,
          options: ['Минимум (1–3 шага)', 'Средний (3–5 шагов)', 'Максимум (5+ шагов)', 'Не знаю'],
        },
        {
          code: 'BUDGET',
          text: 'Какой бюджет вам комфортен?',
          type: 'single_choice',
          position: 3,
          isRequired: true,
          options: [
            'Бюджетный сегмент (до 2 000 ₽)',
            'Средний сегмент (2 000–5 000 ₽)',
            'Премиум-сегмент (5 000+ ₽)',
            'Без предпочтений (любой)',
          ],
        },
      ],
    },
  ];

  // Создаем группы и вопросы
  for (const groupData of questions) {
    const group = await prisma.questionGroup.create({
      data: {
        questionnaireId: questionnaire.id,
        title: groupData.groupTitle,
        position: groupData.groupPosition,
      },
    });

    // Поддерживаем как один вопрос, так и массив вопросов
    const questionsToCreate = groupData.question ? [groupData.question] : groupData.questions || [];

    for (const qData of questionsToCreate) {
      const question = await prisma.question.create({
        data: {
          questionnaireId: questionnaire.id,
          groupId: group.id,
          code: qData.code,
          text: qData.text,
          type: qData.type,
          position: qData.position,
          isRequired: qData.isRequired,
        },
      });

      // Создаем варианты ответов
      if (qData.options && qData.options.length > 0) {
        const answerOptions = qData.options.map((optionLabel, idx) => {
          const value = optionLabel
            .split('\n')[0] // Берем первую строку для value
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .toUpperCase()
            .substring(0, 50);

          return {
            questionId: question.id,
            value: `${qData.code}_${idx + 1}`,
            label: optionLabel,
            position: idx + 1,
            scoreJson: createScoreJson(qData.code, optionLabel),
          };
        });

        await prisma.answerOption.createMany({
          data: answerOptions,
        });
      }
    }
  }

  console.log('✅ Full questionnaire seeded successfully!');
  console.log('   Groups:', questions.length);
  console.log('   Total questions:', questions.reduce((sum, g) => sum + (g.question ? 1 : (g.questions?.length || 0)), 0));
}

seedFullQuestionnaire()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

