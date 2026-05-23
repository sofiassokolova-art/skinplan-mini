// lib/plan-page/profile-cards.ts
// Сборка карусели "Профиль кожи" — до 4 карточек, упорядоченных по важности.

import type { SkinProfile } from '@prisma/client';
import {
  formatSkinTypeLabel,
  formatAgeGroupLabel,
} from '@/lib/ui-formatters';
import type { ProfileCard } from './types';

/**
 * Возвращает 2..4 карточки для карусели "Профиль кожи".
 *
 * Стратегия:
 *   - Тип кожи и Барьер показываем всегда (это базовая характеристика).
 *   - Дальше добавляем по приоритету: Акне → Обезвоженность → Пигментация
 *     → Розацеа → Возраст. Берём топ-2 не пустых.
 *   - Жёсткий потолок — 4 карточки.
 */
export function buildProfileCards(profile: SkinProfile): ProfileCard[] {
  const cards: ProfileCard[] = [];

  // 1. Тип кожи — всегда
  const skinTypeCard = makeSkinTypeCard(profile);
  if (skinTypeCard) cards.push(skinTypeCard);

  // 2. Барьер — всегда (derived из sensitivityLevel)
  const barrierCard = makeBarrierCard(profile);
  if (barrierCard) cards.push(barrierCard);

  // 3-4. Опциональные — по приоритету
  const optional: Array<{ card: ProfileCard; priority: number }> = [];

  const acneCard = makeAcneCard(profile);
  if (acneCard) optional.push({ card: acneCard, priority: (profile.acneLevel ?? 0) * 10 + 30 });

  const dehydrationCard = makeDehydrationCard(profile);
  if (dehydrationCard) optional.push({ card: dehydrationCard, priority: (profile.dehydrationLevel ?? 0) * 10 + 20 });

  const pigmentationCard = makePigmentationCard(profile);
  if (pigmentationCard) optional.push({
    card: pigmentationCard,
    priority: profile.pigmentationRisk === 'high' ? 28 : 15,
  });

  const rosaceaCard = makeRosaceaCard(profile);
  if (rosaceaCard) optional.push({
    card: rosaceaCard,
    priority: profile.rosaceaRisk === 'high' ? 26 : 12,
  });

  const ageCard = makeAgeCard(profile);
  if (ageCard) optional.push({ card: ageCard, priority: 10 });

  optional
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 4 - cards.length)
    .forEach(({ card }) => cards.push(card));

  return cards.slice(0, 4);
}

// ─── builders ───

function makeSkinTypeCard(profile: SkinProfile): ProfileCard | null {
  const label = formatSkinTypeLabel(profile.skinType);
  if (!label) return null;

  const descriptionsByType: Record<string, string> = {
    'Сухая': 'Кожа склонна к стянутости и шелушению, поэтому фокусируемся на удержании влаги и поддержке липидного барьера.',
    'Жирная': 'Повышенная себопродукция и склонность к расширенным порам, работа идёт через мягкую себорегуляцию без пересушивания.',
    'Комбинированная': 'Т-зона склонна к жирности, при этом щёки и зона вокруг рта могут реагировать сухостью и стянутостью.',
    'Нормальная': 'Сбалансированное состояние без выраженных проблем — фокус на профилактике и поддержании барьера.',
    'Чувствительная': 'Кожа реагирует на агрессивные средства, поэтому в плане только хорошо переносимые активы.',
  };

  // Для "Комбинированная (сухая)" / "Комбинированная (жирная)" подберём базовый кейс
  const baseLabel = label.toLowerCase().startsWith('комбин') ? 'Комбинированная' : label;

  const description = descriptionsByType[baseLabel]
    ?? 'Тип кожи учтён при подборе средств — план адаптирован к вашим особенностям.';

  return {
    key: 'skinType',
    label: 'Тип кожи',
    value: label.toLowerCase(),
    description,
  };
}

function makeBarrierCard(profile: SkinProfile): ProfileCard | null {
  const sensitivity = (profile.sensitivityLevel ?? '').toLowerCase();
  if (!sensitivity) return null;

  if (sensitivity === 'high' || sensitivity === 'very_high') {
    return {
      key: 'barrier',
      label: 'Барьер',
      value: 'ослаблен',
      description: 'Кожа быстрее реагирует на активы и внешние раздражители, поэтому восстановление барьера — первый приоритет.',
    };
  }

  if (sensitivity === 'medium') {
    return {
      key: 'barrier',
      label: 'Барьер',
      value: 'нормальный',
      description: 'Барьер стабилен, но иногда реагирует на новые средства — поэтому активы вводим постепенно.',
    };
  }

  return {
    key: 'barrier',
    label: 'Барьер',
    value: 'крепкий',
    description: 'Кожа хорошо переносит активы, можно работать с задачами в стандартном темпе.',
  };
}

