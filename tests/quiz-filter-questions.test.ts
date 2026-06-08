import { describe, expect, it } from 'vitest';
import { filterQuestions } from '@/lib/quiz/filterQuestions';
import type { Question } from '@/lib/quiz/types';

const quietLogger = {
  log: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function question(id: number, code: string, options: Question['options'] = []): Question {
  return {
    id,
    code,
    text: code,
    type: options.length > 0 ? 'single_choice' : 'text',
    position: id,
    isRequired: false,
    options,
  } as Question;
}

const gateQuestion = question(1, 'has_avoid_ingredients', [
  { id: 11, value: 'yes', label: 'Да, есть' },
  { id: 12, value: 'no', label: 'Нет, исключать ничего не нужно' },
]);

const avoidQuestion = question(2, 'avoid_ingredients');
const careTypeQuestion = question(3, 'care_type');

describe('filterQuestions', () => {
  it('shows avoid_ingredients before the gate is answered', () => {
    const codes = filterQuestions({
      questions: [gateQuestion, avoidQuestion, careTypeQuestion],
      answers: {},
      logger: quietLogger,
    }).map((q) => q.code);

    expect(codes).toEqual(['has_avoid_ingredients', 'avoid_ingredients', 'care_type']);
  });

  it('keeps avoid_ingredients after a positive gate answer', () => {
    const codes = filterQuestions({
      questions: [gateQuestion, avoidQuestion, careTypeQuestion],
      answers: { [gateQuestion.id]: 'yes' },
      logger: quietLogger,
    }).map((q) => q.code);

    expect(codes).toEqual(['has_avoid_ingredients', 'avoid_ingredients', 'care_type']);
  });

  it('skips avoid_ingredients after a negative gate answer and keeps care_type next in flow', () => {
    const codes = filterQuestions({
      questions: [gateQuestion, avoidQuestion, careTypeQuestion],
      answers: { [gateQuestion.id]: 'no' },
      logger: quietLogger,
    }).map((q) => q.code);

    expect(codes).toEqual(['has_avoid_ingredients', 'care_type']);
  });
});
