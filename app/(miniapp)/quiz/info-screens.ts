// Информационные экраны между вопросами анкеты
// Порядок экранов согласно требованиям пользователя (41 экран)

export interface Testimonial {
  stars: number;
  text: string;
  author: string;
  city?: string;
  beforeImage?: string;
  afterImage?: string;
}

export interface InfoScreenProduct {
  name: string;
  desc: string;
  icon: string;
}

export interface InfoScreen {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  // ИСПРАВЛЕНО: Разделены триггеры на два явных поля для предотвращения путаницы
  showAfterQuestionCode?: string; // Код вопроса (question.code), после которого показать экран
  showAfterInfoScreenId?: string; // ID предыдущего инфо-экрана (infoScreen.id), после которого показать экран
  ctaText?: string;
  type?: 'default' | 'testimonials' | 'tinder' | 'comparison' | 'products' | 'transformation'; // Тип экрана для специального рендеринга
  content?: Testimonial[] | InfoScreenProduct[] | any; // Дополнительные данные для кастомного рендеринга
  // Mini-progress-step: если указано, экран рендерится как «Шаг N из M: <stepLabel>»
  // с прогресс-баром. Используется для секционных интро между блоками вопросов.
  stepNumber?: number; // Текущий шаг (1-based)
  totalSteps?: number; // Всего шагов
  stepLabel?: string; // Короткое название блока (например, «Особенности кожи»)
}

// ИСПРАВЛЕНО: Единая функция для получения начальных инфо-экранов
// Начальные экраны - это те, которые не имеют showAfterQuestionCode И не имеют showAfterInfoScreenId
let _initialScreensCache: InfoScreen[] | null = null;

export function getInitialInfoScreens(): InfoScreen[] {
  if (_initialScreensCache) return _initialScreensCache;
  _initialScreensCache = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode && !screen.showAfterInfoScreenId);
  return _initialScreensCache;
}

