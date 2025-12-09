// Скрипт для очистки localStorage и sessionStorage
// Запустите этот скрипт в консоли браузера (F12)

console.log('🧹 Начинаю очистку localStorage и sessionStorage...');

// Очистка localStorage
try {
  const localStorageKeys = [
    'is_retaking_quiz',
    'full_retake_from_home',
    'quiz_progress',
    'profile_check_cache',
    'profile_check_cache_timestamp',
  ];
  
  let removedFromLocalStorage = 0;
  localStorageKeys.forEach(key => {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      removedFromLocalStorage++;
      console.log(`✅ Удалено из localStorage: ${key}`);
    }
  });
  
  console.log(`📊 Удалено ${removedFromLocalStorage} ключей из localStorage`);
} catch (error) {
  console.error('❌ Ошибка при очистке localStorage:', error);
}

// Очистка sessionStorage
try {
  const sessionStorageKeys = [
    'quiz_just_submitted',
    'profile_check_cache',
    'profile_check_cache_timestamp',
  ];
  
  let removedFromSessionStorage = 0;
  sessionStorageKeys.forEach(key => {
    if (sessionStorage.getItem(key) !== null) {
      sessionStorage.removeItem(key);
      removedFromSessionStorage++;
      console.log(`✅ Удалено из sessionStorage: ${key}`);
    }
  });
  
  console.log(`📊 Удалено ${removedFromSessionStorage} ключей из sessionStorage`);
} catch (error) {
  console.error('❌ Ошибка при очистке sessionStorage:', error);
}

// Показываем оставшиеся ключи (для проверки)
console.log('\n📋 Оставшиеся ключи в localStorage:');
console.log(Object.keys(localStorage));

console.log('\n📋 Оставшиеся ключи в sessionStorage:');
console.log(Object.keys(sessionStorage));

console.log('\n✅ Очистка завершена! Обновите страницу для применения изменений.');
