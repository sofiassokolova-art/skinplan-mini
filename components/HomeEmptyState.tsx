// components/HomeEmptyState.tsx
//
// Единый фолбэк-экран для /home: «нет плана» (CTA «Пройти анкету») и
// «ошибка загрузки» (CTA «Попробовать ещё раз / Пройти анкету»). Раньше
// эти два экрана были inline в home/page.tsx двумя почти идентичными
// JSX-блоками со сырым английским сообщением от API.
//
// Сообщение от API НИКОГДА не показывается напрямую — используется
// classifyError() для локализации.

'use client';

import { useRouter } from 'next/navigation';

export type HomeEmptyVariant = 'no-plan' | 'error';

export interface HomeEmptyStateProps {
  variant: HomeEmptyVariant;
  /** Сырая ошибка от API (Error.message, status и т. п.) — для логирования
   *  и локализации, в UI не показывается as-is. */
  rawError?: unknown;
  /** Кастомный обработчик retry. Если не передан, для error используется
   *  «Пройти анкету заново». */
  onRetry?: () => void;
}

interface LocalizedError {
  /** Заголовок экрана. */
  title: string;
  /** Подзаголовок — короткая, дружелюбная, на русском. */
  message: string;
  /** Подпись на кнопке. */
  cta: string;
}

/**
 * Превращаем что угодно из API-ошибки в локализованную копию.
 * Никогда не возвращаем сырое error?.message пользователю.
 */
function classifyError(rawError: unknown): LocalizedError {
  const err = (rawError ?? {}) as { status?: number; message?: string; isNotFound?: boolean };
  const status = typeof err.status === 'number' ? err.status : 0;
  const msg = (typeof rawError === 'string' ? rawError : err.message ?? '').toLowerCase();

  // 401 / auth — нужно пройти анкету (а скорее всего, открыть из Telegram).
  if (status === 401 || msg.includes('unauthorized') || msg.includes('initdata')) {
    return {
      title: 'Нужна авторизация',
      message: 'Откройте мини-приложение через Telegram, чтобы получить персональный план.',
      cta: 'Пройти анкету',
    };
  }

  // 404 / no profile — пользователь ещё не проходил анкету.
  if (status === 404 || err.isNotFound || msg.includes('no skin profile') || msg.includes('not found')) {
    return {
      title: 'Начнём с анкеты',
      message: 'Мы подберём персональный уход после короткой анкеты — это 5 минут.',
      cta: 'Пройти анкету',
    };
  }

  // 429 — rate limit.
  if (status === 429 || msg.includes('too many requests') || msg.includes('rate limit')) {
    return {
      title: 'Слишком много запросов',
      message: 'Попробуйте через несколько секунд.',
      cta: 'Попробовать ещё раз',
    };
  }

  // 5xx / network — серверная проблема.
  if (status >= 500 || msg.includes('network') || msg.includes('timeout') || msg.includes('failed to fetch')) {
    return {
      title: 'Что-то пошло не так',
      message: 'Сервер не отвечает. Попробуйте ещё раз через минуту.',
      cta: 'Попробовать ещё раз',
    };
  }

  // Всё остальное — дженерик.
  return {
    title: 'Что-то пошло не так',
    message: 'Не удалось загрузить рекомендации. Попробуйте ещё раз.',
    cta: 'Попробовать ещё раз',
  };
}

export function HomeEmptyState({ variant, rawError, onRetry }: HomeEmptyStateProps) {
  const router = useRouter();

  let title: string;
  let message: string;
  let cta: string;
  let onClick: () => void;

  if (variant === 'no-plan') {
    title = 'Начнём с анкеты';
    message = 'Мы подберём персональный уход после короткой анкеты — это 5 минут.';
    cta = 'Пройти анкету';
    onClick = () => router.push('/quiz');
  } else {
    const localised = classifyError(rawError);
    title = localised.title;
    message = localised.message;
    cta = localised.cta;
    // По умолчанию retry — это reload через quiz, как было в исходном коде.
    // Но если передан onRetry — используем его (для retry без перезагрузки страницы).
    onClick = onRetry ?? (() => router.push('/quiz'));
  }

  return (
    <div
      className="animate-fade-in app-bottom-nav-clearance"
      style={{
        minHeight: '100vh',
        background: 'var(--canvas)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        padding: '24px 24px var(--bottom-nav-clearance)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 360 }}>
        <h1
          style={{
            fontFamily: "var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '24px',
            lineHeight: 1.2,
            letterSpacing: '-0.4px',
            color: 'var(--ink)',
            margin: '0 0 12px',
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: '15px',
            lineHeight: 1.5,
            color: 'var(--ink-soft)',
            margin: '0 0 28px',
          }}
        >
          {message}
        </p>
        <button
          type="button"
          onClick={onClick}
          className="btn-primary"
          style={{
            cursor: 'pointer',
            fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          {cta}
        </button>
      </div>
    </div>
  );
}
