// lib/plan-page/phase-content.ts
// Готовит данные для блока "3 фазы плана" с персонализированными тегами активов.

import type { GoalKey } from '@/lib/concern-taxonomy';
import { getPhaseForDay, getPhaseLabel } from '@/lib/plan-formatters';
import type { PhaseUI } from './types';

interface PhaseDescriptor {
  phase: 'adaptation' | 'active' | 'support';
  daysRange: [number, number];
  daysLabel: string;
  baseTags: string[];
  /** Общая база описания фазы */
  baseDescription: string;
}

const PHASES: PhaseDescriptor[] = [
  {
    phase: 'adaptation',
    daysRange: [1, 7],
    daysLabel: 'Дни 1–7',
    baseTags: ['очищение', 'крем', 'SPF'],
    baseDescription:
      'Снижаем раздражение, укрепляем защитный барьер и оставляем только средства с высокой переносимостью.',
  },
  {
    phase: 'active',
    daysRange: [8, 21],
    daysLabel: 'Дни 8–21',
    baseTags: [],
    baseDescription:
      'Постепенно подключаем активы — работаем с целями плана, не перегружая кожу.',
  },
  {
    phase: 'support',
    daysRange: [22, 28],
    daysLabel: 'Дни 22–28',
    baseTags: ['барьер', 'SPF', 'мягкое обновление'],
    baseDescription:
      'Фиксируем переносимую схему, сохраняем SPF и мягкое обновление, убираем всё, что провоцирует реактивность.',
  },
];

/**
 * Маппинг целей плана (mainGoals) на теги активов для активной фазы.
 * Несколько goal → объединяем уникальные теги.
 */
const ACTIVE_PHASE_TAGS_BY_GOAL: Record<GoalKey, { tags: string[]; descriptionFragment: string }> = {
  acne: {
    tags: ['BHA', 'ниацинамид', 'точечный актив'],
    descriptionFragment: 'воспалениями и постакне',
  },
  pores: {
    tags: ['BHA', 'ниацинамид', 'себорегуляция'],
    descriptionFragment: 'расширенными порами и неровной текстурой',
  },
  pigmentation: {
    tags: ['витамин C', 'азелаиновая кислота', 'мягкие AHA'],
    descriptionFragment: 'пигментацией и неровным тоном',
  },
  barrier: {
    tags: ['церамиды', 'пантенол', 'мягкое увлажнение'],
    descriptionFragment: 'восстановлением барьера',
  },
  dehydration: {
    tags: ['гиалуроновая кислота', 'глицерин', 'окклюзив'],
    descriptionFragment: 'обезвоженностью',
  },
  wrinkles: {
    tags: ['ретинол', 'пептиды', 'антиоксиданты'],
    descriptionFragment: 'первыми признаками старения',
  },
  antiage: {
    tags: ['ретиноиды', 'пептиды', 'витамин C'],
    descriptionFragment: 'возрастными изменениями',
  },
  general: {
    tags: ['ниацинамид', 'мягкие кислоты'],
    descriptionFragment: 'общим состоянием кожи',
  },
  dark_circles: {
    tags: ['кофеин', 'пептиды для век'],
    descriptionFragment: 'тёмными кругами',
  },
};

export function buildPhasesUI(
  currentDay: number,
  mainGoals: GoalKey[],
): PhaseUI[] {
  const currentPhase = getPhaseForDay(currentDay);

  return PHASES.map((descriptor) => {
    const state: PhaseUI['state'] =
      descriptor.phase === currentPhase
        ? 'current'
        : isPhaseBefore(descriptor.phase, currentPhase)
        ? 'past'
        : 'upcoming';

    let tags = descriptor.baseTags;
    let description = descriptor.baseDescription;

    if (descriptor.phase === 'active') {
      const collected = collectActivePhaseContent(mainGoals);
      tags = collected.tags;
      description = collected.description;
    }

    return {
      phase: descriptor.phase,
      phaseLabel: getPhaseLabel(descriptor.phase),
      daysLabel: descriptor.daysLabel,
      description,
      tags,
      state,
    };
  });
}

function collectActivePhaseContent(mainGoals: GoalKey[]): { tags: string[]; description: string } {
  if (mainGoals.length === 0) {
    return {
      tags: ['ниацинамид', 'мягкие кислоты'],
      description: 'Постепенно подключаем активы для общего улучшения состояния кожи.',
    };
  }

  const tagSet = new Set<string>();
  const fragments: string[] = [];

  for (const goal of mainGoals) {
    const entry = ACTIVE_PHASE_TAGS_BY_GOAL[goal];
    if (!entry) continue;
    entry.tags.forEach((t) => tagSet.add(t));
    fragments.push(entry.descriptionFragment);
  }

  // Максимум 3 тега (UI-ограничение)
  const tags = Array.from(tagSet).slice(0, 3);

  const description = fragments.length === 0
    ? 'Постепенно подключаем активы для целей плана.'
    : `Постепенно подключаем активы: работаем с ${joinList(fragments)}.`;

  return { tags, description };
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} и ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} и ${items[items.length - 1]}`;
}

function isPhaseBefore(a: PhaseUI['phase'], b: PhaseUI['phase']): boolean {
  const order: Record<PhaseUI['phase'], number> = {
    adaptation: 0,
    active: 1,
    support: 2,
  };
  return order[a] < order[b];
}

/**
 * Hero info: какая сейчас фаза + день внутри фазы.
 */
export function buildHeroInfo(currentDay: number) {
  const phase = getPhaseForDay(currentDay);
  const descriptor = PHASES.find((p) => p.phase === phase)!;
  const [from, to] = descriptor.daysRange;
  const daysInPhase = to - from + 1;
  const dayInPhase = Math.max(1, Math.min(daysInPhase, currentDay - from + 1));

  return {
    phaseLabel: getPhaseLabel(phase),
    phaseKey: phase,
    dayInPhase,
    daysInPhase,
    currentDay,
  };
}
