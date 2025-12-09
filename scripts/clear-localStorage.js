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

// ИСПРАВЛЕНО: Безопасное получение оставшихся ключей с обработкой ошибок
// Используем setTimeout для неблокирующего выполнения
setTimeout(() => {
  try {
    console.log('\n📋 Оставшиеся ключи в localStorage:');
    try {
      const keys = Object.keys(localStorage);
      // Ограничиваем вывод для предотвращения блокировки консоли
      if (keys.length > 50) {
        console.log(keys.slice(0, 50));
        console.log(`... и еще ${keys.length - 50} ключей`);
      } else {
        console.log(keys);
      }
    } catch (e) {
      console.warn('Ошибка при получении ключей localStorage:', e);
    }

    console.log('\n📋 Оставшиеся ключи в sessionStorage:');
    try {
      const keys = Object.keys(sessionStorage);
      if (keys.length > 50) {
        console.log(keys.slice(0, 50));
        console.log(`... и еще ${keys.length - 50} ключей`);
      } else {
        console.log(keys);
      }
    } catch (e) {
      console.warn('Ошибка при получении ключей sessionStorage:', e);
    }

    console.log('\n✅ Очистка завершена! Обновите страницу для применения изменений.');
  } catch (error) {
    console.error('Ошибка при выводе оставшихся ключей:', error);
    console.log('\n✅ Очистка завершена! Обновите страницу для применения изменений.');
  }
}, 0);
