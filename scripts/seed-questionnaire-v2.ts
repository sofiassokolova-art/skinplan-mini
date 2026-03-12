// scripts/seed-questionnaire-v2.ts
// Полный seed анкеты согласно QUIZ_FLOW.md (41 экран)
// Все вопросы с правильными кодами для связи с инфо-экранами

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Функция для создания scoreJson на основе вопроса и ответа
function createScoreJson(questionCode: string, optionLabel: string): any {
  const scores: any = {};

  // Тип кожи
  if (questionCode === 'skin_type') {
    if (optionLabel.includes('Тип 1') || optionLabel.includes('Сухая')) {
      return { oiliness: 0, dehydration: 5 };
    }
    if (optionLabel.includes('Тип 2') || optionLabel.includes('Комбинированная (сухая)')) {
      return { oiliness: 2, dehydration: 3 };
    }
    if (optionLabel.includes('Тип 3') && optionLabel.includes('Нормальная')) {
      return { oiliness: 1, dehydration: 1 };
    }
    if (optionLabel.includes('Тип 3') && optionLabel.includes('Комбинированная (жирная)')) {
      return { oiliness: 3, dehydration: 1 };
    }
    if (optionLabel.includes('Тип 4') || optionLabel.includes('Жирная')) {
      return { oiliness: 5, dehydration: 0 };
    }
  }

  // Проблемы кожи
  if (questionCode === 'skin_concerns') {
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
    if (optionLabel.includes('Морщины')) {
      return { aging: 2 };
    }
  }

  // Возраст
  if (questionCode === 'age') {
    if (optionLabel.includes('До 18')) return { age_group: '18_25' };
    if (optionLabel.includes('18–24')) return { age_group: '18_25' };
    if (optionLabel.includes('25–34')) return { age_group: '26_30' };
    if (optionLabel.includes('35–44')) return { age_group: '31_40' };
    if (optionLabel.includes('45+')) return { age_group: '41_50' };
  }

  // Беременность
  if (questionCode === 'pregnancy_breastfeeding') {
    if (optionLabel.includes('беременна') || optionLabel.includes('кормлю')) {
      return { has_pregnancy: true };
    }
    return { has_pregnancy: false };
  }

  // Чувствительность
  if (questionCode === 'skin_sensitivity') {
    if (optionLabel.includes('Нет') || optionLabel === 'Нет') {
      return { sensitivity: 0 };
    }
    if (optionLabel.includes('Низкий')) {
      return { sensitivity: 1 };
    }
    if (optionLabel.includes('Средний')) {
      return { sensitivity: 2 };
    }
    if (optionLabel.includes('Высокий')) {
      return { sensitivity: 3 };
    }
  }

  return {};
}

