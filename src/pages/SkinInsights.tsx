import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type SkinMetrics } from '../components/SkinAnalysis';

// Загружаем данные из localStorage
const getPhotoData = () => {
  try {
    const raw = localStorage.getItem("skinplan_answers");
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      photo_data_url: data.photo_data_url,
      photo_analysis: data.photo_analysis,
      photo_metrics: data.photo_metrics,
      photo_zones: data.photo_zones,
      photo_scans: data.photo_scans || []
    };
  } catch {
    return null;
  }
};

const getMetricColor = (value: number): string => {
  if (value <= 30) return 'text-green-600';
  if (value <= 60) return 'text-yellow-600';
  return 'text-red-600';
};


const getMetricStatus = (key: string, value: number): string => {
  const statusMap: Record<string, { good: string, medium: string, bad: string }> = {
    acne: { good: 'Чистая кожа', medium: 'Единичные высыпания', bad: 'Выраженные высыпания' },
    pores: { good: 'Поры не заметны', medium: 'Поры слегка видны', bad: 'Расширенные поры' },
    wrinkles: { good: 'Гладкая кожа', medium: 'Мимические морщины', bad: 'Выраженные морщины' },
    pigmentation: { good: 'Ровный тон', medium: 'Легкая пигментация', bad: 'Выраженная пигментация' },
    redness: { good: 'Спокойная кожа', medium: 'Легкие покраснения', bad: 'Выраженные покраснения' },
    oiliness: { good: 'Нормальная кожа', medium: 'Умеренная жирность', bad: 'Очень жирная кожа' },
    hydration: { good: 'Хорошо увлажнена', medium: 'Нужно больше увлажнения', bad: 'Сухая кожа' },
    elasticity: { good: 'Упругая кожа', medium: 'Снижена упругость', bad: 'Потеря упругости' }
  };

  const status = statusMap[key];
  if (!status) return '';

  if (key === 'hydration') {
    // Для увлажнения логика обратная - высокие значения хорошо
    if (value >= 70) return status.good;
    if (value >= 40) return status.medium;
    return status.bad;
  } else {
    // Для остальных показателей - низкие значения хорошо
    if (value <= 30) return status.good;
    if (value <= 60) return status.medium;
    return status.bad;
  }
};

const metricLabels: Record<string, string> = {
  acne: 'Акне',
  pores: 'Поры', 
  wrinkles: 'Морщины',
  pigmentation: 'Пигментация',
  redness: 'Покраснения',
  oiliness: 'Жирность',
  hydration: 'Увлажненность',
  elasticity: 'Эластичность',
  texture: 'Текстура',
  brightness: 'Сияние',
  evenness: 'Ровность',
  puffiness: 'Отечность'
};

const getRecommendations = (metrics: SkinMetrics): string[] => {
  const recommendations = [];

  if (metrics.acne > 50) {
    recommendations.push('Используйте средства с салициловой кислотой или бензоилпероксидом');
  }
  if (metrics.oiliness > 60) {
    recommendations.push('Добавьте в уход ниацинамид для контроля жирности');
  }
  if (metrics.hydration < 40) {
    recommendations.push('Увеличьте увлажнение с помощью гиалуроновой кислоты');
  }
  if (metrics.pigmentation > 40) {
    recommendations.push('Рассмотрите использование витамина C и арбутина');
  }
  if (metrics.wrinkles > 50) {
    recommendations.push('Включите ретиноиды в вечерний уход');
  }
  if (metrics.redness > 50) {
    recommendations.push('Используйте успокаивающие средства с центеллой или ниацинамидом');
  }
  if (metrics.pores > 70) {
    recommendations.push('Регулярно используйте BHA-кислоты для очищения пор');
  }

  if (recommendations.length === 0) {
    recommendations.push('Ваша кожа в отличном состоянии! Продолжайте текущий уход.');
  }

  return recommendations;
};

