// app/(miniapp)/quiz/components/Spinner.tsx
// Переиспользуемый компонент спиннера с 3 слипающимися шариками (5 состояний)

'use client';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  className?: string;
}

const sizeMap = {
  small: 0.75,
  medium: 1,
  large: 1.25,
};

// Размеры из графики
const BALL_SMALL = 20;
const BALL_LARGE = 48;
const MERGED_2 = { width: 60, height: 38 }; // Переходное состояние: 2 шара слились
const MERGED_3 = { width: 96, height: 38 }; // Все 3 шара слились

export function Spinner({ size = 'medium', color = '#0A5F59', className = '' }: SpinnerProps) {
  const scale = sizeMap[size];
  const ballSmall = BALL_SMALL * scale;
  const ballLarge = BALL_LARGE * scale;
  const merged2 = { width: MERGED_2.width * scale, height: MERGED_2.height * scale };
  const merged3 = { width: MERGED_3.width * scale, height: MERGED_3.height * scale };

  // Цвет шариков (яркий лайм-зеленый из графики)
  const ballColor = '#D5FE61'; // Яркий лайм-зеленый цвет для переходных состояний

  // Центр контейнера
  const centerX = merged3.width / 2;
  const centerY = ballLarge / 2;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        width: `${merged3.width + 40}px`,
        height: `${ballLarge + 40}px`,
      }}
      className={className}
    >
      <div
        style={{
          position: 'relative',
          width: `${merged3.width}px`,
          height: `${ballLarge}px`,
        }}
      >
        {/* Шар 1 (левый) */}
        <div
          style={{
            position: 'absolute',
            backgroundColor: ballColor,
            animation: 'ball1 2.5s ease-in-out infinite',
          }}
        />
        
        {/* Шар 2 (центральный) */}
        <div
          style={{
            position: 'absolute',
            backgroundColor: ballColor,
            animation: 'ball2 2.5s ease-in-out infinite',
          }}
        />
        
        {/* Шар 3 (правый) */}
        <div
          style={{
            position: 'absolute',
            backgroundColor: ballColor,
            animation: 'ball3 2.5s ease-in-out infinite',
          }}
        />
      </div>
      <style jsx>{`
        @keyframes ball1 {
          /* Состояние 1 (0-20%): 3 маленьких шара отдельно */
          0%, 20% {
            width: ${ballSmall}px;
            height: ${ballSmall}px;
            border-radius: 50%;
            left: ${centerX - merged3.width / 2 + ballSmall / 2}px;
            top: ${centerY - ballSmall / 2}px;
            transform: translate(-50%, -50%);
          }
          /* Состояние 2 (25-40%): 2 маленьких + 1 большой */
          25%, 40% {
            width: ${ballSmall}px;
            height: ${ballSmall}px;
            border-radius: 50%;
            left: ${centerX - merged3.width / 3}px;
            top: ${centerY - ballSmall / 2}px;
            transform: translate(-50%, -50%);
          }
          /* Состояние 3 (45-60%): 2 шара слиплись + 1 маленький - переходное аморфное состояние */
          45% {
            width: ${merged2.width * 0.9}px;
            height: ${merged2.height * 1.1}px;
            border-radius: ${merged2.height / 2}px;
            left: ${centerX - merged3.width / 2 + merged2.width / 2}px;
            top: ${centerY - merged2.height / 2}px;
            transform: translate(-50%, -50%) scale(1.0, 0.9);
          }
          50% {
            width: ${merged2.width}px;
            height: ${merged2.height}px;
            border-radius: ${merged2.height / 2}px;
            left: ${centerX - merged3.width / 2 + merged2.width / 2}px;
            top: ${centerY - merged2.height / 2}px;
            transform: translate(-50%, -50%) scale(1.05, 0.95);
          }
          55% {
            width: ${merged2.width * 1.05}px;
            height: ${merged2.height * 0.95}px;
            border-radius: ${merged2.height / 2}px;
            left: ${centerX - merged3.width / 2 + merged2.width / 2}px;
            top: ${centerY - merged2.height / 2}px;
            transform: translate(-50%, -50%) scale(1.08, 0.92);
          }
          60% {
            width: ${merged2.width}px;
            height: ${merged2.height}px;
            border-radius: ${merged2.height / 2}px;
            left: ${centerX - merged3.width / 2 + merged2.width / 2}px;
            top: ${centerY - merged2.height / 2}px;
            transform: translate(-50%, -50%) scale(1.05, 0.95);
          }
          /* Состояние 4 (65-80%): все 3 шара слиплись - переходное аморфное состояние */
          65% {
            width: ${merged3.width * 0.95}px;
            height: ${merged3.height * 1.05}px;
            border-radius: ${merged3.height / 2}px;
            left: ${centerX}px;
            top: ${centerY - merged3.height / 2}px;
            transform: translate(-50%, -50%) scale(1.0, 0.96);
          }
          70% {
            width: ${merged3.width}px;
            height: ${merged3.height}px;
            border-radius: ${merged3.height / 2}px;
            left: ${centerX}px;
            top: ${centerY - merged3.height / 2}px;
            transform: translate(-50%, -50%) scale(1.02, 0.98);
          }
          75% {
            width: ${merged3.width * 1.03}px;
            height: ${merged3.height * 0.97}px;
            border-radius: ${merged3.height / 2}px;
            left: ${centerX}px;
            top: ${centerY - merged3.height / 2}px;
            transform: translate(-50%, -50%) scale(1.04, 0.96);
          }
          80% {
            width: ${merged3.width}px;
            height: ${merged3.height}px;
            border-radius: ${merged3.height / 2}px;
            left: ${centerX}px;
            top: ${centerY - merged3.height / 2}px;
            transform: translate(-50%, -50%) scale(1.02, 0.98);
          }
          /* Состояние 5 (85-100%): 1 большой + 2 маленьких */
          85%, 100% {
            width: ${ballLarge}px;
            height: ${ballLarge}px;
            border-radius: 50%;
            left: ${centerX}px;
            top: ${centerY - ballLarge / 2}px;
            transform: translate(-50%, -50%);
          }
        }

        @keyframes ball2 {
          /* Состояние 1 (0-20%): 3 маленьких шара отдельно */
          0%, 20% {
            width: ${ballSmall}px;
            height: ${ballSmall}px;
            border-radius: 50%;
            left: ${centerX}px;
            top: ${centerY - ballSmall / 2}px;
            transform: translate(-50%, -50%);
          }
          /* Состояние 2 (25-40%): 2 маленьких + 1 большой */
          25%, 40% {
            width: ${ballSmall}px;
            height: ${ballSmall}px;
            border-radius: 50%;
            left: ${centerX}px;
            top: ${centerY - ballSmall / 2}px;
            transform: translate(-50%, -50%);
          }
          /* Состояние 3 (45-60%): 2 шара слиплись + 1 маленький - скрыт (часть слипшегося) */
          45%, 60% {
            width: ${merged2.width}px;
            height: ${merged2.height}px;
            border-radius: ${merged2.height / 2}px;
            left: ${centerX - merged3.width / 2 + merged2.width / 2}px;
            top: ${centerY - merged2.height / 2}px;
            transform: translate(-50%, -50%);
            opacity: 0;
            z-index: -1;
          }
          /* Состояние 4 (65-80%): все 3 шара слиплись - скрыт (часть слипшегося) */
          65%, 80% {
            width: ${merged3.width}px;
            height: ${merged3.height}px;
            border-radius: ${merged3.height / 2}px;
            left: ${centerX}px;
            top: ${centerY - merged3.height / 2}px;
            transform: translate(-50%, -50%);
            opacity: 0;
          }
          /* Состояние 5 (85-100%): 1 большой + 2 маленьких */
          85%, 100% {
            width: ${ballSmall}px;
            height: ${ballSmall}px;
            border-radius: 50%;
            left: ${centerX - merged3.width / 4}px;
            top: ${centerY - ballSmall / 2}px;
            transform: translate(-50%, -50%);
            opacity: 1;
          }
        }

        @keyframes ball3 {
          /* Состояние 1 (0-20%): 3 маленьких шара отдельно */
          0%, 20% {
            width: ${ballSmall}px;
            height: ${ballSmall}px;
            border-radius: 50%;
            left: ${centerX + merged3.width / 2 - ballSmall / 2}px;
            top: ${centerY - ballSmall / 2}px;
            transform: translate(-50%, -50%);
          }
          /* Состояние 2 (25-40%): 2 маленьких + 1 большой */
          25%, 40% {
            width: ${ballLarge}px;
            height: ${ballLarge}px;
            border-radius: 50%;
            left: ${centerX + merged3.width / 3}px;
            top: ${centerY - ballLarge / 2}px;
            transform: translate(-50%, -50%);
          }
          /* Состояние 3 (45-60%): 2 шара слиплись + 1 маленький */
          45%, 60% {
            width: ${ballSmall}px;
            height: ${ballSmall}px;
            border-radius: 50%;
            left: ${centerX + merged3.width / 2 - ballSmall / 2}px;
            top: ${centerY - ballSmall / 2}px;
            transform: translate(-50%, -50%);
          }
          /* Состояние 4 (65-80%): все 3 шара слиплись - скрыт (часть слипшегося) */
          65%, 80% {
            width: ${merged3.width}px;
            height: ${merged3.height}px;
            border-radius: ${merged3.height / 2}px;
            left: ${centerX}px;
            top: ${centerY - merged3.height / 2}px;
            transform: translate(-50%, -50%);
            opacity: 0;
          }
          /* Состояние 5 (85-100%): 1 большой + 2 маленьких */
          85%, 100% {
            width: ${ballSmall}px;
            height: ${ballSmall}px;
            border-radius: 50%;
            left: ${centerX + merged3.width / 4}px;
            top: ${centerY - ballSmall / 2}px;
            transform: translate(-50%, -50%);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
