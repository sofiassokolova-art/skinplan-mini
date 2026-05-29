import { describe, expect, it } from 'vitest';
import { QUIZ_TOPICS, getTopicById as getQuizTopicById } from '@/lib/quiz-topics';
import { QUESTION_TOPICS, getQuestionCodesForTopic } from '@/lib/questionnaire-topics';

const ACTIVE_QUESTION_CODES = [
  'user_name',
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

const RETAKABLE_QUESTION_CODES = ACTIVE_QUESTION_CODES.filter(
  code => !['user_name', 'age', 'gender'].includes(code)
);

describe('quiz retake topic mappings', () => {
  it('covers every retakable active question code in topic retake', () => {
    const retakeCodes = new Set(QUIZ_TOPICS.flatMap(topic => topic.questionCodes ?? []));

    const missingCodes = RETAKABLE_QUESTION_CODES.filter(code => !retakeCodes.has(code));

    expect(missingCodes).toEqual([]);
  });

  it('does not point retake topics at removed questionnaire codes', () => {
    const activeCodes = new Set(ACTIVE_QUESTION_CODES);
    const staleCodes = QUIZ_TOPICS.flatMap(topic =>
      (topic.questionCodes ?? [])
        .filter(code => !activeCodes.has(code))
        .map(code => `${topic.id}:${code}`)
    );

    expect(staleCodes).toEqual([]);
  });

  it('keeps the skin retake topic tied to seasonality and Fitzpatrick type', () => {
    expect(getQuizTopicById('skin_type')?.questionCodes).toEqual([
      'skin_type',
      'seasonal_changes',
      'fitzpatrick_type',
    ]);
    expect(getQuestionCodesForTopic('skin_type')).toEqual([
      'skin_type',
      'seasonal_changes',
      'fitzpatrick_type',
    ]);
  });

  it('keeps scoped recalculation topics on active question codes too', () => {
    const activeCodes = new Set(ACTIVE_QUESTION_CODES);
    const staleCodes = Object.entries(QUESTION_TOPICS).flatMap(([topicId, topic]) => {
      if (topicId === 'motivation') return [];
      return topic.questionCodes
        .filter(code => !activeCodes.has(code))
        .map(code => `${topicId}:${code}`);
    });

    expect(staleCodes).toEqual([]);
    expect(getQuestionCodesForTopic('current_care')).toEqual([
      'retinoid_usage',
      'retinoid_reaction',
      'prescription_topical',
      'oral_medications',
    ]);
    expect(getQuestionCodesForTopic('avoid_ingredients')).toEqual([
      'allergies',
      'has_avoid_ingredients',
      'avoid_ingredients',
    ]);
  });
});
