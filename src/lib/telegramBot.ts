const BOT_TOKEN = "8138388674:AAHt8HqnPS3LRwo7l_g_q1Bw05c9vTqsfEw";
const BOT_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface PlanData {
  userName: string;
  skinType: string;
  sensitivity: boolean;
  oiliness: string;
  primaryGoal: string;
  concerns: string[];
  morningSteps: Array<{ name: string; step: string }>;
  eveningSteps: Array<{ name: string; step: string }>;
  schedule?: Array<{ day: number; morningNotes: string[]; eveningNotes: string[] }>;
}

// Получить chat_id пользователя из Telegram WebApp
function getTelegramChatId(): string | null {
  if (typeof window !== 'undefined') {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user?.id) {
      return tg.initDataUnsafe.user.id.toString();
    }
  }
  return null;
}

// Генерировать HTML для PDF
function generatePlanHTML(data: PlanData): string {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SkinIQ - План ухода</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 20px; 
      line-height: 1.6; 
      color: #333;
    }
    .header { 
      text-align: center; 
      margin-bottom: 30px; 
      border-bottom: 2px solid #f0f0f0; 
      padding-bottom: 20px;
    }
    .header h1 { 
      color: #2563eb; 
      margin-bottom: 5px; 
    }
    .section { 
      margin-bottom: 25px; 
      padding: 15px; 
      border: 1px solid #e5e7eb; 
      border-radius: 8px;
      background: #fafafa;
    }
    .section h2 { 
      color: #1f2937; 
      margin-bottom: 10px; 
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 5px;
    }
    .metrics { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 10px; 
      margin-bottom: 15px;
    }
    .metric { 
      padding: 10px; 
      background: white; 
      border-radius: 6px; 
      border: 1px solid #e5e7eb;
    }
    .metric-label { 
      font-size: 12px; 
      color: #6b7280; 
      text-transform: uppercase; 
      letter-spacing: 0.5px;
    }
    .metric-value { 
      font-size: 16px; 
      font-weight: bold; 
      color: #1f2937;
    }
    ol, ul { 
      padding-left: 20px; 
    }
    li { 
      margin-bottom: 5px; 
    }
    .footer { 
      text-align: center; 
      margin-top: 30px; 
      padding-top: 20px; 
      border-top: 1px solid #e5e7eb; 
      font-size: 14px; 
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>SkinIQ — Персональный план ухода</h1>
    <p><strong>Пользователь:</strong> ${data.userName}</p>
    <p><strong>Дата создания:</strong> ${new Date().toLocaleDateString('ru-RU')}</p>
  </div>
  
  <div class="section">
    <h2>Характеристики кожи</h2>
    <div class="metrics">
      <div class="metric">
        <div class="metric-label">Тип кожи</div>
        <div class="metric-value">${data.skinType}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Чувствительность</div>
        <div class="metric-value">${data.sensitivity ? 'Да' : 'Нет'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Жирность</div>
        <div class="metric-value">${data.oiliness}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Главная цель</div>
        <div class="metric-value">${data.primaryGoal}</div>
      </div>
    </div>
    ${data.concerns.length > 0 ? `<p><strong>Проблемы:</strong> ${data.concerns.join(', ')}</p>` : ''}
  </div>
  
  <div class="section">
    <h2>🌅 Утренний уход</h2>
    <ol>
      ${data.morningSteps.map(step => `<li><strong>${step.name}</strong> <small>(${step.step})</small></li>`).join('')}
    </ol>
  </div>
  
  <div class="section">
    <h2>🌙 Вечерний уход</h2>
    <ol>
      ${data.eveningSteps.map(step => `<li><strong>${step.name}</strong> <small>(${step.step})</small></li>`).join('')}
    </ol>
  </div>
  
  ${data.schedule ? `
  <div class="section">
    <h2>📅 Расписание на 28 дней</h2>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 10px;">
      ${data.schedule.slice(0, 7).map(day => `
        <div class="metric">
          <div class="metric-label">День ${day.day}</div>
          <div style="font-size: 12px; margin-top: 5px;">
            <strong>Утро:</strong> ${day.morningNotes.join('; ')}<br>
            <strong>Вечер:</strong> ${day.eveningNotes.join('; ')}
          </div>
        </div>
      `).join('')}
    </div>
    <p style="margin-top: 15px; font-size: 14px; color: #6b7280;">
      <em>Показаны первые 7 дней. Полное расписание доступно в приложении.</em>
    </p>
  </div>
  ` : ''}
  
  <div class="footer">
    <p>Создано в SkinIQ — персональный уход за кожей</p>
    <p>Следуйте рекомендациям и отслеживайте результаты</p>
  </div>
</body>
</html>`;
}

// Конвертировать HTML в PDF blob (упрощённая версия)
function htmlToPDFBlob(html: string): Blob {
  // В реальном приложении здесь был бы jsPDF или Puppeteer
  // Для демо отправляем HTML как текстовый документ
  return new Blob([html], { type: 'text/html; charset=utf-8' });
}

// Отправить план как документ в Telegram
export async function sendPlanToTelegram(planData: PlanData): Promise<{ success: boolean; error?: string }> {
  try {
    const chatId = getTelegramChatId();
    
    if (!chatId) {
      // Fallback для браузерного режима
      const textPlan = `SkinIQ — План ухода
Пользователь: ${planData.userName}
Дата: ${new Date().toLocaleDateString('ru-RU')}

ХАРАКТЕРИСТИКИ:
• Тип кожи: ${planData.skinType}
• Чувствительность: ${planData.sensitivity ? 'да' : 'нет'}
• Жирность: ${planData.oiliness}
• Цель: ${planData.primaryGoal}

УТРЕННИЙ УХОД:
${planData.morningSteps.map((step, i) => `${i + 1}. ${step.name}`).join('\n')}

ВЕЧЕРНИЙ УХОД:
${planData.eveningSteps.map((step, i) => `${i + 1}. ${step.name}`).join('\n')}`;

      await navigator.clipboard?.writeText(textPlan);
      return { success: true };
    }

    // Генерируем HTML-документ
    const htmlContent = generatePlanHTML(planData);
    const pdfBlob = htmlToPDFBlob(htmlContent);
    
    // Создаём FormData для отправки файла
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', pdfBlob, `skiniq-plan-${planData.userName}-${Date.now()}.html`);
    formData.append('caption', `📋 Персональный план ухода для ${planData.userName}\n\nСоздан в SkinIQ на основе анализа кожи`);

    // Отправляем через Bot API
    const response = await fetch(`${BOT_API_URL}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    if (result.ok) {
      return { success: true };
    } else {
      console.error('Telegram API error:', result);
      return { success: false, error: result.description || 'Ошибка отправки' };
    }

  } catch (error) {
    console.error('Send to Telegram error:', error);
    return { success: false, error: 'Ошибка подключения к Telegram' };
  }
}

// Получить информацию о боте (для тестирования)
export async function getBotInfo() {
  try {
    const response = await fetch(`${BOT_API_URL}/getMe`);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Bot info error:', error);
    return null;
  }
}