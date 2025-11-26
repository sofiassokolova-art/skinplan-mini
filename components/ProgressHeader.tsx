// components/ProgressHeader.tsx
// Шапка с прогрессом и краткой информацией о коже

'use client';

interface ProgressHeaderProps {
  currentDay: number;
  totalDays: number;
  skinType: string;
  primaryConcernRu: string;
}

export function ProgressHeader({ 
  currentDay, 
  totalDays, 
  skinType, 
  primaryConcernRu 
}: ProgressHeaderProps) {
  const progressPercent = Math.round((currentDay / totalDays) * 100);

  return (
    <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-8 rounded-b-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">День {currentDay}/{totalDays}</h1>
          <p className="text-white/80 text-sm">
            {skinType} • {primaryConcernRu}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold">{progressPercent}%</div>
          <div className="text-xs text-white/80">завершено</div>
        </div>
      </div>
      
      {/* Прогресс-бар */}
      <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-white rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
