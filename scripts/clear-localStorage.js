// Скрипт для полной очистки localStorage и sessionStorage (как новый пользователь).
// Вариант 1: Открой в браузере http://localhost:3001/dev/clear — очистит всё и сделает редирект.
// Вариант 2: Вставь этот код в консоль (F12) на странице приложения.

console.log('🧹 Очистка хранилища (как новый пользователь)...');

const QUIZ_KEYS = [
  'quiz_progress',
  'quiz_just_submitted',
  'quiz_retake',
  'quiz_full_retake_from_home',
  'quiz_progress_cleared',
  'quiz_initCalled',
  'quiz_completed',
  'quiz_currentInfoScreenIndex',
  'quiz_currentQuestionIndex',
  'quiz_currentQuestionCode',
  'quiz_answers_backup',
  'default:quiz_progress_cleared',
  'user_preferences_cache',
  'profile_check_cache',
  'profile_check_cache_timestamp',
  'is_retaking_quiz',
  'full_retake_from_home',
  'currentInfoScreenIndex',
];

function clearAll() {
  let removed = 0;

  QUIZ_KEYS.forEach((key) => {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      removed++;
      console.log('localStorage:', key);
    }
    if (sessionStorage.getItem(key) !== null) {
      sessionStorage.removeItem(key);
      removed++;
      console.log('sessionStorage:', key);
    }
  });

  [...Object.keys(sessionStorage)].forEach((key) => {
    if (
      key.includes('quiz') ||
      key.includes('Quiz') ||
      key.includes('currentQuestion') ||
      key.includes('currentInfoScreen') ||
      key.includes('questionnaire') ||
      key.includes('profile_check') ||
      key.includes('user_preferences')
    ) {
      sessionStorage.removeItem(key);
      removed++;
      console.log('sessionStorage (pattern):', key);
    }
  });

  [...Object.keys(localStorage)].forEach((key) => {
    if (
      key.includes('quiz') ||
      key.includes('Quiz') ||
      key.includes('questionnaire') ||
      key.includes('profile_check') ||
      key === 'user_preferences_cache'
    ) {
      localStorage.removeItem(key);
      removed++;
      console.log('localStorage (pattern):', key);
    }
  });

  return removed;
}

try {
  const n = clearAll();
  console.log('✅ Удалено ключей:', n);
  console.log('Обнови страницу (F5) или открой /dev/clear для сброса прогресса на сервере.');
} catch (e) {
  console.error('Ошибка:', e);
}
