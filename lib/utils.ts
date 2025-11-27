// lib/utils.ts
// Утилиты для работы с классами и стилями

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Glassmorphism стили для карточек
export const glassCard = 'bg-white/6 backdrop-blur-2xl border border-white/10 rounded-3xl';
export const glassCardHover = 'hover:bg-white/8 hover:border-white/20 hover:shadow-[0_8px_32px_rgba(139,92,246,0.3)] hover:-translate-y-2 transition-all duration-300';

// Неон стили
export const neonPurple = 'text-[#8B5CF6]';
export const neonPink = 'text-[#EC4899]';
export const neonBorder = 'border-[#8B5CF6]';
export const neonGradient = 'bg-gradient-to-r from-[#8B5CF6] to-[#EC4899]';

