// lib/utils.ts
// Утилиты для работы с классами и стилями

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Glassmorphism стили для карточек
export const glassCard = 'glass rounded-2xl';
export const glassCardHover = 'glass glass-hover';
export const glassCardDark = 'glass-dark rounded-2xl';
export const glassCardGray = 'glass-gray rounded-2xl';

// Неон стили
export const neonPurple = 'text-[#8B5CF6]';
export const neonPink = 'text-[#EC4899]';
export const neonBorder = 'border-[#8B5CF6]';
export const neonGradient = 'bg-gradient-to-r from-[#8B5CF6] to-[#EC4899]';

