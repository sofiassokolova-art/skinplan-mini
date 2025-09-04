import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PlanData {
  profile: {
    skinType?: string;
    goals: string[];
    sensitivity?: boolean | null;
    notes: string[];
  };
  products: Record<string, string>;
  days: Array<{
    morning: string[];
    evening: string[];
  }>;
}

export async function generatePlanPDF(planData: PlanData): Promise<void> {
  try {
    // Создаем PDF документ
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    // Настройка шрифтов
    pdf.setFont('helvetica', 'normal');
    
    // Заголовок
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('SkinPlan — Персональный план ухода', margin, yPosition);
    yPosition += 15;

    // Дата создания
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const date = new Date().toLocaleDateString('ru-RU');
    pdf.text(`Создан: ${date}`, margin, yPosition);
    yPosition += 10;

    // Профиль кожи
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Профиль кожи', margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    if (planData.profile.skinType) {
      pdf.text(`Тип кожи: ${planData.profile.skinType}`, margin, yPosition);
      yPosition += 6;
    }
    
    if (planData.profile.goals.length > 0) {
      pdf.text(`Цели: ${planData.profile.goals.join(', ')}`, margin, yPosition);
      yPosition += 6;
    }

    if (planData.profile.sensitivity) {
      pdf.text('Чувствительная кожа — частота активов снижена', margin, yPosition);
      yPosition += 6;
    }

    // Заметки
    if (planData.profile.notes.length > 0) {
      yPosition += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Важные заметки:', margin, yPosition);
      yPosition += 6;
      
      pdf.setFont('helvetica', 'normal');
      planData.profile.notes.forEach(note => {
        const lines = pdf.splitTextToSize(`• ${note}`, pageWidth - 2 * margin);
        lines.forEach((line: string) => {
          if (yPosition > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.text(line, margin, yPosition);
          yPosition += 5;
        });
      });
    }

    yPosition += 10;

    // Подобранные продукты
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Подобранные продукты', margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    const productLabels = {
      cleanser: 'Очищение',
      moisturizer: 'Крем',
      spf: 'SPF',
      barrier: 'Барьер',
      activeA: 'Актив A (утро)',
      activeB: 'Актив B (вечер)'
    };

    Object.entries(planData.products).forEach(([key, value]) => {
      const label = productLabels[key as keyof typeof productLabels] || key;
      pdf.text(`${label}: ${value}`, margin, yPosition);
      yPosition += 6;
    });

    yPosition += 10;

    // Расписание на 28 дней
    if (yPosition > pageHeight - 100) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Расписание на 28 дней', margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');

    // Группируем дни по неделям
    for (let week = 0; week < 4; week++) {
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.text(`Неделя ${week + 1}`, margin, yPosition);
      yPosition += 6;

      pdf.setFont('helvetica', 'normal');
      
      for (let day = 0; day < 7; day++) {
        const dayIndex = week * 7 + day;
        if (dayIndex >= planData.days.length) break;

        const dayData = planData.days[dayIndex];
        
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = margin;
        }

        pdf.text(`День ${dayIndex + 1}:`, margin, yPosition);
        yPosition += 4;
        
        pdf.text(`  Утро: ${dayData.morning.join(' → ')}`, margin, yPosition);
        yPosition += 4;
        
        pdf.text(`  Вечер: ${dayData.evening.join(' → ')}`, margin, yPosition);
        yPosition += 6;
      }
      yPosition += 4;
    }

    // Инструкции
    if (yPosition > pageHeight - 80) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Как читать план', margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    const instructions = [
      'Вводи новые активы «через день». Если нет дискомфорта — увеличивай до через день/ежедневно.',
      'Патч-тест: нанеси немного на участок за ухом 24 ч.',
      'SPF ежедневно, даже зимой.',
      'При реакции — неделя барьерного ухода и откат частоты.'
    ];

    instructions.forEach((instruction, index) => {
      const lines = pdf.splitTextToSize(`${index + 1}. ${instruction}`, pageWidth - 2 * margin);
      lines.forEach((line: string) => {
        if (yPosition > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      });
      yPosition += 2;
    });

    // Футер
    const footerY = pageHeight - 10;
    pdf.setFontSize(8);
    pdf.setTextColor(128);
    pdf.text('SkinPlan — Персонализированный уход за кожей', margin, footerY);
    pdf.text(`Создано: ${date}`, pageWidth - margin - 40, footerY);

    // Сохраняем PDF
    const fileName = `skinplan-${date.replace(/\./g, '-')}.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error('Ошибка генерации PDF:', error);
    // Fallback к стандартной печати
    window.print();
  }
}

// Альтернативный метод через html2canvas (для более точного отображения стилей)
export async function generatePlanPDFFromHTML(elementId: string): Promise<void> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error('Элемент для PDF не найден');
    }

    // Временно показываем элемент для рендеринга
    const originalDisplay = element.style.display;
    element.style.display = 'block';

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight
    });

    // Возвращаем исходный стиль
    element.style.display = originalDisplay;

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    const imgWidth = pageWidth - 20; // отступы по 10мм с каждой стороны
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 10;

    // Добавляем первую страницу
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - 20;

    // Добавляем дополнительные страницы если нужно
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 20;
    }

    const date = new Date().toLocaleDateString('ru-RU');
    const fileName = `skinplan-${date.replace(/\./g, '-')}.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error('Ошибка генерации PDF из HTML:', error);
    // Fallback к стандартной печати
    window.print();
  }
}