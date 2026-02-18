// hooks/usePerformanceMonitor.ts
// Хук для мониторинга производительности компонентов

'use client';

import { useEffect, useRef } from 'react';
import { clientLogger } from '@/lib/client-logger';

interface PerformanceMetrics {
  renderTime: number;
  mountTime: number;
  updateCount: number;
}

export function usePerformanceMonitor(componentName: string, enabled: boolean = true) {
  const mountTimeRef = useRef<number>(0);
  const renderStartRef = useRef<number>(0);
  const metricsRef = useRef<PerformanceMetrics>({
    renderTime: 0,
    mountTime: 0,
    updateCount: 0,
  });

  // Мониторинг времени монтирования
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const mountStart = performance.now();
    mountTimeRef.current = mountStart;

    return () => {
      const mountEnd = performance.now();
      const mountTime = mountEnd - mountStart;

      metricsRef.current.mountTime = mountTime;

      // Логируем время монтирования только если оно значительное (> 100ms)
      if (mountTime > 100) {
        clientLogger.log(`Performance: ${componentName} mount time`, {
          component: componentName,
          mountTime: Math.round(mountTime),
          timestamp: new Date().toISOString(),
        });
      }
    };
  }, [componentName, enabled]);

  // Мониторинг времени рендеринга
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const renderStart = performance.now();
    renderStartRef.current = renderStart;
    metricsRef.current.updateCount++;

    const renderEnd = performance.now();
    const renderTime = renderEnd - renderStart;
    metricsRef.current.renderTime = renderTime;

    // Логируем медленные рендеры (> 16ms - больше одного кадра)
    if (renderTime > 16) {
      clientLogger.log(`Performance: ${componentName} slow render`, {
        component: componentName,
        renderTime: Math.round(renderTime),
        updateCount: metricsRef.current.updateCount,
        timestamp: new Date().toISOString(),
      });
    }
  });

  return metricsRef.current;
}