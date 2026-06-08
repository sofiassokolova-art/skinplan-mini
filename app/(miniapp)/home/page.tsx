// app/(miniapp)/home/page.tsx
// Главная страница мини-аппа (рутина ухода) - перенесена из page.tsx

'use client';

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';
import { PaymentGate } from '@/components/PaymentGate';
import { getBaseStepFromStepCategory } from '@/lib/plan-helpers';
import { AppLoader } from '@/components/AppLoader';
import { HomeEmptyState } from '@/components/HomeEmptyState';
import { getStepMeta, STEP_ICONS } from '@/lib/routine-step-meta';
import { getClientUserScope } from '@/lib/client-user-scope';
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
  ...STEP_ICONS,
  acid: STEP_ICONS.treatment,
  oil: '/icons/clean/oil_true.png',
  mask: '/icons/clean/claymask_true.png',
};

// ФИКС #17: персистентность отмеченных шагов рутины между переключениями страниц.
// Раньше toggleItem обновлял только локальный стейт; при уходе на /plan и обратно
// home/page.tsx ремонтировался, рутина пересобиралась из рекомендаций без .done,
// и блок «{N} из {M}» (визуальный стрик на главной) показывал 0 — отсюда #17.
// Ключ скоупится пользователем, календарной датой и вкладкой (AM/PM).
const ROUTINE_DONE_KEY_PREFIX = 'skinplan:home:routine_done';
function routineStorageDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function routineDoneStorageKey(tab: 'AM' | 'PM'): string | null {
  const userScope = getClientUserScope();
  if (!userScope) return null;
  return `${ROUTINE_DONE_KEY_PREFIX}:${userScope}:${routineStorageDate()}:${tab}`;
}
function routineProgressSyncedStorageKey(): string | null {
  const userScope = getClientUserScope();
  return userScope
    ? `${ROUTINE_DONE_KEY_PREFIX}:${userScope}:${routineStorageDate()}:progress_synced`
    : null;
}
function loadDoneIds(tab: 'AM' | 'PM'): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const key = routineDoneStorageKey(tab);
    if (!key) return new Set();
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x: unknown) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}
function saveDoneIds(tab: 'AM' | 'PM', items: RoutineItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    const key = routineDoneStorageKey(tab);
    if (!key) return;
    const ids = items.filter((i) => i.done).map((i) => i.id);
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // localStorage недоступен / переполнен — пропускаем
  }
}
function applyDoneFromStorage(items: RoutineItem[], tab: 'AM' | 'PM'): RoutineItem[] {
  const done = loadDoneIds(tab);
  if (done.size === 0) return items;
  return items.map((i) => (done.has(i.id) ? { ...i, done: true } : i));
}