export default function SkinInsights() {
  const navigate = useNavigate();
  const [selectedScan, setSelectedScan] = useState<number>(0);
  const photoData = getPhotoData();

  if (!photoData || !photoData.photo_scans.length) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📸</div>
          <h2 className="text-2xl font-bold mb-4">Нет данных анализа кожи</h2>
          <p className="text-zinc-600 mb-6">
            Сначала пройдите анкету и загрузите фото для анализа
          </p>
          <button 
            onClick={() => navigate("/quiz")}
            className="inline-flex items-center px-6 py-3 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition"
          >
            Пройти анкету
          </button>
        </div>
      </div>
    );
  }

  const currentScan = photoData.photo_scans[selectedScan];
  const metrics = currentScan.metrics;
  const zones = currentScan.zones;

  if (!metrics) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Анализ не завершен</h2>
          <p className="text-zinc-600">Данные анализа кожи недоступны</p>
        </div>
      </div>
    );
  }

  const overallScore = Math.round((
    (100 - metrics.acne) + 
    (100 - metrics.redness) + 
    (100 - metrics.pigmentation) + 
    metrics.hydration + 
    metrics.elasticity
  ) / 5);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Заголовок */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">🔬 Анализ кожи</h1>
        <p className="text-zinc-600">Детальный AI-анализ состояния вашей кожи</p>
      </div>

      {/* Выбор анализа */}
      {photoData.photo_scans.length > 1 && (
        <div className="bg-white/70 rounded-3xl p-6 backdrop-blur-xl border border-white/60">
          <h3 className="font-bold mb-3">История анализов</h3>
          <div className="flex gap-3 overflow-x-auto">
            {photoData.photo_scans.map((scan: any, idx: number) => (
              <button
                key={idx}
                onClick={() => setSelectedScan(idx)}
                className={`flex-shrink-0 p-3 rounded-xl border transition ${
                  selectedScan === idx 
                    ? 'border-indigo-300 bg-indigo-50' 
                    : 'border-gray-200 bg-white/60 hover:bg-white/80'
                }`}
              >
                <img 
                  src={scan.preview} 
                  alt={`Анализ ${idx + 1}`}
                  className="w-16 h-16 object-cover rounded-lg mb-2"
                />
                <div className="text-xs text-center">
                  {new Date(scan.ts).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Общая оценка */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-6 text-white">
        <div className="text-center">
          <div className="text-4xl font-bold mb-2">{overallScore}/100</div>
          <div className="text-lg">Общий индекс здоровья кожи</div>
          <div className="text-sm opacity-90 mt-1">
            {overallScore >= 80 ? 'Отличное состояние' : 
             overallScore >= 60 ? 'Хорошее состояние' : 
             overallScore >= 40 ? 'Требует внимания' : 'Нужна коррекция'}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Фото с зонами */}
        <div className="space-y-6">
          <div className="bg-white/70 rounded-3xl p-6 backdrop-blur-xl border border-white/60">
            <h3 className="font-bold mb-4">Зоны анализа</h3>
            <div className="relative">
              <img
                src={currentScan.preview}
                alt="Анализ кожи"
                className="w-full rounded-2xl"
              />
              
              {zones && zones.length > 0 && (
                <div className="absolute inset-0">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {zones.map((zone: any) => (
                      <rect
                        key={zone.id}
                        x={zone.x}
                        y={zone.y}
                        width={zone.width}
                        height={zone.height}
                        fill={zone.color}
                        stroke="rgba(255,255,255,0.8)"
                        strokeWidth="0.5"
                        className="cursor-pointer"
                      />
                    ))}
                  </svg>
                </div>
              )}
            </div>
            
            {zones && zones.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                {zones.map((zone: any) => (
                  <div key={zone.id} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: zone.color }}
                    />
                    <span>{zone.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Анализ */}
          <div className="bg-white/70 rounded-3xl p-6 backdrop-blur-xl border border-white/60">
            <h3 className="font-bold mb-3">📝 Заключение</h3>
            <p className="text-zinc-700 leading-relaxed">{currentScan.analysis}</p>
          </div>
        </div>

        {/* Метрики */}
        <div className="space-y-6">
          <div className="bg-white/70 rounded-3xl p-6 backdrop-blur-xl border border-white/60">
            <h3 className="font-bold mb-4">📊 Показатели кожи</h3>
            <div className="space-y-4">
              {Object.entries(metrics).map(([key, value]) => {
                const numValue = value as number;
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{metricLabels[key]}</span>
                      <span className={`font-bold ${getMetricColor(numValue)}`}>
                        {numValue}/100
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          numValue <= 30 ? 'bg-green-500' : 
                          numValue <= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${numValue}%` }}
                      />
                    </div>
                    <div className="text-sm text-zinc-600">
                      {getMetricStatus(key, numValue)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Рекомендации */}
          <div className="bg-white/70 rounded-3xl p-6 backdrop-blur-xl border border-white/60">
            <h3 className="font-bold mb-4">💡 Рекомендации</h3>
            <ul className="space-y-3">
              {getRecommendations(metrics).map((rec, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="text-indigo-600 mt-0.5">•</span>
                  <span className="text-sm text-zinc-700">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="flex gap-4 justify-center">
        <button 
          onClick={() => navigate("/plan")}
          className="px-6 py-3 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition"
        >
          📋 Перейти к плану ухода
        </button>
        <button 
          onClick={() => navigate("/quiz")}
          className="px-6 py-3 rounded-full border border-indigo-600 text-indigo-600 hover:bg-indigo-50 transition"
        >
          📸 Новый анализ
        </button>
      </div>
    </div>
  );
}