function makeAcneCard(profile: SkinProfile): ProfileCard | null {
  const level = profile.acneLevel ?? 0;
  if (level <= 0) return null;

  const map: Record<number, { value: string; description: string }> = {
    1: {
      value: 'лёгкая степень',
      description: 'Эпизодические воспаления и закрытые комедоны. План включает мягкое отшелушивание и точечный актив.',
    },
    2: {
      value: 'умеренная',
      description: 'Регулярные воспаления и постакне. Работаем через салициловую кислоту, ниацинамид и контроль себума.',
    },
    3: {
      value: 'выраженная',
      description: 'Активные воспаления и заметные следы. Параллельно с уходом рекомендуем очную консультацию дерматолога.',
    },
  };

  const entry = map[level] ?? map[1]!;
  return {
    key: 'acne',
    label: 'Акне',
    value: entry.value,
    description: entry.description,
  };
}

function makeDehydrationCard(profile: SkinProfile): ProfileCard | null {
  const level = profile.dehydrationLevel ?? 0;
  if (level <= 0) return null;

  const map: Record<number, { value: string; description: string }> = {
    1: { value: 'лёгкая',     description: 'Кожа иногда испытывает нехватку влаги. План включает увлажняющие сыворотки и кремы с гиалуроновой кислотой.' },
    2: { value: 'умеренная',  description: 'Регулярное чувство стянутости и тусклый тон. Фокус на удержании влаги и восстановлении липидов.' },
    3: { value: 'выраженная', description: 'Выраженное обезвоживание. Используем увлажнение в 2-3 слоя и окклюзивный крем поверх.' },
  };

  const entry = map[level] ?? map[1]!;
  return {
    key: 'dehydration',
    label: 'Обезвоженность',
    value: entry.value,
    description: entry.description,
  };
}

function makePigmentationCard(profile: SkinProfile): ProfileCard | null {
  const risk = (profile.pigmentationRisk ?? '').toLowerCase();
  if (!risk || risk === 'low') return null;

  if (risk === 'high') {
    return {
      key: 'pigmentation',
      label: 'Пигментация',
      value: 'высокий риск',
      description: 'Склонность к поствоспалительной гиперпигментации. SPF ежедневно, в активной фазе подключаем осветляющие активы.',
    };
  }

  return {
    key: 'pigmentation',
    label: 'Пигментация',
    value: 'умеренный риск',
    description: 'Есть склонность к неровному тону. SPF и мягкие осветляющие компоненты помогут стабилизировать оттенок.',
  };
}

function makeRosaceaCard(profile: SkinProfile): ProfileCard | null {
  const risk = (profile.rosaceaRisk ?? '').toLowerCase();
  if (!risk || risk === 'low') return null;

  if (risk === 'high') {
    return {
      key: 'rosacea',
      label: 'Розацеа',
      value: 'высокий риск',
      description: 'Сосудистая реактивность и стойкое покраснение. План исключает агрессивные кислоты и спиртосодержащие средства.',
    };
  }

  return {
    key: 'rosacea',
    label: 'Розацеа',
    value: 'умеренный риск',
    description: 'Эпизодические покраснения. Делаем акцент на успокаивающих компонентах и мягком SPF.',
  };
}

function makeAgeCard(profile: SkinProfile): ProfileCard | null {
  const value = formatAgeGroupLabel(profile.ageGroup);
  if (!value) return null;

  const ageLower = (profile.ageGroup ?? '').toLowerCase();

  let description = 'Возрастная группа учтена в подборе активов и текстур.';
  if (ageLower === 'u18' || ageLower === '18_24') {
    description = 'Молодая кожа — фокус на базовом уходе, контроле себума и формировании привычки SPF.';
  } else if (ageLower === '25_34') {
    description = 'Возраст, где важно укрепить барьер и заложить базу профилактики, не уходя в агрессивный антиэйдж.';
  } else if (ageLower === '35_44') {
    description = 'Подключаем компоненты против первых признаков старения: ретиноиды по схеме, антиоксиданты, активное увлажнение.';
  } else if (ageLower === '45plus') {
    description = 'Фокус на восстановлении, питании, антиоксидантной защите и работе с возрастной пигментацией.';
  }

  return {
    key: 'age',
    label: 'Возраст',
    value,
    description,
  };
}
