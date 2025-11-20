import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    console.error('Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-red-200 text-center max-w-sm">
            <div className="text-2xl mb-2">⚠️</div>
            <h2 className="text-lg font-bold mb-2">Что-то пошло не так</h2>
            <p className="text-sm text-gray-600 mb-4">
              {this.state.error?.message || 'Произошла ошибка при загрузке. Попробуйте обновить страницу.'}
            </p>
            {this.state.error && (
              <details className="text-xs text-left mb-4 p-2 bg-gray-50 rounded">
                <summary className="cursor-pointer font-semibold mb-2">Детали ошибки</summary>
                <pre className="whitespace-pre-wrap break-words text-xs">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <button 
              onClick={() => {
                // Clear localStorage if needed
                try {
                  localStorage.removeItem('skinQuizCompleted');
                  localStorage.removeItem('firstStepHintShown');
                } catch (e) {}
                window.location.reload();
              }}
              className="w-full px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition mb-2"
            >
              Обновить страницу
            </button>
            <button 
              onClick={() => {
                // Reset error boundary
                this.setState({ hasError: false, error: undefined });
              }}
              className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition text-sm"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;