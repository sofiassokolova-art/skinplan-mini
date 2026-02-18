// app/(miniapp)/quiz/components/Spinner.tsx
// Переиспользуемый компонент спиннера с 3 шарами и перемычками между ними (6 состояний)

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

  // Позиции шаров
  const ball1X = 0;
  const ball2X = distance;
  const ball3X = distance * 2;

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
            animation: 'ball1 3s ease-in-out infinite',
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
            animation: 'ball2 3s ease-in-out infinite',
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
            animation: 'ball3 3s ease-in-out infinite',
          }}
        />

        {/* Перемычка между шаром 1 и шаром 2 */}
        <div
          style={{
            position: 'absolute',
            backgroundColor: bridgeColor,
            border: `1px solid ${borderColor}`,
            animation: 'bridge1 3s ease-in-out infinite',
          }}
        />

        {/* Перемычка между шаром 2 и шаром 3 */}
        <div
          style={{
            position: 'absolute',
            backgroundColor: bridgeColor,
            border: `1px solid ${borderColor}`,
            animation: 'bridge2 3s ease-in-out infinite',
          }}
        />
      </div>
      <style jsx>{`
        /* Состояние 1 (0-16.66%): 2 шара - маленький слева, большой справа */
        /* Состояние 2 (16.66-33.33%): 2 блоба - круг слева, справа "арахис" (2 шара + перемычка) */
        /* Состояние 3 (33.33-50%): 1 большой блоб - все 3 шара соединены перемычками */
        /* Состояние 4 (50-66.66%): 2 блоба - "арахис" слева, круг справа */
        /* Состояние 5 (66.66-83.33%): 2 шара - большой слева, маленький справа */
        /* Состояние 6 (83.33-100%): возврат к состоянию 1 */

        @keyframes ball1 {
          /* Состояние 1: маленький шар слева */
          0%, 16.66% {
            left: ${ball1X}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 2: маленький круг слева */
          16.67%, 33.33% {
            left: ${ball1X}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 3: часть большого блоба (левая выпуклость) */
          33.34%, 50% {
            left: ${ball1X}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 4: часть "арахиса" слева (левая выпуклость) */
          50.01%, 66.66% {
            left: ${ball1X}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 5: большой шар слева */
          66.67%, 83.33% {
            left: ${ball1X}px;
            top: ${centerY - ballLarge / 2}px;
            width: ${ballLarge}px;
            height: ${ballLarge}px;
          }
          /* Состояние 6: возврат к состоянию 1 */
          83.34%, 100% {
            left: ${ball1X}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
        }

        @keyframes ball2 {
          /* Состояние 1: скрыт (только 2 шара видны) */
          0%, 16.66% {
            left: ${ball2X}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
            opacity: 0;
          }
          /* Состояние 2: часть "арахиса" справа (правая выпуклость) */
          16.67%, 33.33% {
            left: ${ball2X}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
            opacity: 1;
          }
          /* Состояние 3: часть большого блоба (центральная выпуклость) */
          33.34%, 50% {
            left: ${ball2X}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
            opacity: 1;
          }
          /* Состояние 4: часть "арахиса" слева (правая выпуклость) */
          50.01%, 66.66% {
            left: ${ball2X}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
            opacity: 1;
          }
          /* Состояние 5: скрыт (только 2 шара видны) */
          66.67%, 83.33% {
            left: ${ball2X}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
            opacity: 0;
          }
          /* Состояние 6: возврат к состоянию 1 */
          83.34%, 100% {
            left: ${ball2X}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
            opacity: 0;
          }
        }

        @keyframes ball3 {
          /* Состояние 1: большой шар справа */
          0%, 16.66% {
            left: ${ball3X}px;
            top: ${centerY - ballLarge / 2}px;
            width: ${ballLarge}px;
            height: ${ballLarge}px;
          }
          /* Состояние 2: часть "арахиса" справа (левая выпуклость) */
          16.67%, 33.33% {
            left: ${ball3X}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 3: часть большого блоба (правая выпуклость) */
          33.34%, 50% {
            left: ${ball3X}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 4: маленький круг справа */
          50.01%, 66.66% {
            left: ${ball3X}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 5: маленький шар справа */
          66.67%, 83.33% {
            left: ${ball3X}px;
            top: 0;
            width: ${ballSmall}px;
            height: ${ballSmall}px;
          }
          /* Состояние 6: возврат к состоянию 1 */
          83.34%, 100% {
            left: ${ball3X}px;
            top: ${centerY - ballLarge / 2}px;
            width: ${ballLarge}px;
            height: ${ballLarge}px;
          }
        }

        @keyframes bridge1 {
          /* Состояние 1: перемычки нет */
          0%, 16.66% {
            left: ${ball1X + ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: 0;
            height: ${bridgeHeight}px;
            clip-path: polygon(0% 0%, 0% 100%, 0% 100%, 0% 0%);
            opacity: 0;
          }
          /* Состояние 2: перемычка появляется между шаром 2 и 3 (справа) */
          16.67%, 33.33% {
            left: ${ball2X + ballSmall - bridgeWidth / 2}px;
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
          /* Состояние 3: перемычка между шаром 1 и 2 (левая перемычка большого блоба) */
          33.34%, 50% {
            left: ${ball1X + ballSmall - bridgeWidth / 2}px;
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
          /* Состояние 4: перемычка между шаром 1 и 2 (левая перемычка "арахиса") */
          50.01%, 66.66% {
            left: ${ball1X + ballSmall - bridgeWidth / 2}px;
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
          /* Состояние 5: перемычки нет */
          66.67%, 83.33% {
            left: ${ball1X + ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: 0;
            height: ${bridgeHeight}px;
            clip-path: polygon(0% 0%, 0% 100%, 0% 100%, 0% 0%);
            opacity: 0;
          }
          /* Состояние 6: возврат к состоянию 1 */
          83.34%, 100% {
            left: ${ball1X + ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: 0;
            height: ${bridgeHeight}px;
            clip-path: polygon(0% 0%, 0% 100%, 0% 100%, 0% 0%);
            opacity: 0;
          }
        }

        @keyframes bridge2 {
          /* Состояние 1: перемычки нет */
          0%, 16.66% {
            left: ${ball2X + ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: 0;
            height: ${bridgeHeight}px;
            clip-path: polygon(0% 0%, 0% 100%, 0% 100%, 0% 0%);
            opacity: 0;
          }
          /* Состояние 2: перемычка между шаром 2 и 3 (правая перемычка "арахиса") */
          16.67%, 33.33% {
            left: ${ball2X + ballSmall - bridgeWidth / 2}px;
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
          /* Состояние 3: перемычка между шаром 2 и 3 (правая перемычка большого блоба) */
          33.34%, 50% {
            left: ${ball2X + ballSmall - bridgeWidth / 2}px;
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
          /* Состояние 4: перемычки нет */
          50.01%, 66.66% {
            left: ${ball2X + ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: 0;
            height: ${bridgeHeight}px;
            clip-path: polygon(0% 0%, 0% 100%, 0% 100%, 0% 0%);
            opacity: 0;
          }
          /* Состояние 5: перемычки нет */
          66.67%, 83.33% {
            left: ${ball2X + ballSmall - bridgeWidth / 2}px;
            top: ${(ballSmall - bridgeHeight) / 2}px;
            width: 0;
            height: ${bridgeHeight}px;
            clip-path: polygon(0% 0%, 0% 100%, 0% 100%, 0% 0%);
            opacity: 0;
          }
          /* Состояние 6: возврат к состоянию 1 */
          83.34%, 100% {
            left: ${ball2X + ballSmall - bridgeWidth / 2}px;
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
