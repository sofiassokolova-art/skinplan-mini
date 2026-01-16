// tests/components/QuizResumeScreen.test.tsx
// Unit тесты для компонента QuizResumeScreen

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuizResumeScreen } from '@/app/(miniapp)/quiz/components/QuizResumeScreen';
import type { Questionnaire, SavedProgress, Question } from '@/lib/quiz/types';

// Моки для зависимостей
vi.mock('@/lib/client-logger', () => ({
  clientLogger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/quiz/filterQuestions', () => ({
  filterQuestions: vi.fn(({ questions }) => questions), // Просто возвращаем вопросы как есть
}));

describe('QuizResumeScreen', () => {
  const mockQuestions: Question[] = [
    {
      id: 1,
      code: 'user_name',
      type: 'free_text',
      text: 'Как вас зовут?',
      isRequired: true,
      options: [],
    },
    {
      id: 2,
      code: 'skin_type',
      type: 'single_choice',
      text: 'Какой у вас тип кожи?',
      isRequired: true,
      options: [
        { id: 1, label: 'Сухая', value: 'dry' },
        { id: 2, label: 'Жирная', value: 'oily' },
      ],
    },
    {
      id: 3,
      code: 'skin_goals',
      type: 'multi_choice',
      text: 'На чём вы хотите сфокусироваться?',
      isRequired: true,
      options: [
        { id: 1, label: 'Морщины', value: 'wrinkles' },
        { id: 2, label: 'Акне', value: 'acne' },
      ],
    },
    {
      id: 4,
      code: 'skin_concerns',
      type: 'multi_choice',
      text: 'Что вас беспокоит?',
      isRequired: true,
      options: [
        { id: 1, label: 'Поры', value: 'pores' },
      ],
    },
  ];

  const mockQuestionnaire: Questionnaire = {
    id: 1,
    name: 'Тестовая анкета',
    version: 1,
    groups: [
      {
        id: 1,
        name: 'Группа 1',
        questions: mockQuestions,
      },
    ],
    questions: [],
  };

  const mockSavedProgress: SavedProgress = {
    answers: {
      1: 'Иван',
      2: 'dry',
    },
    questionIndex: 1, // Ответили на вопросы 1 и 2, следующий - 3
    infoScreenIndex: 0,
  };

  const mockHandlers = {
    onResume: vi.fn(),
    onStartOver: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('должен отображать заголовок "Вы не завершили анкету"', () => {
    render(
      <QuizResumeScreen
        savedProgress={mockSavedProgress}
        questionnaire={mockQuestionnaire}
        answers={{}}
        isRetakingQuiz={false}
        showRetakeScreen={false}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Вы не завершили анкету')).toBeInTheDocument();
  });

  it('должен отображать подзаголовок с информацией о сохранении прогресса', () => {
    render(
      <QuizResumeScreen
        savedProgress={mockSavedProgress}
        questionnaire={mockQuestionnaire}
        answers={{}}
        isRetakingQuiz={false}
        showRetakeScreen={false}
        {...mockHandlers}
      />
    );

    expect(
      screen.getByText(/Мы сохранили ваш прогресс — продолжите с того же места или начните заново/)
    ).toBeInTheDocument();
  });

  it('должен отображать кнопку "Продолжить с вопроса N"', () => {
    render(
      <QuizResumeScreen
        savedProgress={mockSavedProgress}
        questionnaire={mockQuestionnaire}
        answers={{}}
        isRetakingQuiz={false}
        showRetakeScreen={false}
        {...mockHandlers}
      />
    );

    const continueButton = screen.getByText(/Продолжить с вопроса/);
    expect(continueButton).toBeInTheDocument();
  });

  it('должен отображать кнопку "Начать анкету заново"', () => {
    render(
      <QuizResumeScreen
        savedProgress={mockSavedProgress}
        questionnaire={mockQuestionnaire}
        answers={{}}
        isRetakingQuiz={false}
        showRetakeScreen={false}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Начать анкету заново')).toBeInTheDocument();
  });

  it('должен правильно вычислять номер следующего вопроса', () => {
    render(
      <QuizResumeScreen
        savedProgress={mockSavedProgress}
        questionnaire={mockQuestionnaire}
        answers={{}}
        isRetakingQuiz={false}
        showRetakeScreen={false}
        {...mockHandlers}
      />
    );

    // Ответили на вопросы 1 и 2, следующий - 3 (индекс 2 + 1 = 3)
    expect(screen.getByText(/Продолжить с вопроса 3/)).toBeInTheDocument();
  });

  it('должен показывать правильный номер вопроса когда ответили на все вопросы', () => {
    const allAnsweredProgress: SavedProgress = {
      answers: {
        1: 'Иван',
        2: 'dry',
        3: ['wrinkles'],
        4: ['pores'],
      },
      questionIndex: 3,
      infoScreenIndex: 0,
    };

    render(
      <QuizResumeScreen
        savedProgress={allAnsweredProgress}
        questionnaire={mockQuestionnaire}
        answers={{}}
        isRetakingQuiz={false}
        showRetakeScreen={false}
        {...mockHandlers}
      />
    );

    // Все вопросы отвечены, показываем последний (4)
    expect(screen.getByText(/Продолжить с вопроса 4/)).toBeInTheDocument();
  });

  it('должен вызывать onResume при клике на кнопку "Продолжить"', () => {
    render(
      <QuizResumeScreen
        savedProgress={mockSavedProgress}
        questionnaire={mockQuestionnaire}
        answers={{}}
        isRetakingQuiz={false}
        showRetakeScreen={false}
        {...mockHandlers}
      />
    );

    const continueButton = screen.getByText(/Продолжить с вопроса/);
    fireEvent.click(continueButton);

    expect(mockHandlers.onResume).toHaveBeenCalledTimes(1);
  });

  it('должен вызывать onStartOver при клике на кнопку "Начать заново"', async () => {
    render(
      <QuizResumeScreen
        savedProgress={mockSavedProgress}
        questionnaire={mockQuestionnaire}
        answers={{}}
        isRetakingQuiz={false}
        showRetakeScreen={false}
        {...mockHandlers}
      />
    );

    const startOverButton = screen.getByText('Начать анкету заново');
    fireEvent.click(startOverButton);

    await waitFor(() => {
      expect(mockHandlers.onStartOver).toHaveBeenCalledTimes(1);
    });
  });

  it('должен работать без questionnaire (fallback на questionIndex)', () => {
    const progressWithFallback: SavedProgress = {
      answers: {
        1: 'Иван',
      },
      questionIndex: 0,
      infoScreenIndex: 0,
    };

    render(
      <QuizResumeScreen
        savedProgress={progressWithFallback}
        questionnaire={null}
        answers={{}}
        isRetakingQuiz={false}
        showRetakeScreen={false}
        {...mockHandlers}
      />
    );

    // Fallback: questionIndex + 2 = 0 + 2 = 2
    expect(screen.getByText(/Продолжить с вопроса 2/)).toBeInTheDocument();
  });

  it('должен правильно обрабатывать пустой массив вопросов', () => {
    const emptyQuestionnaire: Questionnaire = {
      id: 1,
      name: 'Пустая анкета',
      version: 1,
      groups: [],
      questions: [],
    };

    render(
      <QuizResumeScreen
        savedProgress={mockSavedProgress}
        questionnaire={emptyQuestionnaire}
        answers={{}}
        isRetakingQuiz={false}
        showRetakeScreen={false}
        {...mockHandlers}
      />
    );

    // При пустом массиве вопросов используется fallback: questionIndex + 2 = 1 + 2 = 3
    expect(screen.getByText(/Продолжить с вопроса 3/)).toBeInTheDocument();
  });

  it('должен правильно находить следующий неотвеченный вопрос', () => {
    const partialProgress: SavedProgress = {
      answers: {
        1: 'Иван',
        // Вопрос 2 не отвечен
      },
      questionIndex: 0,
      infoScreenIndex: 0,
    };

    render(
      <QuizResumeScreen
        savedProgress={partialProgress}
        questionnaire={mockQuestionnaire}
        answers={{}}
        isRetakingQuiz={false}
        showRetakeScreen={false}
        {...mockHandlers}
      />
    );

    // Следующий неотвеченный вопрос - это вопрос 2 (индекс 1), номер = 2
    expect(screen.getByText(/Продолжить с вопроса 2/)).toBeInTheDocument();
  });
});
