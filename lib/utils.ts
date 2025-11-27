// lib/utils.ts
// Утилиты для работы с классами и стилями

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Glassmorphism стили для карточек
export const glassCard = 'bg-white border border-gray-200 rounded-2xl shadow-sm';
export const glassCardHover = 'hover:bg-gray-50 hover:border-gray-300 hover:shadow-md hover:-translate-y-1 transition-all duration-300';

// Неон стили
export const neonPurple = 'text-[#8B5CF6]';
export const neonPink = 'text-[#EC4899]';
export const neonBorder = 'border-[#8B5CF6]';
export const neonGradient = 'bg-gradient-to-r from-[#8B5CF6] to-[#EC4899]';

