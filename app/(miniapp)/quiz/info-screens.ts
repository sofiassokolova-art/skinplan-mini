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
    image: '/792c9598_nano_4K.jpg',
    ctaText: 'Продолжить',
  },
  
  // 2) Как это работает?
  {
    id: 'how_it_works',
    title: 'Как это работает?',
    subtitle: '1. Пройдите анкету\n2. Получите индивидуальную программу ухода\nи персональные советы\nот дерматологов\n3. Отслеживайте прогресс ежедневно',
    image: '/5426b95c-f28c-4172-b3ef-e67237150a77.jpg',
    ctaText: 'Продолжить',
  },
  
  // 3) SkinIQ — ваш персональный анализ кожи
  {
    id: 'personal_analysis',
    title: 'SkinIQ — ваш персональный анализ кожи',
    subtitle: '92% пользователей SkinIQ отмечают улучшение состояния кожи за 1 месяц',
    image: '/skin-model.jpg',
    ctaText: 'Продолжить',
  },
  
  // 4) Расскажите о вашей цели
  {
    id: 'goals_intro',
    title: 'Расскажите\nо вашей цели',
    subtitle: 'Это поможет нам сделать рекомендации точнее',
    image: '/quiz4.png',
    ctaText: 'Продолжить',
  },
  
  // 5) Вопрос: Какие ваши основные цели для кожи? (multi_choice, без ограничений)
  // Этот экран будет вопросом в БД
  
  // 6) Отзывы с горизонтальным скроллом
  {
    id: 'testimonials',
    title: 'Тысячи пользователей уже\nполучили результат\nсо SkinIQ',
    type: 'testimonials',
    showAfterQuestionCode: 'skin_goals', // После вопроса о целях
    content: [
      {
        stars: 5,
        text: '«С подобранным уходом ушли акне и следы постакне примерно за 3 месяца. Понравилось, что рекомендации не общие, а реально под мою кожу»',
        author: 'Ольга',
        city: 'Москва',
        beforeImage: '/отзыв1до.jpeg',
        afterImage: '/отзыв1после.jpg',
      },
      {
        stars: 5,
        text: '«Кожа стала заметно более увлажнённой и упругой. Раньше постоянно меняла средства, а тут наконец-то попали точно»',
        author: 'Дарья',
        city: 'Санкт-Петербург',
        beforeImage: '/отзыв2до.jpeg',
        afterImage: '/отзыв2после.jpeg',
      },
      {
        stars: 5,
        text: '«Была проблема с покраснением и чувствительностью. Уже через месяц кожа стала спокойнее, меньше реагирует на всё подряд»',
        author: 'Ирина',
        city: 'Екатеринбург',
        beforeImage: '/отзыв3до.jpeg',
        afterImage: '/отзыв3после.jpeg',
      },
      {
        stars: 5,
        text: '«Всегда мучилась с расширенными порами и жирным блеском. Сейчас макияж держится нормально, а блеск появляется только к вечеру»',
        author: 'Екатерина',
        city: 'Казань',
        beforeImage: '/отзыв4до.jpeg',
        afterImage: '/отзыв4после.jpeg',
      },
    ],
    ctaText: 'Продолжить',
  },
  
  // 7) Общая информация (инфо-экран перед вопросами о возрасте и поле)
  {
    id: 'general_info_intro',
    title: 'Общая информация',
    subtitle: 'Поможет нам подобрать подходящий уход',
    image: '/information.png',
    showAfterInfoScreenId: 'testimonials', // ИСПРАВЛЕНО: После экрана testimonials, а не вопроса
    ctaText: 'Продолжить',
  },
  // Вопросы: Возраст (age), Пол (gender)
  
  // 8) Узнаем особенности вашей кожи
  {
    id: 'skin_features_intro',
    title: 'Узнаем особенности вашей кожи',
    subtitle: 'Мы поймем какой у вас тип кожи и как о нем заботиться лучше всего',
    image: '/lookimgclosely.png',
    showAfterQuestionCode: 'gender',
    ctaText: 'Продолжить',
  },
  // 9) Тип кожи - это вопрос в БД (skin_type)
  // 10) Что вас больше всего беспокоит - это вопрос в БД (skin_concerns)
  // 11) Чувствительность кожи (skin_sensitivity) - вопрос в БД
  // 12) Меняется ли состояние кожи в зависимости от сезона? - вопрос в БД (seasonal_changes)
  
  // 13) SkinIQ делает уход за кожей простым и понятным
  {
    id: 'simple_care',
    title: 'SkinIQ делает уход за кожей простым и понятным',
    subtitle: 'Традиционный уход:\n❌ Часы поиска советов в интернете\n❌ Тратить деньги на неподходящие средства\n❌ Результата приходится ждать месяцами\n\nС SkinIQ:\n✅ Персональные рекомендации для вашего типа кожи\n✅ Сканируйте и отслеживайте прогресс легко\n✅ Видимые результаты уже через несколько недель',
    type: 'comparison',
    showAfterQuestionCode: 'seasonal_changes',
    ctaText: 'Продолжить',
  },
  
  // 14) Нам важно учесть ваши данные о здоровье
  {
    id: 'health_data',
    title: 'Нам важно учесть ваши данные о здоровье',
    subtitle: 'Ваши данные защищены — они нужны только для точных рекомендаций',
    image: '/healthmatter.png',
    showAfterInfoScreenId: 'simple_care', // ИСПРАВЛЕНО: После экрана simple_care, а не вопроса
    ctaText: 'Продолжить',
  },
  // 15) Есть ли у вас диагнозы? - вопрос в БД (medical_diagnoses)
  // 16) Беременность/кормление (только для женщин) - вопрос в БД (pregnancy_breastfeeding)
  // 17) Аллергические реакции - вопрос в БД (allergies)
  // 18) Исключить ингредиенты (можно пропустить) - вопрос в БД (avoid_ingredients)
  
  // 19) SkinIQ заботится о вашем здоровье
  {
    id: 'health_trust',
    title: '💙 SkinIQ заботится о вашем здоровье',
    subtitle: 'Все рекомендации по уходу одобрены врачами-дерматологами и абсолютно безопасны\n\nВся информация остаётся конфиденциальной и используется только для персональных рекомендаций',
    image: '/dermatologist_examining.jpg',
    showAfterQuestionCode: 'oral_medications',
    ctaText: 'Продолжить',
  },
  
  // 20) Расскажите о вашем текущем уходе — та же вёрстка, что Общая информация (GoalsIntroScreen)
  {
    id: 'current_care_intro',
    title: 'Расскажите о вашем текущем уходе',
    subtitle: 'Это поможет нам понять, какие средства вы уже используете и как реагирует ваша кожа',
    image: '/routine.png',
    showAfterInfoScreenId: 'health_trust', // FIX: было showAfterQuestionCode — но health_trust это info screen, не question
    ctaText: 'Продолжить',
  },
  // 21) Ретинол - вопрос в БД (retinoid_usage) - если Да, показывается доп. вопрос (retinoid_reaction)
  // 22) Рецептурные кремы - вопрос в БД (prescription_topical)
  // 23) Пероральные препараты - вопрос в БД (oral_medications)
  
  // 24) SkinIQ использует ИИ
  {
    id: 'ai_showcase',
    title: 'SkinIQ использует ИИ для подбора ухода, который действительно работает',
    subtitle: '95% точность рекомендаций\n10M+ анализов кожи по фото\nПоддержка 500+ активных ингредиентов\nОбучено на данных, подтверждённых дерматологами',
    type: 'products',
    // ПОСЛЕ вопроса "Выберите ингредиенты, которые вы хотели бы исключить" (avoid_ingredients),
    // а не сразу после "Применяете ли вы рецептурные кремы..."
    showAfterQuestionCode: 'avoid_ingredients',
    content: [
      { name: 'Увлажняющий крем', desc: 'Поддерживает барьер кожи', icon: '/products/moisturizer.jpg' },
      { name: 'Сыворотка с витамином C', desc: 'Осветляет и выравнивает тон', icon: '/products/vitamin_c.jpg' },
      { name: 'Солнцезащитный крем SPF 50', desc: 'Защищает от фотостарения', icon: '/products/spf.jpg' },
    ],
    ctaText: 'Продолжить',
  },
  
  // 25) Каждая привычка отражается на коже
  {
    id: 'habits_matter',
    title: 'Каждая привычка отражается на коже',
    subtitle: 'Давайте посмотрим, что влияет именно на вашу и как ей помочь',
    image: '/habits2.png',
    showAfterInfoScreenId: 'ai_showcase', // ИСПРАВЛЕНО: После экрана ai_showcase, а не вопроса
    ctaText: 'Продолжить',
  },
  // 26) Декоративная косметика - вопрос в БД (makeup_frequency)
  // 27) Солнцезащитный крем - вопрос в БД (spf_frequency)
  // 28) Время на солнце - вопрос в БД (sun_exposure)
  // 29) Привычки (multi_choice) - вопрос в БД (lifestyle_habits)
  
  // 30) Больше никакой путаницы
  {
    id: 'ai_comparison',
    title: 'Больше никакой путаницы — AI SkinIQ подберёт уход быстро и точно ✨',
    subtitle: 'Традиционный подбор ухода:\n❌ Долгие поиски советов в интернете\n❌ Сложно понять, что подойдёт именно вам\n\nSkinIQ с AI:\n✅ Точный подбор средств на основе анкеты\n✅ Рекомендации за пару секунд',
    type: 'comparison',
    showAfterQuestionCode: 'lifestyle_habits',
    ctaText: 'Продолжить',
  },
  
  // 31) Расскажите о ваших предпочтениях
  {
    id: 'preferences_intro',
    title: '✨ Расскажите о ваших предпочтениях в уходе',
    subtitle: 'Это поможет учесть ваши ожидания — какие текстуры, форматы и ощущения от ухода вам ближе',
    showAfterInfoScreenId: 'ai_comparison', // ИСПРАВЛЕНО: После экрана ai_comparison, а не вопроса
    ctaText: 'Продолжить',
  },
  // 32) Тип ухода - вопрос в БД (care_type)
  // 33) Количество шагов - вопрос в БД (care_steps)
  // 34) Бюджет - вопрос в БД (budget)
  
  // 35) Не нужно бояться ошибок
  {
    id: 'no_mistakes',
    title: 'Не нужно бояться ошибок — уход должен быть комфортным! ✨',
    subtitle: '❌ Слишком много средств сразу → ✅ Последовательный уход шаг за шагом\n❌ Ожидать моментальный результат → ✅ Смотреть на долгосрочные изменения\n❌ Копировать чужой уход → ✅ Подбор под особенности вашей кожи\n\nМы поможем выстроить уход, который работает именно для вас — без перегрузки кожи и лишнего стресса.',
    showAfterQuestionCode: 'budget',
    ctaText: 'Продолжить',
  },
  
  // 36) Давайте сосредоточимся на вашей мотивации
  {
    id: 'motivation_focus',
    title: '🎯 Давайте сосредоточимся на вашей мотивации',
    subtitle: 'Исследования показывают: когда вы держите цель перед глазами, это помогает сохранить мотивацию и добиться долгосрочных результатов.',
    showAfterInfoScreenId: 'no_mistakes', // ИСПРАВЛЕНО: После экрана no_mistakes, а не вопроса
    ctaText: 'Продолжить',
  },
  
  // 37) Вы узнаёте себя в этом? (Tinder-экран 1)
  {
    id: 'recognize_yourself_1',
    title: 'Вы узнаёте себя в этом?',
    subtitle: '«Я часто чувствую недовольство своей кожей, когда смотрю в зеркало»',
    image: '/illustrations/mirror_concern.jpg',
    type: 'tinder',
    showAfterInfoScreenId: 'motivation_focus', // ИСПРАВЛЕНО: После экрана motivation_focus, а не вопроса
    ctaText: '', // Кнопки будут отдельными (Нет/Да)
  },
  
  // 38) Вы узнаёте себя в этом? (Tinder-экран 2)
  {
    id: 'recognize_yourself_2',
    title: 'Вы узнаёте себя в этом?',
    subtitle: '«Я хочу заботиться о своей коже, но не знаю, какие средства выбрать»',
    image: '/illustrations/products_confusion.jpg',
    type: 'tinder',
    showAfterInfoScreenId: 'recognize_yourself_1', // ИСПРАВЛЕНО: После предыдущего инфо-экрана
    ctaText: '', // Кнопки будут отдельными (Нет/Да)
  },
  
  // 39) SkinIQ создан для людей, как вы!
  {
    id: 'created_for_you',
    title: 'SkinIQ создан для людей, как вы!',
    subtitle: '✨ 97% пользователей отмечают, что SkinIQ помогает лучше заботиться о коже\n🌿 92% заметили улучшения внешнего вида кожи\n⚡️ 85% увидели первые результаты уже в первый месяц\n\nОсновано на опросах и отзывах реальных пользователей',
    showAfterInfoScreenId: 'recognize_yourself_2', // ИСПРАВЛЕНО: После экрана recognize_yourself_2, а не вопроса
    ctaText: 'Продолжить',
  },
  
  // 40) Посмотрите, как меняется ваша кожа!
  {
    id: 'skin_transformation',
    title: 'Посмотрите, как меняется ваша кожа!',
    subtitle: 'Отслеживайте прогресс и улучшайте состояние кожи',
    image: '/illustrations/skin_transformation.jpg',
    type: 'transformation',
    showAfterInfoScreenId: 'created_for_you', // ИСПРАВЛЕНО: После экрана created_for_you, а не вопроса
    ctaText: 'Продолжить',
    content: {
      from: 'Сейчас',
      to: 'Ваша цель',
      indicator: 'Здоровье кожи',
    },
  },
  
  // 41) Хотите улучшить состояние кожи? (Tinder-экран)
  {
    id: 'want_improve',
    title: 'Хотите улучшить состояние кожи?',
    image: '/illustrations/improve_skin.jpg',
    type: 'tinder',
    showAfterInfoScreenId: 'skin_transformation', // ИСПРАВЛЕНО: После экрана skin_transformation, а не вопроса
    ctaText: '', // Кнопки будут отдельными (❌ Нет / ✅ Да)
  },
];

// Функция для получения информационного экрана, который нужно показать после вопроса с указанным кодом
export function getInfoScreenAfterQuestion(questionCode: string): InfoScreen | undefined {
  if (!questionCode) return undefined;
  const normalized = questionCode.toLowerCase();
  return INFO_SCREENS.find((screen) => screen.showAfterQuestionCode?.toLowerCase() === normalized);
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
