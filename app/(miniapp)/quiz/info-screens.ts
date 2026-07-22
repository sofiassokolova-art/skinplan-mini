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
  // 1) Подбери уход для своей кожи со skiniq - начальный экран
  {
    id: 'welcome',
    title: 'Подбери уход для своей кожи со skiniq',
    image: '/onboarding/welcome.jpg',
    ctaText: 'Продолжить',
  },
  
  // 2) Как это работает?
  {
    id: 'how_it_works',
    title: 'Как это работает?',
    subtitle: '1. Ответьте на вопросы о коже\n2. Получите персональный план ухода\n3. Увидьте изменения кожи через 28 дней\n4. Доступ к плану — 199 ₽',
    ctaText: 'Продолжить',
  },
  
  // personal_analysis УДАЛЁН: третий подряд вводный экран до первого вопроса.
  // По смыслу дублировал how_it_works («что вы получите»), а соц-пруф теперь
  // несут отзывы реальных людей на экране testimonials. Заодно ушло
  // непроверяемое «92% пользователей отмечают улучшение».

  // goals_intro УДАЛЁН: филлер «Расскажите о вашей цели» перед самим вопросом
  // про цели не несёт пользы. После how_it_works сразу идёт вопрос skin_goals.


  // 5) Вопрос: Какие ваши основные цели для кожи? (multi_choice, без ограничений)
  // Этот экран будет вопросом в БД
  
  // 6) Отзывы с горизонтальным скроллом
  {
    id: 'testimonials',
    title: 'Что говорят пользователи skiniq',
    subtitle: 'Персональный уход\nпод ваши цели и особенности',
    type: 'testimonials',
    showAfterQuestionCode: 'skin_goals', // После вопроса о целях
    // Возвращены все 4 отзыва (ранее были сокращены до 2). Тексты и авторы —
    // оригинальные, восстановлены дословно из истории; выдумывать отзывы нельзя.
    // Картинки «до/после» — существующие пары отзыв1-4 в public/.
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

  // simple_care УДАЛЁН: буквальный дубликат ai_comparison — тот же формат
  // «традиционный уход vs со skiniq» и дословно совпадающий пункт
  // «Часы поиска советов в интернете». Оставлен ai_comparison как более поздний
  // и оформленный отдельным компонентом.
  
  // health_data УДАЛЁН: был progress-step без UI, давал белую вспышку.
  // Гарантия приватности теперь нативно отображается в самой анкете (см. health-related вопросы).
  // Лейбл «Шаг 3: Данные о здоровье» сохранён в QUESTION_STEP_MAP.
  // 15) Есть ли у вас диагнозы? - вопрос в БД (medical_diagnoses)
  // 16) Беременность/кормление (только для женщин) - вопрос в БД (pregnancy_breastfeeding)
  // 17) Аллергические реакции - вопрос в БД (allergies)
  // 18) Исключить ингредиенты (можно пропустить) - вопрос в БД (avoid_ingredients)
  
  // health_trust УДАЛЁН как отдельный экран: его работа — снять тревогу про
  // медицинские данные — теперь выполняется информером прямо в первом вопросе
  // блока (medical_diagnoses, см. QUESTION_INFORMERS в QuizQuestion.tsx).
  // Так сообщение стоит ДО того, как у человека спрашивают про диагнозы,
  // а не после блока, как было раньше (анкор был на has_avoid_ingredients).

  // current_care_intro УДАЛЁН: интро к блоку «Текущий уход», лишний экран.
  // 21) Ретинол - вопрос в БД (retinoid_usage)
  // 22) Рецептурные кремы - вопрос в БД (prescription_topical)
  // 23) Пероральные препараты - вопрос в БД (oral_medications)

  // ai_showcase УДАЛЁН: дубликат продажи AI (есть уже в ai_comparison).
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
    title: 'AI skiniq подбирает уход по вашим ответам',
    content: {
      traditionalItems: [
        'Часы поиска советов в интернете',
        'Деньги на средства, которые не подошли',
        'Непонятно, с чего начать',
      ],
      skiniqItems: [
        'План под вашу кожу и цели',
        'Готово сразу после анкеты',
        'Учитываем цели и бюджет',
      ],
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
    title: 'Ваш skiniq-план почти готов',
    showAfterQuestionCode: 'budget',
    ctaText: 'Завершить анализ',
  },
  
  // motivation_focus УДАЛЁН: чистый мотивационный текст без информационной ценности.

  // recognize_yourself_1/2 УДАЛЕНЫ: tinder-экраны «Вы узнаёте себя в этом?» (свайп
  // Нет/Да) убраны целиком — приём «это про вас» уже несёт экран ai_comparison
  // («Зеркало»). Оставлен только финальный want_improve перед генерацией плана,
  // перецеплен напрямую на no_mistakes.

  // created_for_you УДАЛЁН: повтор соц-прува (есть уже на экране testimonials).

  // ФИКС #5: skin_transformation объединён с want_improve в один финальный экран.
  // Старая запись skin_transformation удалена. Сейчас want_improve рендерится
  // компонентом ImproveSkinScreen, который совмещает transformation-визуал ("Посмотрите,
  // как меняется ваша кожа") и CTA "Получить план ухода". После него начинается генерация.
  {
    id: 'want_improve',
    title: 'Хотите улучшить состояние кожи?',
    subtitle: 'Первые изменения обычно заметны через 28 дней регулярного ухода. Отслеживайте прогресс и подкручивайте план под себя.',
    type: 'tinder',
    showAfterInfoScreenId: 'no_mistakes', // recognize_yourself_1 удалён — цепляемся на no_mistakes
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
