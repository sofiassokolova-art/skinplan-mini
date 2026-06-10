'use client';

// Временная dev-страница для превью редизайна экрана ai_comparison.
// Удалить после согласования макета.

import { AiComparisonScreen } from '@/components/quiz/screens';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

const MOCK_SCREEN: InfoScreen = {
  id: 'ai_comparison',
  title: 'Больше никакой путаницы — AI SkinIQ подберёт уход быстро и точно',
  type: 'comparison',
  ctaText: 'Продолжить',
  content: {
    traditionalItems: [
      'Часы поиска советов в интернете',
      'Деньги на средства, которые не подошли',
      'Непонятно, с чего начать',
    ],
    skiniqItems: [
      'Точный план под вашу кожу',
      'Готово за секунды',
      'Учитываем цели и бюджет',
    ],
  },
};

export default function PreviewAiPage() {
  return (
    <AiComparisonScreen
      screen={MOCK_SCREEN}
      currentInfoScreenIndex={3}
      onContinue={() => {}}
      onBack={() => {}}
    />
  );
}
