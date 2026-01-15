// app/(miniapp)/components/WebVitals.tsx
// Компонент для отслеживания Web Vitals метрик

'use client';

import { useEffect } from 'react';
import { reportWebVitals } from '@/lib/utils/performance-monitor';

/**
 * Компонент для отслеживания Web Vitals метрик
 * Автоматически собирает и отправляет метрики производительности
 */
export function WebVitalsTracker() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Отслеживаем Web Vitals только в браузере
    const trackWebVitals = async () => {
      try {
        // Используем PerformanceObserver для отслеживания метрик
        if ('PerformanceObserver' in window) {
          // LCP (Largest Contentful Paint)
          try {
            const lcpObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const lastEntry = entries[entries.length - 1] as any;
              if (lastEntry) {
                reportWebVitals({ lcp: lastEntry.renderTime || lastEntry.loadTime });
              }
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
          } catch (e) {
            // Игнорируем ошибки, если API не поддерживается
          }

          // FID (First Input Delay)
          try {
            const fidObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              entries.forEach((entry: any) => {
                if (entry.processingStart && entry.startTime) {
                  const fid = entry.processingStart - entry.startTime;
                  reportWebVitals({ fid });
                }
              });
            });
            fidObserver.observe({ entryTypes: ['first-input'] });
          } catch (e) {
            // Игнорируем ошибки, если API не поддерживается
          }

          // CLS (Cumulative Layout Shift)
          try {
            let clsValue = 0;
            const clsObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              entries.forEach((entry: any) => {
                if (!entry.hadRecentInput) {
                  clsValue += entry.value;
                }
              });
              reportWebVitals({ cls: clsValue });
            });
            clsObserver.observe({ entryTypes: ['layout-shift'] });
          } catch (e) {
            // Игнорируем ошибки, если API не поддерживается
          }

          // FCP (First Contentful Paint)
          try {
            const fcpObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              entries.forEach((entry: any) => {
                if (entry.name === 'first-contentful-paint') {
                  reportWebVitals({ fcp: entry.startTime });
                }
              });
            });
            fcpObserver.observe({ entryTypes: ['paint'] });
          } catch (e) {
            // Игнорируем ошибки, если API не поддерживается
          }
        }

        // TTFB (Time to First Byte) - из navigation timing
        if ('performance' in window && 'timing' in window.performance) {
          const timing = (window.performance as any).timing;
          if (timing.responseStart && timing.requestStart) {
            const ttfb = timing.responseStart - timing.requestStart;
            reportWebVitals({ ttfb });
          }
        }
      } catch (error) {
        // Игнорируем ошибки отслеживания
        console.debug('Web Vitals tracking error', error);
      }
    };

    // Запускаем отслеживание после загрузки страницы
    if (document.readyState === 'complete') {
      trackWebVitals();
    } else {
      window.addEventListener('load', trackWebVitals);
      return () => {
        window.removeEventListener('load', trackWebVitals);
      };
    }
  }, []);

  return null; // Компонент не рендерит ничего
}
