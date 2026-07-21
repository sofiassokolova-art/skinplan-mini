// tests/components/StepCard.test.tsx
// frequencyLabel может приходить в данных плана, но UI карточки шага его
// не показывает: каденцию убрали с главной и остальных поверхностей.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepCard } from '@/components/StepCard';
import type { DayStep } from '@/lib/plan-types';

function step(overrides: Partial<DayStep> = {}): DayStep {
  return {
    stepCategory: 'toner_soothing',
    productId: '641',
    alternatives: [],
    ...overrides,
  };
}

const glycolic = {
  id: 641,
  name: 'Glycolic Acid 7% Toning Solution',
  brand: { name: 'The Ordinary' },
  imageUrl: null,
};

describe('StepCard: frequencyLabel', () => {
  it('не показывает каденцию, когда шаг под титрацией', () => {
    render(<StepCard step={step({ frequencyLabel: 'до 3 раз в неделю' })} product={glycolic} />);
    expect(screen.queryByText('до 3 раз в неделю')).not.toBeInTheDocument();
  });

  it('не показывает ничего лишнего для ежедневного шага', () => {
    render(<StepCard step={step()} product={glycolic} />);
    expect(screen.queryByText(/в неделю/)).not.toBeInTheDocument();
  });

  it('frequencyLabel не ломает карточку без продукта (шаг-инструкция)', () => {
    render(
      <StepCard
        step={step({
          productId: null,
          manualLabel: 'Умывание тёплой водой',
          instruction: 'Без средства',
          frequencyLabel: '1 раз в неделю',
        })}
        product={null}
      />
    );
    expect(screen.getByText('Умывание тёплой водой')).toBeInTheDocument();
    expect(screen.queryByText('1 раз в неделю')).not.toBeInTheDocument();
  });

  it('legacy-план без frequencyLabel рендерится как раньше', () => {
    const legacyStep = { stepCategory: 'serum_hydrating', productId: '1', alternatives: [] } as DayStep;
    render(<StepCard step={legacyStep} product={glycolic} />);
    expect(screen.getByText('Glycolic Acid 7% Toning Solution')).toBeInTheDocument();
  });

  it('название продукта показывается, а каденция нет', () => {
    render(<StepCard step={step({ frequencyLabel: '1 раз в неделю' })} product={glycolic} />);
    expect(screen.getByText('Glycolic Acid 7% Toning Solution')).toBeInTheDocument();
    expect(screen.queryByText('1 раз в неделю')).not.toBeInTheDocument();
  });
});
