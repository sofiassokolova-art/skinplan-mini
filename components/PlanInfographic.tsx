// components/PlanInfographic.tsx
// Инфографика для плана: что нужно коже, как работаем, за счет каких средств

'use client';

import type { Plan28 } from '@/lib/plan-types';

interface PlanInfographicProps {
  plan28: Plan28;
  products: Map<number, {
    id: number;
    name: string;
    brand: { name: string };
    price?: number;
    imageUrl?: string | null;
    description?: string;
  }>;
}

export function PlanInfographic({ plan28, products }: PlanInfographicProps) {
  // Собираем уникальные категории продуктов из плана
  const productCategories = new Set<string>();
  const uniqueProducts = new Set<number>();
  
  plan28.days.forEach(day => {
    [...day.morning, ...day.evening, ...day.weekly].forEach(step => {
      if (step.productId) {
        uniqueProducts.add(Number(step.productId));
        const product = products.get(Number(step.productId));
        if (product) {
          // Определяем категорию по описанию или названию
          const name = product.name.toLowerCase();
          if (name.includes('очищ') || name.includes('cleanser')) productCategories.add('Очищение');
          if (name.includes('тоник') || name.includes('toner')) productCategories.add('Тонизирование');
          if (name.includes('сыворотк') || name.includes('serum')) productCategories.add('Сыворотки');
          if (name.includes('увлажн') || name.includes('moisturizer') || name.includes('крем')) productCategories.add('Увлажнение');
          if (name.includes('spf') || name.includes('защит') || name.includes('солнце')) productCategories.add('Защита от солнца');
          if (name.includes('маск') || name.includes('mask')) productCategories.add('Маски');
          if (name.includes('пилинг') || name.includes('peel')) productCategories.add('Пилинги');
        }
      }
    });
  });

  const goalLabels: Record<string, string> = {
    acne: 'Акне и высыпания',
    pores: 'Сокращение пор',
    pigmentation: 'Выравнивание пигментации',
    barrier: 'Укрепление барьера',
    dehydration: 'Увлажнение',
    wrinkles: 'Морщины',
    antiage: 'Антиэйдж',
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      marginBottom: '32px',
    }}>
      {/* Как мы будем работать */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(10, 95, 89, 0.1)',
      }}>
        <h2 style={{
          fontSize: '22px',
          fontWeight: 'bold',
          color: '#0A5F59',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{ fontSize: '28px' }}>🔬</span>
          Как мы будем работать
        </h2>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{
            padding: '16px',
            backgroundColor: '#FEF3C7',
            borderRadius: '12px',
            border: '1px solid #FCD34D',
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#92400E',
              marginBottom: '8px',
            }}>
              Фаза 1: Адаптация (дни 1-7)
            </div>
            <div style={{
              fontSize: '14px',
              color: '#78350F',
              lineHeight: '1.6',
            }}>
              Мягкое внедрение ухода. Постепенно знакомим кожу с новыми средствами, минимизируя раздражение.
            </div>
          </div>
          <div style={{
            padding: '16px',
            backgroundColor: '#DBEAFE',
            borderRadius: '12px',
            border: '1px solid #60A5FA',
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1E40AF',
              marginBottom: '8px',
            }}>
              Фаза 2: Активная работа (дни 8-21)
            </div>
            <div style={{
              fontSize: '14px',
              color: '#1E3A8A',
              lineHeight: '1.6',
            }}>
              Подключаем активные ингредиенты для решения ваших задач. Интенсивная работа над улучшением состояния кожи.
            </div>
          </div>
          <div style={{
            padding: '16px',
            backgroundColor: '#D1FAE5',
            borderRadius: '12px',
            border: '1px solid #34D399',
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#065F46',
              marginBottom: '8px',
            }}>
              Фаза 3: Поддержка (дни 22-28)
            </div>
            <div style={{
              fontSize: '14px',
              color: '#064E3B',
              lineHeight: '1.6',
            }}>
              Закрепляем достигнутые результаты и поддерживаем здоровье барьера кожи.
            </div>
          </div>
        </div>
      </div>

      {/* За счет каких средств */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(10, 95, 89, 0.1)',
      }}>
        <h2 style={{
          fontSize: '22px',
          fontWeight: 'bold',
          color: '#0A5F59',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{ fontSize: '28px' }}>💧</span>
          За счет каких средств мы достигнем цели
        </h2>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          {Array.from(productCategories).map((category) => (
            <div
              key={category}
              style={{
                padding: '16px',
                backgroundColor: '#F5FFFC',
                borderRadius: '12px',
                border: '1px solid rgba(10, 95, 89, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#0A5F59',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '20px',
                fontWeight: 'bold',
                flexShrink: 0,
              }}>
                ✓
              </div>
              <div style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#0A5F59',
              }}>
                {category}
              </div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: '16px',
          padding: '16px',
          backgroundColor: '#E8FBF7',
          borderRadius: '12px',
          border: '1px dashed #0A5F59',
        }}>
          <div style={{
            fontSize: '14px',
            color: '#065F46',
            lineHeight: '1.6',
            fontStyle: 'italic',
          }}>
            💡 Все средства подобраны индивидуально на основе вашего типа кожи и целей. 
            Каждый продукт работает в синергии с другими для максимальной эффективности.
          </div>
        </div>
      </div>
    </div>
  );
}

