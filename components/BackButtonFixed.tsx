'use client';

/**
 * Кнопка "Назад" в отдельном фиксированном контейнере через портал в body.
 * Контейнер position: fixed без transform, чтобы кнопка никогда не скроллилась с контентом
 * (transform у предков, например в PageTransition, ломает position: fixed у потомков).
 */
import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';

const BACK_BUTTON_SVG = (
  <svg width="12" height="20" viewBox="0 0 12 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2L2 10L10 18" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export interface BackButtonFixedProps {
  onClick: () => void;
  /** Показывать кнопку (если false, портал не рендерится) */
  show?: boolean;
}

function getBackButtonPortalRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById('back-button-portal-root');
}

export function BackButtonFixed({ onClick, show = true }: BackButtonFixedProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!show || !mounted) return null;

  const portalTarget = getBackButtonPortalRoot() || document.body;

  return createPortal(
    <div
      role="presentation"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '80px',
        height: '80px',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        style={{
          position: 'absolute',
          top: 'clamp(20px, 4vh, 40px)',
          left: 'clamp(19px, 5vw, 24px)',
          width: 44,
          height: 44,
          background: 'transparent',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          pointerEvents: 'auto',
        }}
      >
        {BACK_BUTTON_SVG}
      </button>
    </div>,
    portalTarget
  );
}
