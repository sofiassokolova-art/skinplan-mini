// scripts/set-payment-console.js
// Скрипт для установки статуса оплаты через консоль браузера
// Выполните этот код в консоли браузера (F12) в Mini App

(function() {
  console.log('🔓 Установка статуса оплаты...');
  
  // Устанавливаем оба флага оплаты
  localStorage.setItem('payment_first_completed', 'true');
  localStorage.setItem('payment_retaking_completed', 'true');
  
  console.log('✅ Статус оплаты установлен!');
  console.log('📋 Текущие значения:');
  console.log('   payment_first_completed:', localStorage.getItem('payment_first_completed'));
  console.log('   payment_retaking_completed:', localStorage.getItem('payment_retaking_completed'));
  
  console.log('\n🔄 Теперь обновите страницу (F5 или Cmd+R)');
  console.log('📱 План должен отобразиться без блюра');
  
  return {
    success: true,
    payment_first_completed: localStorage.getItem('payment_first_completed'),
    payment_retaking_completed: localStorage.getItem('payment_retaking_completed')
  };
})();
