// app/(miniapp)/home/page.tsx
// Главная страница мини-аппа (рутина ухода) - перенесена из page.tsx

'use client';

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';
import { PaymentGate } from '@/components/PaymentGate';
import { getBaseStepFromStepCategory } from '@/lib/plan-helpers';
import { TabLoadingShell } from '@/components/TabLoadingShell';
import { HomeEmptyState } from '@/components/HomeEmptyState';
import { ProfileAvatarButton } from '@/components/ProfileAvatarButton';
import { getStepMeta, STEP_ICONS } from '@/lib/routine-step-meta';
import { getClientUserScope } from '@/lib/client-user-scope';
import { resolvePlanPaywall, resolvePlanRetakeHref, hasWinbackOfferParam } from '@/lib/paywall-product';
interface RoutineItem {
  id: string;
  title: string;
  subtitle: string;
  brand?: string;
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
  oil: '/icons/oil_green.png',
  mask: '/icons/mask_green.png',
};

function readProductBrand(product: any): string | undefined {
  const brand = product?.brand;
  if (!brand) return undefined;
  if (typeof brand === 'string') return brand;
  if (typeof brand?.name === 'string') return brand.name;
  return undefined;
}

function readProductName(product: any, fallback: string): string {
  return typeof product?.name === 'string' && product.name.trim() ? product.name : fallback;
}

