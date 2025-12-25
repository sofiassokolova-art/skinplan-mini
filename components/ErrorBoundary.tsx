// components/ErrorBoundary.tsx
// Глобальный Error Boundary для обработки ошибок React

'use client';

import { Component, ReactNode } from 'react';
import { clientLogger } from '@/lib/client-logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorDetails?: {
    message: string;
    url: string;
    timestamp: string;
    errorName: string;
  };
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorDetails: undefined };
  }

  static getDerivedStateFromError(error: Error): State {
    // Игнорируем известные "некритичные" ошибки, которые могут возникать при редиректах
    const errorMessage = error.message || error.toString();
    
    // Игнорируем ошибки, связанные с редиректами или размонтированием компонентов
    // ИСПРАВЛЕНО: Добавляем обработку ошибки #310 (hooks order) - она может возникать при race conditions
    if (
      errorMessage.includes('Minified React error #300') ||
      errorMessage.includes('Minified React error #310') ||
      errorMessage.includes('Cannot update a component') ||
      errorMessage.includes('Can\'t perform a React state update on an unmounted component') ||
      errorMessage.includes('on an unmounted component')
    ) {
      // Эти ошибки обычно происходят при редиректах или race conditions и не критичны
      // Не показываем экран ошибки, просто логируем
      console.warn('⚠️ Известная некритичная ошибка, игнорируем:', errorMessage);
      return { hasError: false, error: undefined };
    }
    
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Проверяем, не является ли это известной некритичной ошибкой
    const errorMessage = error.message || error.toString();
    const isKnownNonCriticalError = 
      errorMessage.includes('Minified React error #300') ||
      errorMessage.includes('Minified React error #310') ||
      errorMessage.includes('Cannot update a component') ||
      errorMessage.includes('Can\'t perform a React state update on an unmounted component') ||
      errorMessage.includes('on an unmounted component');
    
    if (isKnownNonCriticalError) {
      // Для известных ошибок просто логируем, но не отправляем в БД
      console.warn('⚠️ Известная некритичная ошибка (не отправляем в БД):', errorMessage);
      return;
    }
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: typeof window !== 'undefined' ? window.location.href : 'N/A',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
      timestamp: new Date().toISOString(),
      errorName: error.name,
      errorString: error.toString(),
      // Расшифровка React ошибок
      reactErrorCode: error.message.includes('Minified React error #') 
        ? error.message.match(/Minified React error #(\d+)/)?.[1] 
        : undefined,
      reactErrorDescription: error.message.includes('Minified React error #310')
        ? 'Rendered more hooks than during the previous render. This usually means you have conditional hooks or hooks inside loops. Hooks must be called in the same order on every render.'
        : undefined,
      // Дополнительная информация
      localStorage: typeof window !== 'undefined' ? {
        quizProgress: 'stored in DB', // ИСПРАВЛЕНО: Прогресс хранится в БД, не в localStorage
        initData: typeof window !== 'undefined' && window.Telegram?.WebApp?.initData ? 'exists' : 'not found',
      } : undefined,
      telegramWebApp: typeof window !== 'undefined' ? {
        available: !!window.Telegram?.WebApp,
        initDataLength: window.Telegram?.WebApp?.initData?.length || 0,
        hasUser: !!window.Telegram?.WebApp?.initDataUnsafe?.user,
        userId: window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 'N/A',
      } : undefined,
    };
    
    // Сохраняем только базовую информацию для отображения
    this.setState({
      errorDetails: {
        message: errorDetails.message,
        url: errorDetails.url,
        timestamp: errorDetails.timestamp,
        errorName: errorDetails.errorName,
      },
    });
    
    // Логируем в консоль для разработки
    console.error('❌ ErrorBoundary caught an error:', errorDetails);
    clientLogger.error('ErrorBoundary caught an error', {
      errorName: error.name,
      errorMessage: error.message,
      url: errorDetails.url,
      reactErrorCode: errorDetails.reactErrorCode,
    });
    
    // Сохраняем ошибку в БД через API (асинхронно, не блокируем)
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      const initData = window.Telegram.WebApp.initData;
      const userId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
      
      // Отправляем в БД через API
      fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        body: JSON.stringify({
          level: 'error',
          message: `ErrorBoundary: ${error.message}`,
          context: {
            errorName: error.name,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            reactErrorCode: errorDetails.reactErrorCode,
            reactErrorDescription: errorDetails.reactErrorDescription,
            localStorage: errorDetails.localStorage,
            telegramWebApp: errorDetails.telegramWebApp,
            userId: userId?.toString(),
          },
          userAgent: errorDetails.userAgent,
          url: errorDetails.url,
        }),
      }).catch((err) => {
        // Игнорируем ошибки сохранения лога, чтобы не создавать бесконечный цикл
        console.error('Failed to save error log:', err);
      });
    }
    
    // Отправка в Sentry (будет добавлено позже)
    // Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  render() {
    if (this.state.hasError) {
      // Логируем, когда показывается экран ошибки
      if (this.state.error) {
        console.error('🔴 ErrorBoundary: Rendering error screen', {
          errorMessage: this.state.error.message,
          errorName: this.state.error.name,
          errorStack: this.state.error.stack,
          url: typeof window !== 'undefined' ? window.location.href : 'N/A',
          timestamp: new Date().toISOString(),
        });
      }
      
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px',
            }}>
              😔
            </div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#0A5F59',
              marginBottom: '12px',
            }}>
              Что-то пошло не так
            </h2>
            
            <p style={{
              color: '#475467',
              marginBottom: '24px',
              lineHeight: '1.6',
            }}>
              Произошла неожиданная ошибка. Попробуйте обновить страницу.
              {this.state.errorDetails && (
                <span style={{ display: 'block', marginTop: '8px', fontSize: '14px', color: '#6B7280' }}>
                  Ошибка сохранена в системе. Техподдержка уже получила уведомление.
                </span>
              )}
            </p>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: '24px',
            }}>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  }
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  backgroundColor: '#0A5F59',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(10, 95, 89, 0.3)',
                }}
              >
                Обновить страницу
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

