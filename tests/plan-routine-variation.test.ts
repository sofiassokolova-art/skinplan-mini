import { describe, expect, it } from 'vitest';
import { isWeeklyFocusDay } from '@/lib/plan-types';
import { applyPhaseRoutineVariation } from '@/lib/plan-routine-variation';
import type { StepCategory } from '@/lib/step-category-rules';

const barrierMorning: StepCategory[] = [
  'cleanser_gentle',
  'toner_hydrating',
  'serum_hydrating',
  'moisturizer_barrier',
  'spf_50_sensitive',
];

const acneEvening: StepCategory[] = [
  'cleanser_gentle',
  'toner_soothing',
  'treatment_acne_azelaic',
  'moisturizer_barrier',
];

function signature(morningSteps: StepCategory[], eveningSteps: StepCategory[], weekly: boolean): string {
  return `M:${morningSteps.join('>')}|E:${eveningSteps.join('>')}|W:${weekly ? 'weekly' : '-'}`;
}

describe('applyPhaseRoutineVariation', () => {
  it('minimal routine остается неизменной', () => {
    const morning: StepCategory[] = ['cleanser_gentle', 'moisturizer_light', 'spf_50_face'];
    const evening: StepCategory[] = ['cleanser_gentle', 'moisturizer_light'];
    const result = applyPhaseRoutineVariation({
      morningSteps: morning,
      eveningSteps: evening,
      dayIndex: 1,
      phase: 'adaptation',
      routineComplexity: 'minimal',
      isWeeklyFocusDay: false,
    });

    expect(result.morningSteps).toEqual(morning);
    expect(result.eveningSteps).toEqual(evening);
    expect(result.appliedRules).toEqual([]);
  });

  it('первые дни адаптации короче, но сохраняют cleanser/moisturizer/SPF', () => {
    const result = applyPhaseRoutineVariation({
      morningSteps: barrierMorning,
      eveningSteps: ['cleanser_gentle', 'toner_soothing', 'moisturizer_barrier'],
      dayIndex: 1,
      phase: 'adaptation',
      routineComplexity: 'medium',
      isWeeklyFocusDay: false,
    });

    expect(result.morningSteps).toEqual([
      'cleanser_gentle',
      'serum_hydrating',
      'moisturizer_barrier',
      'spf_50_sensitive',
    ]);
    expect(result.eveningSteps).toEqual(['cleanser_gentle', 'moisturizer_barrier']);
    expect(result.appliedRules).toContain('early_adaptation_short_morning');
    expect(result.appliedRules).toContain('early_adaptation_short_evening');
  });

  it('recovery-night убирает частотно-чувствительные вечерние активы', () => {
    const result = applyPhaseRoutineVariation({
      morningSteps: barrierMorning,
      eveningSteps: acneEvening,
      dayIndex: 13,
      phase: 'active',
      routineComplexity: 'medium',
      isWeeklyFocusDay: false,
    });

    expect(result.eveningSteps).toEqual([
      'cleanser_gentle',
      'toner_soothing',
      'moisturizer_barrier',
    ]);
    expect(result.appliedRules).toContain('weekly_recovery_without_frequency_sensitive_actives');
  });

  it('support-фаза облегчает часть утренних рутин', () => {
    const result = applyPhaseRoutineVariation({
      morningSteps: barrierMorning,
      eveningSteps: ['cleanser_gentle', 'toner_soothing', 'moisturizer_barrier'],
      dayIndex: 24,
      phase: 'support',
      routineComplexity: 'medium',
      isWeeklyFocusDay: false,
    });

    expect(result.morningSteps).not.toContain('toner_hydrating');
    expect(result.morningSteps).toContain('serum_hydrating');
    expect(result.morningSteps).toContain('spf_50_sensitive');
    expect(result.appliedRules).toContain('support_streamlined_morning');
  });

  it('создает больше двух сигнатур за 28 дней для не-minimal плана', () => {
    const signatures = new Set<string>();

    for (let dayIndex = 1; dayIndex <= 28; dayIndex++) {
      const phase = dayIndex <= 7 ? 'adaptation' : dayIndex <= 21 ? 'active' : 'support';
      const weekly = isWeeklyFocusDay(dayIndex, ['mask_soothing'], 'medium');
      const result = applyPhaseRoutineVariation({
        morningSteps: barrierMorning,
        eveningSteps: ['cleanser_gentle', 'toner_soothing', 'moisturizer_barrier'],
        dayIndex,
        phase,
        routineComplexity: 'medium',
        isWeeklyFocusDay: weekly,
      });
      signatures.add(signature(result.morningSteps, result.eveningSteps, weekly));
    }

    expect(signatures.size).toBeGreaterThanOrEqual(4);
  });
});
