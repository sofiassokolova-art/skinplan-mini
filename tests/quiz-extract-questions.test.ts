import { describe, expect, it } from 'vitest';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';
import { getQuizSteps } from '@/lib/quiz/quizSteps';

function question(id: number, code: string, position = id) {
  return {
    id,
    code,
    text: code,
    type: 'single_choice',
    position,
    isRequired: false,
    description: null,
    options: [],
  };
}

describe('extractQuestionsFromQuestionnaire', () => {
  it('keeps fitzpatrick_type in the skin block before health questions and budget', () => {
    const apiOrderCodes = [
      'USER_NAME',
      'skin_goals',
      'age',
      'gender',
      'skin_type',
      'skin_concerns',
      'skin_sensitivity',
      'seasonal_changes',
      'fitzpatrick_type',
      'medical_diagnoses',
      'pregnancy_breastfeeding',
      'allergies',
      'has_avoid_ingredients',
      'avoid_ingredients',
      'retinoid_usage',
      'retinoid_reaction',
      'prescription_topical',
      'oral_medications',
      'makeup_frequency',
      'care_type',
      'care_steps',
      'budget',
    ];

    const questionnaire = {
      id: 18,
      groups: [
        {
          id: 1,
          title: 'All',
          position: 1,
          questions: apiOrderCodes.map((code, index) => question(index + 1, code, index + 1)),
        },
      ],
      questions: [],
    };

    const codes = extractQuestionsFromQuestionnaire(questionnaire).map((q) => q.code);

    expect(codes.indexOf('seasonal_changes')).toBeLessThan(codes.indexOf('fitzpatrick_type'));
    expect(codes.indexOf('fitzpatrick_type')).toBeLessThan(codes.indexOf('medical_diagnoses'));
    expect(codes.indexOf('fitzpatrick_type')).toBeLessThan(codes.indexOf('budget'));
    expect(codes.at(-1)).toBe('budget');

    const steps = getQuizSteps(extractQuestionsFromQuestionnaire(questionnaire)).map((step) =>
      step.type === 'question' ? `Q:${step.question.code}` : `I:${step.infoScreen.id}`
    );
    expect(steps).toContain('Q:seasonal_changes');
    expect(steps.indexOf('Q:seasonal_changes')).toBeLessThan(steps.indexOf('Q:fitzpatrick_type'));
    expect(steps.indexOf('Q:fitzpatrick_type')).toBeLessThan(steps.indexOf('I:skin_preview'));
    expect(steps.indexOf('I:skin_preview')).toBeLessThan(steps.indexOf('I:simple_care'));
  });
});
