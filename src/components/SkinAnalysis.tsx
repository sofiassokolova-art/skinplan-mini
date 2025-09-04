import { useState, useRef } from 'react';

export interface SkinMetrics {
  // Основные показатели
  acne: number;           // 0-100
  pores: number;          // 0-100  
  wrinkles: number;       // 0-100
  pigmentation: number;   // 0-100
  redness: number;        // 0-100
  oiliness: number;       // 0-100
  hydration: number;      // 0-100
  elasticity: number;     // 0-100
  
  // Дополнительные показатели
  texture: number;        // 0-100
  brightness: number;     // 0-100
  evenness: number;       // 0-100
  puffiness: number;      // 0-100
}

export interface SkinZone {
  id: string;
  name: string;
  x: number;      // процент от ширины
  y: number;      // процент от высоты
  width: number;  // процент от ширины
  height: number; // процент от высоты
  metrics: Partial<SkinMetrics>;
  color: string;  // цвет зоны
}

interface SkinAnalysisProps {
  imageUrl: string;
  onAnalysisComplete: (metrics: SkinMetrics, zones: SkinZone[], analysis: string) => void;
}

// Симуляция AI анализа кожи
const analyzeSkinImage = (_imageData: ImageData): { metrics: SkinMetrics, zones: SkinZone[] } => {
  // Базовые метрики (в реальности здесь был бы ML алгоритм)
  const baseMetrics: SkinMetrics = {
    acne: Math.floor(Math.random() * 40) + 10,
    pores: Math.floor(Math.random() * 50) + 20,
    wrinkles: Math.floor(Math.random() * 30) + 15,
    pigmentation: Math.floor(Math.random() * 35) + 10,
    redness: Math.floor(Math.random() * 45) + 15,
    oiliness: Math.floor(Math.random() * 60) + 20,
    hydration: Math.floor(Math.random() * 40) + 40,
    elasticity: Math.floor(Math.random() * 30) + 60,
    texture: Math.floor(Math.random() * 40) + 30,
    brightness: Math.floor(Math.random() * 30) + 50,
    evenness: Math.floor(Math.random() * 40) + 30,
    puffiness: Math.floor(Math.random() * 25) + 10
  };

  // Зоны лица с разными показателями
  const zones: SkinZone[] = [
    {
      id: 'forehead',
      name: 'Лоб',
      x: 25, y: 10, width: 50, height: 25,
      color: 'rgba(255, 99, 132, 0.3)',
      metrics: {
        oiliness: Math.min(100, baseMetrics.oiliness + 15),
        pores: Math.min(100, baseMetrics.pores + 10),
        wrinkles: Math.max(0, baseMetrics.wrinkles - 5)
      }
    },
    {
      id: 't-zone',
      name: 'T-зона',
      x: 35, y: 35, width: 30, height: 35,
      color: 'rgba(54, 162, 235, 0.3)',
      metrics: {
        oiliness: Math.min(100, baseMetrics.oiliness + 20),
        pores: Math.min(100, baseMetrics.pores + 15),
        acne: Math.min(100, baseMetrics.acne + 10)
      }
    },
    {
      id: 'cheeks-left',
      name: 'Левая щека',
      x: 10, y: 40, width: 25, height: 30,
      color: 'rgba(255, 206, 86, 0.3)',
      metrics: {
        redness: Math.min(100, baseMetrics.redness + 10),
        pigmentation: Math.min(100, baseMetrics.pigmentation + 5),
        hydration: Math.max(0, baseMetrics.hydration - 10)
      }
    },
    {
      id: 'cheeks-right',
      name: 'Правая щека',
      x: 65, y: 40, width: 25, height: 30,
      color: 'rgba(255, 206, 86, 0.3)',
      metrics: {
        redness: Math.min(100, baseMetrics.redness + 12),
        pigmentation: Math.min(100, baseMetrics.pigmentation + 7),
        hydration: Math.max(0, baseMetrics.hydration - 8)
      }
    },
    {
      id: 'under-eyes',
      name: 'Область под глазами',
      x: 25, y: 30, width: 50, height: 15,
      color: 'rgba(153, 102, 255, 0.3)',
      metrics: {
        wrinkles: Math.min(100, baseMetrics.wrinkles + 20),
        puffiness: Math.min(100, baseMetrics.puffiness + 15),
        pigmentation: Math.min(100, baseMetrics.pigmentation + 10)
      }
    },
    {
      id: 'chin',
      name: 'Подбородок',
      x: 35, y: 70, width: 30, height: 25,
      color: 'rgba(75, 192, 192, 0.3)',
      metrics: {
        acne: Math.min(100, baseMetrics.acne + 8),
        oiliness: Math.min(100, baseMetrics.oiliness + 10),
        texture: Math.max(0, baseMetrics.texture - 5)
      }
    }
  ];

  return { metrics: baseMetrics, zones };
};

const getMetricColor = (value: number): string => {
  if (value <= 30) return 'text-green-600';
  if (value <= 60) return 'text-yellow-600';
  return 'text-red-600';
};