const HOME_BACKGROUND = 'var(--canvas)';

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
  const [planExpired, setPlanExpired] = useState(false); // Плану 28+ дней; цену выбираем отдельно по hasPaidBefore
  const [hasPaidBefore, setHasPaidBefore] = useState(false);
  const [howtoItem, setHowtoItem] = useState<RoutineItem | null>(null); // Bottom-sheet «как наносить»
  const searchParams = useSearchParams();
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
          if (plan?.hasPaidBefore === true) {
            setHasPaidBefore(true);
          }
          
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
      setHasPaidBefore(plan?.hasPaidBefore === true);

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
            const baseStep = getBaseStepFromStepCategory(step.stepCategory);
            const meta = getStepMeta(baseStep, time);
            if (!meta) return;

            // Шаг без продукта, но с ручной инструкцией (напр. утреннее умывание тёплой
            // водой для чувствительной/розацеа-кожи). Раньше такие шаги молча выпадали
            // из дневной рутины (productId === null), и юзер не видел инструкцию.
            if (!productId) {
              if (step.manualLabel || step.instruction) {
                items.push({
                  id: `${time}-${baseStep}-${idx}-manual`,
                  ...meta,
                  subtitle: step.manualLabel || meta.title,
                  howto: step.instruction
                    ? { steps: [step.instruction], volume: '', tip: '' }
                    : meta.howto,
                  done: false,
                });
              }
              return;
            }

            const product = getProduct(productId);
            if (!product) return;

            items.push({
              id: `${time}-${baseStep}-${idx}-${productId}`,
              ...meta,
              subtitle: readProductName(product, meta.title),
              brand: readProductBrand(product),
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
              subtitle: readProductName(product, meta.title),
              brand: readProductBrand(product),
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
      setHasPaidBefore(data?.hasPaidBefore === true);
      
      // Если план истёк (28+ дней) — показываем понятный экран с предложением перепройти анкету
      // (после перепрохождения в конце снова будет оплата/гейт).
      if (data?.expired === true) {
        // План истёк: оставляем UX на месте (не редиректим),
        // строим рутину из plan28 и показываем блюр через PaymentGate.
        setPlanExpired(true);
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

      setPlanExpired(false);
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
        brand?: string,
        overrides: Partial<Pick<RoutineItem, 'title' | 'icon' | 'howto'>> = {},
      ) => {
        const meta = getStepMeta(baseStep, time);
        if (!meta) return;
        items.push({ id, ...meta, ...overrides, subtitle, brand, done: false });
      };
      
      // Утреннее умывание только тёплой водой для чувствительной/розацеа-кожи:
      // дерматологи рекомендуют пропускать ПАВ-очищение утром. Розацеа/атопик после
      // фикса риск-сигналов поднимают sensitivityLevel до high, поэтому ориентируемся
      // на него (profile_summary уже приходит в ответе рекомендаций).
      const morningWaterOnlyCleanse = ['high', 'very_high'].includes(
        String(data?.profile_summary?.sensitivityLevel || '').toLowerCase()
      );

      // УТРЕННЯЯ РУТИНА
      if (data?.steps?.cleanser) {
        if (morningWaterOnlyCleanse) {
          addRoutineItem(morning, 'morning-cleanser', 'cleanser', 'AM', 'Умывание тёплой водой', undefined, {
            howto: {
              steps: ['Умойтесь тёплой (не горячей) водой', 'Промокните кожу мягким полотенцем'],
              volume: 'Без очищающего средства',
              tip: 'При чувствительной коже/розацеа утром лучше без ПАВ-очищения — только вода. Полноценное очищение оставляем на вечер.',
            },
          });
        } else {
          addRoutineItem(
            morning,
            'morning-cleanser',
            'cleanser',
            'AM',
            readProductName(data.steps.cleanser[0], 'Очищающее средство'),
            readProductBrand(data.steps.cleanser[0]),
          );
        }
      }
      
      if (data?.steps?.toner) {
        addRoutineItem(morning, 'morning-toner', 'toner', 'AM', readProductName(data.steps.toner[0], 'Тоник'), readProductBrand(data.steps.toner[0]));
      }
      
      if (data?.steps?.treatment) {
        addRoutineItem(morning, 'morning-active', 'treatment', 'AM', readProductName(data.steps.treatment[0], 'Активное средство'), readProductBrand(data.steps.treatment[0]));
      }
      
      if (data?.steps?.moisturizer) {
        addRoutineItem(morning, 'morning-cream', 'moisturizer', 'AM', readProductName(data.steps.moisturizer[0], 'Увлажняющий крем'), readProductBrand(data.steps.moisturizer[0]));
      }
      
      if (data?.steps?.spf) {
        addRoutineItem(morning, 'morning-spf', 'spf', 'AM', readProductName(data.steps.spf[0], 'SPF 50'), readProductBrand(data.steps.spf[0]));
      }
      
      // ИСПРАВЛЕНО: Добавляем бальзам для губ утром для всех
      if (data?.steps?.lip_care) {
        addRoutineItem(morning, 'morning-lip-balm', 'lip_care', 'AM', readProductName(data.steps.lip_care[0], 'Бальзам для губ'), readProductBrand(data.steps.lip_care[0]));
      }
      
      // ВЕЧЕРНЯЯ РУТИНА
      if (data?.steps?.cleanser) {
        addRoutineItem(evening, 'evening-cleanser', 'cleanser', 'PM', readProductName(data.steps.cleanser[0], 'Двойное очищение'), readProductBrand(data.steps.cleanser[0]), {
          howto: {
            steps: ['1) Масло: сухими руками распределить, эмульгировать водой', '2) Гель: умыть 30–40 сек, смыть'],
            volume: '1–2 дозы масла + 1–2 пшика геля',
            tip: 'Двойное очищение — в дни макияжа/кислот.',
          },
        });
      }
      
      if (data?.steps?.treatment || data?.steps?.acid) {
        const acidProduct = data.steps?.treatment?.[0] || data.steps?.acid?.[0];
        addRoutineItem(evening, 'evening-acid', 'treatment', 'PM', readProductName(acidProduct, 'AHA/BHA/PHА пилинг'), readProductBrand(acidProduct), {
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
        const serumProduct = data.steps?.treatment?.[0] || data.steps?.serum?.[0];
        addRoutineItem(evening, 'evening-serum', 'serum', 'PM', readProductName(serumProduct, 'Пептидная / успокаивающая'), readProductBrand(serumProduct));
      }
      
      if (data?.steps?.moisturizer) {
        addRoutineItem(evening, 'evening-cream', 'moisturizer', 'PM', readProductName(data.steps.moisturizer[0], 'Питательный крем'), readProductBrand(data.steps.moisturizer[0]));
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
      {...resolvePlanPaywall({
        expired: planExpired,
        hasPaidBefore,
        winbackOffer: hasWinbackOfferParam(searchParams?.toString()),
      })}
      isRetaking={false}
      retakeCta={{ text: 'Изменились цели? Перепройти анкету', href: resolvePlanRetakeHref(hasPaidBefore) }}
      onPaymentComplete={() => {
        clientLogger.log('✅ Payment completed on homepage');
        void loadRecommendations();
      }}
    >
      {children}
    </PaymentGate>
  );

  if (!mounted || loading) {
    return renderWithPaymentGate(<TabLoadingShell title="Уход на сегодня" background={HOME_BACKGROUND} />);
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
  const morningCompletedCount = morningItems.filter((item) => item.done).length;
  const eveningCompletedCount = eveningItems.filter((item) => item.done).length;
  const dayCompletedCount = morningCompletedCount + eveningCompletedCount;
  const dayTotalCount = morningItems.length + eveningItems.length;
  const dayPct = dayTotalCount > 0 ? Math.round((dayCompletedCount / dayTotalCount) * 100) : 0;
  const routinePct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const routineLabel = tab === 'AM' ? 'Утренний уход' : 'Вечерний уход';
  const routineSubText =
    totalCount === 0
      ? 'Нет шагов на это время'
      : completedCount === totalCount
        ? `${routineLabel} завершён`
        : `Осталось ${totalCount - completedCount} ${
            totalCount - completedCount === 1 ? 'шаг' : totalCount - completedCount < 5 ? 'шага' : 'шагов'
          }`;

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
        html, body { background-color: var(--canvas); }
        /* Фон рисуем на фиксированном псевдо-слое (viewport-anchored), а не через
           background-attachment:fixed — последний не красит весь документ в
           Telegram iOS WebView. */
        .home-rd{position:relative;isolation:isolate;--hr-radius-control:12px;--hr-radius-toggle:16px;--hr-radius-panel:20px;--hr-radius-card:24px;--hr-radius-sheet:28px;--hr-radius-pill:999px;}
        .home-rd::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background:var(--canvas);}
        .home-rd > *{position:relative;z-index:1;}
        .home-rd .hr-topbar{display:flex;align-items:center;justify-content:space-between;padding:8px 20px 14px;}
        .home-rd .hr-logo{font-family:var(--font-inter),-apple-system,BlinkMacSystemFont,sans-serif;font-size:18px;font-weight:500;letter-spacing:0;color:var(--ink);text-transform:lowercase;}
        .home-rd .hr-avatar{position:relative;width:40px;height:40px;border:0;padding:0;border-radius:50%;background:linear-gradient(135deg,#2A2A2A,var(--ink));color:var(--accent);display:grid;place-items:center;cursor:pointer;box-shadow:0 0 0 2px rgba(255,255,255,0.9),0 6px 18px rgba(10,10,10,0.18);font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:600;}
        .home-rd .hr-avatar::after{content:"";position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;background:var(--accent);border:2px solid var(--canvas);}
        .home-rd .hr-heading{padding:0 20px 14px;}
        .home-rd .hr-intro{font-family:var(--font-inter),-apple-system,BlinkMacSystemFont,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:7px;}
        .home-rd .hr-title{font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:30px;font-weight:700;color:var(--ink);line-height:1.08;letter-spacing:-0.9px;}
        .home-rd .hr-progress-card{position:relative;overflow:hidden;margin:0 20px 12px;padding:15px 18px 14px;border-radius:var(--hr-radius-card);border:1px solid rgba(255,255,255,0.07);color:#fff;background:#111;box-shadow:0 16px 36px rgba(10,10,10,0.19);min-height:128px;}
        .home-rd .hr-progress-card::after{content:"";position:absolute;top:0;right:0;width:90px;height:100%;background:linear-gradient(90deg, transparent, rgba(213,254,97,0.12));pointer-events:none;}
        .home-rd .hr-progress-head{position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;}
        .home-rd .hr-eyebrow{color:rgba(255,255,255,0.5);font-size:9px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;}
        .home-rd .hr-progress-value{margin-top:7px;color:var(--accent);font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:24px;font-weight:700;letter-spacing:-1px;line-height:1;}
        .home-rd .hr-progress-sub{margin-top:5px;color:rgba(255,255,255,0.64);font-size:12px;font-weight:500;}
        .home-rd .hr-progress-badge{position:relative;z-index:1;width:60px;height:60px;flex-shrink:0;display:grid;place-items:center;border:1px solid rgba(213,254,97,0.22);border-radius:50%;color:var(--accent);background:rgba(255,255,255,0.04);font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:600;}
        .home-rd .hr-track{position:relative;height:7px;margin-top:14px;overflow:hidden;border-radius:var(--hr-radius-pill);background:rgba(255,255,255,0.1);}
        .home-rd .hr-fill{position:absolute;left:0;top:0;bottom:0;border-radius:inherit;background:var(--accent);transition:width 0.28s ease;}
        .home-rd .hr-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 20px 16px;padding:5px;border:0;border-radius:var(--hr-radius-toggle);background:rgba(10,10,10,0.05);box-shadow:none;}
        .home-rd .hr-tab{min-height:42px;border:0;border-radius:var(--hr-radius-control);background:transparent;color:var(--ink-soft);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;font-size:14px;font-weight:600;transition:background .16s ease,color .16s ease;}
        .home-rd .hr-tab.active{background:#fff;color:var(--ink);box-shadow:0 1px 2px rgba(10,10,10,0.03),0 8px 20px -12px rgba(10,10,10,0.08);}
        .home-rd .hr-tab svg{width:16px;height:16px;}
        .home-rd .hr-routine-card{display:flex;align-items:center;gap:12px;margin:0 20px 16px;padding:13px 14px;border-radius:var(--hr-radius-panel);border:1px solid var(--glass-border);background:#fff;box-shadow:var(--glass-shadow);}
        .home-rd .hr-routine-icon{width:42px;height:42px;flex-shrink:0;border-radius:50%;display:grid;place-items:center;background:var(--accent);color:var(--ink);box-shadow:0 8px 18px rgba(213,254,97,0.3);}
        .home-rd .hr-routine-icon svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
        .home-rd .hr-routine-copy{flex:1;min-width:0;}
        .home-rd .hr-routine-label{font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink-soft);}
        .home-rd .hr-routine-value{margin-top:3px;font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:16px;font-weight:700;letter-spacing:-0.35px;color:var(--ink);}
        .home-rd .hr-routine-sub{margin-top:2px;font-size:12px;font-weight:500;color:var(--ink-soft);}
        .home-rd .hr-routine-pct{width:48px;height:48px;flex-shrink:0;display:grid;place-items:center;border-radius:50%;background:rgba(10,10,10,0.06);font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:12px;font-weight:700;color:var(--ink);}
        .home-rd .hr-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px;}
        .home-rd .hr-section-title{font-family:var(--font-inter),-apple-system,BlinkMacSystemFont,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink-soft);}
        .home-rd .hr-section-note{color:var(--ink-soft);font-size:11px;font-weight:500;}
        .home-rd .hr-featured-wrap{padding:0 20px 16px;}
        .home-rd .hr-featured{position:relative;overflow:hidden;padding:16px 18px 72px;border-radius:var(--hr-radius-card);border:1px solid var(--glass-border);background:radial-gradient(110% 120% at 96% 100%, rgba(var(--accent-rgb),0.44) 0%, rgba(var(--accent-rgb),0.22) 38%, transparent 66%), #fff;box-shadow:0 1px 2px rgba(10,10,10,0.03),0 14px 30px -18px rgba(10,10,10,0.16);min-height:222px;}
        .home-rd .hr-chip{display:inline-flex;align-items:center;min-height:24px;padding:0 10px;border-radius:var(--hr-radius-pill);color:var(--ink);background:var(--accent);font-size:9.5px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;}
        .home-rd .hr-featured-product{position:absolute;top:18px;right:18px;width:108px;height:118px;object-fit:contain;filter:drop-shadow(0 13px 14px rgba(0,0,0,0.14));pointer-events:none;}
        .home-rd .hr-featured-product.blend{mix-blend-mode:multiply;filter:drop-shadow(0 8px 10px rgba(0,0,0,0.08));}
        .home-rd .hr-featured-copy{position:relative;z-index:1;width:58%;margin-top:30px;}
        .home-rd .hr-featured-title{margin-bottom:6px;font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:18px;font-weight:600;line-height:1.18;letter-spacing:-0.5px;color:var(--ink);}
        .home-rd .hr-featured-brand{margin-bottom:3px;color:var(--ink-soft);font-size:10px;font-weight:800;letter-spacing:0.09em;text-transform:uppercase;line-height:1.2;}
        .home-rd .hr-featured-sub{color:var(--ink-soft);font-size:12.5px;line-height:1.4;font-weight:400;}
        .home-rd .hr-featured-actions{position:absolute;right:16px;bottom:14px;left:16px;display:flex;align-items:center;gap:8px;z-index:2;}
        .home-rd .hr-featured-action{flex:1;height:44px;border:0;border-radius:var(--hr-radius-pill);color:#fff;background:var(--ink);cursor:pointer;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;transition:transform 0.14s ease,opacity 0.14s ease;}
        .home-rd .hr-featured-action:active{transform:scale(0.985);}
        .home-rd .hr-featured-action.done{color:var(--ink);background:var(--accent);}
        .home-rd .hr-howto-icon-btn{width:44px;height:44px;flex:0 0 44px;border:1px solid rgba(10,10,10,0.1);border-radius:50%;background:rgba(255,255,255,0.82);color:var(--ink);display:grid;place-items:center;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,0.76);transition:transform .14s ease,background .14s ease;}
        .home-rd .hr-howto-icon-btn:active{transform:scale(0.94);background:#fff;}
        .home-rd .hr-howto-icon-btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
        .home-rd .hr-undo{margin:-6px 20px 14px;display:flex;justify-content:center;}
        .home-rd .hr-undo button{background:transparent;border:0;padding:6px 10px;color:var(--ink-soft);font-size:12px;font-weight:500;text-decoration:underline;cursor:pointer;}
        .home-rd .hr-next-heading{font-family:var(--font-inter),-apple-system,BlinkMacSystemFont,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink-soft);margin:0 20px 10px;}
        .home-rd .hr-next-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:0 20px 8px;}
        .home-rd .hr-next-card{position:relative;overflow:hidden;min-height:164px;padding:12px;border-radius:var(--hr-radius-panel);border:1px solid var(--glass-border);background:#fff;box-shadow:var(--glass-shadow);cursor:default;}
        .home-rd .hr-next-top{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;}
        .home-rd .hr-next-kicker{color:var(--ink-mute);font-size:9px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;}
        .home-rd .hr-next-number{width:24px;height:24px;display:grid;place-items:center;border-radius:var(--hr-radius-control);color:var(--ink);background:rgba(10,10,10,0.07);font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:9px;font-weight:600;}
        .home-rd .hr-next-product{position:absolute;top:32px;right:12px;left:12px;width:calc(100% - 24px);height:78px;object-fit:contain;filter:drop-shadow(0 9px 10px rgba(0,0,0,0.1));pointer-events:none;}
        .home-rd .hr-next-product.blend{mix-blend-mode:multiply;filter:none;}
        .home-rd .hr-next-copy{position:absolute;right:12px;bottom:12px;left:12px;}
        .home-rd .hr-next-brand{margin-bottom:2px;color:var(--ink-soft);font-size:8.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .home-rd .hr-next-title{font-size:13px;font-weight:600;line-height:1.2;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
        .home-rd .hr-retake{width:100%;background:transparent;border:none;color:var(--ink-soft);text-decoration:underline;cursor:pointer;font-size:13px;font-weight:500;padding:14px 0 4px;}
        .home-rd .hr-next-card.tappable{cursor:pointer;}
        .home-rd .hr-next-card.tappable:active{transform:scale(0.98);}
        .hr-sheet-backdrop{position:fixed;inset:0;z-index:60;background:rgba(10,10,10,0.42);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);display:flex;align-items:flex-end;justify-content:center;animation:hrFade .18s ease;}
        @keyframes hrFade{from{opacity:0;}to{opacity:1;}}
        .hr-sheet{width:100%;max-width:520px;max-height:84vh;overflow-y:auto;background:var(--canvas);border-radius:var(--hr-radius-sheet) var(--hr-radius-sheet) 0 0;padding:10px 22px calc(28px + env(safe-area-inset-bottom)) 22px;box-shadow:0 -16px 40px rgba(10,10,10,0.22);animation:hrSlide .24s cubic-bezier(0.22,1,0.36,1);}
        @keyframes hrSlide{from{transform:translateY(100%);}to{transform:translateY(0);}}
        .hr-sheet-grab{width:42px;height:4px;border-radius:var(--hr-radius-pill);background:rgba(10,10,10,0.16);margin:0 auto 16px;}
        .hr-sheet-head{display:flex;align-items:center;gap:13px;margin-bottom:18px;}
        .hr-sheet-ic{flex:0 0 auto;width:50px;height:50px;border-radius:var(--hr-radius-toggle);background:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.85);display:grid;place-items:center;}
        .hr-sheet-ic img{width:70%;height:70%;object-fit:contain;}
        .hr-sheet-kicker{font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;}
        .hr-sheet-title{font-family:var(--font-unbounded),-apple-system,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.4px;color:#0A0A0A;line-height:1.15;margin-top:2px;}
        .hr-sheet-steps{list-style:none;margin:0 0 18px;padding:0;display:flex;flex-direction:column;gap:10px;counter-reset:hrstep;}
        .hr-sheet-steps li{position:relative;padding-left:38px;font-size:14px;line-height:1.4;color:#1F2937;}
        .hr-sheet-steps li::before{counter-increment:hrstep;content:counter(hrstep);position:absolute;left:0;top:-1px;width:26px;height:26px;border-radius:50%;background:#0A0A0A;color:#D5FE61;display:grid;place-items:center;font-size:12px;font-weight:800;}
        .hr-sheet-vol{display:inline-flex;align-items:center;gap:7px;background:rgba(213,254,97,0.4);border:1px solid rgba(10,10,10,0.06);border-radius:var(--hr-radius-pill);padding:8px 14px;font-size:12px;font-weight:700;color:#0A0A0A;margin-bottom:16px;}
        .hr-sheet-tip{display:flex;gap:11px;padding:14px 15px;border-radius:var(--hr-radius-panel);background:rgba(255,255,255,0.72);border:1px solid rgba(255,255,255,0.85);}
        .hr-sheet-tip-ic{flex:0 0 auto;width:28px;height:28px;border-radius:50%;background:#0A0A0A;display:grid;place-items:center;font-size:15px;}
        .hr-sheet-tip-tx{font-size:12.5px;line-height:1.42;color:#374151;}
        .hr-sheet-tip-tx strong{display:block;font-weight:800;color:#0A0A0A;margin-bottom:2px;font-size:11px;letter-spacing:0.04em;text-transform:uppercase;}
        .hr-sheet-close{width:100%;margin-top:20px;height:48px;border:0;border-radius:var(--hr-radius-pill);background:#0A0A0A;color:#fff;font-family:var(--font-inter),sans-serif;font-size:15px;font-weight:700;cursor:pointer;}
        .hr-sheet-close:active{transform:scale(0.99);}
      `}</style>
      {/* Topbar */}
      <div className="hr-topbar">
        <div className="hr-logo">skiniq</div>
        <ProfileAvatarButton className="hr-avatar" />
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

      {/* Dark progress card */}
      {dayTotalCount > 0 && (() => {
        const dayRemaining = dayTotalCount - dayCompletedCount;
        const subText =
          dayRemaining === 0
            ? 'Уход на сегодня завершён'
            : `Утро ${morningCompletedCount}/${morningItems.length} · вечер ${eveningCompletedCount}/${eveningItems.length}`;
        return (
          <section className="hr-progress-card" aria-label="Прогресс ухода на сегодня">
            <div className="hr-progress-head">
              <div>
                <div className="hr-eyebrow">Прогресс дня</div>
                <div className="hr-progress-value">{dayCompletedCount} из {dayTotalCount} шагов</div>
                <div className="hr-progress-sub">{subText}</div>
              </div>
              <div className="hr-progress-badge">{dayPct}%</div>
            </div>
            <div className="hr-track">
              <div className="hr-fill" style={{ width: `${Math.max(4, dayPct)}%` }} />
            </div>
          </section>
        );
      })()}

      {/* Toggle AM/PM */}
      <div className="hr-tabs" role="tablist" aria-label="Время ухода">
        <button
          className={`hr-tab${tab === 'AM' ? ' active' : ''}`}
          role="tab"
          aria-selected={tab === 'AM'}
          onClick={() => setTab('AM')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
          Утро
        </button>
        <button
          className={`hr-tab${tab === 'PM' ? ' active' : ''}`}
          role="tab"
          aria-selected={tab === 'PM'}
          onClick={() => setTab('PM')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>
          </svg>
          Вечер
        </button>
      </div>

      {totalCount > 0 && (
        <section className="hr-routine-card" aria-label={routineLabel}>
          <div className="hr-routine-icon" aria-hidden>
            {tab === 'AM' ? (
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
              </svg>
            )}
          </div>
          <div className="hr-routine-copy">
            <div className="hr-routine-label">{routineLabel}</div>
            <div className="hr-routine-value">{completedCount} из {totalCount} шагов</div>
            <div className="hr-routine-sub">{routineSubText}</div>
          </div>
          <div className="hr-routine-pct">{routinePct}%</div>
        </section>
      )}

      {/* Featured (current) step */}
      {(() => {
        const isFinished = currentStepIndex < 0;
        const currentItem = !isFinished ? routineItems[currentStepIndex] : null;
        const currentStepNumber = !isFinished ? currentStepIndex + 1 : routineItems.length;
        const lastDoneIdx = (() => {
          for (let i = routineItems.length - 1; i >= 0; i -= 1) {
            if (routineItems[i].done) return i;
          }
          return -1;
        })();
        const featuredIcon = currentItem?.icon || (lastDoneIdx >= 0 ? routineItems[lastDoneIdx].icon : '');
        const featuredBlend = (featuredIcon || '').includes('cream');
        const handleMarkStep = () => {
          if (isFinished) return;
          if (!currentItem) return;
          toggleItem(currentItem.id);
        };
        return (
          <>
            <section className="hr-featured-wrap" aria-label="Текущий шаг">
              <div className="hr-section-head">
                <div className="hr-section-title">{isFinished ? 'Готово' : 'Сейчас'}</div>
                {!isFinished && <div className="hr-section-note">Следуйте плану по порядку</div>}
              </div>
              <article className="hr-featured">
                <span className="hr-chip">{isFinished ? 'Готово' : `Шаг ${currentStepNumber}`}</span>
                {featuredIcon && (
                  <img
                    className={`hr-featured-product${featuredBlend ? ' blend' : ''}`}
                    src={featuredIcon}
                    alt=""
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className="hr-featured-copy">
                  <div className="hr-featured-title">
                    {isFinished ? 'Уход завершён' : currentItem?.title}
                  </div>
                  {!isFinished && currentItem?.brand && (
                    <div className="hr-featured-brand">{currentItem.brand}</div>
                  )}
                  <div className="hr-featured-sub">
                    {isFinished ? 'Кожа получила всё необходимое' : currentItem?.subtitle}
                  </div>
                </div>
                <div className="hr-featured-actions">
                  <button
                    className={`hr-featured-action${isFinished ? ' done' : ''}`}
                    type="button"
                    onClick={handleMarkStep}
                    disabled={isFinished}
                  >
                    {isFinished ? 'Все шаги отмечены' : 'Отметить шаг'}
                  </button>
                  {!isFinished && currentItem && (
                    <button
                      type="button"
                      className="hr-howto-icon-btn"
                      onClick={() => setHowtoItem(currentItem)}
                      aria-label={`Как наносить: ${currentItem.title}`}
                      title="Как наносить"
                    >
                      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg>
                    </button>
                  )}
                </div>
              </article>
            </section>
            {completedCount > 0 && (
              <div className="hr-undo">
                <button
                  type="button"
                  onClick={() => {
                    if (lastDoneIdx >= 0) toggleItem(routineItems[lastDoneIdx].id);
                  }}
                >
                  Отменить последний шаг
                </button>
              </div>
            )}
          </>
        );
      })()}

      {/* Next steps */}
      {(() => {
        if (currentStepIndex < 0) return null;
        const upcoming = routineItems.slice(currentStepIndex + 1, currentStepIndex + 3);
        if (upcoming.length === 0) return null;
        return (
          <section aria-label="Следующие шаги">
            <h2 className="hr-next-heading">Дальше</h2>
            <div className="hr-next-grid">
              {upcoming.map((item, offset) => {
                const stepNumber = currentStepIndex + offset + 2;
                const blend = (item.icon || '').includes('cream');
                return (
                  <article
                    key={item.id}
                    className="hr-next-card tappable"
                    role="button"
                    tabIndex={0}
                    onClick={() => setHowtoItem(item)}
                  >
                    <div className="hr-next-top">
                      <span className="hr-next-kicker">Шаг {stepNumber}</span>
                      <span className="hr-next-number">{stepNumber}</span>
                    </div>
                    <img
                      className={`hr-next-product${blend ? ' blend' : ''}`}
                      src={item.icon}
                      alt=""
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="hr-next-copy">
                      {item.brand && <div className="hr-next-brand">{item.brand}</div>}
                      <div className="hr-next-title">{item.subtitle || item.title}</div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* Bottom-sheet «как наносить» — совет по конкретному шагу/средству */}
      {howtoItem && (
        <div
          className="hr-sheet-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`Как наносить: ${howtoItem.title}`}
          onClick={() => setHowtoItem(null)}
        >
          <div className="hr-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="hr-sheet-grab" />
            <div className="hr-sheet-head">
              <div className="hr-sheet-ic">
                <img src={howtoItem.icon} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <div>
                <div className="hr-sheet-kicker">{howtoItem.title}</div>
                <div className="hr-sheet-title">{howtoItem.subtitle}</div>
              </div>
            </div>
            <ol className="hr-sheet-steps">
              {howtoItem.howto.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            {howtoItem.howto.volume && (
              <div className="hr-sheet-vol">
                <span aria-hidden="true">💧</span>
                Количество: {howtoItem.howto.volume}
              </div>
            )}
            {howtoItem.howto.tip && (
              <div className="hr-sheet-tip">
                <span className="hr-sheet-tip-ic" aria-hidden="true">🩺</span>
                <div className="hr-sheet-tip-tx">
                  <strong>Совет дерматолога</strong>
                  {howtoItem.howto.tip}
                </div>
              </div>
            )}
            <button type="button" className="hr-sheet-close" onClick={() => setHowtoItem(null)}>
              Понятно
            </button>
          </div>
        </div>
      )}

    </div>,
  );
}