async function seedQuestionnaireV2() {
  console.log('🌱 Seeding questionnaire v2 according to QUIZ_FLOW.md...');

  // Проверяем, не существует ли уже анкета v2
  const existing = await prisma.questionnaire.findUnique({
    where: { version: 2 },
  });

  if (existing) {
    console.log('⚠️  Questionnaire v2 already exists. Deleting old version...');
    await prisma.questionnaire.delete({
      where: { id: existing.id },
    });
  }

  // Создаем анкету v2
  const questionnaire = await prisma.questionnaire.create({
    data: {
      name: 'Анкета v2 (41 экран)',
      version: 2,
      isActive: true,
    },
  });

  console.log('✅ Questionnaire v2 created:', questionnaire.id);

  // Определяем вопросы согласно QUIZ_FLOW.md
  // Порядок важен - он соответствует последовательности экранов
  
  const questionsData = [
    // 0. Имя (первый вопрос после инфо-экранов)
    {
      groupTitle: 'Приветствие',
      groupPosition: 0,
      questions: [
        {
          code: 'USER_NAME',
          text: 'Как мы можем к вам обращаться?',
          type: 'free_text',
          position: 1,
          isRequired: true,
          options: [],
        },
      ],
    },
    // 5. Какие ваши основные цели для кожи? (skin_goals)
    {
      groupTitle: 'Цели ухода',
      groupPosition: 1,
      questions: [
        {
          code: 'skin_goals',
          text: 'На чём вы хотите сфокусироваться?',
          type: 'multi_choice',
          position: 1,
          isRequired: true,
          options: [
            'Сократить морщины и мелкие линии',
            'Избавиться от акне и высыпаний',
            'Сделать поры менее заметными',
            'Уменьшить отёчность лица',
            'Выровнять тон и пигментацию',
            'Улучшить текстуру и гладкость кожи',
          ],
        },
      ],
    },

    // 8-9. Общая информация (age, gender)
    {
      groupTitle: 'Общая информация',
      groupPosition: 2,
      questions: [
        {
          code: 'age',
          text: 'Возраст',
          type: 'single_choice',
          position: 1,
          isRequired: true,
          options: ['До 18 лет', '18–24', '25–34', '35–44', '45+'],
        },
        {
          code: 'gender',
          text: 'Пол',
          type: 'single_choice',
          position: 2,
          isRequired: true,
          options: ['Женский', 'Мужской'],
        },
      ],
    },

    // 11-14. Особенности кожи
    {
      groupTitle: 'Особенности кожи',
      groupPosition: 3,
      questions: [
        {
          code: 'skin_type',
          text: 'Тип кожи',
          type: 'single_choice',
          position: 1,
          isRequired: true,
          options: [
            'Тип 1 — Сухая\nКожа ощущается стянутой и сухой по всей поверхности, часто вызывает дискомфорт, особенно после умывания',
            'Тип 2 — Комбинированная (сухая)\nЕсть стянутость и сухость в области скул и щёк, в Т-зоне кожа нормальная',
            'Тип 3 - Нормальная\nНет ощущения стянутости и сухости кожи, не появляется жирный блеск в Т-зоне',
            'Тип 3 — Комбинированная (жирная)\nВ области щёк и скул кожа нормальная , но в Т-зоне появляется жирный блеск',
            'Тип 4 — Жирная\nЖирный блеск присутствует во всех зонах лица. Кожа выглядит жирной и склонна к закупориванию пор',
          ],
        },
        {
          code: 'skin_concerns',
          text: 'Что вас больше всего беспокоит в коже сейчас? (можно выбрать несколько)',
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
            'Морщины',
            'Отеки под глазами',
            'Круги под глазами',
            'В целом всё устраивает, хочу поддерживающий уход',
          ],
        },
        {
          code: 'skin_sensitivity',
          text: 'Насколько ваша кожа склонна к покраснениям и раздражениям?',
          type: 'single_choice',
          position: 3,
          isRequired: true,
          options: [
            'Практически никогда, кожа устойчивая',
            'Легкое покраснение, которое быстро проходит',
            'Заметное покраснение и дискомфорт, который может сохраняться',
            'Сильное и стойкое покраснение, возможны диагнозы (розацеа, дерматит)',
          ],
        },
        {
          code: 'seasonal_changes',
          text: 'Меняется ли состояние кожи в зависимости от сезона?',
          type: 'single_choice',
          position: 4,
          isRequired: true,
          options: ['Летом становится жирнее', 'Зимой суше', 'Круглый год одинаково'],
        },
      ],
    },

    // 17–20. Данные о здоровье: после oral_medications показывается health_trust → current_care_intro, затем блок «Текущий уход»
    {
      groupTitle: 'Данные о здоровье',
      groupPosition: 4,
      questions: [
        {
          code: 'medical_diagnoses',
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
          code: 'pregnancy_breastfeeding',
          text: 'Вы беременны или кормите грудью?',
          type: 'single_choice',
          position: 2,
          isRequired: false, // Не обязательно, показывается только для женщин
          options: ['Я беременна', 'Я кормлю грудью', 'Нет'],
        },
        {
          code: 'allergies',
          text: 'Отмечались ли у вас аллергические реакции на косметические или уходовые средства?',
          type: 'single_choice',
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
          code: 'oral_medications',
          text: 'Принимаете ли вы пероральные препараты?',
          type: 'multi_choice',
          position: 4,
          isRequired: false,
          options: [
            'Изотретиноин (Аккутан, Роаккутан и аналоги)',
            'Антибиотики (Доксициклин, Миноциклин, Эритромицин и др.)',
            'Гормональные препараты (Спиронолактон, оральные контрацептивы)',
            'Нет, не принимал(а)',
          ],
        },
      ],
    },

    // 21–24. Текущий уход: после current_care_intro идут ретинол → рецептурные → avoid_ingredients; после avoid_ingredients — ai_showcase → habits_matter → makeup_frequency
    {
      groupTitle: 'Текущий уход',
      groupPosition: 5,
      questions: [
        {
          code: 'retinoid_usage',
          text: 'Использовали ли вы когда-либо ретинол или ретиноиды?\nНапример, третиноин, адапален и др.',
          type: 'single_choice',
          position: 1,
          isRequired: false,
          options: ['Да', 'Нет'],
        },
        {
          code: 'retinoid_reaction',
          text: 'Как кожа реагировала?',
          type: 'single_choice',
          position: 2,
          isRequired: false, // Показывается только если retinoid_usage === 'Да'
          options: [
            'Хорошо переносила',
            'Появлялось раздражение или сухость',
            'Затрудняюсь ответить',
          ],
        },
        {
          code: 'prescription_topical',
          text: 'Применяете ли вы рецептурные кремы или гели для кожи?',
          type: 'multi_choice',
          position: 3,
          isRequired: false,
          options: [
            'Азелаиновая кислота (Skinoren, Азелик, Finacea)',
            'Антибактериальные средства (Клиндамицин — Клиндовит, Далацин; Метронидазол — Метрогил, Розамет)',
            'Ретиноиды наружные (Адапален — Дифферин, Адаклин; Изотретиноин — Изотрекс)',
            'Бензоилпероксид (Базирон АС, Эффезел)',
            'Кортикостероидные кремы/мази (Гидрокортизон, Адвантан, Локоид)',
            'Нет, не применяю',
          ],
        },
        {
          code: 'avoid_ingredients',
          text: 'Выберите ингредиенты, которые вы хотели бы исключить',
          type: 'multi_choice',
          position: 4,
          isRequired: false,
          options: [
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
            'Такие ингредиенты отсутствуют',
          ],
        },
      ],
    },

    // 29-32. Привычки и образ жизни
    {
      groupTitle: 'Привычки и образ жизни',
      groupPosition: 6,
      questions: [
        {
          code: 'makeup_frequency',
          text: 'Как часто вы используете декоративную косметику?',
          type: 'single_choice',
          position: 1,
          isRequired: false,
          options: ['Ежедневно', 'Иногда', 'Почти никогда'],
        },
        {
          code: 'spf_frequency',
          text: 'Как часто используете солнцезащитный крем?',
          type: 'single_choice',
          position: 2,
          isRequired: false,
          options: ['Каждый день', 'Иногда', 'Никогда'],
        },
        {
          code: 'sun_exposure',
          text: 'Сколько времени вы проводите на солнце?',
          type: 'single_choice',
          position: 3,
          isRequired: false,
          options: ['0–1 час в день', '1–3 часа в день', 'Более 3 часов в день', 'Не знаю'],
        },
        {
          code: 'lifestyle_habits',
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

    // 35-37. Предпочтения в уходе
    {
      groupTitle: 'Предпочтения в уходе',
      groupPosition: 7,
      questions: [
        {
          code: 'care_type',
          text: 'Какой тип ухода вам ближе?',
          type: 'single_choice',
          position: 1,
          isRequired: false,
          options: [
            'Стандартные продукты популярных брендов',
            'Только натуральное / органическое',
            'Медицинские и аптечные средства',
            'Не знаю, хочу, чтобы подобрали',
          ],
        },
        {
          code: 'care_steps',
          text: 'Сколько шагов в уходе для вас комфортно?',
          type: 'single_choice',
          position: 2,
          isRequired: false,
          options: ['Минимум (1–3 шага)', 'Средний (3–5 шагов)', 'Максимум (5+ шагов)', 'Не знаю'],
        },
        {
          code: 'budget',
          text: 'Какой бюджет вам комфортен?',
          type: 'single_choice',
          position: 3,
          isRequired: false,
          options: [
            'Бюджетный сегмент\ndo 2 000 ₽',
            'Средний сегмент\n2 000–5 000 ₽',
            'Премиум-сегмент\n5 000+ ₽',
            'Без предпочтений\nЛюбой',
          ],
        },
      ],
    },
  ];

  // Создаем группы и вопросы
  let globalQuestionPosition = 1;

  for (const groupData of questionsData) {
    const group = await prisma.questionGroup.create({
      data: {
        questionnaireId: questionnaire.id,
        title: groupData.groupTitle,
        position: groupData.groupPosition,
      },
    });

    console.log(`✅ Created group: ${groupData.groupTitle}`);

    for (const qData of groupData.questions) {
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

      console.log(`  ✅ Created question: ${qData.code} (${qData.text.substring(0, 50)}...)`);

      // Создаем варианты ответов
      if (qData.options && qData.options.length > 0) {
        const answerOptions = qData.options.map((optionLabel, idx) => {
          // Для value используем код вопроса + индекс
          const value = `${qData.code}_${idx + 1}`;

          return {
            questionId: question.id,
            value: value,
            label: optionLabel,
            position: idx + 1,
            scoreJson: createScoreJson(qData.code, optionLabel),
          };
        });

        await prisma.answerOption.createMany({
          data: answerOptions,
        });

        console.log(`    ✅ Created ${answerOptions.length} answer options`);
      }

      globalQuestionPosition++;
    }
  }

  // Деактивируем все старые версии
  await prisma.questionnaire.updateMany({
    where: {
      isActive: true,
      id: { not: questionnaire.id },
    },
    data: { isActive: false },
  });
  console.log('✅ Deactivated all other questionnaire versions');

  // Активируем новую версию
  await prisma.questionnaire.update({
    where: { id: questionnaire.id },
    data: { isActive: true },
  });
  console.log('✅ Activated questionnaire v2');

  const totalQuestions = questionsData.reduce((sum, g) => sum + g.questions.length, 0);
  
  console.log('\n✅ Questionnaire v2 seeded successfully!');
  console.log(`   Groups: ${questionsData.length}`);
  console.log(`   Total questions: ${totalQuestions}`);
  console.log(`   Questionnaire ID: ${questionnaire.id}`);
  console.log('\n📋 Questions order:');
  questionsData.forEach((group, gIdx) => {
    console.log(`\n   ${gIdx + 1}. ${group.groupTitle}:`);
    group.questions.forEach((q, qIdx) => {
      console.log(`      ${qIdx + 1}. [${q.code}] ${q.text.substring(0, 60)}...`);
    });
  });
}

seedQuestionnaireV2()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

