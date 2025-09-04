import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

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


// Функция транслитерации для PDF
function transliterate(text: string): string {
  const map: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'j', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E', 'Ж': 'Zh',
    'З': 'Z', 'И': 'I', 'Й': 'J', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
    'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'C',
    'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  };
  
  return text.replace(/[а-яё]/gi, (char) => map[char] || char);
}

// Генерировать красивый HTML для PDF
function createPDFHTML(data: PlanData): string {
  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          margin: 0;
          padding: 20px;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          color: #1f2937;
          line-height: 1.6;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding: 20px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          border-radius: 15px;
          box-shadow: 0 10px 25px rgba(99, 102, 241, 0.2);
        }
        .title { font-size: 28px; font-weight: bold; margin-bottom: 5px; }
        .subtitle { font-size: 14px; opacity: 0.9; }
        .section {
          background: white;
          padding: 20px;
          margin-bottom: 20px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
          border: 1px solid #e5e7eb;
        }
        .section-title {
          font-size: 18px;
          font-weight: bold;
          color: #374151;
          margin-bottom: 15px;
          padding-bottom: 8px;
          border-bottom: 2px solid #e5e7eb;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 15px;
        }
        .info-item {
          padding: 10px;
          background: #f9fafb;
          border-radius: 8px;
          border-left: 4px solid #6366f1;
        }
        .info-label { font-weight: 600; color: #6b7280; font-size: 12px; }
        .info-value { color: #111827; font-size: 14px; }
        .routine-list { list-style: none; padding: 0; }
        .routine-item {
          padding: 12px;
          margin-bottom: 8px;
          background: #f8fafc;
          border-radius: 8px;
          border-left: 4px solid #10b981;
          display: flex;
          align-items: center;
        }
        .routine-number {
          background: #6366f1;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          margin-right: 12px;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding: 15px;
          background: #f3f4f6;
          border-radius: 8px;
          font-size: 12px;
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">SkinIQ - Персональный план ухода</div>
        <div class="subtitle">Создано: ${new Date().toLocaleDateString('ru-RU')}</div>
      </div>

      <div class="section">
        <div class="section-title">👤 Профиль пользователя</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Имя</div>
            <div class="info-value">${data.userName}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Тип кожи</div>
            <div class="info-value">${data.skinType}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Чувствительность</div>
            <div class="info-value">${data.sensitivity ? 'Да' : 'Нет'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Главная цель</div>
            <div class="info-value">${data.primaryGoal}</div>
          </div>
        </div>
        ${data.concerns.length > 0 ? `
          <div class="info-item">
            <div class="info-label">Проблемы</div>
            <div class="info-value">${data.concerns.join(', ')}</div>
          </div>
        ` : ''}
      </div>

      <div class="section">
        <div class="section-title">🌅 Утренний уход</div>
        <ul class="routine-list">
          ${data.morningSteps.map((step, index) => `
            <li class="routine-item">
              <div class="routine-number">${index + 1}</div>
              <div>
                <div style="font-weight: 600;">${step.name}</div>
                <div style="font-size: 12px; color: #6b7280;">${step.step}</div>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>

      <div class="section">
        <div class="section-title">🌙 Вечерний уход</div>
        <ul class="routine-list">
          ${data.eveningSteps.map((step, index) => `
            <li class="routine-item">
              <div class="routine-number">${index + 1}</div>
              <div>
                <div style="font-weight: 600;">${step.name}</div>
                <div style="font-size: 12px; color: #6b7280;">${step.step}</div>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>

      <div class="footer">
        Создано в SkinIQ - персональный уход за кожей
      </div>
    </body>
    </html>
  `;
}

// Генерировать красивый PDF из HTML
async function generateBeautifulPDF(data: PlanData): Promise<Blob> {
  try {
    // Создаем временный HTML элемент
    const htmlContent = createPDFHTML(data);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = '800px';
    document.body.appendChild(tempDiv);

    // Генерируем PDF из HTML
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 800,
      height: tempDiv.scrollHeight
    });

    // Удаляем временный элемент
    document.body.removeChild(tempDiv);

    // Создаем PDF
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
    
    return pdf.output('blob');
  } catch (error) {
    console.error('Ошибка создания красивого PDF:', error);
    // Fallback на старый способ
    return generatePDFBlob(data);
  }
}

// Старая функция как fallback
function generatePDFBlob(data: PlanData): Blob {
  const doc = new jsPDF();
  
  // Настройка шрифта для лучшей читаемости
  doc.setFont('helvetica', 'normal');
  
  let yPos = 20;
  const lineHeight = 7;
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Заголовок
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SkinIQ - Personalnyj plan uhoda', pageWidth / 2, yPos, { align: 'center' });
  yPos += lineHeight * 2;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Polzovatel: ${transliterate(data.userName)}`, 20, yPos);
  yPos += lineHeight;
  doc.text(`Data: ${new Date().toLocaleDateString('ru-RU')}`, 20, yPos);
  yPos += lineHeight * 2;
  
  // Характеристики кожи
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Harakteristiki kozhi:', 20, yPos);
  yPos += lineHeight * 1.5;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tip kozhi: ${transliterate(data.skinType)}`, 25, yPos);
  yPos += lineHeight;
  doc.text(`Chuvstvitelnost: ${data.sensitivity ? 'da' : 'net'}`, 25, yPos);
  yPos += lineHeight;
  doc.text(`Zhirnost: ${transliterate(data.oiliness)}`, 25, yPos);
  yPos += lineHeight;
  doc.text(`Cel: ${transliterate(data.primaryGoal)}`, 25, yPos);
  yPos += lineHeight * 1.5;
  
  if (data.concerns.length > 0) {
    doc.text(`Problemy: ${data.concerns.map(transliterate).join(', ')}`, 25, yPos);
    yPos += lineHeight * 2;
  }
  
  // Утренний уход
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Utrennij uhod:', 20, yPos);
  yPos += lineHeight * 1.5;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  data.morningSteps.forEach((step, index) => {
    doc.text(`${index + 1}. ${transliterate(step.name)}`, 25, yPos);
    yPos += lineHeight;
    if (yPos > 250) { // Новая страница если нужно
      doc.addPage();
      yPos = 20;
    }
  });
  yPos += lineHeight;
  
  // Вечерний уход
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Vechernij uhod:', 20, yPos);
  yPos += lineHeight * 1.5;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  data.eveningSteps.forEach((step, index) => {
    doc.text(`${index + 1}. ${transliterate(step.name)}`, 25, yPos);
    yPos += lineHeight;
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
  });
  
  // Футер
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Sozdano v SkinIQ - personal\'nyj uhod za kozhej', pageWidth / 2, 280, { align: 'center' });
  
  return doc.output('blob');
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

    // Генерируем красивый PDF-документ на русском языке
    const pdfBlob = await generateBeautifulPDF(planData);
    
    // Создаём FormData для отправки файла
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', pdfBlob, `skiniq-plan-${planData.userName}-${Date.now()}.pdf`);
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