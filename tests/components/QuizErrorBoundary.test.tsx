// tests/components/QuizErrorBoundary.test.tsx
// Unit тесты для QuizErrorBoundary компонентов

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  QuizErrorBoundary,
  QuestionErrorBoundary,
  ScreenErrorBoundary
} from '@/components/QuizErrorBoundary';

// Компонент, который выбрасывает ошибку
const ErrorThrowingComponent = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Компонент с кнопкой для тестирования retry
const ErrorWithRetryComponent = () => {
  const [shouldThrow, setShouldThrow] = React.useState(true);

  if (shouldThrow) {
    throw new Error('Retryable error');
  }

  return (
    <div>
      <p>Recovered from error</p>
      <button onClick={() => setShouldThrow(true)}>Throw again</button>
    </div>
  );
};

// Импортируем React для использования в тестах
import React from 'react';

describe('QuizErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Очищаем консоль перед каждым тестом
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('должен рендерить дочерние компоненты без ошибок', () => {
    render(
      <QuizErrorBoundary>
        <div>Test content</div>
      </QuizErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('должен отображать fallback UI при ошибке', () => {
    // Подавляем ошибку в консоль для чистоты теста
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(
        <QuizErrorBoundary>
          <ErrorThrowingComponent />
        </QuizErrorBoundary>
      );
    }).not.toThrow();

    expect(screen.getByText('Ошибка в компоненте квиза')).toBeInTheDocument();
    expect(screen.getByText(/Test error/)).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('должен позволять перезагрузку при клике на кнопку retry', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <QuizErrorBoundary>
        <ErrorWithRetryComponent />
      </QuizErrorBoundary>
    );

    // Ошибка должна быть поймана и показан fallback
    expect(screen.getByText('Ошибка в компоненте квиза')).toBeInTheDocument();

    // Кликаем на кнопку retry
    fireEvent.click(screen.getByText(/Повторить попытку/));

    // После retry ошибка должна быть поймана снова
    expect(screen.getByText('Ошибка в компоненте квиза')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('должен использовать кастомный fallback если предоставлен', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const customFallback = <div>Custom error message</div>;

    render(
      <QuizErrorBoundary fallback={customFallback}>
        <ErrorThrowingComponent />
      </QuizErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('должен передавать componentName в обработчик ошибок', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <QuizErrorBoundary componentName="TestComponent">
        <ErrorThrowingComponent />
      </QuizErrorBoundary>
    );

    // Проверяем что в сообщении об ошибке есть имя компонента
    expect(consoleSpy).toHaveBeenCalledWith(
      '❌ QuizErrorBoundary (TestComponent):',
      expect.objectContaining({
        error: 'Test error',
        componentStack: expect.stringContaining('ErrorThrowingComponent'),
      })
    );

    consoleSpy.mockRestore();
  });
});

describe('QuestionErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('должен отображать специфичный для вопросов fallback UI', () => {
    render(
      <QuestionErrorBoundary>
        <ErrorThrowingComponent />
      </QuestionErrorBoundary>
    );

    expect(screen.getByText('Ошибка загрузки вопроса')).toBeInTheDocument();
    expect(screen.getByText(/Не удалось загрузить вопрос/)).toBeInTheDocument();
    expect(screen.getByText('Попробовать снова')).toBeInTheDocument();
  });
});

describe('ScreenErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('должен отображать специфичный для экранов fallback UI', () => {
    render(
      <ScreenErrorBoundary>
        <ErrorThrowingComponent />
      </ScreenErrorBoundary>
    );

    expect(screen.getByText('Ошибка экрана')).toBeInTheDocument();
    expect(screen.getByText(/Не удалось загрузить экран/)).toBeInTheDocument();
    expect(screen.getByText('Повторить')).toBeInTheDocument();
    expect(screen.getByText('Назад')).toBeInTheDocument();
  });

  it('должен вызывать window.history.back при клике на кнопку "Назад"', () => {
    const backSpy = vi.fn();
    Object.defineProperty(window, 'history', {
      value: { back: backSpy },
      writable: true,
    });

    render(
      <ScreenErrorBoundary>
        <ErrorThrowingComponent />
      </ScreenErrorBoundary>
    );

    fireEvent.click(screen.getByText('Назад'));

    expect(backSpy).toHaveBeenCalled();
  });
});

describe('Error Boundary Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('должен корректно работать с вложенными error boundaries', () => {
    render(
      <QuizErrorBoundary componentName="Outer">
        <ScreenErrorBoundary componentName="Inner">
          <ErrorThrowingComponent />
        </ScreenErrorBoundary>
      </QuizErrorBoundary>
    );

    // Должен отобразиться fallback от внутреннего boundary (ScreenErrorBoundary)
    expect(screen.getByText('Ошибка экрана')).toBeInTheDocument();
    expect(screen.queryByText('Ошибка в компоненте квиза')).not.toBeInTheDocument();
  });

  it('должен игнорировать известные некритичные ошибки React', () => {
    // Мокаем console.warn чтобы проверить, что вызывается для известных ошибок
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const error300 = new Error('Minified React error #300');

    // Создаем компонент, который выбрасывает известную ошибку
    const KnownErrorComponent = () => {
      throw error300;
    };

    // Ожидаем, что компонент все равно выбросит ошибку (так как error boundary не предотвращает throw)
    expect(() => {
      render(
        <QuizErrorBoundary>
          <KnownErrorComponent />
        </QuizErrorBoundary>
      );
    }).toThrow();

    // Проверяем, что была вызвана console.warn для известной ошибки
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '⚠️ Quiz ErrorBoundary: Известная некритичная ошибка, игнорируем:',
      'Minified React error #300'
    );

    consoleWarnSpy.mockRestore();
  });
});