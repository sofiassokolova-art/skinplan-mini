// app/(miniapp)/quiz/components/Spinner.tsx
// Переиспользуемый компонент спиннера с 3 шарами и перемычкой между ними (5 состояний)

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
const BRIDGE_WIDTH = 8; // Ширина перемычки
const BRIDGE_HEIGHT = 20; // Высота перемычки (равна диаметру маленького шара)

export function Spinner({ size = 'medium', color = '#0A5F59', className = '' }: SpinnerProps) {
  const scale = sizeMap[size];
  const ballSmall = BALL_SMALL * scale;
  const ballLarge = BALL_LARGE * scale;
  const bridgeWidth = BRIDGE_WIDTH * scale;
  const bridgeHeight = BRIDGE_HEIGHT * scale;

  // Цвет шариков и перемычки (яркий лайм-зеленый из графики)
  const ballColor = '#D5FE61';
  const bridgeColor = '#D5FE61';
  const borderColor = '#00B8FF'; // Яркий синий контур

  // Расстояния между шарами
  const distance = ballSmall * 1.5; // Расстояние между центрами шаров

  // Центр контейнера
  const totalWidth = ballSmall * 2 + distance * 2;
  const centerX = totalWidth / 2;
  const centerY = ballSmall / 2;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        width: `${totalWidth + 40}px`,
        height: `${ballSmall + 40}px`,
      }}
      className={className}
    >
      <div
        style={{
          position: 'relative',
          width: `${totalWidth}px`,
          height: `${ballSmall}px`,
        }}
      >
        {/* Шар 1 (левый) */}
        <div
          style={{
            position: 'absolute',
            width: `${ballSmall}px`,
            height: `${ballSmall}px`,
            backgroundColor: ballColor,
            border: `1px solid ${borderColor}`,
            borderRadius: '50%',
            animation: 'ball1 2.5s ease-in-out infinite',
          }}
        />
        
        {/* Шар 2 (центральный) */}
        <div
          style={{
            position: 'absolute',
            width: `${ballSmall}px`,
            height: `${ballSmall}px`,
            backgroundColor: ballColor,
            border: `1px solid ${borderColor}`,
            borderRadius: '50%',
            animation: 'ball2 2.5s ease-in-out infinite',
          }}
        />
        
        {/* Шар 3 (правый) */}
        <div
          style={{
            position: 'absolute',
            width: `${ballSmall}px`,
            height: `${ballSmall}px`,
            backgroundColor: ballColor,
            border: `1px solid ${borderColor}`,
            borderRadius: '50%',
            animation: 'ball3 2.5s ease-in-out infinite',
          }}
        />

        {/* Перемычка между шаром 1 и шаром 2 */}
        <div
          style={{
            position: 'absolute',
            backgroundColor: bridgeColor,
            border: `1px solid ${borderColor}`,
            animation: 'bridge1 2.5s ease-in-out infinite',
          }}
        />

        {/* Перемычка между шаром 2 и шаром 3 */}
        <div
          style={{
            position: 'absolute',
            backgroundColor: bridgeColor,
            border: `1px solid ${borderColor}`,
            animation: 'bridge2 2.5s ease-in-out infinite',
          }}
        />
      </div>
      <style jsx>{`
        @keyframes ball1 {
          /* Состояние 1 (0-20%): 3 маленьких шара отдельно */
          0%, 20% {
            left: 0;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 2 (25-40%): 2 маленьких + 1 большой */
          25%, 40% {
            left: 0;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 3 (45-60%): 2 шара соединены перемычкой + 1 маленький */
          45%, 60% {
            left: 0;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 4 (65-80%): все 3 шара соединены перемычками */
          65%, 80% {
            left: 0;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 5 (85-100%): 1 большой + 2 маленьких */
          85%, 100% {
            left: ${centerX - ballLarge / 2}px;
            top: ${centerY - ballLarge / 2}px;
            width: ${ballLarge}px;
            height: ${ballLarge}px;
          }
        }

        @keyframes ball2 {
          /* Состояние 1 (0-20%): 3 маленьких шара отдельно */
          0%, 20% {
            left: ${distance}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 2 (25-40%): 2 маленьких + 1 большой */
          25%, 40% {
            left: ${distance}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 3 (45-60%): 2 шара соединены перемычкой + 1 маленький */
          45%, 60% {
            left: ${distance}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 4 (65-80%): все 3 шара соединены перемычками */
          65%, 80% {
            left: ${distance}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 5 (85-100%): 1 большой + 2 маленьких */
          85%, 100% {
            left: ${centerX - ballSmall / 2}px;
            top: ${centerY - ballSmall / 2}px;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
        }

        @keyframes ball3 {
          /* Состояние 1 (0-20%): 3 маленьких шара отдельно */
          0%, 20% {
            left: ${distance * 2}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 2 (25-40%): 2 маленьких + 1 большой */
          25%, 40% {
            left: ${distance * 2}px;
            top: ${centerY - ballLarge / 2}px;
            width: ${ballLarge}px;
            height: ${ballLarge}px;
          }
          /* Состояние 3 (45-60%): 2 шара соединены перемычкой + 1 маленький */
          45%, 60% {
            left: ${distance * 2}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 4 (65-80%): все 3 шара соединены перемычками */
          65%, 80% {
            left: ${distance * 2}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 5 (85-100%): 1 большой + 2 маленьких */
          85%, 100% {
            left: ${centerX + ballLarge / 2}px;
            top: ${centerY - ballSmall / 2}px;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
        }

        @keyframes bridge1 {
          /* Состояние 1 (0-20%): перемычки нет */
          0%, 20% {
            left: ${ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: 0;
            height: ${bridgeHeight}px;
            clip-path: polygon(0% 0%, 0% 100%, 0% 100%, 0% 0%);
            opacity: 0;
          }
          /* Состояние 2 (25-40%): перемычки нет */
          25%, 40% {
            left: ${ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: 0;
            height: ${bridgeHeight}px;
            clip-path: polygon(0% 0%, 0% 100%, 0% 100%, 0% 0%);
            opacity: 0;
          }
          /* Состояние 3 (45-60%): перемычка появляется с V-образными впадинами */
          45% {
            left: ${ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: ${bridgeWidth}px;
            height: ${bridgeHeight}px;
            clip-path: polygon(
              0% 20%, 
              0% 80%, 
              50% 100%, 
              100% 80%, 
              100% 20%, 
              50% 0%
            );
            opacity: 1;
          }
          50% {
            left: ${ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: ${distance}px;
            height: ${bridgeHeight}px;
            clip-path: polygon(
              0% 15%, 
              0% 85%, 
              50% 100%, 
              100% 85%, 
              100% 15%, 
              50% 0%
            );
            opacity: 1;
          }
          55% {
            left: ${ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: ${distance}px;
            height: ${bridgeHeight}px;
            clip-path: polygon(
              0% 18%, 
              0% 82%, 
              50% 100%, 
              100% 82%, 
              100% 18%, 
              50% 0%
            );
            opacity: 1;
          }
          60% {
            left: ${ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: ${distance}px;
            height: ${bridgeHeight}px;
            clip-path: polygon(
              0% 20%, 
              0% 80%, 
              50% 100%, 
              100% 80%, 
              100% 20%, 
              50% 0%
            );
            opacity: 1;
          }
          /* Состояние 4 (65-80%): перемычка расширяется для соединения всех 3 шаров */
          65% {
            left: ${ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: ${distance * 2}px;
            height: ${bridgeHeight}px;
            clip-path: polygon(
              0% 20%, 
              0% 80%, 
              25% 100%, 
              50% 95%, 
              75% 100%, 
              100% 80%, 
              100% 20%, 
              75% 0%, 
              50% 5%, 
              25% 0%
            );
            opacity: 1;
          }
          70% {
            left: ${ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: ${distance * 2}px;
            height: ${bridgeHeight}px;
            clip-path: polygon(
              0% 18%, 
              0% 82%, 
              25% 100%, 
              50% 95%, 
              75% 100%, 
              100% 82%, 
              100% 18%, 
              75% 0%, 
              50% 5%, 
              25% 0%
            );
            opacity: 1;
          }
          75% {
            left: ${ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: ${distance * 2}px;
            height: ${bridgeHeight}px;
            clip-path: polygon(
              0% 20%, 
              0% 80%, 
              25% 100%, 
              50% 95%, 
              75% 100%, 
              100% 80%, 
              100% 20%, 
              75% 0%, 
              50% 5%, 
              25% 0%
            );
            opacity: 1;
          }
          80% {
            left: ${ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: ${distance * 2}px;
            height: ${bridgeHeight}px;
            clip-path: polygon(
              0% 20%, 
              0% 80%, 
              25% 100%, 
              50% 95%, 
              75% 100%, 
              100% 80%, 
              100% 20%, 
              75% 0%, 
              50% 5%, 
              25% 0%
            );
            opacity: 1;
          }
          /* Состояние 5 (85-100%): перемычка исчезает */
          85%, 100% {
            left: ${ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: 0;
            height: ${bridgeHeight}px;
            clip-path: polygon(0% 0%, 0% 100%, 0% 100%, 0% 0%);
            opacity: 0;
          }
        }

        @keyframes bridge2 {
          /* Состояние 1 (0-20%): перемычки нет */
          0%, 20% {
            left: ${ballSmall + distance - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: 0;
            height: ${bridgeHeight}px;
            clip-path: polygon(0% 0%, 0% 100%, 0% 100%, 0% 0%);
            opacity: 0;
          }
          /* Состояние 2 (25-40%): перемычки нет */
          25%, 40% {
            left: ${ballSmall + distance - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: 0;
            height: ${bridgeHeight}px;
            clip-path: polygon(0% 0%, 0% 100%, 0% 100%, 0% 0%);
            opacity: 0;
          }
          /* Состояние 3 (45-60%): перемычки нет */
          45%, 60% {
            left: ${ballSmall + distance - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: 0;
            height: ${bridgeHeight}px;
            clip-path: polygon(0% 0%, 0% 100%, 0% 100%, 0% 0%);
            opacity: 0;
          }
          /* Состояние 4 (65-80%): перемычка появляется с V-образными впадинами */
          65% {
            left: ${ballSmall + distance - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: ${bridgeWidth}px;
            height: ${bridgeHeight}px;
            clip-path: polygon(
              0% 20%, 
              0% 80%, 
              50% 100%, 
              100% 80%, 
              100% 20%, 
              50% 0%
            );
            opacity: 1;
          }
          70% {
            left: ${ballSmall + distance - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: ${distance}px;
            height: ${bridgeHeight}px;
            clip-path: polygon(
              0% 15%, 
              0% 85%, 
              50% 100%, 
              100% 85%, 
              100% 15%, 
              50% 0%
            );
            opacity: 1;
          }
          75% {
            left: ${ballSmall + distance - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: ${distance}px;
            height: ${bridgeHeight}px;
            clip-path: polygon(
              0% 18%, 
              0% 82%, 
              50% 100%, 
              100% 82%, 
              100% 18%, 
              50% 0%
            );
            opacity: 1;
          }
          80% {
            left: ${ballSmall + distance - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: ${distance}px;
            height: ${bridgeHeight}px;
            clip-path: polygon(
              0% 20%, 
              0% 80%, 
              50% 100%, 
              100% 80%, 
              100% 20%, 
              50% 0%
            );
            opacity: 1;
          }
          /* Состояние 5 (85-100%): перемычка исчезает */
          85%, 100% {
            left: ${ballSmall + distance - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: 0;
            height: ${bridgeHeight}px;
            clip-path: polygon(0% 0%, 0% 100%, 0% 100%, 0% 0%);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
