// components/SkinInfographic.tsx
// Профессиональная инфографика кожи SkinIQ 2025
// Методология: Curology, Agency, Typology, Prose, Luvly, Drunk Elephant Skin School

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
  skinType?: string;
  skinTypeRu?: string;
  sensitivityLevel?: string | null;
  acneLevel?: number | null;
}

export function SkinInfographic({ 
  scores, 
  skinType, 
  skinTypeRu,
  sensitivityLevel,
  acneLevel 
}: SkinInfographicProps) {
  // Преобразуем scores в нужный формат
  const getScore = (axis: string) => {
    return scores.find(s => s.axis === axis);
  };

  // Получаем значения для расчета
  const hydrationScore = getScore('hydration');
  const inflammationScore = getScore('inflammation');
  const barrierScore = getScore('barrier');
  const pigmentationScore = getScore('pigmentation');
  const photoagingScore = getScore('photoaging');

  // Увлажнение: инвертируем (100 - value) для получения процента увлажнения
  const hydrationPercent = hydrationScore ? Math.max(0, Math.min(100, 100 - hydrationScore.value)) : 50;

  // Акне/воспаления: преобразуем в 0-10 баллов
  const acneScore = inflammationScore ? Math.min(10, Math.round(inflammationScore.value / 10)) : 0;

  // Поры: используем oiliness или barrier как индикатор
  const oilinessScore = getScore('oiliness');
  const poresLevel = oilinessScore ? 
    (oilinessScore.value > 70 ? 'Крупные' : oilinessScore.value > 40 ? 'Средние' : 'Мелкие') 
    : 'Средние';

  // Пигментация: преобразуем в проценты
  const pigmentationPercent = pigmentationScore ? Math.min(100, pigmentationScore.value) : 0;

  // Морщины: преобразуем в 0-10 баллов
  const wrinklesScore = photoagingScore ? Math.min(10, Math.round(photoagingScore.value / 10)) : 0;

  // Чувствительность: используем barrier или sensitivityLevel
  const sensitivity = sensitivityLevel || (barrierScore && barrierScore.value < 50 ? 'high' : 
    barrierScore && barrierScore.value < 70 ? 'medium' : 'low');

  // Глобальный тип кожи
  const globalSkinType = skinTypeRu || 
    (skinType === 'dry' ? 'Сухая' : 
     skinType === 'oily' ? 'Жирная' : 
     skinType === 'combo' ? 'Комбинированная' : 
     'Нормальная');

  // Цвет фона для типа кожи
  const getSkinTypeColor = (type: string) => {
    const normalized = type.toLowerCase();
    if (normalized.includes('сухая')) return { bg: 'rgba(59, 130, 246, 0.1)', border: '#3B82F6' };
    if (normalized.includes('жирная')) return { bg: 'rgba(16, 185, 129, 0.1)', border: '#10B981' };
    if (normalized.includes('комбинированная')) return { bg: 'rgba(245, 158, 11, 0.1)', border: '#F59E0B' };
    return { bg: 'rgba(139, 92, 246, 0.1)', border: '#8B5CF6' };
  };

  const skinTypeColor = getSkinTypeColor(globalSkinType);

  // Расчет SkinIQ Score
  const calculateSkinIQScore = () => {
    const hydration = hydrationPercent;
    const acne = acneScore * 10; // 0-100
    const pores = oilinessScore ? (oilinessScore.value > 70 ? 80 : oilinessScore.value > 40 ? 50 : 20) : 50;
    const pigmentation = pigmentationPercent;
    const wrinkles = wrinklesScore * 10; // 0-100

    // Формула: 30% × Увлажнение + 25% × (−Акне) + 20% × (−Поры) + 15% × (−Пигментация) + 10% × (−Морщины)
    const score = 
      0.30 * hydration +
      0.25 * (100 - acne) +
      0.20 * (100 - pores) +
      0.15 * (100 - pigmentation) +
      0.10 * (100 - wrinkles);

    return Math.max(22, Math.min(98, Math.round(score)));
  };

  const skinIQScore = calculateSkinIQScore();

  // Цвет для SkinIQ Score
  const getScoreColor = (score: number) => {
    if (score >= 90) return { bg: '#065F46', text: '#10B981', border: '#FCD34D', label: 'Идеал' };
    if (score >= 75) return { bg: '#D1FAE5', text: '#059669', border: '#10B981', label: 'Хорошая кожа' };
    if (score >= 50) return { bg: '#FEF3C7', text: '#D97706', border: '#F59E0B', label: 'Есть проблемы' };
    return { bg: '#FEE2E2', text: '#DC2626', border: '#EF4444', label: 'Нужна помощь' };
  };

  const scoreColor = getScoreColor(skinIQScore);

  // Иконка чувствительности
  const getSensitivityIcon = (level: string) => {
    if (level === 'high') {
      return (
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#EF4444" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      );
    }
    if (level === 'medium') {
      return (
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#F59E0B" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#10B981" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
      </svg>
    );
  };

  // Круговая шкала для увлажнения
  const CircleProgress = ({ percent }: { percent: number }) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;

    return (
      <div className="relative w-24 h-24">
        <svg className="transform -rotate-90" width="96" height="96">
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="rgba(10, 95, 89, 0.1)"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="#0A5F59"
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-[#0A5F59]">{Math.round(percent)}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white/80 backdrop-blur-[28px] rounded-3xl p-6 border border-white/40 shadow-xl">
      <h3 className="text-2xl font-bold text-[#0A5F59] mb-6 text-center">
        Портрет кожи сейчас
      </h3>

      {/* Глобальный тип кожи - большой бейдж */}
      <div 
        className="rounded-2xl p-4 mb-6 text-center border-2"
        style={{ 
          backgroundColor: skinTypeColor.bg,
          borderColor: skinTypeColor.border 
        }}
      >
        <div className="text-sm text-[#475467] mb-1">Глобальный тип</div>
        <div className="text-2xl font-bold" style={{ color: skinTypeColor.border }}>
          {globalSkinType}
        </div>
      </div>

      {/* SkinIQ Score - большая цифра в центре */}
      <div 
        className="rounded-2xl p-6 mb-6 text-center border-2 relative overflow-hidden"
        style={{ 
          backgroundColor: scoreColor.bg,
          borderColor: scoreColor.border 
        }}
      >
        {skinIQScore >= 90 && (
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(45deg, #FCD34D 0%, transparent 50%)',
            }}></div>
          </div>
        )}
        <div className="relative z-10">
          <div className="text-sm text-[#475467] mb-2">SkinIQ Score</div>
          <div 
            className="text-6xl font-bold mb-2"
            style={{ color: scoreColor.text }}
          >
            {skinIQScore}
          </div>
          <div className="text-sm font-medium" style={{ color: scoreColor.text }}>
            {scoreColor.label}
          </div>
        </div>
      </div>

      {/* Основные показатели в сетке */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Уровень увлажнения - круговая шкала */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 text-center border border-blue-100">
          <div className="text-xs text-[#475467] mb-2">Уровень увлажнения</div>
          <div className="flex justify-center mb-2">
            <CircleProgress percent={hydrationPercent} />
          </div>
        </div>

        {/* Чувствительность - иконка */}
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 text-center border border-orange-100">
          <div className="text-xs text-[#475467] mb-2">Чувствительность</div>
          <div className="flex justify-center mb-2">
            {getSensitivityIcon(sensitivity)}
          </div>
          <div className="text-sm font-medium text-[#0A5F59]">
            {sensitivity === 'high' ? 'Высокая' : sensitivity === 'medium' ? 'Средняя' : 'Низкая'}
          </div>
        </div>

        {/* Акне / воспаления */}
        <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl p-4 text-center border border-red-100">
          <div className="text-xs text-[#475467] mb-2">Акне / воспаления</div>
          <div className="text-3xl font-bold text-red-600 mb-1">{acneScore}</div>
          <div className="text-xs text-[#475467]">из 10 баллов</div>
        </div>

        {/* Поры */}
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-4 text-center border border-purple-100">
          <div className="text-xs text-[#475467] mb-2">Поры</div>
          <div className="text-lg font-bold text-[#0A5F59] mb-1">{poresLevel}</div>
          <div className="text-xs text-[#475467]">в Т-зоне</div>
        </div>

        {/* Пигментация */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-4 text-center border border-indigo-100">
          <div className="text-xs text-[#475467] mb-2">Пигментация</div>
          <div className="text-2xl font-bold text-indigo-600 mb-1">{Math.round(pigmentationPercent)}%</div>
          <div className="text-xs text-[#475467]">от нормы</div>
        </div>

        {/* Морщины / эластичность */}
        <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-4 text-center border border-gray-100">
          <div className="text-xs text-[#475467] mb-2">Морщины / эластичность</div>
          <div className="text-3xl font-bold text-gray-700 mb-1">{wrinklesScore}</div>
          <div className="text-xs text-[#475467]">из 10 баллов</div>
        </div>
      </div>

      {/* Подпись с формулой */}
      <div className="text-xs text-center text-[#6B7280] mt-4 pt-4 border-t border-gray-200">
        SkinIQ Score = 30% × Увлажнение + 25% × (−Акне) + 20% × (−Поры) + 15% × (−Пигментация) + 10% × (−Морщины)
      </div>
    </div>
  );
}
