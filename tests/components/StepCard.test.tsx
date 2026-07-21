// tests/components/StepCard.test.tsx
// Подпись каденции на карточке шага. Без неё юзер видит, что купленное средство
// просто исчезает из рутины в off-day, и не понимает почему — это и был UX-дефект,
// а не сам факт частотного ограничения.

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

describe('StepCard: подпись каденции', () => {
  it('показывает каденцию, когда шаг под титрацией', () => {
    render(<StepCard step={step({ frequencyLabel: 'до 3 раз в неделю' })} product={glycolic} />);
    expect(screen.getByText('до 3 раз в неделю')).toBeInTheDocument();
  });

  it('не показывает ничего лишнего для ежедневного шага', () => {
    render(<StepCard step={step()} product={glycolic} />);
    expect(screen.queryByText(/в неделю/)).not.toBeInTheDocument();
  });

  it('каденция не ломает карточку без продукта (шаг-инструкция)', () => {
    render(
      <StepCard
        step={step({ productId: null, manualLabel: 'Умывание тёплой водой', instruction: 'Без средства' })}
        product={null}
      />
    );
    expect(screen.getByText('Умывание тёплой водой')).toBeInTheDocument();
  });

  it('legacy-план без frequencyLabel рендерится как раньше', () => {
    const legacyStep = { stepCategory: 'serum_hydrating', productId: '1', alternatives: [] } as DayStep;
    render(<StepCard step={legacyStep} product={glycolic} />);
    expect(screen.getByText('Glycolic Acid 7% Toning Solution')).toBeInTheDocument();
  });

  it('название продукта и каденция показываются одновременно', () => {
    render(<StepCard step={step({ frequencyLabel: '1 раз в неделю' })} product={glycolic} />);
    expect(screen.getByText('Glycolic Acid 7% Toning Solution')).toBeInTheDocument();
    expect(screen.getByText('1 раз в неделю')).toBeInTheDocument();
  });
});
