// app/(miniapp)/faq/page.tsx
// Страница часто задаваемых вопросов

'use client';

import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: 'Как работает SkinIQ?',
    answer: 'SkinIQ анализирует вашу кожу на основе ответов в анкете и создает персональный 28-дневный план ухода. Мы учитываем тип кожи, проблемы, чувствительность и другие факторы для подбора оптимальных средств.',
  },
  {
    question: 'Как часто нужно обновлять план?',
    answer: 'Рекомендуется перепроходить анкету раз в 3-6 месяцев или при значительных изменениях состояния кожи (сезонные изменения, новые проблемы, смена климата).',
  },
  {
    question: 'Можно ли использовать план во время беременности?',
    answer: 'Да, наш алгоритм учитывает беременность и кормление грудью. Все рекомендации безопасны и исключают средства с ретинолом и другими нежелательными компонентами.',
  },
  {
    question: 'Где купить рекомендованные средства?',
    answer: 'Все средства из вашего плана можно купить в аптеках, на маркетплейсах (Ozon, Wildberries) или в специализированных магазинах. В приложении есть прямые ссылки на покупку.',
  },
  {
    question: 'Что делать, если средство не подошло?',
    answer: 'Вы можете заменить любое средство из плана на альтернативное. Нажмите кнопку "Не подошло — заменить" рядом с продуктом, и мы предложим подходящие варианты.',
  },
  {
    question: 'Как отслеживать прогресс?',
    answer: 'В разделе "План" вы видите текущий день и прогресс выполнения. Отмечайте выполненные дни, чтобы видеть свой прогресс. Результаты обычно видны через 4-6 недель регулярного использования.',
  },
];

export default function FAQPage() {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      padding: '20px',
      paddingBottom: '120px',
    }}>
      <h1 style={{
        fontSize: '32px',
        fontWeight: 'bold',
        color: '#0A5F59',
        marginBottom: '8px',
      }}>
        Часто задаваемые вопросы
      </h1>
      <p style={{ fontSize: '16px', color: '#475467', marginBottom: '24px' }}>
        Ответы на популярные вопросы о SkinIQ
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {faqItems.map((item, index) => (
          <div
            key={index}
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(10, 95, 89, 0.1)',
            }}
          >
            <button
              onClick={() => toggleItem(index)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left',
              }}
            >
              <h3 style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#0A5F59',
                margin: 0,
                flex: 1,
              }}>
                {item.question}
              </h3>
              <span style={{
                fontSize: '24px',
                color: '#0A5F59',
                marginLeft: '16px',
                transition: 'transform 0.2s',
                transform: expandedItems.has(index) ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>
                ▼
              </span>
            </button>
            {expandedItems.has(index) && (
              <p style={{
                marginTop: '16px',
                fontSize: '16px',
                color: '#475467',
                lineHeight: '1.6',
                paddingTop: '16px',
                borderTop: '1px solid #E5E7EB',
              }}>
                {item.answer}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

