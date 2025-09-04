import { jsPDF } from 'jspdf';

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

// Генерировать настоящий PDF с помощью jsPDF
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

    // Генерируем настоящий PDF-документ
    const pdfBlob = generatePDFBlob(planData);
    
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