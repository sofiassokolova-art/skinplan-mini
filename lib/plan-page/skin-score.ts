// lib/plan-page/skin-score.ts
// Расчёт скин-скора 0..100 + персонализированное описание

import type { SkinProfile } from '@prisma/client';
import type { SkinScoreInfo } from './types';

/**
 * Вычисляет интегральную оценку состояния кожи 20..100.
 *
 * Логика:
 *   База = 100
 *   - acneLevel (0..3)   → −12 за уровень
 *   - sensitivityLevel   → high −16, medium −8, very_high −22, low 0
 *   - dehydrationLevel   → −5 за уровень
 *   - rosaceaRisk        → high −10, medium −5
 *   - pigmentationRisk   → high −6, medium −3
 *   Клампим в диапазоне [20, 100].
 *
 * Это эвристика, не медицинская оценка. Достаточно, чтобы
 * пользователь видел движение балла после daily check-ins.
 */
export function calcSkinScore(profile: SkinProfile): SkinScoreInfo {
  let score = 100;

  score -= clampLevel(profile.acneLevel) * 12;
  score -= clampLevel(profile.dehydrationLevel) * 5;

  switch ((profile.sensitivityLevel ?? '').toLowerCase()) {
    case 'high':       score -= 16; break;
    case 'very_high':  score -= 22; break;
    case 'medium':     score -= 8;  break;
    default: break;
  }

  switch ((profile.rosaceaRisk ?? '').toLowerCase()) {
    case 'high':   score -= 10; break;
    case 'medium': score -= 5;  break;
  }

  switch ((profile.pigmentationRisk ?? '').toLowerCase()) {
    case 'high':   score -= 6;  break;
    case 'medium': score -= 3;  break;
  }

  const final = Math.max(20, Math.min(100, score));
  const label = labelFromScore(final);
  const description = buildScoreDescription(profile, final);

  return { score: final, label, description };
}

function clampLevel(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(3, Math.round(value)));
}

function labelFromScore(score: number): SkinScoreInfo['label'] {
  if (score >= 80) return 'высокая';
  if (score >= 60) return 'средняя';
  if (score >= 40) return 'низкая';
  return 'критичная';
}

/**
 * Собирает описание скора из конкретных «триггеров» в профиле.
 * Без LLM, без сложной логики — просто упорядоченные фразы, которые включаются
 * по флагам. На выходе — связный абзац.
 */
function buildScoreDescription(profile: SkinProfile, score: number): string {
  const fragments: string[] = [];

  // Точка отсчёта
  if (score >= 80) {
    fragments.push('По ответам анкеты кожа в стабильном состоянии — выраженных проблем не выявлено');
  } else if (score >= 60) {
    fragments.push('По ответам анкеты кожа выглядит реактивной');
  } else if (score >= 40) {
    fragments.push('По ответам анкеты кожа испытывает заметную нагрузку');
  } else {
    fragments.push('По ответам анкеты состояние кожи требует деликатного подхода');
  }

  const triggers: string[] = [];

  if ((profile.acneLevel ?? 0) >= 2) {
    triggers.push('есть выраженные воспаления и постакне');
  } else if ((profile.acneLevel ?? 0) === 1) {
    triggers.push('встречаются эпизодические воспаления');
  }

  const s = (profile.sensitivityLevel ?? '').toLowerCase();
  if (s === 'high' || s === 'very_high') {
    triggers.push('признаки ослабленного защитного барьера и склонность к покраснению');
  } else if (s === 'medium') {
    triggers.push('умеренная чувствительность к активам');
  }

  if ((profile.dehydrationLevel ?? 0) >= 2) {
    triggers.push('кожа обезвожена');
  }

  if ((profile.pigmentationRisk ?? '').toLowerCase() === 'high') {
    triggers.push('повышенный риск пигментации и поствоспалительных следов');
  }

  if (triggers.length > 0) {
    fragments.push(': ' + triggers.join(', '));
  }

  fragments.push('. ');

  // Стратегия плана
  if (score < 60) {
    fragments.push('Поэтому план начинается не с агрессивных активов, а с восстановления переносимости.');
  } else if (score < 80) {
    fragments.push('Поэтому активы вводим постепенно, начиная с восстановления барьера.');
  } else {
    fragments.push('Поэтому фокус — на профилактике и точечной работе с задачами.');
  }

  return fragments.join('').trim();
}
