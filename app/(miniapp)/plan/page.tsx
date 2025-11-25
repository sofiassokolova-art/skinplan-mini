// app/(miniapp)/plan/page.tsx
// Страница 28-дневного плана ухода за кожей

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface PlanDay {
  day: number;
  week: number;
  morning: string[];
  evening: string[];
  products: Record<string, {
    id: number;
    name: string;
    brand: string;
    step: string;
  }>;
  completed: boolean;
}

interface PlanWeek {
  week: number;
  days: PlanDay[];
  summary: {
    focus: string[];
    productsCount: number;
  };
}

interface GeneratedPlan {
  profile: {
    skinType: string;
    primaryFocus: string;
    concerns: string[];
    ageGroup: string;
  };
  weeks: PlanWeek[];
  infographic: {
    progress: Array<{
      week: number;
      acne: number;
      pores: number;
      hydration: number;
      pigmentation: number;
    }>;
  };
  products: Array<{
    id: number;
    name: string;
    brand: string;
    category: string;
    price: number;
    available: string;
    imageUrl?: string;
  }>;
}

const STEP_LABELS: Record<string, string> = {
  cleanser: 'Очищение',
  toner: 'Тонер',
  treatment: 'Актив',
  moisturizer: 'Крем',
  spf: 'SPF',
};

