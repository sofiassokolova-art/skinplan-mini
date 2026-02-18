// hooks/useErrorHandler.ts
// Хук для обработки ошибок в компонентах

'use client';

import { useCallback } from 'react';
import { clientLogger } from '@/lib/client-logger';

export interface ErrorHandlerOptions {
  componentName?: string;
  logToConsole?: boolean;
  logToServer?: boolean;
  showToast?: boolean;
}

export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const {
    componentName = 'Unknown',
    logToConsole = true,
    logToServer = true,
    showToast = false,
  } = options;

  const handleError = useCallback((error: Error, context?: any) => {
    const errorDetails = {
      component: componentName,
      message: error.message,
      stack: error.stack,
      name: error.name,
      context,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'N/A',
    };

    if (logToConsole) {
      console.error(`❌ ${componentName}:`, errorDetails);
    }

    if (logToServer) {
      clientLogger.error(`${componentName}: ${error.message}`, {
        errorName: error.name,
        errorStack: error.stack,
        component: componentName,
        context,
      });
    }

    if (showToast) {
      // TODO: Implement toast notification
      console.warn('Toast notifications not implemented yet');
    }

    // Return error details for potential use in error boundaries
    return errorDetails;
  }, [componentName, logToConsole, logToServer, showToast]);

  const handleAsyncError = useCallback(async (promise: Promise<any>, context?: any) => {
    try {
      return await promise;
    } catch (error) {
      handleError(error as Error, { ...context, asyncOperation: true });
      throw error; // Re-throw to allow caller to handle
    }
  }, [handleError]);

  return {
    handleError,
    handleAsyncError,
  };
}