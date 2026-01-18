// components/QuizErrorBoundary.tsx
// Специализированные error boundaries для компонентов квиза

'use client';

import { Component, ReactNode } from 'react';
import { clientLogger } from '@/lib/client-logger';

interface Props {
  children: ReactNode;
  componentName?: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  retryCount: number;
}

const MAX_RETRY_COUNT = 2;

// Quiz-specific error boundary
export class QuizErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    const errorMessage = error.message || error.toString();

    // Игнорируем известные "некритичные" ошибки
    if (
      errorMessage.includes('Minified React error #300') ||
      errorMessage.includes('Minified React error #310') ||
      errorMessage.includes('Cannot update a component') ||
      errorMessage.includes('Can\'t perform a React state update on an unmounted component') ||
      errorMessage.includes('on an unmounted component')
    ) {
      console.warn('⚠️ Quiz ErrorBoundary: Известная некритичная ошибка, игнорируем:', errorMessage);
      return { hasError: false, error: undefined, retryCount: 0 };
    }

    return { hasError: true, error, retryCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    const errorMessage = error.message || error.toString();
    const isKnownNonCriticalError =
      errorMessage.includes('Minified React error #300') ||
      errorMessage.includes('Minified React error #310') ||
      errorMessage.includes('Cannot update a component') ||
      errorMessage.includes('Can\'t perform a React state update on an unmounted component') ||
      errorMessage.includes('on an unmounted component');

    if (isKnownNonCriticalError) {
      console.warn('⚠️ Quiz ErrorBoundary: Известная некритичная ошибка (не отправляем в БД):', errorMessage);
      return;
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log with component context
    console.error(`❌ QuizErrorBoundary (${this.props.componentName || 'unknown'}):`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
    });

    clientLogger.error(`QuizErrorBoundary (${this.props.componentName || 'unknown'})`, {
      errorName: error.name,
      errorMessage: error.message,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
    });
  }

  handleRetry = () => {
    if (this.state.retryCount < MAX_RETRY_COUNT) {
      console.log(`🔄 QuizErrorBoundary: Retrying (${this.state.retryCount + 1}/${MAX_RETRY_COUNT})`);
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '16px',
          margin: '16px 0',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '8px',
          color: '#991B1B',
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
            Ошибка в компоненте квиза
          </h3>
          <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
            {this.state.error?.message || 'Произошла неизвестная ошибка'}
          </p>
          {this.state.retryCount < MAX_RETRY_COUNT && (
            <button
              onClick={this.handleRetry}
              style={{
                marginTop: '8px',
                padding: '4px 8px',
                backgroundColor: '#991B1B',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Повторить попытку ({this.state.retryCount + 1}/{MAX_RETRY_COUNT})
            </button>
          )}
          {this.state.retryCount >= MAX_RETRY_COUNT && (
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#7F1D1D' }}>
              Превышено максимальное количество попыток. Обновите страницу.
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Error boundary specifically for question components
export class QuestionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, retryCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error(`❌ QuestionErrorBoundary (${this.props.componentName || 'question'}):`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    clientLogger.error(`QuestionErrorBoundary (${this.props.componentName || 'question'})`, {
      errorName: error.name,
      errorMessage: error.message,
      componentStack: errorInfo.componentStack,
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < MAX_RETRY_COUNT) {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '20px',
          margin: '20px 0',
          backgroundColor: '#FFF7ED',
          border: '1px solid #FED7AA',
          borderRadius: '12px',
          color: '#9A3412',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
            Ошибка загрузки вопроса
          </h4>
          <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>
            Не удалось загрузить вопрос. Это может быть связано с проблемой сети или данными.
          </p>
          {this.state.retryCount < MAX_RETRY_COUNT && (
            <button
              onClick={this.handleRetry}
              style={{
                padding: '8px 16px',
                backgroundColor: '#9A3412',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Попробовать снова
            </button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Error boundary for screen-level components
export class ScreenErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, retryCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error(`❌ ScreenErrorBoundary (${this.props.componentName || 'screen'}):`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    clientLogger.error(`ScreenErrorBoundary (${this.props.componentName || 'screen'})`, {
      errorName: error.name,
      errorMessage: error.message,
      componentStack: errorInfo.componentStack,
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < MAX_RETRY_COUNT) {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          minHeight: '50vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backgroundColor: '#F9FAFB',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>🚨</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#111827' }}>
              Ошибка экрана
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6B7280' }}>
              Не удалось загрузить экран. Попробуйте обновить страницу или вернитесь назад.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {this.state.retryCount < MAX_RETRY_COUNT && (
                <button
                  onClick={this.handleRetry}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3B82F6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Повторить
                </button>
              )}
              <button
                onClick={() => window.history.back()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6B7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Назад
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}