// app/(miniapp)/home/page.tsx
// Главная страница мини-аппа (рутина ухода) - перенесена из page.tsx

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';
import { PaymentGate } from '@/components/PaymentGate';
import { getBaseStepFromStepCategory } from '@/lib/plan-helpers';
interface RoutineItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  howto: {
    steps: string[];
    volume: string;
    tip: string;
  };
  done: boolean;
}

interface Recommendation {
  profile_summary: {
    skinType: string;
    sensitivityLevel: string;
    notes: string;
  };
  steps: Record<string, Array<{
    id: number;
    name: string;
    brand: string;
    description: string;
    imageUrl?: string;
  }>>;
}

const ICONS: Record<string, string> = {
  cleanser: '/icons/cleanser1.PNG',
  toner: '/icons/toner1.PNG',
  serum: '/icons/serum.PNG',
  cream: '/icons/cream.PNG',
  spf: '/icons/spf1.PNG',
  acid: '/icons/acid1.PNG',
};

export default function HomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { initialize } = useTelegram();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasPlan, setHasPlan] = useState(false); // Есть ли сохранённый 28-дневный план
  const [recommendations, setRecommendations] = useState<Recommendation | null>(null);
  const [morningItems, setMorningItems] = useState<RoutineItem[]>([]);
  const [eveningItems, setEveningItems] = useState<RoutineItem[]>([]);
  const [tab, setTab] = useState<'AM' | 'PM'>('AM');
  const [selectedItem, setSelectedItem] = useState<RoutineItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null); // Имя пользователя для приветствия

  useEffect(() => {
    setMounted(true);
    initialize();
    setError(null);
    const initDoneRef = { current: false };

    // Загружаем данные (пользователь идентифицируется автоматически через initData)
    const initAndLoad = async () => {
      try {
      // КРИТИЧНО: Проверяем флаг quiz_just_submitted ПЕРЕД ВСЕМ
      // Это предотвращает редирект на /quiz сразу после отправки анкеты
      const justSubmitted = typeof window !== 'undefined' ? sessionStorage.getItem('quiz_just_submitted') === 'true' : false;
      if (justSubmitted) {
        clientLogger.log('✅ Флаг quiz_just_submitted установлен на главной - редиректим на /plan?state=generating');
        try {
          const { setHasPlanProgress } = await import('@/lib/user-preferences');
          await setHasPlanProgress(true);
        } catch (error) {
          clientLogger.warn('⚠️ Ошибка при установке hasPlanProgress (некритично):', error);
        }
        setLoading(false);
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('quiz_just_submitted');
          window.location.replace('/plan?state=generating');
        }
        return;
      }

      // Устанавливаем loading = true для загрузки контента
      setLoading(true);

      // ОПТИМИЗИРОВАНО: Загружаем имя пользователя асинхронно, не блокируя основную загрузку
      const loadUserNameAsync = async () => {
        try {
          const userAnswers = await api.getUserAnswers() as any;
          if (userAnswers && Array.isArray(userAnswers)) {
            const nameAnswer = userAnswers.find((a: any) => a.question?.code === 'USER_NAME');
            if (nameAnswer && nameAnswer.answerValue && String(nameAnswer.answerValue).trim().length > 0) {
              const userNameFromAnswer = String(nameAnswer.answerValue).trim();
              setUserName(userNameFromAnswer);
              clientLogger.log('✅ User name loaded from USER_NAME answer:', userNameFromAnswer);
              return;
            }
          }
          
          const userProfile = await api.getUserProfile();
          if (userProfile?.firstName) {
            setUserName(userProfile.firstName);
            clientLogger.log('✅ User name loaded from profile:', userProfile.firstName);
          }
        } catch (err: any) {
          if (err?.status !== 429 && err?.status !== 405) {
            clientLogger.warn('Could not load user name:', err);
          } else if (err?.status === 405) {
            if (process.env.NODE_ENV === 'development') {
              clientLogger.warn('HTTP 405 when loading user name - check endpoint:', err);
            }
          }
        }
      };

      const checkPlanExists = async (): Promise<boolean> => {
        try {
          const plan = await api.getPlan() as any;
          const hasPlan28 =
            plan &&
            plan.plan28 &&
            Array.isArray(plan.plan28.days) &&
            plan.plan28.days.length > 0;
          const hasWeeks = plan && Array.isArray(plan.weeks) && plan.weeks.length > 0;
          const exists = !!hasPlan28 || !!hasWeeks;
          setHasPlan(exists);
          
          // ИСПРАВЛЕНО: Детальное логирование для диагностики редиректа на /quiz
          if (hasPlan28 || hasWeeks) {
            clientLogger.log('✅ Plan exists for user, disabling CTA on home', {
              hasPlan28,
              plan28DaysCount: hasPlan28 ? plan.plan28.days.length : 0,
              hasWeeks,
              weeksCount: hasWeeks ? plan.weeks.length : 0,
            });
          } else {
            clientLogger.log('ℹ️ Plan not found when checking from home page', {
              hasPlan: !!plan,
              hasPlan28: !!(plan?.plan28),
              plan28DaysCount: plan?.plan28?.days?.length || 0,
              hasWeeks: !!(plan?.weeks),
              weeksCount: plan?.weeks?.length || 0,
              planKeys: plan ? Object.keys(plan) : [],
            });
          }
          return exists;
        } catch (err: any) {
          if (err?.status === 404 || err?.isNotFound) {
            setHasPlan(false);
            clientLogger.log('ℹ️ Plan not found (404) when checking from home page');
            return false;
          } else {
            if (err?.status !== 429 && err?.status !== 408) {
              clientLogger.warn('Could not check plan existence from home page', err);
            }
            return false;
          }
        }
      };
      
      const planExists = await checkPlanExists();
      
      if (planExists) {
        clientLogger.log('✅ Plan exists - loading recommendations');
        await loadRecommendations();
        loadUserNameAsync();
        return;
      }

      clientLogger.log('ℹ️ No plan but plan_progress exists - loading recommendations (plan may be generating)');
      await loadRecommendations();
      loadUserNameAsync();
      } finally {
        initDoneRef.current = true;
      }
    };

    initAndLoad();

    // Если загрузка зависла (например, таймаут API на кастомном домене) — через 25 с снимаем лоадер
    const timeoutId = setTimeout(() => {
      if (!initDoneRef.current) {
        setLoading(false);
        setError('Загрузка заняла слишком много времени. Проверьте интернет или обновите страницу.');
      }
    }, 25000);
    return () => clearTimeout(timeoutId);
  }, [router, initialize]);

  // Фолбэк: строим рутину напрямую из 28-дневного плана, если рекомендации по каким‑то причинам пустые
  const buildRoutineFromPlan = async () => {
    try {
      const plan = await api.getPlan() as any;
      if (!plan) {
        clientLogger.warn('Fallback plan: plan is empty');
        return;
      }

      // Определяем текущий день из БД
      let currentDay = 1;
      try {
        const planProgress = await api.getPlanProgress() as any;
        if (planProgress && typeof planProgress.currentDay === 'number' && planProgress.currentDay >= 1 && planProgress.currentDay <= 28) {
          currentDay = planProgress.currentDay;
        }
      } catch {
        // ignore, используем значение по умолчанию
      }

      // 1) Новый формат: plan28
      if (plan.plan28 && Array.isArray(plan.plan28.days) && plan.plan28.days.length > 0) {
        const plan28 = plan.plan28;

        const dayData =
          plan28.days.find((d: any) => d.dayIndex === currentDay) ||
          plan28.days[0];

        if (!dayData) {
          clientLogger.warn('Fallback plan: no day data found');
          return;
        }

        const productsArray: any[] = Array.isArray(plan.products) ? plan.products : [];
        const getProduct = (id: number) => productsArray.find(p => p.id === id);

        const buildItems = (steps: any[], time: 'AM' | 'PM'): RoutineItem[] => {
          const items: RoutineItem[] = [];
          steps.forEach((step, idx) => {
            const productId = Number(step.productId);
            if (!productId) return;
            const product = getProduct(productId);
            if (!product) return;

            const baseStep = getBaseStepFromStepCategory(step.stepCategory);

            // Маппинг метаданных по базовому шагу
            let title = '';
            let icon = ICONS.cleanser;
            let howto: RoutineItem['howto'] = {
              steps: [],
              volume: '',
              tip: '',
            };

            if (baseStep === 'cleanser') {
              title = 'Очищение';
              icon = ICONS.cleanser;
              howto = {
                steps: ['Смочите лицо тёплой водой', '1–2 нажатия геля в ладони', 'Массируйте 30–40 сек', 'Смойте, промокните полотенцем'],
                volume: '1–2 нажатия',
                tip: 'Если кожа сухая утром — можно умыться только водой.',
              };
            } else if (baseStep === 'toner') {
              title = 'Тонер';
              icon = ICONS.toner;
              howto = {
                steps: ['Нанесите 3–5 капель на руки', 'Распределите похлопывающими движениями', 'Дайте впитаться 30–60 сек'],
                volume: '3–5 капель',
                tip: 'Избегайте ватных дисков — тратите меньше продукта.',
              };
            } else if (baseStep === 'serum' || baseStep === 'treatment') {
              title = time === 'AM' ? 'Актив' : 'Сыворотка';
              icon = ICONS.serum;
              howto = {
                steps: ['3–6 капель на сухую кожу', 'Равномерно нанесите и дайте впитаться 1–2 минуты'],
                volume: '3–6 капель',
                tip: 'При раздражении сделайте паузу в использовании актива.',
              };
            } else if (baseStep === 'moisturizer') {
              title = 'Крем';
              icon = ICONS.cream;
              howto = {
                steps: ['Горох крема распределить по лицу', 'Мягко втереть по массажным линиям'],
                volume: 'Горошина',
                tip: 'Не забывайте шею и линию подбородка.',
              };
            } else if (baseStep === 'spf') {
              title = 'SPF-защита';
              icon = ICONS.spf;
              howto = {
                steps: ['Нанести 2 пальца SPF (лицо/шея)', 'Обновлять каждые 2–3 часа на улице'],
                volume: '~1.5–2 мл',
                tip: 'При UV > 3 — обязательно SPF даже в облачную погоду.',
              };
            } else if (baseStep === 'lip_care') {
              title = 'Бальзам для губ';
              icon = ICONS.cream;
              howto = {
                steps: ['Нанести на губы тонким слоем', 'Обновлять по необходимости в течение дня'],
                volume: 'Тонкий слой',
                tip: 'Регулярное использование предотвращает сухость и трещины.',
              };
            } else {
              // Неизвестные шаги пока пропускаем, чтобы не ломать верстку
              return;
            }

            items.push({
              id: `${time}-${baseStep}-${idx}-${productId}`,
              title,
              subtitle: product.name || title,
              icon,
              howto,
              done: false,
            });
          });
          return items;
        };

        const fallbackMorning = buildItems(dayData.morning || [], 'AM');
        const fallbackEvening = buildItems(dayData.evening || [], 'PM');

        if (fallbackMorning.length === 0 && fallbackEvening.length === 0) {
          clientLogger.warn('Fallback plan: no routine items built from plan28');
          return;
        }

        clientLogger.log('✅ Fallback routine built from plan28', {
          currentDay,
          morningCount: fallbackMorning.length,
          eveningCount: fallbackEvening.length,
        });

        setMorningItems(fallbackMorning);
        setEveningItems(fallbackEvening);
        return;
      }

      // 2) Legacy формат: weeks (без plan28)
      if (Array.isArray(plan.weeks) && plan.weeks.length > 0) {
        const weekIndex = Math.max(0, Math.min(Math.floor((currentDay - 1) / 7), plan.weeks.length - 1));
        const weekData = plan.weeks[weekIndex];
        const days = Array.isArray(weekData?.days) ? weekData.days : [];
        const dayIndex = Math.max(0, Math.min((currentDay - 1) % 7, days.length - 1));
        const dayData = days[dayIndex] || days[0];

        if (!dayData) {
          clientLogger.warn('Fallback plan: no day data found in legacy weeks');
          return;
        }

        const productsArray: any[] = Array.isArray(plan.products) ? plan.products : [];
        const getProduct = (id: number) => productsArray.find(p => p.id === id);

        const buildItemsFromIds = (ids: any[], time: 'AM' | 'PM'): RoutineItem[] => {
          const items: RoutineItem[] = [];
          (Array.isArray(ids) ? ids : []).forEach((rawId, idx) => {
            const productId = Number(rawId);
            if (!productId) return;
            const product = getProduct(productId);
            if (!product) return;

            // В legacy формате нет stepCategory → берём category продукта как "категорию шага"
            const baseStep = getBaseStepFromStepCategory((product.category || product.step || 'serum') as any);

            let title = '';
            let icon = ICONS.cleanser;
            let howto: RoutineItem['howto'] = { steps: [], volume: '', tip: '' };

            if (baseStep === 'cleanser') {
              title = 'Очищение';
              icon = ICONS.cleanser;
              howto = {
                steps: ['Смочите лицо тёплой водой', '1–2 нажатия геля в ладони', 'Массируйте 30–40 сек', 'Смойте, промокните полотенцем'],
                volume: '1–2 нажатия',
                tip: 'Если кожа сухая утром — можно умыться только водой.',
              };
            } else if (baseStep === 'toner') {
              title = 'Тонер';
              icon = ICONS.toner;
              howto = {
                steps: ['Нанесите 3–5 капель на руки', 'Распределите похлопывающими движениями', 'Дайте впитаться 30–60 сек'],
                volume: '3–5 капель',
                tip: 'Избегайте ватных дисков — тратите меньше продукта.',
              };
            } else if (baseStep === 'serum' || baseStep === 'treatment') {
              title = time === 'AM' ? 'Актив' : 'Сыворотка';
              icon = ICONS.serum;
              howto = {
                steps: ['3–6 капель на сухую кожу', 'Равномерно нанесите и дайте впитаться 1–2 минуты'],
                volume: '3–6 капель',
                tip: 'При раздражении сделайте паузу в использовании актива.',
              };
            } else if (baseStep === 'moisturizer') {
              title = 'Крем';
              icon = ICONS.cream;
              howto = {
                steps: ['Горох крема распределить по лицу', 'Мягко втереть по массажным линиям'],
                volume: 'Горошина',
                tip: 'Не забывайте шею и линию подбородка.',
              };
            } else if (baseStep === 'spf') {
              title = 'SPF-защита';
              icon = ICONS.spf;
              howto = {
                steps: ['Нанести 2 пальца SPF (лицо/шея)', 'Обновлять каждые 2–3 часа на улице'],
                volume: '~1.5–2 мл',
                tip: 'При UV > 3 — обязательно SPF даже в облачную погоду.',
              };
            } else if (baseStep === 'lip_care') {
              title = 'Бальзам для губ';
              icon = ICONS.cream;
              howto = {
                steps: ['Нанести на губы тонким слоем', 'Обновлять по необходимости в течение дня'],
                volume: 'Тонкий слой',
                tip: 'Регулярное использование предотвращает сухость и трещины.',
              };
            } else {
              return;
            }

            items.push({
              id: `${time}-${baseStep}-${idx}-${productId}`,
              title,
              subtitle: product.name || title,
              icon,
              howto,
              done: false,
            });
          });
          return items;
        };

        const fallbackMorning = buildItemsFromIds(dayData.morning || [], 'AM');
        const fallbackEvening = buildItemsFromIds(dayData.evening || [], 'PM');

        if (fallbackMorning.length === 0 && fallbackEvening.length === 0) {
          clientLogger.warn('Fallback plan: no routine items built from legacy weeks');
          return;
        }

        clientLogger.log('✅ Fallback routine built from legacy weeks', {
          currentDay,
          morningCount: fallbackMorning.length,
          eveningCount: fallbackEvening.length,
        });

        setMorningItems(fallbackMorning);
        setEveningItems(fallbackEvening);
        return;
      }

      clientLogger.warn('Fallback plan: no plan28 and no weeks data available');
    } catch (err: any) {
      clientLogger.warn('Fallback plan: failed to build routine from plan28', err);
    }
  };

  const loadRecommendations = useCallback(async () => {
    setLoading(true); // ИСПРАВЛЕНО: Устанавливаем loading в true перед началом загрузки
    setError(null); // ИСПРАВЛЕНО: Очищаем ошибку перед началом новой загрузки
    try {
      const data = await api.getRecommendations() as any;
      
      // Если план истёк (28+ дней) — показываем понятный экран с предложением перепройти анкету
      // (после перепрохождения в конце снова будет оплата/гейт).
      if (data?.expired === true) {
        // План истёк: оставляем UX на месте (не редиректим),
        // строим рутину из plan28 и показываем блюр через PaymentGate.
        setRecommendations(null as any);
        setError(null);
        try {
          await buildRoutineFromPlan();
        } catch (fallbackErr) {
          clientLogger.warn('Failed to build routine from plan28 for expired plan', fallbackErr);
          setMorningItems([]);
          setEveningItems([]);
        } finally {
          setLoading(false);
        }
        return;
      }

      setRecommendations(data as Recommendation);
      setError(null); // ИСПРАВЛЕНО: Очищаем ошибку при успешной загрузке
      
      // Преобразуем рекомендации в RoutineItem[] раздельно для утра и вечера
      const morning: RoutineItem[] = [];
      const evening: RoutineItem[] = [];
      
      // УТРЕННЯЯ РУТИНА
      if (data?.steps?.cleanser) {
        morning.push({
          id: 'morning-cleanser',
          title: 'Очищение',
          subtitle: data?.steps?.cleanser?.[0]?.name || 'Очищающее средство',
          icon: ICONS.cleanser,
          howto: {
            steps: ['Смочите лицо тёплой водой', '1–2 нажатия геля в ладони', 'Массируйте 30–40 сек', 'Смойте, промокните полотенцем'],
            volume: 'Гель: 1–2 пшика',
            tip: 'Если кожа сухая утром — можно умыться только водой.',
          },
          done: false,
        });
      }
      
      if (data?.steps?.toner) {
        morning.push({
          id: 'morning-toner',
          title: 'Тонер',
          subtitle: data?.steps?.toner?.[0]?.name || 'Тоник',
          icon: ICONS.toner,
          howto: {
            steps: ['Нанесите 3–5 капель на руки', 'Распределите похлопывающими движениями', 'Дайте впитаться 30–60 сек'],
            volume: '3–5 капель',
            tip: 'Избегайте ватных дисков — тратите меньше продукта.',
          },
          done: false,
        });
      }
      
      if (data?.steps?.treatment) {
        morning.push({
          id: 'morning-active',
          title: 'Актив',
          subtitle: data?.steps?.treatment?.[0]?.name || 'Активное средство',
          icon: ICONS.serum,
          howto: {
            steps: ['1–2 пипетки на сухую кожу', 'Наносите на T‑зону и щеки', 'Подождите 1–2 минуты до крема'],
            volume: '4–6 капель',
            tip: 'Если есть раздражение — пропустите актив на день.',
          },
          done: false,
        });
      }
      
      if (data?.steps?.moisturizer) {
        morning.push({
          id: 'morning-cream',
          title: 'Крем',
          subtitle: data?.steps?.moisturizer?.[0]?.name || 'Увлажняющий крем',
          icon: ICONS.cream,
          howto: {
            steps: ['Горох крема распределить по лицу', 'Мягко втереть по массажным линиям'],
            volume: 'Горошина',
            tip: 'Не забывайте шею и линию подбородка.',
          },
          done: false,
        });
      }
      
      if (data?.steps?.spf) {
        morning.push({
          id: 'morning-spf',
          title: 'SPF-защита',
          subtitle: data?.steps?.spf?.[0]?.name || 'SPF 50',
          icon: ICONS.spf,
          howto: {
            steps: ['Нанести 2 пальца SPF (лицо/шея)', 'Обновлять каждые 2–3 часа на улице'],
            volume: '~1.5–2 мл',
            tip: 'При UV > 3 — обязательно SPF даже в облачную погоду.',
          },
          done: false,
        });
      }
      
      // ИСПРАВЛЕНО: Добавляем бальзам для губ утром для всех
      if (data?.steps?.lip_care) {
        morning.push({
          id: 'morning-lip-balm',
          title: 'Бальзам для губ',
          subtitle: data?.steps?.lip_care?.[0]?.name || 'Бальзам для губ',
          icon: ICONS.cream, // Используем иконку крема как временную
          howto: {
            steps: ['Нанести на губы тонким слоем', 'Обновлять по необходимости в течение дня'],
            volume: 'Тонкий слой',
            tip: 'Регулярное использование предотвращает сухость и трещины.',
          },
          done: false,
        });
      }
      
      // ВЕЧЕРНЯЯ РУТИНА
      if (data?.steps?.cleanser) {
        evening.push({
          id: 'evening-cleanser',
          title: 'Очищение',
          subtitle: data?.steps?.cleanser?.[0]?.name || 'Двойное очищение',
          icon: ICONS.cleanser,
          howto: {
            steps: ['1) Масло: сухими руками распределить, эмульгировать водой', '2) Гель: умыть 30–40 сек, смыть'],
            volume: '1–2 дозы масла + 1–2 пшика геля',
            tip: 'Двойное очищение — в дни макияжа/кислот.',
          },
          done: false,
        });
      }
      
      if (data?.steps?.treatment || data?.steps?.acid) {
        evening.push({
          id: 'evening-acid',
          title: 'Кислоты (по расписанию)',
          subtitle: data.steps?.treatment?.[0]?.name || data.steps?.acid?.[0]?.name || 'AHA/BHA/PHА пилинг',
          icon: ICONS.acid,
          howto: {
            steps: ['Нанести тонким слоем на Т‑зону', 'Выдержать 5–10 минут (по переносимости)', 'Смыть/нейтрализовать, далее крем'],
            volume: 'Тонкий слой',
            tip: 'При покраснении — пауза 3–5 дней.',
          },
          done: false,
        });
      }
      
      if (data?.steps?.treatment || data?.steps?.serum) {
        evening.push({
          id: 'evening-serum',
          title: 'Сыворотка',
          subtitle: data.steps?.treatment?.[0]?.name || data.steps?.serum?.[0]?.name || 'Пептидная / успокаивающая',
          icon: ICONS.serum,
          howto: {
            steps: ['3–6 капель', 'Равномерно нанести, дать впитаться 1 мин'],
            volume: '3–6 капель',
            tip: 'В дни кислот сыворотка — без кислот/ретинола.',
          },
          done: false,
        });
      }
      
      if (data?.steps?.moisturizer) {
        evening.push({
          id: 'evening-cream',
          title: 'Крем',
          subtitle: data?.steps?.moisturizer?.[0]?.name || 'Питательный крем',
          icon: ICONS.cream,
          howto: {
            steps: ['Горох крема', 'Распределить, не втирая сильно'],
            volume: 'Горошина',
            tip: 'Если сухо — добавьте каплю масла локально.',
          },
          done: false,
        });
      }
      
      setMorningItems(morning);
      setEveningItems(evening);

      // ИСПРАВЛЕНО: Логируем результат загрузки рекомендаций для диагностики
      clientLogger.log('✅ Recommendations loaded', {
        hasSteps: !!data?.steps,
        stepsKeys: data?.steps ? Object.keys(data.steps) : [],
        morningItemsCount: morning.length,
        eveningItemsCount: evening.length,
        hasPlan,
        willRedirect: morning.length === 0 && evening.length === 0 && !hasPlan,
      });

      // Фолбэк через план для нового пользователя больше не используем:
      // если нет шагов рутины, дальше логика редиректит на /quiz (см. ниже).
    } catch (error: any) {
      clientLogger.error('Error loading recommendations', error);
      
      // Проверяем тип ошибки
      if (error?.message?.includes('Unauthorized') || error?.message?.includes('401') || error?.message?.includes('initData')) {
        // Ошибка идентификации - перенаправляем на анкету
        setError('Не удалось загрузить данные. Пройдите анкету, чтобы получить план.');
        setLoading(false);
        return;
      }
      
      // ИСПРАВЛЕНО: При 404 / профиле, которого нет
      // - если у пользователя УЖЕ есть план, не редиректим на /quiz, а остаёмся на главной
      //   и пробуем собрать рутину напрямую из план28 (fallback),
      // - если плана нет, считаем, что пользователь ещё не прошёл анкету и отправляем на /quiz.
      if (
        error?.status === 404 ||
        error?.isNotFound ||
        error?.message?.includes('404') ||
        error?.message?.includes('No skin profile') ||
        error?.message?.includes('Not found') ||
        error?.message?.includes('profile not found')
      ) {
        setLoading(false);
        // Если уже есть валидный план — остаёмся на главной и пробуем фолбэк-рутину из плана
        if (hasPlan) {
          clientLogger.log('Рекомендации не найдены, но план уже существует — остаёмся на главной и пробуем fallback из plan28');
          try {
            await buildRoutineFromPlan();
          } catch (fallbackErr) {
            clientLogger.warn('Не удалось построить фолбэк-рутину из plan28 при ошибке рекомендаций', fallbackErr);
          }
          return;
        }

        // Плана нет — это действительно новый пользователь → показываем CTA на анкету
        clientLogger.log('Рекомендации не найдены (профиль ещё не создан, плана нет) — показываем CTA на анкету');
        setError(null);
        return;
      }
      
      // Другие ошибки - показываем сообщение
      setError(error?.message || 'Ошибка загрузки рекомендаций');
      setMorningItems([]);
      setEveningItems([]);
    } finally {
      setLoading(false);
    }
  }, [hasPlan, router, setLoading, setError, setMorningItems, setEveningItems, buildRoutineFromPlan]);

  const toggleItem = (itemId: string) => {
    if (tab === 'AM') {
      setMorningItems((items) =>
        items.map((item) =>
          item.id === itemId ? { ...item, done: !item.done } : item
        )
      );
    } else {
      setEveningItems((items) =>
        items.map((item) =>
          item.id === itemId ? { ...item, done: !item.done } : item
        )
      );
    }
  };

  if (!mounted || loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        paddingBottom: '120px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          border: '4px solid rgba(10, 95, 89, 0.2)',
          borderTop: '4px solid #0A5F59',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px',
        }} />
        <div style={{ color: '#0A5F59', fontSize: '16px', fontWeight: 500 }}>
          Загрузка плана...
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Получаем текущие элементы в зависимости от вкладки
  const routineItems = tab === 'AM' ? morningItems : eveningItems;
  
  // План истёк: не показываем отдельный экран — paywall + блюр от PaymentGate.

  if (error && routineItems.length === 0) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
      }}>
        <h1 style={{ color: '#0A5F59', marginBottom: '16px' }}>Ошибка загрузки</h1>
        <p style={{ color: '#475467', marginBottom: '24px' }}>{error}</p>
        <button
          onClick={() => router.push('/quiz')}
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
          Пройти анкету заново
        </button>
      </div>
    );
  }

  // Совсем новый пользователь (нет рутины и нет сохранённого плана) → показываем CTA на анкету
  if (routineItems.length === 0 && !hasPlan) {
    clientLogger.log('ℹ️ No routine items and no plan — showing CTA to start questionnaire', {
      routineItemsCount: routineItems.length,
      hasPlan,
      morningItemsCount: morningItems.length,
      eveningItemsCount: eveningItems.length,
      tab,
      recommendations: !!recommendations,
      hasSteps: !!recommendations?.steps,
      stepsKeys: recommendations?.steps ? Object.keys(recommendations.steps) : [],
    });
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
        <h1 style={{ color: '#0A5F59', marginBottom: '16px' }}>Начните с анкеты</h1>
        <p style={{ color: '#475467', marginBottom: '24px' }}>
          Мы подберём персональный уход после короткой анкеты.
        </p>
        <button
          onClick={() => router.push('/quiz')}
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
          Пройти анкету
        </button>
      </div>
    );
  }

  const completedCount = routineItems.filter((item) => item.done).length;
  const totalCount = routineItems.length;

  // ИСПРАВЛЕНО: План - это платный продукт, поэтому PaymentGate показывается ВСЕГДА
  // PaymentGate сам проверит статус оплаты через localStorage и БД
  // Если не оплачено - покажет блюр с экраном оплаты
  // Если оплачено - покажет контент без блюра
  return (
    <PaymentGate
      price={199}
      productCode="plan_access"
      isRetaking={false}
      onPaymentComplete={() => {
        clientLogger.log('✅ Payment completed on homepage');
        // После оплаты перезагружаем рекомендации
        loadRecommendations();
      }}
      retakeCta={{ text: 'Изменились цели? Перепройти анкету', href: '/quiz' }}
    >
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
        {/* Приветствие с именем */}
        {userName && (
          <div style={{
            fontSize: '20px',
            fontWeight: 500,
            color: '#0A5F59',
            marginBottom: '12px',
          }}>
            {(() => {
              const hour = new Date().getHours();
              const greeting = hour >= 6 && hour < 18 ? 'Добрый день' : 'Добрый вечер';
              return `${greeting}, ${userName}`;
            })()}
          </div>
        )}
        <div style={{
          fontSize: '26px',
          fontWeight: 600,
          color: '#374151',
          marginBottom: '8px',
        }}>
          Время заботиться о своей коже
        </div>
        <button
          onClick={() => router.push('/plan')}
          style={{
            marginTop: '16px',
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
          📅 28-дневный план →
        </button>
        {recommendations?.profile_summary && (
          <div style={{
            fontSize: '16px',
            color: '#475467',
            marginBottom: '16px',
          }}>
            {completedCount}/{totalCount} шагов
          </div>
        )}
      </div>

      {/* Ретейк ссылка на главной (всегда видна, даже если доступ уже оплачен) */}
      <div style={{ padding: '0 20px', marginTop: '8px' }}>
        <button
          type="button"
          onClick={async () => {
            try {
              const { setFullRetakeFromHome, setIsRetakingQuiz } = await import('@/lib/user-preferences');
              await setFullRetakeFromHome(true);
              await setIsRetakingQuiz(true);
            } catch (error) {
              clientLogger.warn('Failed to set retake flags:', error);
            }
            queryClient.invalidateQueries({ queryKey: ['quiz', 'active'] });
            // window.location гарантирует URL с query — на localhost router.push может терять параметры
            window.location.href = '/quiz?retakeFromHome=1';
          }}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: '#0A5F59',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            padding: '10px 0',
          }}
        >
          Изменились цели? Перепройти анкету
        </button>
      </div>

      {/* Toggle AM/PM */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '24px',
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.42)',
          backdropFilter: 'blur(20px)',
          borderRadius: '28px',
          padding: '6px',
          display: 'flex',
          gap: '6px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
        }}>
          <button
            onClick={() => setTab('AM')}
            style={{
              padding: '8px 20px',
              borderRadius: '22px',
              border: 'none',
              backgroundColor: tab === 'AM' ? 'rgba(10, 95, 89, 0.9)' : 'rgba(255, 255, 255, 0.2)',
              color: tab === 'AM' ? 'white' : '#0A5F59',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            Утро
          </button>
          <button
            onClick={() => setTab('PM')}
            style={{
              padding: '8px 20px',
              borderRadius: '22px',
              border: 'none',
              backgroundColor: tab === 'PM' ? 'rgba(10, 95, 89, 0.9)' : 'rgba(255, 255, 255, 0.2)',
              color: tab === 'PM' ? 'white' : '#0A5F59',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            Вечер
          </button>
        </div>
      </div>

      {/* Routine Items */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '0 20px',
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        {routineItems.map((item, index) => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.56)',
              backdropFilter: 'blur(28px)',
              borderRadius: '20px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              cursor: 'pointer',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              opacity: item.done ? 0.7 : 1,
            }}
          >
            {/* Step Number */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                toggleItem(item.id);
              }}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: item.done ? '#0A5F59' : 'rgba(10, 95, 89, 0.1)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {item.done ? '✓' : index + 1}
            </div>

            {/* Icon */}
            <img
              src={item.icon}
              alt={item.title}
              style={{
                width: '60px',
                height: '60px',
                objectFit: 'contain',
                flexShrink: 0,
              }}
              onError={(e) => {
                clientLogger.warn('Icon not found:', item.icon);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '17px',
                fontWeight: 'bold',
                color: '#0A5F59',
                marginBottom: '4px',
              }}>
                {item.title}
              </div>
              <div style={{
                fontSize: '14px',
                color: '#475467',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {item.subtitle}
              </div>
            </div>

            {/* Info Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedItem(item);
              }}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#0A5F59',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                flexShrink: 0,
              }}
            >
              i
            </button>
          </div>
        ))}
      </div>

      {/* BottomSheet для деталей */}
      {selectedItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setSelectedItem(null)}
          />
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxHeight: '85vh',
              backgroundColor: 'rgba(250, 251, 253, 0.75)',
              backdropFilter: 'blur(32px)',
              borderTopLeftRadius: '28px',
              borderTopRightRadius: '28px',
              padding: '24px',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0A5F59', marginBottom: '16px' }}>
              {selectedItem.title}
            </h3>
            <div style={{ marginBottom: '16px', color: '#475467' }}>
              {selectedItem.subtitle}
            </div>
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>Как использовать:</h4>
              <ol style={{ paddingLeft: '20px' }}>
                {selectedItem.howto.steps.map((step, i) => (
                  <li key={i} style={{ marginBottom: '8px', color: '#475467' }}>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            <div style={{ marginBottom: '16px', color: '#475467', fontSize: '14px' }}>
              <strong>Объём:</strong> {selectedItem.howto.volume}
            </div>
            <div style={{ color: '#0A5F59', fontSize: '14px', fontStyle: 'italic' }}>
              💡 {selectedItem.howto.tip}
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              style={{
                marginTop: '24px',
                width: '100%',
                padding: '16px',
                borderRadius: '16px',
                backgroundColor: '#0A5F59',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
              }}
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </div>
    </PaymentGate>
  );
}