export const INFO_SCREENS: InfoScreen[] = [
  // 1) Подбери уход для своей кожи со SkinIQ - начальный экран
  {
    id: 'welcome',
    title: 'Подбери уход для своей кожи со SkinIQ',
    image: '/onboarding/welcome.jpg',
    ctaText: 'Продолжить',
  },
  
  // 2) Как это работает?
  {
    id: 'how_it_works',
    title: 'Как это работает?',
    subtitle: '1. Ответьте на вопросы о коже\n2. Получите персональный план ухода\n3. Увидьте изменения кожи через 28 дней',
    ctaText: 'Продолжить',
  },
  
  // 3) SkinIQ — ваш персональный анализ кожи
  {
    id: 'personal_analysis',
    title: 'SkinIQ — ваш персональный анализ кожи',
    subtitle: '92% пользователей SkinIQ отмечают улучшение состояния кожи за 1 месяц',
    ctaText: 'Продолжить',
  },
  
  // goals_intro УДАЛЁН: филлер «Расскажите о вашей цели» перед самим вопросом
  // про цели не несёт пользы. После personal_analysis сразу идёт вопрос skin_goals.


  // 5) Вопрос: Какие ваши основные цели для кожи? (multi_choice, без ограничений)
  // Этот экран будет вопросом в БД
  
  // 6) Отзывы с горизонтальным скроллом
  {
    id: 'testimonials',
    title: 'Тысячи пользователей уже получили результат со SkinIQ',
    subtitle: 'Персональный уход\nпод ваши цели и особенности',
    type: 'testimonials',
    showAfterQuestionCode: 'skin_goals', // После вопроса о целях
    // Сокращено с 4 до 2 отзывов. По бенчмаркам мобильной карусели прокручивается 1-2 карточки;
    // 4-я почти никем не видна. Оставляем максимально разнообразную пару (акне + поры/жирность),
    // чтобы покрыть самые частые цели из skin_goals.
    content: [
      {
        stars: 5,
        text: '«С подобранным уходом ушли акне и следы постакне примерно за 3 месяца. Понравилось, что рекомендации не общие, а реально под мою кожу»',
        author: 'Ольга',
        city: 'Москва',
        beforeImage: '/отзыв1до.webp',
        afterImage: '/отзыв1после.webp',
      },
      {
        stars: 5,
        text: '«Всегда мучилась с расширенными порами и жирным блеском. Сейчас макияж держится нормально, а блеск появляется только к вечеру»',
        author: 'Екатерина',
        city: 'Казань',
        beforeImage: '/отзыв4до.webp',
        afterImage: '/отзыв4после.webp',
      },
    ],
    ctaText: 'Продолжить',
  },
  
  // general_info_intro и skin_features_intro УДАЛЕНЫ полностью:
  // оба были progress-step-экранами без UI (StepScreenAutoAdvance → null),
  // что давало белую вспышку при переходе. Лейблы «Шаг N: название»
  // продолжают показываться над прогресс-баром вопросов через QUESTION_STEP_MAP
  // (см. QuizQuestion.tsx). Вопросы Возраст (age), Пол (gender) и далее
  // Тип кожи / Особенности — идут напрямую после соответствующих экранов
  // без промежуточных филлеров.
  // 9) Тип кожи - это вопрос в БД (skin_type)
  // 10) Что вас больше всего беспокоит - это вопрос в БД (skin_concerns)
  // 11) Чувствительность кожи (skin_sensitivity) - вопрос в БД
  // 12) Меняется ли состояние кожи в зависимости от сезона? - вопрос в БД (seasonal_changes)
  
  // Mid-quiz preview персонализации. Показывается сразу после блока скин-вопросов
  // (skin_type/skin_concerns/skin_sensitivity/seasonal_changes/fitzpatrick_type). Цель — показать
  // пользователю промежуточный «вывод» по его ответам, удержать на следующий блок.
  // Контент рендерится динамически в QuizInfoScreen.tsx по флагу isSkinPreviewScreen.
  {
    id: 'skin_preview',
    title: 'Ваш предварительный профиль',
    showAfterQuestionCode: 'fitzpatrick_type',
    ctaText: 'Продолжить',
  },

  // SkinIQ делает уход за кожей простым и понятным
  // ПЕРЕАНКОРИРОВАН: раньше срабатывал после вопроса seasonal_changes —
  // теперь идёт в цепочке после skin_preview, чтобы preview шёл первым.
  {
    id: 'simple_care',
    title: 'SkinIQ делает уход за кожей простым и понятным',
    image: '/image 1576994977.webp',
    type: 'comparison',
    content: {
      left: {
        title: 'Традиционный уход',
        items: [
          'Часы поиска советов в интернете',
          'Тратить деньги на неподходящие средства',
          'Результата приходится ждать месяцами',
        ],
      },
      right: {
        title: 'Со SkinIQ',
        items: [
          'Персональные рекомендации для вашего типа кожи',
          'Сканируйте и отслеживайте прогресс легко',
          'Видимые результаты уже через несколько недель',
        ],
      },
    },
    showAfterInfoScreenId: 'skin_preview',
    ctaText: 'Продолжить',
  },
  
  // health_data УДАЛЁН: был progress-step без UI, давал белую вспышку.
  // Гарантия приватности теперь нативно отображается в самой анкете (см. health-related вопросы).
  // Лейбл «Шаг 3: Данные о здоровье» сохранён в QUESTION_STEP_MAP.
  // 15) Есть ли у вас диагнозы? - вопрос в БД (medical_diagnoses)
  // 16) Беременность/кормление (только для женщин) - вопрос в БД (pregnancy_breastfeeding)
  // 17) Аллергические реакции - вопрос в БД (allergies)
  // 18) Исключить ингредиенты (можно пропустить) - вопрос в БД (avoid_ingredients)
  
  // SkinIQ заботится о вашем здоровье — trust-экран после блока медицинских вопросов.
  // ПЕРЕАНКОРИРОВАН: было после avoid_ingredients (который теперь conditional и может быть
  // пропущен gate-вопросом has_avoid_ingredients). Теперь анкорится на has_avoid_ingredients —
  // экран показывается одинаково для всех пользователей вне зависимости от пути.
  {
    id: 'health_trust',
    title: 'SkinIQ заботится\nо вашем здоровье',
    image: '/image 1576994970.webp',
    showAfterQuestionCode: 'has_avoid_ingredients',
    ctaText: 'Продолжить',
  },
  
  // current_care_intro УДАЛЁН: интро к блоку «Текущий уход», лишний экран.
  // 21) Ретинол - вопрос в БД (retinoid_usage)
  // 22) Рецептурные кремы - вопрос в БД (prescription_topical)
  // 23) Пероральные препараты - вопрос в БД (oral_medications)

  // ai_showcase УДАЛЁН: дубликат продажи AI (есть уже в simple_care).
  // habits_matter УДАЛЁН: интро к блоку «Привычки», в котором остался единственный вопрос — лишнее.
  // 26) Декоративная косметика - вопрос в БД (makeup_frequency)

  // Больше никакой путаницы — пробивка AI ПЕРЕД блоком «Предпочтения в уходе».
  // ПЕРЕАНКОРИРОВАН: lifestyle_habits → makeup_frequency → oral_medications.
  // Теперь идёт после oral_medications (последний вопрос блока «Текущий уход»)
  // и сразу перед preferences-блоком, в который перемещён makeup_frequency.
  // Поток: medical/current care → AI pitch + price anchor → preferences
  // (makeup_frequency → care_type → care_steps → budget).
  {
    id: 'ai_comparison',
    title: 'Больше никакой путаницы — AI SkinIQ подберёт уход быстро и точно ✨',
    subtitle: 'Традиционный подбор ухода:\n❌ Долгие поиски советов в интернете\n❌ Сложно понять, что подойдёт именно вам\n\nSkinIQ с AI:\n✅ Точный подбор средств на основе анкеты\n✅ Рекомендации за пару секунд\n\n💡 Большинство персональных планов укладывается в 3–5 средств — от 2 000 ₽/мес в бюджетном сегменте до 5 000+ ₽/мес в премиум.',
    content: {
      traditionalItems: [
        'Долгие поиски советов в интернете',
        'Сложно понять, что подойдёт именно вам',
      ],
      skiniqItems: [
        'Точный подбор средств на основе анкеты',
        'Рекомендации за пару секунд',
      ],
      hint: 'Большинство персональных планов укладывается в 3–5 средств — от 2 000 ₽/мес в бюджетном сегменте до 5 000+ ₽/мес в премиум.',
    },
    type: 'comparison',
    showAfterQuestionCode: 'oral_medications',
    ctaText: 'Продолжить',
  },
  
  // preferences_intro УДАЛЁН: был progress-step без UI, давал белую вспышку.
  // Лейбл «Шаг 4: Ваши предпочтения» сохранён в QUESTION_STEP_MAP.
  // 32) Тип ухода - вопрос в БД (care_type)
  // 33) Количество шагов - вопрос в БД (care_steps)
  // 34) Бюджет - вопрос в БД (budget)
  
  // Финальный продающий экран перед закрывающей последовательностью.
  {
    id: 'no_mistakes',
    title: 'Ваш SkinIQ-план почти готов',
    subtitle: 'Мы собрали рекомендации, которые помогут вашей коже выглядеть лучше — без хаотичных покупок и сложных схем.',
    showAfterQuestionCode: 'budget',
    ctaText: 'Завершить анализ',
  },
  
  // motivation_focus УДАЛЁН: чистый мотивационный текст без информационной ценности.

  // 37) Вы узнаёте себя в этом? (Tinder-экран 1)
  // ПЕРЕАНКОРИРОВАН: было после motivation_focus (удалён) — теперь напрямую после no_mistakes.
  // Фон: фото девушки с welcome-экрана — на двух подряд tinder-экранах создаём эффект
  // «это про вас», совпадая с первым визуальным якорем анкеты.
  {
    id: 'recognize_yourself_1',
    title: 'Вы узнаёте себя в этом?',
    subtitle: '«Я часто чувствую недовольство своей кожей, когда смотрю в зеркало»',
    image: '/onboarding/welcome.webp',
    type: 'tinder',
    showAfterInfoScreenId: 'no_mistakes',
    ctaText: '', // Кнопки будут отдельными (Нет/Да)
  },

  // Второй Tinder перед планом. ИЗМЕНЕН ТОН: раньше было «не знаю какие средства» —
  // два подряд негативных утверждения (про недовольство в зеркале + растерянность) создавали
  // эмоциональную просадку прямо перед закрытием. Теперь — позитивный identity-claim:
  // свайп «Да» строит самоидентификацию вместо подтверждения боли.
  {
    id: 'recognize_yourself_2',
    title: 'Это похоже на вас?',
    subtitle: '«Я хочу понимать СВОЮ кожу и подбирать уход осознанно — а не следовать общим советам из интернета»',
    image: '/onboarding/welcome.webp',
    type: 'tinder',
    showAfterInfoScreenId: 'recognize_yourself_1',
    ctaText: '', // Кнопки будут отдельными (Нет/Да)
  },
  
  // created_for_you УДАЛЁН: третий повтор соц-прува (есть уже в personal_analysis и testimonials).

  // ФИКС #5: skin_transformation объединён с want_improve в один финальный экран.
  // Старая запись skin_transformation удалена (раньше показывалась отдельно после
  // recognize_yourself_2 → потом want_improve). Сейчас want_improve рендерится
  // компонентом ImproveSkinScreen, который совмещает transformation-визуал ("Посмотрите,
  // как меняется ваша кожа") и CTA "Получить план ухода". После него начинается генерация.
  {
    id: 'want_improve',
    title: 'Хотите улучшить состояние кожи?',
    subtitle: 'Первые видимые изменения — уже через 28 дней регулярного ухода. Отслеживайте прогресс и подкручивайте план под себя.',
    type: 'tinder',
    showAfterInfoScreenId: 'recognize_yourself_2', // ФИКС #5: напрямую после recognize_yourself_2
    ctaText: '', // Кнопки рендерятся внутри ImproveSkinScreen
    content: {
      from: 'Сейчас',
      to: 'Ваша цель',
      indicator: 'Здоровье кожи',
    },
  },
];