export default function HomePage() {
  const router = useRouter();
  const { initialize } = useTelegram();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasPlan, setHasPlan] = useState(false); // Есть ли сохранённый 28-дневный план
  const [recommendations, setRecommendations] = useState<Recommendation | null>(null);
  const [morningItems, setMorningItems] = useState<RoutineItem[]>([]);
  const [eveningItems, setEveningItems] = useState<RoutineItem[]>([]);
  const [tab, setTab] = useState<'AM' | 'PM'>('AM');
  const [error, setError] = useState<unknown>(null);
  const [userName, setUserName] = useState<string | null>(null); // Имя пользователя для приветствия
  const progressSyncInFlightRef = useRef(false);

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
        setError(new Error('timeout'));
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

            const meta = getStepMeta(baseStep, time);
            if (!meta) return;

            items.push({
              id: `${time}-${baseStep}-${idx}-${productId}`,
              ...meta,
              subtitle: product.name || meta.title,
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

        setMorningItems(applyDoneFromStorage(fallbackMorning, 'AM'));
        setEveningItems(applyDoneFromStorage(fallbackEvening, 'PM'));
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

            const meta = getStepMeta(baseStep, time);
            if (!meta) return;

            items.push({
              id: `${time}-${baseStep}-${idx}-${productId}`,
              ...meta,
              subtitle: product.name || meta.title,
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

        setMorningItems(applyDoneFromStorage(fallbackMorning, 'AM'));
        setEveningItems(applyDoneFromStorage(fallbackEvening, 'PM'));
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

      const addRoutineItem = (
        items: RoutineItem[],
        id: string,
        baseStep: string,
        time: 'AM' | 'PM',
        subtitle: string,
        overrides: Partial<Pick<RoutineItem, 'title' | 'icon' | 'howto'>> = {},
      ) => {
        const meta = getStepMeta(baseStep, time);
        if (!meta) return;
        items.push({ id, ...meta, ...overrides, subtitle, done: false });
      };
      
      // УТРЕННЯЯ РУТИНА
      if (data?.steps?.cleanser) {
        addRoutineItem(morning, 'morning-cleanser', 'cleanser', 'AM', data.steps.cleanser[0]?.name || 'Очищающее средство');
      }
      
      if (data?.steps?.toner) {
        addRoutineItem(morning, 'morning-toner', 'toner', 'AM', data.steps.toner[0]?.name || 'Тоник');
      }
      
      if (data?.steps?.treatment) {
        addRoutineItem(morning, 'morning-active', 'treatment', 'AM', data.steps.treatment[0]?.name || 'Активное средство');
      }
      
      if (data?.steps?.moisturizer) {
        addRoutineItem(morning, 'morning-cream', 'moisturizer', 'AM', data.steps.moisturizer[0]?.name || 'Увлажняющий крем');
      }
      
      if (data?.steps?.spf) {
        addRoutineItem(morning, 'morning-spf', 'spf', 'AM', data.steps.spf[0]?.name || 'SPF 50');
      }
      
      // ИСПРАВЛЕНО: Добавляем бальзам для губ утром для всех
      if (data?.steps?.lip_care) {
        addRoutineItem(morning, 'morning-lip-balm', 'lip_care', 'AM', data.steps.lip_care[0]?.name || 'Бальзам для губ');
      }
      
      // ВЕЧЕРНЯЯ РУТИНА
      if (data?.steps?.cleanser) {
        addRoutineItem(evening, 'evening-cleanser', 'cleanser', 'PM', data.steps.cleanser[0]?.name || 'Двойное очищение', {
          howto: {
            steps: ['1) Масло: сухими руками распределить, эмульгировать водой', '2) Гель: умыть 30–40 сек, смыть'],
            volume: '1–2 дозы масла + 1–2 пшика геля',
            tip: 'Двойное очищение — в дни макияжа/кислот.',
          },
        });
      }
      
      if (data?.steps?.treatment || data?.steps?.acid) {
        addRoutineItem(evening, 'evening-acid', 'treatment', 'PM', data.steps?.treatment?.[0]?.name || data.steps?.acid?.[0]?.name || 'AHA/BHA/PHА пилинг', {
          title: 'Кислоты (по расписанию)',
          icon: ICONS.acid,
          howto: {
            steps: ['Нанести тонким слоем на Т‑зону', 'Выдержать 5–10 минут (по переносимости)', 'Смыть/нейтрализовать, далее крем'],
            volume: 'Тонкий слой',
            tip: 'При покраснении — пауза 3–5 дней.',
          },
        });
      }
      
      if (data?.steps?.treatment || data?.steps?.serum) {
        addRoutineItem(evening, 'evening-serum', 'serum', 'PM', data.steps?.treatment?.[0]?.name || data.steps?.serum?.[0]?.name || 'Пептидная / успокаивающая');
      }
      
      if (data?.steps?.moisturizer) {
        addRoutineItem(evening, 'evening-cream', 'moisturizer', 'PM', data.steps.moisturizer[0]?.name || 'Питательный крем');
      }
      
      setMorningItems(applyDoneFromStorage(morning, 'AM'));
      setEveningItems(applyDoneFromStorage(evening, 'PM'));

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
        setError(error);
        setLoading(false);
        return;
      }
      
      // ИСПРАВЛЕНО: При 404 / "No skin profile" — бэкенд говорит, что профиля нет.
      // Не показываем ошибку и не вызываем buildRoutineFromPlan (он тоже вернёт 404).
      // Сбрасываем hasPlan и показываем контент без рутины (PaymentGate покажет пейвол, ниже — CTA на анкету).
      if (
        error?.status === 404 ||
        error?.isNotFound ||
        error?.message?.includes('404') ||
        error?.message?.includes('No skin profile') ||
        error?.message?.includes('Not found') ||
        error?.message?.includes('profile not found')
      ) {
        setLoading(false);
        setHasPlan(false);
        setError(null);
        setMorningItems([]);
        setEveningItems([]);
        setRecommendations(null as any);
        clientLogger.log('Рекомендации не найдены (нет профиля) — не показываем ошибку, показываем CTA на анкету');
        return;
      }
      
      // Другие ошибки сохраняем только для классификации. Сырой текст не рендерим.
      setError(error);
      setMorningItems([]);
      setEveningItems([]);
    } finally {
      setLoading(false);
    }
  }, [hasPlan, router, setLoading, setError, setMorningItems, setEveningItems, setHasPlan, setRecommendations, buildRoutineFromPlan]);

  const persistCompletedDay = useCallback(async (
    nextMorningItems: RoutineItem[],
    nextEveningItems: RoutineItem[]
  ) => {
    const isComplete = (items: RoutineItem[]) =>
      items.length > 0 && items.every((item) => item.done);

    if (!isComplete(nextMorningItems) || !isComplete(nextEveningItems)) return;
    if (progressSyncInFlightRef.current) return;

    try {
      const syncedKey = routineProgressSyncedStorageKey();
      if (!syncedKey || window.localStorage.getItem(syncedKey) === 'true') return;
      progressSyncInFlightRef.current = true;

      const progress = await api.getPlanProgress() as {
        currentDay?: number;
        completedDays?: number[];
      };
      const currentDay =
        typeof progress.currentDay === 'number' && progress.currentDay >= 1 && progress.currentDay <= 28
          ? progress.currentDay
          : 1;
      const completedDays = Array.from(new Set([
        ...(Array.isArray(progress.completedDays) ? progress.completedDays : []),
        currentDay,
      ])).sort((a, b) => a - b);

      await api.savePlanProgress(Math.min(currentDay + 1, 28), completedDays);
      window.localStorage.setItem(syncedKey, 'true');
    } catch (error) {
      clientLogger.warn('Не удалось сохранить выполненный день плана:', error);
    } finally {
      progressSyncInFlightRef.current = false;
    }
  }, []);

  const toggleItem = (itemId: string) => {
    // ФИКС #17: персистим в localStorage, чтобы отметки переживали навигацию (ключ — дата+вкладка).
    // ФИКС #9: запрещаем ставить галочку, если предыдущее средство ещё не отмечено
    // (последовательный порядок ухода). При снятии каскадно снимаем последующие шаги.
    const update = (items: RoutineItem[]): RoutineItem[] => {
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx < 0) return items;
      const target = items[idx];
      if (target.done) {
        return items.map((item, i) => (i >= idx && item.done ? { ...item, done: false } : item));
      }

      if (!target.done) {
        const allPriorDone = items.slice(0, idx).every((i) => i.done);
        if (!allPriorDone) return items; // блокируем
      }
      return items.map((item, i) => (i === idx ? { ...item, done: !item.done } : item));
    };
    if (tab === 'AM') {
      setMorningItems((items) => {
        const next = update(items);
        if (next !== items) {
          saveDoneIds('AM', next);
          void persistCompletedDay(next, eveningItems);
        }
        return next;
      });
    } else {
      setEveningItems((items) => {
        const next = update(items);
        if (next !== items) {
          saveDoneIds('PM', next);
          void persistCompletedDay(morningItems, next);
        }
        return next;
      });
    }
  };

  const renderWithPaymentGate = (children: ReactNode) => (
    <PaymentGate
      price={199}
      productCode="plan_access"
      isRetaking={false}
      retakeCta={{ text: 'Изменились цели? Перепройти анкету', href: '/quiz?retakeFromHome=1' }}
      onPaymentComplete={() => {
        clientLogger.log('✅ Payment completed on homepage');
        void loadRecommendations();
      }}
    >
      {children}
    </PaymentGate>
  );

  if (!mounted || loading) {
    return renderWithPaymentGate(<AppLoader fullScreen variant="light" />);
  }

  // Получаем текущие элементы в зависимости от вкладки
  const routineItems = tab === 'AM' ? morningItems : eveningItems;
  
  // План истёк: не показываем отдельный экран — paywall + блюр от PaymentGate.

  if (error && routineItems.length === 0) {
    return renderWithPaymentGate(
      <HomeEmptyState variant="error" rawError={error} onRetry={() => void loadRecommendations()} />,
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
    return renderWithPaymentGate(<HomeEmptyState variant="no-plan" />);
  }

  const completedCount = routineItems.filter((item) => item.done).length;
  const totalCount = routineItems.length;
  const currentStepIndex = routineItems.findIndex(item => !item.done);

  // ИСПРАВЛЕНО: План - это платный продукт, поэтому PaymentGate показывается ВСЕГДА
  // PaymentGate сам проверит статус оплаты через localStorage и БД
  // Если не оплачено - покажет блюр с экраном оплаты
  // Если оплачено - покажет контент без блюра
  return renderWithPaymentGate(
    <div
      className="animate-fade-in home-rd"
      style={{
        minHeight: '100vh',
        paddingBottom: '120px',
      }}
    >
      <style>{`
        /* ФИКС #19: подкрашиваем html/body в цвет финального слоя фона главной,
           чтобы при overscroll/листании (iOS Telegram WebApp) не светилась белая подложка
           там, где контент длиннее экрана. Стиль действует только пока главная смонтирована. */
        html, body { background-color: var(--canvas); }
        /* Фон рисуем на фиксированном псевдо-слое (viewport-anchored), а не через
           background-attachment:fixed — последний не красит весь документ в
           Telegram iOS WebView, из-за чего при листании появлялась пустая/белая
           область. Теперь градиент гарантированно покрывает весь экран. */
        .home-rd{position:relative;}
        .home-rd::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:
          radial-gradient(72% 32% at 0% 0%, rgba(255,224,188,0.7) 0%, transparent 62%),
          radial-gradient(50% 22% at 100% 18%, rgba(213,254,97,0.42) 0%, transparent 70%),
          radial-gradient(64% 26% at 100% 55%, rgba(220,210,196,0.55) 0%, transparent 65%),
          radial-gradient(78% 32% at 10% 92%, rgba(213,254,97,0.46) 0%, transparent 62%),
          var(--canvas);}
        .home-rd .hr-topbar{display:flex;align-items:center;justify-content:space-between;padding:8px 20px 14px;}
        .home-rd .hr-logo{font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:18px;font-weight:700;letter-spacing:-0.4px;color:var(--ink);}
        .home-rd .hr-avatar{position:relative;width:40px;height:40px;border:0;padding:0;border-radius:50%;background:linear-gradient(135deg,#2A2A2A,var(--ink));color:var(--accent);display:grid;place-items:center;cursor:pointer;box-shadow:0 0 0 2px rgba(255,255,255,0.9),0 6px 18px rgba(10,10,10,0.18);font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:700;}
        .home-rd .hr-avatar::after{content:"";position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;background:var(--accent);border:2px solid var(--canvas);}
        .home-rd .hr-heading{padding:0 20px 14px;}
        .home-rd .hr-intro{font-size:13px;font-weight:600;color:var(--ink-soft);margin-bottom:6px;}
        .home-rd .hr-title{font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:26px;font-weight:700;color:var(--ink);line-height:1.15;letter-spacing:-0.6px;}
        .home-rd .hr-bento{display:grid;grid-template-columns:minmax(0,0.85fr) minmax(0,1.15fr);gap:10px;padding:0 20px 14px;}
        .home-rd .hr-streak{position:relative;overflow:hidden;padding:14px 14px 12px;border-radius:22px;border:1px solid rgba(255,255,255,0.06);background:radial-gradient(120% 80% at 100% 0%,rgba(213,254,97,0.22) 0%,transparent 60%),var(--ink);color:#fff;min-height:102px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 14px 32px rgba(10,10,10,0.18);}
        .home-rd .hr-streak::before{content:"";position:absolute;top:-34px;right:-28px;width:110px;height:110px;background:radial-gradient(circle,rgba(213,254,97,0.32) 0%,transparent 70%);}
        .home-rd .hr-streak-head{position:relative;display:flex;align-items:center;gap:6px;color:rgba(255,255,255,0.6);font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;}
        .home-rd .hr-streak-num{position:relative;font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:38px;line-height:1;font-weight:700;letter-spacing:-1.5px;color:var(--accent);}
        .home-rd .hr-streak-unit{font-size:12.5px;font-weight:600;color:rgba(255,255,255,0.78);}
        .home-rd .hr-streak-foot{position:relative;color:rgba(255,255,255,0.42);font-size:11px;}
        .home-rd .hr-progress{position:relative;overflow:hidden;min-height:102px;display:flex;flex-direction:column;justify-content:space-between;background:var(--glass-bg-strong);}
        .home-rd .hr-progress-head{display:flex;align-items:center;justify-content:space-between;}
        .home-rd .hr-progress-label{color:var(--ink-soft);font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;}
        .home-rd .hr-progress-count{font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;font-weight:700;color:var(--ink);letter-spacing:-0.2px;}
        .home-rd .hr-progress-count em{font-style:normal;color:var(--ink-mute);}
        .home-rd .hr-progress-text{font-size:12.5px;font-weight:600;color:var(--ink);line-height:1.32;letter-spacing:-0.1px;}
        .home-rd .hr-bar{position:relative;width:100%;height:8px;border-radius:999px;background:rgba(10,10,10,0.08);overflow:hidden;}
        .home-rd .hr-bar-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:var(--ink);transition:width .4s ease;}
        .home-rd .hr-tabs{display:flex;gap:0;margin:0 20px 16px;padding:5px;border:1px solid var(--glass-border);border-radius:10px;background:var(--glass-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:var(--glass-shadow);}
        .home-rd .hr-tab{flex:1;min-height:46px;border:0;border-radius:10px;background:transparent;color:var(--ink-soft);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:700;transition:all .18s ease;}
        .home-rd .hr-tab.active{background:rgba(255,255,255,0.95);color:var(--ink);box-shadow:0 4px 14px rgba(0,0,0,0.06),inset 0 1px 0 rgba(255,255,255,0.9);}
        .home-rd .hr-tab svg{width:16px;height:16px;}
        .home-rd .hr-section-head{display:flex;flex-direction:column;margin:0 22px 12px;}
        .home-rd .hr-section-title{font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:16px;font-weight:700;letter-spacing:-0.3px;color:var(--ink);}
        .home-rd .hr-section-sub{margin-top:3px;color:var(--ink-soft);font-size:12px;}
        .home-rd .hr-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:0 18px 8px;}
        .home-rd .hr-card{position:relative;min-height:248px;display:flex;flex-direction:column;padding:14px 14px 16px;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,opacity .16s ease;}
        .home-rd .hr-card.current{border-color:rgba(10,10,10,0.08);background:radial-gradient(120% 70% at 0% 0%,rgba(255,255,255,0.45) 0%,transparent 60%),var(--accent);box-shadow:0 14px 34px rgba(213,254,97,0.38),0 10px 28px rgba(0,0,0,0.06);backdrop-filter:none;-webkit-backdrop-filter:none;}
        .home-rd .hr-card.done{opacity:0.78;}
        .home-rd .hr-card:active{transform:scale(0.985);}
        .home-rd .hr-card-top{display:flex;align-items:flex-start;justify-content:space-between;min-height:32px;}
        .home-rd .hr-stepdot{width:32px;height:32px;border:0;border-radius:12px;display:grid;place-items:center;background:rgba(10,10,10,0.08);color:var(--ink);cursor:pointer;font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:12px;font-weight:700;line-height:1;letter-spacing:-0.3px;transition:background .16s ease,transform .12s ease;}
        .home-rd .hr-stepdot:active{transform:scale(0.92);}
        .home-rd .hr-card.current .hr-stepdot{background:var(--ink);color:var(--accent);box-shadow:0 6px 14px rgba(10,10,10,0.18);}
        .home-rd .hr-card.done .hr-stepdot{background:var(--accent);color:var(--ink);}
        /* Средства показываем без декоративной подложки, чтобы карточки оставались легче. */
        .home-rd .hr-iconwrap{position:relative;flex:1;display:flex;align-items:center;justify-content:center;padding:16px 8px 12px;min-height:148px;}
        .home-rd .hr-icon{position:relative;z-index:1;display:block;width:96px;height:132px;object-fit:contain;filter:drop-shadow(0 12px 14px rgba(0,0,0,0.12));}
        /* ФИКС: убираем mix-blend-mode на лайм-карточке — multiply красил крем в лайм.
           На обычных карточках оставляем мягкий multiply, чтобы крем «вплавился» в белый фон. */
        .home-rd .hr-icon.blend{mix-blend-mode:multiply;filter:none;}
        .home-rd .hr-card.current .hr-icon.blend{mix-blend-mode:normal;filter:drop-shadow(0 12px 14px rgba(0,0,0,0.12));}
        .home-rd .hr-card-bottom{margin-top:auto;}
        .home-rd .hr-kicker{margin-bottom:5px;font-size:9.5px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(10,10,10,0.42);}
        .home-rd .hr-card.current .hr-kicker{color:var(--ink);}
        .home-rd .hr-card.done .hr-kicker{color:rgba(10,10,10,0.32);}
        .home-rd .hr-itemtitle{margin-bottom:4px;font-size:15px;font-weight:700;color:var(--ink);line-height:1.18;letter-spacing:-0.1px;}
        .home-rd .hr-card.done .hr-itemtitle{text-decoration:line-through;text-decoration-color:rgba(10,10,10,0.32);}
        .home-rd .hr-itemsub{color:var(--ink-soft);font-size:11.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
        .home-rd .hr-retake{width:100%;background:transparent;border:none;color:var(--ink-soft);text-decoration:underline;cursor:pointer;font-size:13px;font-weight:600;padding:14px 0 4px;}
      `}</style>
      {/* Topbar */}
      <div className="hr-topbar">
        <div className="hr-logo">SkinIQ</div>
        <button className="hr-avatar" aria-label="Профиль" onClick={() => router.push('/profile')}>
          {(userName?.[0] || 'S').toUpperCase()}
        </button>
      </div>

      {/* Heading */}
      <div className="hr-heading">
        {userName && (
          <div className="hr-intro">
            {(() => {
              const hour = new Date().getHours();
              const greeting = hour >= 6 && hour < 18 ? 'Добрый день' : 'Добрый вечер';
              return `${greeting}, ${userName}`;
            })()}
          </div>
        )}
        <div className="hr-title">Уход на&nbsp;сегодня</div>
      </div>

      {/* Progress bento */}
      {totalCount > 0 && (() => {
        const remaining = totalCount - completedCount;
        const ratio = totalCount > 0 ? completedCount / totalCount : 0;
        const remText =
          remaining === 0
            ? 'Все шаги выполнены сегодня'
            : `Осталось ${remaining} ${remaining === 1 ? 'шаг' : remaining < 5 ? 'шага' : 'шагов'}`;
        return (
          <div className="hr-bento">
            <div className="hr-streak">
              <div className="hr-streak-head">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8.5 14.5A3.5 3.5 0 0 0 12 18a3.5 3.5 0 0 0 3.5-3.5c0-2.5-3.5-4.2-3.5-7.5-1.9 1.3-4.5 3.8-4.5 7.5Z"/>
                  <path d="M12 2C8.2 5.2 5 8.8 5 13a7 7 0 0 0 14 0c0-3.8-2.3-6.6-4.8-9.1"/>
                </svg>
                Сегодня
              </div>
              <div>
                <span className="hr-streak-num">{completedCount}</span>
                <span className="hr-streak-unit">&nbsp;из {totalCount}</span>
              </div>
              <div className="hr-streak-foot">{tab === 'AM' ? 'Утренний уход' : 'Вечерний уход'}</div>
            </div>
            <div className="hr-progress glass-card-sm">
              <div className="hr-progress-head">
                <span className="hr-progress-label">Прогресс</span>
                <span className="hr-progress-count">{completedCount}<em>/{totalCount}</em></span>
              </div>
              <div className="hr-progress-text">{remText}</div>
              <div className="hr-bar">
                <div className="hr-bar-fill" style={{ width: `${Math.max(6, ratio * 100)}%` }} />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Toggle AM/PM */}
      <div className="hr-tabs">
        <button className={`hr-tab${tab === 'AM' ? ' active' : ''}`} onClick={() => setTab('AM')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
          Утро
        </button>
        <button className={`hr-tab${tab === 'PM' ? ' active' : ''}`} onClick={() => setTab('PM')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>
          </svg>
          Вечер
        </button>
      </div>

      {/* Section head */}
      <div className="hr-section-head">
        <div className="hr-section-title">{tab === 'AM' ? 'Утренний уход' : 'Вечерний уход'}</div>
        <div className="hr-section-sub">Нажмите, чтобы отметить шаг</div>
      </div>

      {/* Routine grid */}
      <div className="hr-grid">
        {routineItems.map((item, index) => {
          const isCurrentStep = !item.done && index === currentStepIndex;
          const cls = `hr-card glass-card-sm${isCurrentStep ? ' current' : ''}${item.done ? ' done' : ''}`;
          const isBlend = (item.icon || '').includes('cream');
          return (
            <div key={item.id} className={cls} onClick={() => toggleItem(item.id)}>
              <div className="hr-card-top">
                <button
                  className="hr-stepdot"
                  aria-label={item.done ? 'Снять отметку' : 'Отметить шаг'}
                  onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
                >
                  {item.done ? (
                    <svg width="13" height="10" viewBox="0 0 14 10" fill="none">
                      <path d="M1 5l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    index + 1
                  )}
                </button>
              </div>

              <div className="hr-iconwrap">
                <img
                  className={`hr-icon${isBlend ? ' blend' : ''}`}
                  src={item.icon}
                  alt=""
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>

              <div className="hr-card-bottom">
                <div className="hr-kicker">{isCurrentStep ? 'Сейчас' : `Шаг ${index + 1}`}</div>
                <div className="hr-itemtitle">{item.title}</div>
                <div className="hr-itemsub">{item.subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>

    </div>,
  );
}
