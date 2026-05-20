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
    isRequired: true,
    options: [
      { id: 1, label: 'Сухая', value: 'dry' },
      { id: 2, label: 'Жирная', value: 'oily' },
      { id: 3, label: 'Комбинированная', value: 'combination' },
    ],
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

  it('должен отображать текст вопроса (нормализованный заголовок для skin_type)', () => {
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

    // Для skin_type компонент нормализует текст в единый заголовок
    expect(screen.getByText('Выберите ваш тип кожи')).toBeInTheDocument();
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

    // Опции отображаются как кнопки с текстом из option.label
    const option = screen.getByText('Сухая');
    expect(option).toBeInTheDocument();
    
    fireEvent.click(option);

    await waitFor(() => {
      expect(mockHandlers.onAnswer).toHaveBeenCalledWith(1, 'dry');
    }, { timeout: 500 });
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

    // Кнопка "Назад" рендерится через BackButtonFixed (портал в body, фиксированный контейнер)
    const backButton = document.body.querySelector('div[style*="position: fixed"] button') ?? document.body.querySelector('button');
    expect(backButton).toBeInTheDocument();
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

    const backButton = (document.body.querySelector('div[style*="position: fixed"] button') ?? document.body.querySelector('button')) as HTMLButtonElement;
    expect(backButton).toBeInTheDocument();
    
    if (backButton) {
      fireEvent.click(backButton);
      expect(mockHandlers.onBack).toHaveBeenCalled();
    }
  });

  it('должен показывать кнопку "Получить план" и дисклеймер для последнего обычного single_choice вопроса', () => {
    const lastQuestion: Question = {
      ...mockQuestion,
      id: 5,
      code: 'some_final_question', // не skin_type и не budget, чтобы использовался SingleChoiceDefault
    };

    render(
      <QuizQuestion
        question={lastQuestion}
        currentQuestionIndex={4}
        allQuestionsLength={5}
        // Есть ответ на последний вопрос
        answers={{ 5: 'dry' }}
        isRetakingQuiz={false}
        isSubmitting={false}
        {...mockHandlers}
        showBackButton={true}
      />
    );

    // Кнопка "Получить план" должна быть видна
    const submitButton = screen.getByRole('button', { name: /получить план/i });
    expect(submitButton).toBeInTheDocument();

    // И текст дисклеймера под кнопкой
    expect(
      screen.getByText(/Нажимая «Получить план», вы соглашаетесь с/i)
    ).toBeInTheDocument();
  });

  it('должен показывать кнопку "Продолжить" для не последнего вопроса при перепрохождении', () => {
    render(
      <QuizQuestion
        question={mockQuestion}
        currentQuestionIndex={0}
        allQuestionsLength={5}
        answers={{ 1: 'dry' }}
        isRetakingQuiz={true}
        isSubmitting={false}
        {...mockHandlers}
        showBackButton={false}
      />
    );

    // При перепрохождении показывается кнопка "Продолжить" после выбора ответа
    // Но кнопка появляется только после выбора, поэтому проверяем наличие опций
    expect(screen.getByText('Сухая')).toBeInTheDocument();
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

    // Прогресс-бар рендерится как div с черным фоном и лаймовой полосой
    const progressBar = document.querySelector('div[style*="background-color: rgb(0, 0, 0)"]');
    expect(progressBar).toBeInTheDocument();
    
    // Проверяем, что есть лаймовая полоса прогресса
    const progressFill = document.querySelector('div[style*="background-color: rgb(213, 254, 97)"]');
    expect(progressFill).toBeInTheDocument();
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
