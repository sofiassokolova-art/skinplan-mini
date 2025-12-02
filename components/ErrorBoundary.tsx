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
  errorDetails?: {
    message: string;
    stack?: string;
    componentStack?: string;
    url: string;
    timestamp: string;
    errorName: string;
    localStorage?: {
      quizProgress: string;
      initData: string;
    };
    telegramWebApp?: {
      available: boolean;
      initDataLength: number;
      hasUser: boolean;
      userId: string | number;
    };
  };
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorDetails: undefined };
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
      } : undefined,
      telegramWebApp: typeof window !== 'undefined' ? {
        available: !!window.Telegram?.WebApp,
        initDataLength: window.Telegram?.WebApp?.initData?.length || 0,
        hasUser: !!window.Telegram?.WebApp?.initDataUnsafe?.user,
        userId: window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 'N/A',
      } : undefined,
    };
    
    // Сохраняем детали ошибки в state для отображения на экране
    this.setState({
      errorDetails: {
        message: errorDetails.message,
        stack: errorDetails.stack,
        componentStack: errorDetails.componentStack,
        url: errorDetails.url,
        timestamp: errorDetails.timestamp,
        errorName: errorDetails.errorName,
        localStorage: errorDetails.localStorage,
        telegramWebApp: errorDetails.telegramWebApp,
      },
    });
    
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
            
            {/* Показываем основное сообщение об ошибке сразу */}
            {this.state.errorDetails && (
              <div style={{
                marginBottom: '24px',
                padding: '16px',
                backgroundColor: '#FEF2F2',
                borderRadius: '12px',
                border: '1px solid #FCA5A5',
                textAlign: 'left',
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ color: '#991B1B', fontSize: '14px' }}>Тип ошибки:</strong>
                  <div style={{ color: '#475467', marginTop: '4px', fontSize: '16px', fontWeight: '600' }}>
                    {this.state.errorDetails.errorName}
                  </div>
                </div>
                <div>
                  <strong style={{ color: '#991B1B', fontSize: '14px' }}>Сообщение:</strong>
                  <div style={{ color: '#475467', marginTop: '4px', fontSize: '16px', wordBreak: 'break-word' }}>
                    {this.state.errorDetails.message || 'Нет сообщения'}
                  </div>
                </div>
              </div>
            )}
            
            <p style={{
              color: '#475467',
              marginBottom: '24px',
              lineHeight: '1.6',
            }}>
              Произошла неожиданная ошибка. Попробуйте обновить страницу.
            </p>
            
            {/* Показываем детали ошибки всегда */}
            {this.state.errorDetails && (
              <details open style={{
                marginTop: '24px',
                textAlign: 'left',
                padding: '16px',
                backgroundColor: '#F9FAFB',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                width: '100%',
              }}>
                <summary style={{
                  cursor: 'pointer',
                  color: '#475467',
                  fontWeight: '600',
                  marginBottom: '12px',
                  fontSize: '16px',
                }}>
                  🔍 Подробные детали ошибки (нажмите, чтобы свернуть)
                </summary>
                <div style={{
                  marginTop: '12px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                }}>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#991B1B' }}>Тип ошибки:</strong>
                    <div style={{ color: '#475467', marginTop: '4px' }}>
                      {this.state.errorDetails.errorName}
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#991B1B' }}>Сообщение:</strong>
                    <div style={{ color: '#475467', marginTop: '4px', wordBreak: 'break-word' }}>
                      {this.state.errorDetails.message || 'Нет сообщения'}
                    </div>
                  </div>
                  
                  {this.state.errorDetails.url && (
                    <div style={{ marginBottom: '12px' }}>
                      <strong style={{ color: '#991B1B' }}>Страница:</strong>
                      <div style={{ color: '#475467', marginTop: '4px', wordBreak: 'break-word', fontSize: '12px' }}>
                        {this.state.errorDetails.url}
                      </div>
                    </div>
                  )}
                  
                  {this.state.errorDetails.telegramWebApp && (
                    <div style={{ marginBottom: '12px' }}>
                      <strong style={{ color: '#991B1B' }}>Telegram WebApp:</strong>
                      <div style={{ color: '#475467', marginTop: '4px', fontSize: '12px' }}>
                        Доступен: {this.state.errorDetails.telegramWebApp.available ? '✅' : '❌'}<br/>
                        InitData длина: {this.state.errorDetails.telegramWebApp.initDataLength}<br/>
                        Пользователь: {this.state.errorDetails.telegramWebApp.hasUser ? `✅ (ID: ${this.state.errorDetails.telegramWebApp.userId})` : '❌'}
                      </div>
                    </div>
                  )}
                  
                  {this.state.errorDetails.localStorage && (
                    <div style={{ marginBottom: '12px' }}>
                      <strong style={{ color: '#991B1B' }}>LocalStorage:</strong>
                      <div style={{ color: '#475467', marginTop: '4px', fontSize: '12px' }}>
                        Quiz Progress: {this.state.errorDetails.localStorage.quizProgress}<br/>
                        InitData: {this.state.errorDetails.localStorage.initData}
                      </div>
                    </div>
                  )}
                  
                  {this.state.errorDetails.stack && (
                    <div style={{ marginBottom: '12px' }}>
                      <strong style={{ color: '#991B1B' }}>Стек ошибки:</strong>
                      <pre style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.05)',
                        padding: '12px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        overflow: 'auto',
                        marginTop: '8px',
                        color: '#991B1B',
                        maxHeight: '200px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}>
                        {this.state.errorDetails.stack}
                      </pre>
                    </div>
                  )}
                  
                  {this.state.errorDetails.componentStack && (
                    <div style={{ marginBottom: '12px' }}>
                      <strong style={{ color: '#991B1B' }}>Компонент:</strong>
                      <pre style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.05)',
                        padding: '12px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        overflow: 'auto',
                        marginTop: '8px',
                        color: '#991B1B',
                        maxHeight: '150px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}>
                        {this.state.errorDetails.componentStack}
                      </pre>
                    </div>
                  )}
                  
                  <div style={{ marginTop: '12px', fontSize: '11px', color: '#6B7280' }}>
                    Время: {new Date(this.state.errorDetails.timestamp).toLocaleString('ru-RU')}
                  </div>
                </div>
              </details>
            )}
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: '24px',
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
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