export default function PlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set());
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('📄 Plan page mounted, loading plan...');
    loadPlan();
  }, []);

  const loadPlan = async (retryCount = 0) => {
    try {
      console.log(`📥 Загрузка плана (попытка ${retryCount + 1})...`);
      setLoading(true);
      setError(null);
      
      // Проверяем токен
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      console.log('🔑 Токен найден:', !!token);
      
      if (!token) {
        console.warn('⚠️ Токен не найден, перенаправляем на /quiz');
        router.push('/quiz');
        return;
      }

      console.log('📡 Запрашиваем план с сервера...');
      
      let data: GeneratedPlan;
      try {
        data = await api.getPlan() as GeneratedPlan;
        console.log('✅ План получен:', {
          profile: data.profile,
          weeksCount: data.weeks?.length || 0,
          productsCount: data.products?.length || 0,
        });
        
        if (!data || !data.weeks || data.weeks.length === 0) {
          throw new Error('План пустой или неполный');
        }
        
        setPlan(data);
      } catch (apiError: any) {
        console.error('❌ Ошибка при запросе плана:', apiError);
        console.error('❌ Детали:', {
          message: apiError?.message,
          status: apiError?.response?.status,
        });
        
        // Если ошибка "No skin profile found" и это первая попытка - ждем и повторяем
        if (retryCount < 2 && (
          apiError?.message?.includes('No skin profile found') ||
          apiError?.message?.includes('Профиль не найден') ||
          apiError?.response?.status === 404
        )) {
          console.log(`⏳ Ждем 2 секунды перед повторной попыткой...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return loadPlan(retryCount + 1);
        }
        
        throw apiError;
      }

      // Загружаем сохраненный прогресс из localStorage
      const savedProgress = localStorage.getItem('plan_progress');
      if (savedProgress) {
        try {
          const progress = JSON.parse(savedProgress);
          setCompletedDays(new Set(progress.completedDays || []));
        } catch (e) {
          console.warn('Failed to parse saved progress', e);
        }
      }
    } catch (err: any) {
      console.error('❌ Error loading plan:', err);
      console.error('❌ Error details:', {
        message: err?.message,
        response: err?.response,
        stack: err?.stack,
      });
      
      if (err?.message?.includes('Unauthorized') || err?.message?.includes('401')) {
        localStorage.removeItem('auth_token');
        router.push('/quiz');
        return;
      }

      // Более понятные сообщения об ошибках
      let errorMessage = err?.message || 'Ошибка загрузки плана';
      let showRetry = true;
      
      if (err?.message?.includes('No skin profile found') || err?.message?.includes('Профиль кожи не найден')) {
        errorMessage = 'Профиль не найден. Возможно, анкета еще обрабатывается. Попробуйте обновить страницу.';
      } else if (err?.message?.includes('No products available') || err?.message?.includes('Продукты не найдены')) {
        errorMessage = 'Продукты не найдены. Обратитесь к администратору.';
        showRetry = false;
      } else if (err?.message?.includes('Unauthorized') || err?.message?.includes('401')) {
        errorMessage = 'Ошибка авторизации. Перенаправляем на анкету...';
        setTimeout(() => router.push('/quiz'), 2000);
        return;
      } else if (err?.message?.includes('500') || err?.response?.status === 500) {
        errorMessage = 'Ошибка сервера. Попробуйте позже.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: number) => {
    const newCompleted = new Set(completedDays);
    if (newCompleted.has(day)) {
      newCompleted.delete(day);
    } else {
      newCompleted.add(day);
    }
    setCompletedDays(newCompleted);

    // Сохраняем прогресс
    localStorage.setItem('plan_progress', JSON.stringify({
      completedDays: Array.from(newCompleted),
    }));
  };

  const toggleWeek = (week: number) => {
    const newExpanded = new Set(expandedWeeks);
    if (newExpanded.has(week)) {
      newExpanded.delete(week);
    } else {
      newExpanded.add(week);
    }
    setExpandedWeeks(newExpanded);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '16px',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid rgba(10, 95, 89, 0.2)',
          borderTop: '4px solid #0A5F59',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}></div>
        <div style={{ color: '#0A5F59', fontSize: '16px' }}>Загрузка плана...</div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <h1 style={{ color: '#0A5F59', marginBottom: '16px', fontSize: '24px' }}>Ошибка загрузки плана</h1>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '400px',
          marginBottom: '24px',
        }}>
          <p style={{ color: '#475467', marginBottom: '16px', fontSize: '16px' }}>
            {error || 'Не удалось загрузить план ухода за кожей.'}
          </p>
          <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '0' }}>
            Возможные причины:
            <br />• Профиль не был создан
            <br />• Ошибка на сервере
            <br />• Проблемы с подключением
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => {
              console.log('🔄 Перезагружаем план...');
              loadPlan(0);
            }}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: '#0A5F59',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            Обновить страницу
          </button>
          <button
            onClick={() => {
              console.log('⬅️ Возвращаемся к анкете...');
              router.push('/quiz');
            }}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: 'rgba(10, 95, 89, 0.1)',
              color: '#0A5F59',
              border: '2px solid #0A5F59',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            Вернуться к анкете
          </button>
        </div>
        {process.env.NODE_ENV === 'development' && error && (
          <details style={{ marginTop: '24px', textAlign: 'left', maxWidth: '600px' }}>
            <summary style={{ cursor: 'pointer', color: '#6B7280', fontSize: '12px' }}>
              Детали ошибки (только для разработки)
            </summary>
            <pre style={{
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '11px',
              overflow: 'auto',
              marginTop: '8px',
            }}>
              {error}
            </pre>
          </details>
        )}
      </div>
    );
  }

  const totalDays = 28;
  const completedCount = completedDays.size;
  const progressPercent = Math.round((completedCount / totalDays) * 100);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      paddingBottom: '120px',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        textAlign: 'center',
      }}>
        <img
          src="/skiniq-logo.png"
          alt="SkinIQ"
          style={{
            height: '120px',
            marginTop: '8px',
            marginBottom: '12px',
          }}
        />
        <div style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#0A5F59',
          marginBottom: '8px',
        }}>
          План ухода на 28 дней
        </div>
        <div style={{
          fontSize: '16px',
          color: '#475467',
          marginBottom: '20px',
        }}>
          Ваш тип кожи: {plan.profile.skinType || 'Нормальная'}
        </div>

        {/* Прогресс-бар */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.56)',
          backdropFilter: 'blur(28px)',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '20px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
            fontSize: '14px',
            color: '#475467',
          }}>
            <span>Прогресс: {completedCount}/{totalDays} дней</span>
            <span>{progressPercent}%</span>
          </div>
          <div style={{
            width: '100%',
            height: '12px',
            backgroundColor: 'rgba(10, 95, 89, 0.1)',
            borderRadius: '6px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progressPercent}%`,
              height: '100%',
              backgroundColor: '#0A5F59',
              transition: 'width 0.3s ease',
            }}></div>
          </div>
        </div>

        {/* Инфографика - Иконки улучшений */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '24px',
        }}>
          {plan.profile.concerns.map((concern, idx) => (
            <div key={idx} style={{
              backgroundColor: 'rgba(255, 255, 255, 0.56)',
              backdropFilter: 'blur(28px)',
              borderRadius: '12px',
              padding: '8px 12px',
              fontSize: '14px',
              color: '#0A5F59',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}>
              {concern}
            </div>
          ))}
        </div>
      </div>

      {/* 28-дневный план - Аккордеон по неделям */}
      <div style={{
        padding: '0 20px',
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        {plan.weeks.map((week) => (
          <div key={week.week} style={{
            marginBottom: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.56)',
            backdropFilter: 'blur(28px)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            overflow: 'hidden',
          }}>
            {/* Заголовок недели */}
            <button
              onClick={() => toggleWeek(week.week)}
              style={{
                width: '100%',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#0A5F59',
                  marginBottom: '4px',
                }}>
                  Неделя {week.week}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#475467',
                }}>
                  Дни {((week.week - 1) * 7) + 1}-{week.week * 7}
                </div>
              </div>
              <div style={{
                fontSize: '20px',
                color: '#0A5F59',
                transform: expandedWeeks.has(week.week) ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}>
                ▼
              </div>
            </button>

            {/* Дни недели */}
            {expandedWeeks.has(week.week) && (
              <div style={{ padding: '0 16px 16px' }}>
                {week.days.map((day) => (
                  <div
                    key={day.day}
                    onClick={() => toggleDay(day.day)}
                    style={{
                      padding: '12px',
                      marginBottom: '8px',
                      backgroundColor: completedDays.has(day.day) 
                        ? 'rgba(10, 95, 89, 0.1)' 
                        : 'rgba(255, 255, 255, 0.3)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      opacity: completedDays.has(day.day) ? 0.7 : 1,
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px',
                    }}>
                      <input
                        type="checkbox"
                        checked={completedDays.has(day.day)}
                        onChange={() => toggleDay(day.day)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '20px',
                          height: '20px',
                          cursor: 'pointer',
                        }}
                      />
                      <span style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: '#0A5F59',
                      }}>
                        День {day.day}
                      </span>
                    </div>

                    {/* Утренний уход */}
                    {day.morning.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{
                          fontSize: '12px',
                          color: '#475467',
                          marginBottom: '4px',
                        }}>
                          Утро:
                        </div>
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px',
                        }}>
                          {day.morning.map((step) => (
                            <span
                              key={step}
                              style={{
                                fontSize: '12px',
                                padding: '4px 8px',
                                backgroundColor: 'rgba(10, 95, 89, 0.1)',
                                borderRadius: '6px',
                                color: '#0A5F59',
                              }}
                            >
                              {STEP_LABELS[step] || step}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Вечерний уход */}
                    {day.evening.length > 0 && (
                      <div>
                        <div style={{
                          fontSize: '12px',
                          color: '#475467',
                          marginBottom: '4px',
                        }}>
                          Вечер:
                        </div>
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px',
                        }}>
                          {day.evening.map((step) => (
                            <span
                              key={step}
                              style={{
                                fontSize: '12px',
                                padding: '4px 8px',
                                backgroundColor: 'rgba(10, 95, 89, 0.1)',
                                borderRadius: '6px',
                                color: '#0A5F59',
                              }}
                            >
                              {STEP_LABELS[step] || step}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Рекомендуемые средства - Карусель */}
      {plan.products.length > 0 && (
        <div style={{
          padding: '20px',
          marginTop: '32px',
        }}>
          <div style={{
            fontSize: '22px',
            fontWeight: 'bold',
            color: '#0A5F59',
            marginBottom: '16px',
            textAlign: 'center',
          }}>
            Рекомендуемые средства
          </div>
          <div style={{
            display: 'flex',
            gap: '16px',
            overflowX: 'auto',
            paddingBottom: '8px',
            scrollSnapType: 'x mandatory',
          }}>
            {plan.products.map((product) => (
              <div
                key={product.id}
                style={{
                  minWidth: '200px',
                  backgroundColor: 'rgba(255, 255, 255, 0.56)',
                  backdropFilter: 'blur(28px)',
                  borderRadius: '16px',
                  padding: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  scrollSnapAlign: 'start',
                }}
              >
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    style={{
                      width: '100%',
                      height: '150px',
                      objectFit: 'cover',
                      borderRadius: '12px',
                      marginBottom: '12px',
                    }}
                  />
                )}
                <div style={{
                  fontSize: '12px',
                  color: '#475467',
                  marginBottom: '4px',
                }}>
                  {product.brand}
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#0A5F59',
                  marginBottom: '8px',
                }}>
                  {product.name}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#475467',
                }}>
                  {product.available}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Кнопка "Анализ фото" */}
      <div style={{
        padding: '20px',
        textAlign: 'center',
        marginTop: '32px',
      }}>
        <button
          onClick={() => router.push('/photo')}
          style={{
            padding: '16px 32px',
            borderRadius: '16px',
            backgroundColor: '#0A5F59',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(10, 95, 89, 0.3)',
          }}
        >
          📸 Анализ фото
        </button>
      </div>
    </div>
  );
}

