// tests/hooks/useErrorHandler.test.ts
// Unit тесты для хука useErrorHandler

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useErrorHandler } from '@/hooks/useErrorHandler';

// Мок для clientLogger
vi.mock('@/lib/client-logger', () => ({
  clientLogger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('useErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('должен корректно инициализироваться с настройками по умолчанию', () => {
    const { result } = renderHook(() => useErrorHandler());

    expect(result.current).toHaveProperty('handleError');
    expect(result.current).toHaveProperty('handleAsyncError');
    expect(typeof result.current.handleError).toBe('function');
    expect(typeof result.current.handleAsyncError).toBe('function');
  });

  it('должен корректно инициализироваться с кастомными настройками', () => {
    const options = {
      componentName: 'TestComponent',
      logToConsole: false,
      logToServer: false,
      showToast: true,
    };

    const { result } = renderHook(() => useErrorHandler(options));

    expect(result.current).toHaveProperty('handleError');
    expect(result.current).toHaveProperty('handleAsyncError');
  });

  it('должен обрабатывать ошибки с логированием в консоль по умолчанию', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useErrorHandler());

    const testError = new Error('Test error');
    const context = { test: 'context' };

    act(() => {
      result.current.handleError(testError, context);
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      '❌ Unknown:',
      expect.objectContaining({
        component: 'Unknown',
        message: 'Test error',
        name: 'Error',
        context,
      })
    );

    consoleSpy.mockRestore();
  });

  it('должен обрабатывать ошибки с кастомным именем компонента', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() =>
      useErrorHandler({ componentName: 'CustomComponent' })
    );

    const testError = new Error('Custom error');

    act(() => {
      result.current.handleError(testError);
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      '❌ CustomComponent:',
      expect.objectContaining({
        component: 'CustomComponent',
        message: 'Custom error',
      })
    );

    consoleSpy.mockRestore();
  });

  it('должен отключать логирование в консоль при logToConsole: false', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() =>
      useErrorHandler({ logToConsole: false })
    );

    const testError = new Error('Test error');

    act(() => {
      result.current.handleError(testError);
    });

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('должен обрабатывать асинхронные ошибки', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useErrorHandler());

    const failingPromise = Promise.reject(new Error('Async error'));
    const context = { operation: 'test' };

    await expect(
      act(async () => {
        await result.current.handleAsyncError(failingPromise, context);
      })
    ).rejects.toThrow('Async error');

    expect(consoleSpy).toHaveBeenCalledWith(
      '❌ Unknown:',
      expect.objectContaining({
        component: 'Unknown',
        message: 'Async error',
        context: { ...context, asyncOperation: true },
      })
    );

    consoleSpy.mockRestore();
  });

  it('должен возвращать успешный результат для resolved промисов', async () => {
    const { result } = renderHook(() => useErrorHandler());

    const successfulPromise = Promise.resolve('success');
    const context = { operation: 'test' };

    let resultValue;
    await act(async () => {
      resultValue = await result.current.handleAsyncError(successfulPromise, context);
    });

    expect(resultValue).toBe('success');
  });

  it('должен возвращать детали ошибки', () => {
    const { result } = renderHook(() =>
      useErrorHandler({ componentName: 'TestComponent' })
    );

    const testError = new Error('Test error');
    testError.stack = 'Test stack';
    const context = { test: 'data' };

    let errorDetails;
    act(() => {
      errorDetails = result.current.handleError(testError, context);
    });

    expect(errorDetails).toEqual(
      expect.objectContaining({
        component: 'TestComponent',
        message: 'Test error',
        stack: 'Test stack',
        name: 'Error',
        context,
        timestamp: expect.any(String),
        url: expect.any(String),
      })
    );
  });
});