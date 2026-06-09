// app/(miniapp)/quiz/components/Spinner.tsx
// Совместимый экспорт старого Spinner: теперь рендерит skeleton.

'use client';

import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  className?: string;
}

const sizeMap = {
  small: 28,
  medium: 40,
  large: 52,
};

export function Spinner({ size = 'medium', color = '#D5FE61', className = '' }: SpinnerProps) {
  const px = sizeMap[size];

  return (
    <SkeletonLoader
      className={className}
      variant="circular"
      width={`${px}px`}
      height={`${px}px`}
      style={{ backgroundColor: color }}
    />
  );
}