// Функция для получения информационного экрана, который нужно показать после вопроса с указанным кодом
export function getInfoScreenAfterQuestion(questionCode: string): InfoScreen | undefined {
  return INFO_SCREENS.find(screen => screen.showAfterQuestionCode === questionCode);
}

/** Следующий инфо-экран в цепочке (имеет showAfterInfoScreenId === screenId) */
export function getNextInfoScreenAfterScreen(screenId: string): InfoScreen | undefined {
  return INFO_SCREENS.find(screen => screen.showAfterInfoScreenId === screenId);
}

/**
 * Проходит всю цепочку инфо-экранов, начиная от startScreen.
 * Возвращает массив экранов в порядке показа (включая startScreen).
 */
export function walkInfoScreenChain(startScreen: InfoScreen): InfoScreen[] {
  const chain: InfoScreen[] = [startScreen];
  const visited = new Set<string>([startScreen.id]);
  let current = startScreen;
  while (true) {
    const next = getNextInfoScreenAfterScreen(current.id);
    if (!next || visited.has(next.id)) break;
    chain.push(next);
    visited.add(next.id);
    current = next;
  }
  return chain;
}

/**
 * Находит первый экран в цепочке — тот, у которого есть showAfterQuestionCode.
 * Полезно для определения, после какого вопроса началась цепочка.
 */
