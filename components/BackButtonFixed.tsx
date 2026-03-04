'use client';

/**
 * Кнопка "Назад" в фиксированном контейнере (портал в body).
 * Положение как раньше: блок 80×80 в левом верхнем углу, кнопка внутри.
 */
import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';

const BACK_BUTTON_CONTAINER_ID = 'back-button-fixed-container';

function BackButtonIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="20" viewBox="0 0 12 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2L2 10L10 18" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface BackButtonFixedProps {
  onClick: () => void;
  /** Показывать кнопку (если false, портал не рендерится) */
  show?: boolean;
  /** Цвет иконки (по умолчанию тёмный) */
  color?: string;
}

/** Создаёт или возвращает контейнер для кнопки «Назад», всегда прямой потомок body */
function getOrCreateBackButtonContainer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(BACK_BUTTON_CONTAINER_ID);
  if (!el && document.body) {
    el = document.createElement('div');
    el.id = BACK_BUTTON_CONTAINER_ID;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;top:0;left:0;width:80px;height:80px;pointer-events:none;z-index:99999;';
    document.body.appendChild(el);
  }
  return el;
}

export function BackButtonFixed({ onClick, show = true, color = '#1A1A1A' }: BackButtonFixedProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const root = getOrCreateBackButtonContainer();
    setPortalRoot(root);
    return () => {};
  }, []);

  if (!show || !portalRoot) return null;

  return createPortal(
    <div
      role="presentation"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 80,
        height: 80,
        zIndex: 100000,
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
          left: 'clamp(12px, 4vw, 20px)',
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
        <BackButtonIcon color={color} />
      </button>
    </div>,
    portalRoot
  );
}
