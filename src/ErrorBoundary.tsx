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
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-red-200 text-center max-w-sm">
            <div className="text-2xl mb-2">⚠️</div>
            <h2 className="text-lg font-bold mb-2">Что-то пошло не так</h2>
            <p className="text-sm text-gray-600 mb-4">
              Произошла ошибка при загрузке. Попробуйте обновить страницу.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition"
            >
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;