export function findChainOriginQuestionCode(screen: InfoScreen): string | undefined {
  const visited = new Set<string>();
  let current: InfoScreen | undefined = screen;
  while (current) {
    if (current.showAfterQuestionCode) return current.showAfterQuestionCode;
    if (visited.has(current.id)) break;
    visited.add(current.id);
    if (!current.showAfterInfoScreenId) break;
    current = INFO_SCREENS.find(s => s.id === current!.showAfterInfoScreenId);
  }
  return undefined;
}

// Функция для получения инфо-экрана, который должен показываться перед указанным вопросом
// Возвращает последний инфо-экран в цепочке, который идет перед этим вопросом
export function getInfoScreenBeforeQuestion(_questionCode: string): InfoScreen | undefined {
  // Ищем все инфо-экраны, которые могут быть связаны с этим вопросом
  // Проверяем цепочки: question -> infoScreen -> nextInfoScreen -> ... -> currentQuestion
  // Находим последний инфо-экран в цепочке, который идет перед текущим вопросом
  
  // Сначала ищем инфо-экран, который показывается после предыдущего вопроса
  // Но нам нужно найти инфо-экран, который идет ПЕРЕД текущим вопросом
  
  // Проходим по всем инфо-экранам и ищем тот, который является последним перед текущим вопросом
  // Последний инфо-экран перед вопросом - это тот, который не имеет следующего инфо-экрана в цепочке
  // и который должен показываться перед текущим вопросом
  
  // Для простоты: находим все инфо-экраны, которые не имеют следующего в цепочке (конец цепочки)
  // и проверяем, какой из них должен показываться перед текущим вопросом
  // Но это сложно определить напрямую...
  
  // Альтернативный подход: находим инфо-экран, который показывается после предыдущего вопроса,
  // и проходим по цепочке до конца - это и будет инфо-экран перед текущим вопросом
  // Но нам нужно знать предыдущий вопрос...
  
  // Пока возвращаем undefined - логика будет в handleBack
  return undefined;
}

