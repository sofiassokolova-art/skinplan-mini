// SkinIQ Logo Component
// Использует шрифт Satoshi Bold (подключен через Fontshare API в index.html)
// Если нужны локальные файлы, добавьте @font-face в index.css
import React from 'react';

interface SkinIQLogoProps {
  size?: number;
  isDark?: boolean;
  className?: string;
}

export default function SkinIQLogo({ 
  size = 36, 
  isDark = false,
  className = ''
}: SkinIQLogoProps) {
  return (
    <h1 
      className={`font-black tracking-tight ${className}`}
      style={{
        fontSize: `${size}px`,
        fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: 700, // Satoshi Bold
        letterSpacing: '0.6px', // 0.6sp как в оригинале
        color: isDark ? '#FFFFFF' : '#0A5F59',
        margin: 0,
        padding: 0,
        lineHeight: 1,
        display: 'inline-block'
      }}
    >
      SkinIQ
    </h1>
  );
}

