// tests/components/QuizQuestion.test.tsx
// Unit тесты для компонента QuizQuestion

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuizQuestion } from '@/app/(miniapp)/quiz/components/QuizQuestion';
import type { Question } from '@/lib/quiz/types';

// Моки для зависимостей
vi.mock('../info-screens', () => ({
  getInfoScreenAfterQuestion: vi.fn(() => null),
}));

describe('QuizQuestion', () => {
  const mockQuestion: Question = {
    id: 1,
    code: 'skin_type',
    type: 'single_choice',
    text: 'Какой у вас тип кожи?',
    options: [
      { id: 1, text: 'Сухая', value: 'dry' },
      { id: 2, text: 'Жирная', value: 'oily' },
      { id: 3, text: 'Комбинированная', value: 'combination' },
    ],
    order: 1,
    questionnaireId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockHandlers = {
    onAnswer: vi.fn(),
    onNext: vi.fn(),
    onSubmit: vi.fn(),
    onBack: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('должен отображать текст вопроса', () => {
    render(
      <QuizQuestion
        question={mockQuestion}
        currentQuestionIndex={0}
        allQuestionsLength={5}
        answers={{}}
        isRetakingQuiz={false}
        isSubmitting={false}
        {...mockHandlers}
        showBackButton={false}
      />
    );

    expect(screen.getByText('Какой у вас тип кожи?')).toBeInTheDocument();
  });

  it('должен отображать опции для single_choice вопроса', () => {
    render(
      <QuizQuestion
        question={mockQuestion}
        currentQuestionIndex={0}
        allQuestionsLength={5}
        answers={{}}
        isRetakingQuiz={false}
        isSubmitting={false}
        {...mockHandlers}
        showBackButton={false}
      />
    );

    expect(screen.getByText('Сухая')).toBeInTheDocument();
    expect(screen.getByText('Жирная')).toBeInTheDocument();
    expect(screen.getByText('Комбинированная')).toBeInTheDocument();
  });

  it('должен вызывать onAnswer при выборе опции', async () => {
    render(
      <QuizQuestion
        question={mockQuestion}
        currentQuestionIndex={0}
        allQuestionsLength={5}
        answers={{}}
        isRetakingQuiz={false}
        isSubmitting={false}
        {...mockHandlers}
        showBackButton={false}
      />
    );

    const option = screen.getByText('Сухая');
    fireEvent.click(option);

    await waitFor(() => {
      expect(mockHandlers.onAnswer).toHaveBeenCalledWith(1, 'dry');
    });
  });

  it('должен отображать кнопку "Назад" если showBackButton=true', () => {
    render(
      <QuizQuestion
        question={mockQuestion}
        currentQuestionIndex={1}
        allQuestionsLength={5}
        answers={{}}
        isRetakingQuiz={false}
        isSubmitting={false}
        {...mockHandlers}
        showBackButton={true}
      />
    );

    expect(screen.getByText(/назад/i)).toBeInTheDocument();
  });

  it('должен вызывать onBack при клике на кнопку "Назад"', () => {
    render(
      <QuizQuestion
        question={mockQuestion}
        currentQuestionIndex={1}
        allQuestionsLength={5}
        answers={{}}
        isRetakingQuiz={false}
        isSubmitting={false}
        {...mockHandlers}
        showBackButton={true}
      />
    );

    const backButton = screen.getByText(/назад/i);
    fireEvent.click(backButton);

    expect(mockHandlers.onBack).toHaveBeenCalled();
  });

  it('должен показывать кнопку "Отправить" для последнего вопроса', () => {
    const lastQuestion = { ...mockQuestion, id: 5 };
    render(
      <QuizQuestion
        question={lastQuestion}
        currentQuestionIndex={4}
        allQuestionsLength={5}
        answers={{ 1: 'dry', 2: 'yes', 3: 'normal', 4: 'moisturizer' }}
        isRetakingQuiz={false}
        isSubmitting={false}
        {...mockHandlers}
        showBackButton={true}
      />
    );

    expect(screen.getByText(/отправить|завершить/i)).toBeInTheDocument();
  });

  it('должен показывать кнопку "Продолжить" для не последнего вопроса', () => {
    render(
      <QuizQuestion
        question={mockQuestion}
        currentQuestionIndex={0}
        allQuestionsLength={5}
        answers={{ 1: 'dry' }}
        isRetakingQuiz={false}
        isSubmitting={false}
        {...mockHandlers}
        showBackButton={false}
      />
    );

    expect(screen.getByText(/продолжить/i)).toBeInTheDocument();
  });

  it('должен отображать прогресс-бар', () => {
    render(
      <QuizQuestion
        question={mockQuestion}
        currentQuestionIndex={2}
        allQuestionsLength={5}
        answers={{}}
        isRetakingQuiz={false}
        isSubmitting={false}
        {...mockHandlers}
        showBackButton={true}
      />
    );

    // Проверяем наличие прогресс-бара (он должен показывать 3/5 или 60%)
    const progressText = screen.getByText(/3|60|из 5/i);
    expect(progressText).toBeInTheDocument();
  });

  it('не должен показывать прогресс-бар для вопроса user_name', () => {
    const nameQuestion: Question = {
      ...mockQuestion,
      code: 'user_name',
      type: 'free_text',
      text: 'Как вас зовут?',
      options: [],
    };

    render(
      <QuizQuestion
        question={nameQuestion}
        currentQuestionIndex={0}
        allQuestionsLength={5}
        answers={{}}
        isRetakingQuiz={false}
        isSubmitting={false}
        {...mockHandlers}
        showBackButton={false}
      />
    );

    // Прогресс-бар не должен отображаться для первого вопроса
    const progressText = screen.queryByText(/из 5/i);
    expect(progressText).not.toBeInTheDocument();
  });
});
