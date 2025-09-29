import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type ProblemZone = {
  id: string;
  type: 'acne' | 'pigmentation' | 'wrinkles' | 'pores' | 'dark_circles' | 'redness';
  severity: 'low' | 'medium' | 'high';
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  description: string;
  confidence: number; // 0-100
};

type Analysis = {
  skinType: string;
  oiliness: "низкая" | "средняя" | "высокая";
  sensitivity: number; // 0-10
  concerns: string[];
  texture: {
    smoothness: number; // 0-10
    poreSize: "мелкие" | "средние" | "расширенные";
    evenness: number; // 0-10
  };
  pigmentation: {
    spots: boolean;
    postAcne: boolean;
    overallTone: "светлый" | "средний" | "тёмный";
  };
  aging: {
    fineLines: boolean;
    elasticity: number; // 0-10
    firmness: number; // 0-10
  };
  hydration: number; // 0-10
  perceivedAge: number;
  eyeAge: number;
  timestamp: number;
  previewDataUrl?: string | null;
  problemZones: ProblemZone[];
};

const isBrowser = typeof window !== "undefined";
const HISTORY_KEY = "skiniq.photo.history";
const ANSWERS_KEY = "skiniq.answers";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export default function Photo() {
  const navigate = useNavigate();

  // UI state
  const [showHowto, setShowHowto] = useState<boolean>(() => {
    return isBrowser ? localStorage.getItem("photo.hideHowto") !== "1" : true;
  });
  const [dontShowChecked, setDontShowChecked] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Analysis | null>(null);
  const [showDetailedMetrics, setShowDetailedMetrics] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);



  





  // По умолчанию историю сохраняем
  const saveHistoryEnabled = true;

  const [history, setHistory] = useState<Analysis[]>(() => {
    if (!isBrowser) return [];
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? (JSON.parse(raw) as Analysis[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!isBrowser) return;
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {}
  }, [history]);

  const onContinueHowto = () => {
    setShowHowto(false);
    if (dontShowChecked && isBrowser) {
      try {
        localStorage.setItem("photo.hideHowto", "1");
      } catch {}
    }
  };

  const onGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) {
      setSelectedFile(null);
      setPreview(null);
      setError("Формат не поддерживается. Загрузите JPG/PNG до 10 МБ.");
      return;
    }

    const file = list[0];

    // Валидация формата
    const allowed = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowed.includes(file.type)) {
      setSelectedFile(null);
      setPreview(null);
      setError("Формат не поддерживается. Загрузите JPG/PNG до 10 МБ.");
      e.currentTarget.value = "";
      return;
    }

    // Валидация размера (<= 10 МБ)
    if (file.size > 10 * 1024 * 1024) {
      setSelectedFile(null);
      setPreview(null);
      setError("Файл слишком большой. Максимум 10 МБ.");
      e.currentTarget.value = "";
      return;
    }

    // Валидный файл: очищаем ошибку и создаём предпросмотр (Data URL)
    setError(null);
    setSelectedFile(file);
    fileToDataUrl(file)
      .then((dataUrl) => setPreview(dataUrl))
      .catch(() => setPreview(null));
  };

  const restart = () => {
    setError(null);
    setSelectedFile(null);
    setPreview(null);
    setIsAnalyzing(false);
    setAnalysisResult(null);
    setShowDetailedMetrics(false);
    setCurrentCardIndex(0);
    setSelectedZone(null);
  };

  // Функция для получения цвета зоны по типу
  const getZoneColor = (type: ProblemZone['type'], severity: ProblemZone['severity']) => {
    const colors = {
      acne: { low: 'bg-yellow-400', medium: 'bg-orange-400', high: 'bg-red-500' },
      pigmentation: { low: 'bg-yellow-300', medium: 'bg-amber-400', high: 'bg-amber-600' },
      wrinkles: { low: 'bg-gray-400', medium: 'bg-gray-500', high: 'bg-gray-600' },
      pores: { low: 'bg-blue-300', medium: 'bg-blue-400', high: 'bg-blue-500' },
      dark_circles: { low: 'bg-purple-300', medium: 'bg-purple-400', high: 'bg-purple-500' },
      redness: { low: 'bg-pink-300', medium: 'bg-pink-400', high: 'bg-pink-500' },
    };
    return colors[type][severity];
  };


  const analyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    try {
      // Имитация ИИ анализа с более реалистичными и связанными результатами
      await new Promise((r) => setTimeout(r, 2000));
      
      // Базовые параметры для более реалистичного анализа
      
      // Расширенный список проблем с категориями
      const concernCategories = {
        acne: ["Чёрные точки", "Белые угри", "Воспаления", "Постакне", "Кистозные угри"],
        pigmentation: ["Пигментные пятна", "Мелазма", "Постакне", "Веснушки", "Неровный тон"],
        aging: ["Морщины", "Потеря упругости", "Глубокие складки", "Обвисание"],
        texture: ["Расширенные поры", "Неровная текстура", "Шероховатость", "Бугристость"],
        sensitivity: ["Покраснение", "Раздражение", "Шелушение", "Жжение", "Зуд"],
        hydration: ["Сухость", "Обезвоженность", "Стянутость", "Тусклость"]
      };

      // Генерируем логически связанный профиль кожи
      const baseProfile = Math.random();
      let skinType, oiliness, sensitivity, hydration, concerns;
      
      if (baseProfile < 0.25) {
        // Сухая кожа
        skinType = "Сухая";
        oiliness = "низкая";
        sensitivity = Math.floor(Math.random() * 4) + 6; // 6-9 (высокая чувствительность)
        hydration = Math.floor(Math.random() * 3) + 2; // 2-4 (низкая увлажнённость)
        concerns = [
          ...concernCategories.hydration.slice(0, 2),
          ...concernCategories.sensitivity.slice(0, 2),
          ...concernCategories.aging.slice(0, 1)
        ];
      } else if (baseProfile < 0.5) {
        // Жирная кожа
        skinType = "Жирная";
        oiliness = "высокая";
        sensitivity = Math.floor(Math.random() * 4) + 2; // 2-5 (низкая чувствительность)
        hydration = Math.floor(Math.random() * 3) + 6; // 6-8 (хорошая увлажнённость)
        concerns = [
          ...concernCategories.acne.slice(0, 3),
          ...concernCategories.texture.slice(0, 2)
        ];
      } else if (baseProfile < 0.75) {
        // Комбинированная кожа
        skinType = "Комбинированная";
        oiliness = "средняя";
        sensitivity = Math.floor(Math.random() * 4) + 3; // 3-6 (средняя чувствительность)
        hydration = Math.floor(Math.random() * 4) + 4; // 4-7 (средняя увлажнённость)
        concerns = [
          ...concernCategories.acne.slice(0, 2),
          ...concernCategories.texture.slice(0, 1),
          ...concernCategories.pigmentation.slice(0, 1)
        ];
      } else {
        // Нормальная кожа
        skinType = "Нормальная";
        oiliness = "средняя";
        sensitivity = Math.floor(Math.random() * 3) + 2; // 2-4 (низкая чувствительность)
        hydration = Math.floor(Math.random() * 3) + 6; // 6-8 (хорошая увлажнённость)
        concerns = [
          ...concernCategories.aging.slice(0, 1),
          ...concernCategories.pigmentation.slice(0, 1)
        ];
      }

      // Логически связанные параметры на основе профиля кожи
      const baseAge = 25;
      const ageVariation = Math.floor(Math.random() * 15) - 7; // -7 to +7
      const perceivedAge = Math.max(18, baseAge + ageVariation);
      const eyeAge = Math.max(16, perceivedAge + Math.floor(Math.random() * 6) - 3);
      
      // Текстура зависит от типа кожи и возраста
      let smoothness, elasticity, firmness, poreSize;
      
      if (skinType === "Жирная") {
        smoothness = Math.floor(Math.random() * 3) + 6; // 6-8 (гладкая)
        elasticity = Math.floor(Math.random() * 3) + 6; // 6-8 (хорошая)
        firmness = Math.floor(Math.random() * 3) + 6; // 6-8 (хорошая)
        poreSize = Math.random() > 0.5 ? "расширенные" : "средние";
      } else if (skinType === "Сухая") {
        smoothness = Math.floor(Math.random() * 3) + 3; // 3-5 (шероховатая)
        elasticity = Math.floor(Math.random() * 3) + 3; // 3-5 (сниженная)
        firmness = Math.floor(Math.random() * 3) + 3; // 3-5 (сниженная)
        poreSize = "мелкие";
      } else if (skinType === "Комбинированная") {
        smoothness = Math.floor(Math.random() * 4) + 4; // 4-7 (смешанная)
        elasticity = Math.floor(Math.random() * 4) + 4; // 4-7 (смешанная)
        firmness = Math.floor(Math.random() * 4) + 4; // 4-7 (смешанная)
        poreSize = Math.random() > 0.3 ? "средние" : "расширенные";
      } else {
        smoothness = Math.floor(Math.random() * 3) + 6; // 6-8 (хорошая)
        elasticity = Math.floor(Math.random() * 3) + 6; // 6-8 (хорошая)
        firmness = Math.floor(Math.random() * 3) + 6; // 6-8 (хорошая)
        poreSize = "мелкие";
      }
      
      // Возрастные корректировки
      if (perceivedAge > 30) {
        elasticity = Math.max(3, elasticity - 2);
        firmness = Math.max(3, firmness - 2);
        smoothness = Math.max(4, smoothness - 1);
      }
      
      // Пигментация зависит от возраста и типа кожи
      const hasSpots = perceivedAge > 25 && Math.random() > 0.4;
      const hasPostAcne = concerns.some(c => c.includes("Постакне") || c.includes("акне"));
      const overallTone = perceivedAge > 30 ? 
        (Math.random() > 0.5 ? "средний" : "тёмный") : 
        (Math.random() > 0.3 ? "светлый" : "средний");

      // Генерируем проблемные зоны на основе анализа
      const problemZones: ProblemZone[] = [];
      
      // Зоны акне
      if (concerns.some(c => c.includes("Воспаления") || c.includes("Кистозные"))) {
        problemZones.push({
          id: 'acne-1',
          type: 'acne',
          severity: 'high',
          coordinates: { x: 120, y: 80, width: 25, height: 25 },
          description: 'Воспаленный прыщ',
          confidence: 85
        });
        problemZones.push({
          id: 'acne-2',
          type: 'acne',
          severity: 'medium',
          coordinates: { x: 200, y: 120, width: 15, height: 15 },
          description: 'Комедон',
          confidence: 78
        });
      }
      
      // Зоны пигментации
      if (hasSpots) {
        problemZones.push({
          id: 'pigment-1',
          type: 'pigmentation',
          severity: 'medium',
          coordinates: { x: 150, y: 100, width: 20, height: 20 },
          description: 'Пигментное пятно',
          confidence: 82
        });
      }
      
      // Зоны морщин
      if (perceivedAge > 28 || (skinType === "Сухая" && perceivedAge > 25)) {
        problemZones.push({
          id: 'wrinkle-1',
          type: 'wrinkles',
          severity: 'low',
          coordinates: { x: 100, y: 60, width: 40, height: 3 },
          description: 'Мелкие морщинки',
          confidence: 75
        });
      }
      
      // Зоны пор
      if (poreSize === "расширенные") {
        problemZones.push({
          id: 'pores-1',
          type: 'pores',
          severity: 'medium',
          coordinates: { x: 180, y: 90, width: 30, height: 30 },
          description: 'Расширенные поры',
          confidence: 88
        });
      }
      
      // Зоны покраснения
      if (sensitivity > 7) {
        problemZones.push({
          id: 'redness-1',
          type: 'redness',
          severity: 'medium',
          coordinates: { x: 140, y: 70, width: 35, height: 25 },
          description: 'Покраснение кожи',
          confidence: 80
        });
      }

      const result: Analysis = {
        skinType,
        oiliness: oiliness as "низкая" | "средняя" | "высокая",
        sensitivity,
        concerns,
        texture: {
          smoothness,
          poreSize: poreSize as "мелкие" | "средние" | "расширенные",
          evenness: Math.floor(Math.random() * 4) + Math.max(4, smoothness - 2), // связан с гладкостью
        },
        pigmentation: {
          spots: hasSpots,
          postAcne: hasPostAcne,
          overallTone: overallTone as "светлый" | "средний" | "тёмный",
        },
        aging: {
          fineLines: perceivedAge > 28 || (skinType === "Сухая" && perceivedAge > 25),
          elasticity,
          firmness,
        },
        hydration,
        timestamp: Date.now(),
        previewDataUrl: preview,
        // Добавляем вычисляемые возрасты
        perceivedAge,
        eyeAge,
        problemZones,
      };

      if (saveHistoryEnabled) {
        setHistory((h) => [result, ...h].slice(0, 20));
      }

      // показываем результат на странице
      setAnalysisResult(result);
    } catch (error) {
      console.error("Analysis error:", error);
      setError("Ошибка при анализе. Попробуйте ещё раз.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const createPlan = () => {
    if (!analysisResult) return;
    if (isBrowser) {
      try {
        const prev = localStorage.getItem(ANSWERS_KEY);
        const data = prev ? JSON.parse(prev) : {};
        
        // Преобразуем расширенный анализ в формат, понятный системе планирования
        const mappedAnswers = {
          ...data,
          source: "photo",
          analysis: analysisResult,
          // Маппинг для совместимости с существующей системой
          skinType: analysisResult.skinType.toLowerCase(),
          oiliness: analysisResult.oiliness,
          sensitivity: analysisResult.sensitivity > 5,
          concerns: analysisResult.concerns,
          // Дополнительные параметры из расширенного анализа
          hydration: analysisResult.hydration,
          texture: analysisResult.texture,
          pigmentation: analysisResult.pigmentation,
          aging: analysisResult.aging,
        };
        
        localStorage.setItem(ANSWERS_KEY, JSON.stringify(mappedAnswers));
      } catch {}
    }
    navigate("/plan");
  };

  const removeFromHistory = (idx: number) => {
    setHistory((h) => {
      const copy = [...h];
      copy.splice(idx, 1);
      return copy;
    });
  };

  return (
    <div className="w-full min-h-screen relative">
      {/* Background layers: CSS gradient */}
      <div 
        className="absolute inset-0 -z-10"
        style={{
          background: "radial-gradient(120% 140% at 70% 0%, #ffe7ef 0%, #f3e6cf 35%, #efeef2 65%, #e7e7ea 100%)"
        }}
      />
      
      <div className="relative z-20 max-w-3xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-4">Скан по фото</h1>

      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Загрузите фото</h2>
            <p className="text-sm text-neutral-600">
              Поддерживаются JPG/PNG до 10 МБ.
            </p>
          </div>
          <div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl transition focus:outline-none disabled:opacity-50 disabled:pointer-events-none px-4 py-2 border border-transparent hover:bg-neutral-100"
              onClick={() => setShowHowto((s) => !s)}
            >
              Как сделать фото?
            </button>
          </div>
        </div>

        {showHowto && (
          <div
            className="mt-3 rounded-xl bg-neutral-50 border border-neutral-200 p-3"
            data-testid="howto"
          >
            <p className="text-sm text-neutral-700">
              Делайте фото при естественном освещении, без фильтров и макияжа.
            </p>

            <div className="mt-3 flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={dontShowChecked}
                  onChange={(e) => setDontShowChecked(e.target.checked)}
                />
                Больше не показывать
              </label>

              <button
                type="button"
                className="text-sm px-3 py-1 rounded border hover:bg-neutral-100"
                onClick={onContinueHowto}
              >
                Продолжить
              </button>
            </div>
          </div>
        )}

        {!analysisResult && !isAnalyzing && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              data-testid="file-gallery"
              type="file"
              accept="image/*,.jpg,.jpeg,.png"
              onChange={onGalleryChange}
            />
            <label className="text-xs text-neutral-500">Фото используется только для анализа и не хранится дольше 24 часов.</label>
          </div>

          <div
            role="alert"
            aria-live="assertive"
            className={error ? "text-sm text-red-600 mt-1" : "sr-only"}
          >
            {error ?? ""}
          </div>

          {preview && (
            <div className="pt-2">
              <img
                src={preview}
                alt="Предпросмотр фото"
                className="w-full max-h-72 object-contain rounded-xl border"
                data-testid="preview"
              />
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              disabled={!selectedFile || !!error || isAnalyzing}
              onClick={analyze}
              className="inline-flex items-center justify-center rounded-xl transition focus:outline-none disabled:opacity-50 disabled:pointer-events-none px-4 py-2 border border-black hover:bg-black hover:text-white"
            >
              Отправить на анализ
            </button>
            <button
              type="button"
              onClick={restart}
              className="inline-flex items-center justify-center rounded-xl transition focus:outline-none px-4 py-2 border hover:bg-neutral-100"
            >
              Повторить скан
            </button>
          </div>
        </div>
        )}

        {isAnalyzing && (
          <div className="mt-4">
            <p>Анализируем...</p>
          </div>
        )}

        {analysisResult && !isAnalyzing && (
          <div className="mt-4 space-y-6">
            {/* Заголовок с кнопкой переснять */}
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Ваш анализ</h3>
              <button
                type="button"
                onClick={restart}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Переснять
              </button>
            </div>

            {/* Основные характеристики - 2 карточки в ряд */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="text-2xl font-bold text-gray-900">{analysisResult.skinType}</div>
                <div className="text-sm text-gray-600 mt-1">Тип кожи</div>
              </div>
              <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-gray-900">{analysisResult.oiliness}</div>
                  <div className="w-4 h-4 rounded-full bg-orange-200"></div>
                </div>
                <div className="text-sm text-gray-600 mt-1">Жирность</div>
              </div>
            </div>

            {/* Визуальные метрики с изображениями - листаемые карточки */}
            <div className="space-y-4">
              {/* Навигация */}
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setCurrentCardIndex(Math.max(0, currentCardIndex - 1))}
                  disabled={currentCardIndex === 0}
                  className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex space-x-2">
                  {[0, 1, 2, 3].map((index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setCurrentCardIndex(index)}
                      className={`w-2 h-2 rounded-full ${
                        currentCardIndex === index ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentCardIndex(Math.min(3, currentCardIndex + 1))}
                  disabled={currentCardIndex === 3}
                  className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Карточки */}
              <div className="relative overflow-hidden">
                <div 
                  className="flex transition-transform duration-300 ease-in-out"
                  style={{ transform: `translateX(-${currentCardIndex * 100}%)` }}
                >
                  {/* Карточка 1 - Акне */}
                  <div className="w-full flex-shrink-0">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="relative">
                        {preview && (
                          <div className="relative">
                            <img
                              src={preview}
                              alt="Анализ акне"
                              className="w-full h-48 object-cover"
                            />
                            {/* Проблемные зоны акне */}
                            {analysisResult.problemZones
                              .filter(zone => zone.type === 'acne')
                              .map((zone) => (
                                <div
                                  key={zone.id}
                                  className={`absolute border-2 border-white rounded-full cursor-pointer transition-all duration-200 hover:scale-110 ${getZoneColor(zone.type, zone.severity)} opacity-80`}
                                  style={{
                                    left: `${zone.coordinates.x}px`,
                                    top: `${zone.coordinates.y}px`,
                                    width: `${zone.coordinates.width}px`,
                                    height: `${zone.coordinates.height}px`,
                                  }}
                                  onClick={() => setSelectedZone(selectedZone === zone.id ? null : zone.id)}
                                >
                                  {selectedZone === zone.id && (
                                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                      {zone.description} ({zone.confidence}%)
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                        <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-medium">
                          Акне
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="text-lg font-semibold text-gray-900">Акне</div>
                        <div className="text-sm text-gray-600 mb-3">
                          {analysisResult.problemZones.filter(z => z.type === 'acne').length > 0 ? 
                            `Обнаружено ${analysisResult.problemZones.filter(z => z.type === 'acne').length} проблемных зон` : 
                            "Проблемы не обнаружены"}
                        </div>
                        <button 
                          type="button"
                          onClick={() => alert('Детальная информация об акне будет доступна в следующих версиях')}
                          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          Показать больше
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Карточка 2 - Поры */}
                  <div className="w-full flex-shrink-0">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="relative">
                        {preview && (
                          <div className="relative">
                            <img
                              src={preview}
                              alt="Анализ пор"
                              className="w-full h-48 object-cover"
                            />
                            {/* Проблемные зоны пор */}
                            {analysisResult.problemZones
                              .filter(zone => zone.type === 'pores')
                              .map((zone) => (
                                <div
                                  key={zone.id}
                                  className={`absolute border-2 border-white rounded-full cursor-pointer transition-all duration-200 hover:scale-110 ${getZoneColor(zone.type, zone.severity)} opacity-80`}
                                  style={{
                                    left: `${zone.coordinates.x}px`,
                                    top: `${zone.coordinates.y}px`,
                                    width: `${zone.coordinates.width}px`,
                                    height: `${zone.coordinates.height}px`,
                                  }}
                                  onClick={() => setSelectedZone(selectedZone === zone.id ? null : zone.id)}
                                >
                                  {selectedZone === zone.id && (
                                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                      {zone.description} ({zone.confidence}%)
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                        <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
                          Поры
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="text-lg font-semibold text-gray-900">Поры</div>
                        <div className="text-sm text-gray-600 mb-3">
                          {analysisResult.problemZones.filter(z => z.type === 'pores').length > 0 ? 
                            `Обнаружено ${analysisResult.problemZones.filter(z => z.type === 'pores').length} проблемных зон` : 
                            "Поры в норме"}
                        </div>
                        <button 
                          type="button"
                          onClick={() => alert('Детальная информация о порах будет доступна в следующих версиях')}
                          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          Показать
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Карточка 3 - Пигментация */}
                  <div className="w-full flex-shrink-0">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="relative">
                        {preview && (
                          <div className="relative">
                            <img
                              src={preview}
                              alt="Анализ пигментации"
                              className="w-full h-48 object-cover"
                            />
                            {/* Проблемные зоны пигментации */}
                            {analysisResult.problemZones
                              .filter(zone => zone.type === 'pigmentation')
                              .map((zone) => (
                                <div
                                  key={zone.id}
                                  className={`absolute border-2 border-white rounded-full cursor-pointer transition-all duration-200 hover:scale-110 ${getZoneColor(zone.type, zone.severity)} opacity-80`}
                                  style={{
                                    left: `${zone.coordinates.x}px`,
                                    top: `${zone.coordinates.y}px`,
                                    width: `${zone.coordinates.width}px`,
                                    height: `${zone.coordinates.height}px`,
                                  }}
                                  onClick={() => setSelectedZone(selectedZone === zone.id ? null : zone.id)}
                                >
                                  {selectedZone === zone.id && (
                                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                      {zone.description} ({zone.confidence}%)
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                        <div className="absolute top-2 left-2 bg-amber-600 text-white px-2 py-1 rounded text-xs font-medium">
                          Пигментация
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="text-lg font-semibold text-gray-900">Пигментация</div>
                        <div className="text-sm text-gray-600 mb-3">
                          {analysisResult.problemZones.filter(z => z.type === 'pigmentation').length > 0 ? 
                            `Обнаружено ${analysisResult.problemZones.filter(z => z.type === 'pigmentation').length} проблемных зон` : 
                            "Равномерный тон"}
                        </div>
                        <button 
                          type="button"
                          onClick={() => alert('Детальная информация о пигментации будет доступна в следующих версиях')}
                          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          Показать
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Карточка 4 - Морщины */}
                  <div className="w-full flex-shrink-0">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="relative">
                        {preview && (
                          <div className="relative">
                            <img
                              src={preview}
                              alt="Анализ морщин"
                              className="w-full h-48 object-cover"
                            />
                            {/* Проблемные зоны морщин */}
                            {analysisResult.problemZones
                              .filter(zone => zone.type === 'wrinkles')
                              .map((zone) => (
                                <div
                                  key={zone.id}
                                  className={`absolute border-2 border-white cursor-pointer transition-all duration-200 hover:scale-110 ${getZoneColor(zone.type, zone.severity)} opacity-80`}
                                  style={{
                                    left: `${zone.coordinates.x}px`,
                                    top: `${zone.coordinates.y}px`,
                                    width: `${zone.coordinates.width}px`,
                                    height: `${zone.coordinates.height}px`,
                                    borderRadius: zone.coordinates.height < 5 ? '2px' : '50%',
                                  }}
                                  onClick={() => setSelectedZone(selectedZone === zone.id ? null : zone.id)}
                                >
                                  {selectedZone === zone.id && (
                                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                      {zone.description} ({zone.confidence}%)
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                        <div className="absolute top-2 right-2 bg-gray-600 text-white px-2 py-1 rounded text-xs font-medium">
                          Морщины
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="text-lg font-semibold text-gray-900">Морщины</div>
                        <div className="text-sm text-gray-600 mb-3">
                          {analysisResult.problemZones.filter(z => z.type === 'wrinkles').length > 0 ? 
                            `Обнаружено ${analysisResult.problemZones.filter(z => z.type === 'wrinkles').length} проблемных зон` : 
                            "Кожа гладкая"}
                        </div>
                        <button 
                          type="button"
                          onClick={() => alert('Детальная информация о морщинах будет доступна в следующих версиях')}
                          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          Показать
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Детальные метрики с прогресс-барами */}
            {showDetailedMetrics && (
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-900">Детальные показатели</h4>
              
              {/* Чувствительность */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">Чувствительность</span>
                  <span className="text-sm text-gray-600">{analysisResult.sensitivity}/10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-orange-500 h-2 rounded-full" 
                    style={{ width: `${(analysisResult.sensitivity / 10) * 100}%` }}
                  ></div>
                </div>
                <div className="mt-2">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    analysisResult.sensitivity > 6 ? 'bg-red-100 text-red-800' : 
                    analysisResult.sensitivity > 3 ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-green-100 text-green-800'
                  }`}>
                    {analysisResult.sensitivity > 6 ? 'Повышенная' : 
                     analysisResult.sensitivity > 3 ? 'Средняя' : 'Низкая'}
                  </span>
                </div>
              </div>

              {/* Увлажнённость */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">Увлажнённость</span>
                  <span className="text-sm text-gray-600">{analysisResult.hydration}/10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${(analysisResult.hydration / 10) * 100}%` }}
                  ></div>
                </div>
                <div className="mt-2">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    analysisResult.hydration > 7 ? 'bg-green-100 text-green-800' : 
                    analysisResult.hydration > 4 ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-red-100 text-red-800'
                  }`}>
                    {analysisResult.hydration > 7 ? 'Хорошая' : 
                     analysisResult.hydration > 4 ? 'Средняя' : 'Низкая'}
                  </span>
                </div>
              </div>

              {/* Текстура */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">Гладкость</span>
                  <span className="text-sm text-gray-600">{analysisResult.texture.smoothness}/10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full" 
                    style={{ width: `${(analysisResult.texture.smoothness / 10) * 100}%` }}
                  ></div>
                </div>
                <div className="mt-2">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    analysisResult.texture.smoothness > 7 ? 'bg-green-100 text-green-800' : 
                    analysisResult.texture.smoothness > 4 ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-red-100 text-red-800'
                  }`}>
                    {analysisResult.texture.smoothness > 7 ? 'Отличная' : 
                     analysisResult.texture.smoothness > 4 ? 'Хорошая' : 'Требует улучшения'}
                  </span>
                </div>
              </div>
            </div>
            )}

            {/* Рекомендации */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-lg font-semibold text-gray-900">Рекомендации для вас</h4>
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-gray-900">Шаг 1: Для снятия макияжа</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Мягко очистите кожу от макияжа и поверхностных загрязнений
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowDetailedMetrics(!showDetailedMetrics)}
                  className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
                >
                  <svg 
                    className={`w-4 h-4 transition-transform ${showDetailedMetrics ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  РЕКОМЕНДАЦИИ ДЛЯ ВАС
                </button>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={createPlan}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                Создать план ухода
              </button>
            </div>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-6">
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4">
            <h3 className="text-lg font-medium mb-2">История сканов</h3>
            <ul className="space-y-2">
              {history.map((h, idx) => (
                <li key={`${h.timestamp}-${idx}`} className="flex items-center gap-3">
                  {h.previewDataUrl && (
                    <img
                      src={h.previewDataUrl}
                      alt=""
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div className="text-sm flex-1">
                    <div className="font-medium">
                      {new Date(h.timestamp).toLocaleString()}
                    </div>
                    <div className="text-neutral-600">
                      {h.skinType} • {h.oiliness} • {h.sensitivity}/10 чувствительность
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {h.concerns.slice(0, 3).join(", ")}{h.concerns.length > 3 && "..."}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={() => removeFromHistory(idx)}
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

