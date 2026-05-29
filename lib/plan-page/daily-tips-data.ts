// lib/plan-page/daily-tips-data.ts
// Статичная библиотека советов "от дерматолога".
//
// Структура: совет триггерится по (phase + goalKey) или по phase без goalKey
// (универсальный совет фазы). При выборе мы сначала ищем тег goalKey,
// совпадающий с mainGoals пользователя, и если ничего нет — берём универсальный.

import type { GoalKey } from '@/lib/concern-taxonomy';
import type { PlanPhases } from '@/lib/plan-types';

export interface DailyTip {
  id: string;
  phase: PlanPhases;
  /** null = универсальный совет для фазы */
  goalKey: GoalKey | null;
  title: string;
  text: string;
}

export const DAILY_TIPS: DailyTip[] = [
  // ─── Adaptation ───
  {
    id: 'a-universal-overload',
    phase: 'adaptation',
    goalKey: null,
    title: 'Не перегружайте кожу активами',
    text: 'На текущем этапе коже важнее восстановить переносимость ухода, чем быстро вводить кислоты или ретиноиды.',
  },
  {
    id: 'a-universal-spf',
    phase: 'adaptation',
    goalKey: null,
    title: 'SPF — часть лечения, а не дополнительный шаг',
    text: 'Без ежедневной защиты от солнца покраснение и постакне будут уходить медленнее.',
  },
  {
    id: 'a-universal-gentle-cleanse',
    phase: 'adaptation',
    goalKey: null,
    title: 'Очищение должно быть мягким',
    text: 'Скрипящая «чистая» кожа после умывания — это нарушенный pH. Используйте гель или пенку без сульфатов.',
  },
  {
    id: 'a-acne-no-zit-cream',
    phase: 'adaptation',
    goalKey: 'acne',
    title: 'Не начинайте с точечных подсушивающих средств',
    text: 'Они снимают воспаление на один день, но усиливают сухость. Сначала восстанавливаем барьер, потом добавляем активы.',
  },
  {
    id: 'a-barrier-cera',
    phase: 'adaptation',
    goalKey: 'barrier',
    title: 'Ищите церамиды и пантенол в составе',
    text: 'Они помогают восстановить липидный барьер за 2–3 недели и снижают чувствительность.',
  },
  {
    id: 'a-dehydration-layer',
    phase: 'adaptation',
    goalKey: 'dehydration',
    title: 'Увлажнение наносите в два слоя',
    text: 'Сначала сыворотка с гиалуроновой кислотой на влажную кожу, затем крем. Это «запечатывает» влагу.',
  },

  // ─── Active ───
  {
    id: 'ac-universal-introduce',
    phase: 'active',
    goalKey: null,
    title: 'Вводите по одному активу за раз',
    text: 'Если кислота и ретинол подключаются одновременно, при реакции невозможно понять, что её вызвало.',
  },
  {
    id: 'ac-universal-spf',
    phase: 'active',
    goalKey: null,
    title: 'SPF в активной фазе обязателен',
    text: 'Большинство активов повышают фоточувствительность на 40–60%. Утренний SPF 30+ — не опционален.',
  },
  {
    id: 'ac-universal-listen',
    phase: 'active',
    goalKey: null,
    title: 'Слушайте кожу, а не календарь',
    text: 'Если кожа стянута или горит — пропустите день актива. Это нормально и не сбивает план.',
  },
  {
    id: 'ac-acne-bha',
    phase: 'active',
    goalKey: 'acne',
    title: 'BHA-кислоту — только вечером, через день',
    text: 'Наносите на сухую кожу через 20 минут после умывания. Утром обязательно SPF — салициловая повышает фоточувствительность.',
  },
  {
    id: 'ac-acne-spot',
    phase: 'active',
    goalKey: 'acne',
    title: 'Точечный актив — не на всё лицо',
    text: 'Бензоил пероксид и сильные подсушивающие средства наносите только на воспаление, чтобы не пересушить здоровую кожу.',
  },
  {
    id: 'ac-pores-niacinamide',
    phase: 'active',
    goalKey: 'pores',
    title: 'Ниацинамид работает в долгую',
    text: 'Видимое сужение пор — после 4–6 недель регулярного использования. Концентрация 5–10% оптимальна.',
  },
  {
    id: 'ac-pigmentation-vitc',
    phase: 'active',
    goalKey: 'pigmentation',
    title: 'Витамин C — утром, до SPF',
    text: 'L-аскорбиновая кислота 10–15% усиливает защиту от UV-индуцированной пигментации и работает синергично с SPF.',
  },
  {
    id: 'ac-pigmentation-no-sun',
    phase: 'active',
    goalKey: 'pigmentation',
    title: 'Любая пигментация без SPF возвращается',
    text: 'Даже если осветляющий актив сработал — без ежедневного SPF 30+ пятна вернутся за 2–4 недели.',
  },
  {
    id: 'ac-wrinkles-retinol',
    phase: 'active',
    goalKey: 'wrinkles',
    title: 'Ретинол — горошина, не больше',
    text: 'На сухую кожу через 20 минут после умывания. Начинайте с 2 раз в неделю и наращивайте по переносимости.',
  },
  {
    id: 'ac-antiage-retinoid',
    phase: 'active',
    goalKey: 'antiage',
    title: 'Антиэйдж — это марафон, не спринт',
    text: 'Видимые изменения от ретиноидов — после 12 недель регулярного использования. Не отменяйте при первых улучшениях.',
  },
  {
    id: 'ac-dehydration-hyaluronic',
    phase: 'active',
    goalKey: 'dehydration',
    title: 'Гиалуроновая кислота — на влажную кожу',
    text: 'В сухом помещении она вытягивает влагу из кожи, а не из воздуха. Поэтому всегда наносим поверх увлажнения.',
  },
  {
    id: 'ac-barrier-no-acid',
    phase: 'active',
    goalKey: 'barrier',
    title: 'Если барьер ещё слаб — без кислот',
    text: 'Сначала 2–3 недели «бутербродного» ухода с церамидами и пантенолом, и только потом мягкие активы.',
  },

  // ─── Support ───
  {
    id: 's-universal-keep-spf',
    phase: 'support',
    goalKey: null,
    title: 'SPF остаётся в рутине навсегда',
    text: 'Это единственное средство с доказанной антивозрастной эффективностью. Не выключайте после плана.',
  },
  {
    id: 's-universal-frequency',
    phase: 'support',
    goalKey: null,
    title: 'Активы — 2–3 раза в неделю, не каждый день',
    text: 'Для поддержания результата частоту можно снизить — кожа уже привыкла, агрессивная схема больше не нужна.',
  },
  {
    id: 's-universal-photo',
    phase: 'support',
    goalKey: null,
    title: 'Зафиксируйте результат',
    text: 'Сделайте фото и запишите, что сейчас работает. Это поможет быстро восстановить рутину при срыве или сезонной смене.',
  },
  {
    id: 's-acne-maintenance',
    phase: 'support',
    goalKey: 'acne',
    title: 'Не отменяйте BHA полностью',
    text: 'Снизьте до 1–2 раз в неделю — это держит поры чистыми и не даёт акне вернуться.',
  },
];
