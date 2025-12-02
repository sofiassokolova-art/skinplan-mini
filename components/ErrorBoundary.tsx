// components/ErrorBoundary.tsx
// Глобальный Error Boundary для обработки ошибок React

'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: typeof window !== 'undefined' ? window.location.href : 'N/A',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
      timestamp: new Date().toISOString(),
      errorName: error.name,
      errorString: error.toString(),
      // Дополнительная информация
      localStorage: typeof window !== 'undefined' ? {
        quizProgress: localStorage.getItem('quiz_progress') ? 'exists' : 'not found',
        initData: typeof window !== 'undefined' && window.Telegram?.WebApp?.initData ? 'exists' : 'not found',
      } : 'N/A',
      telegramWebApp: typeof window !== 'undefined' ? {
        available: !!window.Telegram?.WebApp,
        initDataLength: window.Telegram?.WebApp?.initData?.length || 0,
        hasUser: !!window.Telegram?.WebApp?.initDataUnsafe?.user,
        userId: window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 'N/A',
      } : 'N/A',
    };
    
    // Подробное логирование ошибки
    console.error('❌ ErrorBoundary caught an error:', errorDetails);
    console.error('📋 Full error object:', error);
    console.error('📋 Error info:', errorInfo);
    console.error('📋 Error details (formatted):', JSON.stringify(errorDetails, null, 2));
    
    // Логируем все свойства ошибки
    if (error) {
      console.error('📋 Error properties:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: (error as any).cause,
        // Любые дополнительные свойства
        ...Object.getOwnPropertyNames(error).reduce((acc, key) => {
          if (key !== 'name' && key !== 'message' && key !== 'stack') {
            acc[key] = (error as any)[key];
          }
          return acc;
        }, {} as Record<string, any>),
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
            </p>
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}>
              <button
                onClick={() => window.location.reload()}
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
            {(process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_SHOW_ERROR_DETAILS === 'true') && this.state.error && (
              <details style={{
                marginTop: '24px',
                textAlign: 'left',
                padding: '16px',
                backgroundColor: '#FEF2F2',
                borderRadius: '12px',
                border: '1px solid #FCA5A5',
              }}>
                <summary style={{
                  cursor: 'pointer',
                  color: '#991B1B',
                  fontWeight: '600',
                  marginBottom: '8px',
                }}>
                  Детали ошибки (только для разработки)
                </summary>
                <pre style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  overflow: 'auto',
                  marginTop: '8px',
                  color: '#991B1B',
                  maxHeight: '300px',
                }}>
                  {this.state.error.toString()}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