// Функция для получения всех информационных экранов в порядке их показа
export function getAllInfoScreens(): InfoScreen[] {
  return INFO_SCREENS;
}

// ИСПРАВЛЕНО: Dev-валидация цепочки инфо-экранов для предотвращения циклов и ошибок
if (process.env.NODE_ENV === 'development') {
  const validateInfoScreens = () => {
    const screenIds = new Set(INFO_SCREENS.map(s => s.id));
    const errors: string[] = [];
    
    // Проверяем уникальность id
    if (screenIds.size !== INFO_SCREENS.length) {
      errors.push('❌ Дубликаты id в INFO_SCREENS');
    }
    
    // Проверяем, что все showAfterInfoScreenId указывают на существующие экраны
    for (const screen of INFO_SCREENS) {
      if (screen.showAfterInfoScreenId && !screenIds.has(screen.showAfterInfoScreenId)) {
        errors.push(`❌ Экран "${screen.id}" ссылается на несуществующий showAfterInfoScreenId: "${screen.showAfterInfoScreenId}"`);
      }
    }
    
    // Проверяем циклы в цепочке
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const checkCycle = (screenId: string): boolean => {
      if (recursionStack.has(screenId)) {
        errors.push(`❌ Обнаружен цикл в цепочке инфо-экранов, включающий: ${screenId}`);
        return true;
      }
      if (visited.has(screenId)) {
        return false;
      }
      
      visited.add(screenId);
      recursionStack.add(screenId);
      
      const screen = INFO_SCREENS.find(s => s.id === screenId);
      if (screen?.showAfterInfoScreenId) {
        if (checkCycle(screen.showAfterInfoScreenId)) {
          return true;
        }
      }
      
      recursionStack.delete(screenId);
      return false;
    };
    
    for (const screen of INFO_SCREENS) {
      if (screen.showAfterInfoScreenId && !visited.has(screen.id)) {
        checkCycle(screen.id);
      }
    }
    
    if (errors.length > 0) {
      console.error('🚨 Ошибки валидации INFO_SCREENS:', errors);
    } else {
      console.log('✅ INFO_SCREENS валидация пройдена');
    }
  };
  
  // Запускаем валидацию при загрузке модуля
  validateInfoScreens();
}
