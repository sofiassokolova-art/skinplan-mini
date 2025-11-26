// components/SkinInfographic.tsx
// Инфографика состояния кожи (6 осей)

'use client';

interface SkinScore {
  axis: string;
  value: number;
  level: string;
  title: string;
  description: string;
  color: string;
}

interface SkinInfographicProps {
  scores: SkinScore[];
}

export function SkinInfographic({ scores }: SkinInfographicProps) {
  const getProgressBarWidth = (value: number) => {
    // Нормализуем значение от 0 до 100
    return Math.min(100, Math.max(0, (value / 5) * 100));
  };

  const axisLabels: Record<string, string> = {
    oiliness: 'Жирность',
    hydration: 'Увлажнённость',
    barrier: 'Барьер',
    inflammation: 'Воспаление',
    pigmentation: 'Пигментация',
    photoaging: 'Фотостарение',
  };

  return (
    <div className="bg-white/56 backdrop-blur-[28px] rounded-3xl p-6 border border-white/20">
      <h3 className="text-xl font-bold text-[#0A5F59] mb-6 text-center">
        Состояние кожи
      </h3>
      
      <div className="space-y-4">
        {scores.map((score) => (
          <div key={score.axis} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#475467]">
                {axisLabels[score.axis] || score.title}
              </span>
              <span className="text-sm font-bold text-[#0A5F59]">
                {score.level}
              </span>
            </div>
            
            <div className="relative h-3 bg-[#0A5F59]/10 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${getProgressBarWidth(score.value)}%`,
                  backgroundColor: score.color || '#0A5F59',
                }}
              />
            </div>
            
            <p className="text-xs text-[#6B7280]">{score.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