const getMetricBgColor = (value: number): string => {
  if (value <= 30) return 'bg-green-100';
  if (value <= 60) return 'bg-yellow-100';
  return 'bg-red-100';
};

export default function SkinAnalysis({ imageUrl, onAnalysisComplete }: SkinAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metrics, setMetrics] = useState<SkinMetrics | null>(null);
  const [zones, setZones] = useState<SkinZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const startAnalysis = async () => {
    if (!imageRef.current || !canvasRef.current) return;
    
    setIsAnalyzing(true);
    
    // Симуляция времени анализа
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Получаем данные изображения
    canvas.width = imageRef.current.naturalWidth;
    canvas.height = imageRef.current.naturalHeight;
    ctx.drawImage(imageRef.current, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Анализируем
    const result = analyzeSkinImage(imageData);
    setMetrics(result.metrics);
    setZones(result.zones);
    
    // Генерируем текстовый анализ
    const analysis = generateAnalysisText(result.metrics, result.zones);
    
    setIsAnalyzing(false);
    onAnalysisComplete(result.metrics, result.zones, analysis);
  };

  const generateAnalysisText = (metrics: SkinMetrics, zones: SkinZone[]): string => {
    const issues = [];
    
    if (metrics.acne > 40) issues.push('выраженные высыпания');
    if (metrics.oiliness > 60) issues.push('повышенная жирность');
    if (metrics.redness > 50) issues.push('покраснения и раздражения');
    if (metrics.pores > 70) issues.push('расширенные поры');
    if (metrics.pigmentation > 40) issues.push('пигментация');
    if (metrics.wrinkles > 50) issues.push('признаки старения');
    if (metrics.hydration < 40) issues.push('недостаток увлажнения');

    const problemZones = zones.filter(zone => 
      Object.values(zone.metrics).some(value => value && value > 60)
    ).map(zone => zone.name.toLowerCase());

    let text = '';
    
    if (issues.length > 0) {
      text += `Обнаружены: ${issues.join(', ')}. `;
    } else {
      text += 'Кожа в целом в хорошем состоянии. ';
    }
    
    if (problemZones.length > 0) {
      text += `Особое внимание требуют зоны: ${problemZones.join(', ')}. `;
    }
    
    text += `Общий индекс здоровья кожи: ${Math.round((100 - (metrics.acne + metrics.redness + metrics.pigmentation) / 3))}/100.`;
    
    return text;
  };

  const metricLabels = {
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

  return (
    <div className="space-y-6">
      {/* Изображение с зонами */}
      <div className="relative">
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Анализ кожи"
          className="w-full max-w-md mx-auto rounded-2xl"
          onLoad={() => {
            if (!metrics) startAnalysis();
          }}
        />
        
        {/* Зоны анализа */}
        {zones.length > 0 && (
          <div className="absolute inset-0 max-w-md mx-auto">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {zones.map(zone => (
                <rect
                  key={zone.id}
                  x={zone.x}
                  y={zone.y}
                  width={zone.width}
                  height={zone.height}
                  fill={selectedZone === zone.id ? zone.color.replace('0.3', '0.6') : zone.color}
                  stroke={selectedZone === zone.id ? '#4F46E5' : 'rgba(255,255,255,0.5)'}
                  strokeWidth="0.5"
                  className="cursor-pointer transition-all"
                  onClick={() => setSelectedZone(selectedZone === zone.id ? null : zone.id)}
                />
              ))}
            </svg>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Индикатор анализа */}
      {isAnalyzing && (
        <div className="text-center py-8">
          <div className="inline-flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="text-lg font-medium">Анализируем кожу...</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">Определяем зоны и характеристики</p>
        </div>
      )}

      {/* Метрики */}
      {metrics && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Показатели кожи</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(metrics).map(([key, value]) => (
              <div key={key} className={`p-3 rounded-xl ${getMetricBgColor(value)}`}>
                <div className="text-sm font-medium text-gray-700">
                  {metricLabels[key as keyof SkinMetrics]}
                </div>
                <div className={`text-2xl font-bold ${getMetricColor(value)}`}>
                  {value}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className={`h-2 rounded-full ${
                      value <= 30 ? 'bg-green-500' : 
                      value <= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Детали выбранной зоны */}
      {selectedZone && (
        <div className="bg-indigo-50 rounded-xl p-4">
          <h4 className="font-bold text-indigo-900 mb-2">
            {zones.find(z => z.id === selectedZone)?.name}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(zones.find(z => z.id === selectedZone)?.metrics || {}).map(([key, value]) => 
              value !== undefined ? (
                <div key={key} className="flex justify-between">
                  <span className="text-sm text-indigo-700">{metricLabels[key as keyof SkinMetrics]}:</span>
                  <span className={`text-sm font-medium ${getMetricColor(value)}`}>{value}</span>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Подсказка */}
      {zones.length > 0 && !selectedZone && (
        <p className="text-sm text-gray-500 text-center">
          Нажмите на цветные зоны для детального анализа
        </p>
      )}
    </div>
  );
}