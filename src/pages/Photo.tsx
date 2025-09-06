import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  };

  const analyze = async () => {
    if (!selectedFile) {
      console.log("No file selected");
      return;
    }
    console.log("Starting analysis...");
    setIsAnalyzing(true);
    try {
      // имитация расширенного анализа
      console.log("Waiting for analysis...");
      await new Promise((r) => setTimeout(r, 2000));

      // Генерируем более реалистичные результаты анализа
      const skinTypes = ["Сухая", "Нормальная", "Комбинированная", "Жирная"];
      const oilinessLevels: ("низкая" | "средняя" | "высокая")[] = ["низкая", "средняя", "высокая"];
      const poreSizes: ("мелкие" | "средние" | "расширенные")[] = ["мелкие", "средние", "расширенные"];
      const tones: ("светлый" | "средний" | "тёмный")[] = ["светлый", "средний", "тёмный"];
      
      const possibleConcerns = [
        "Чёрные точки", "Белые угри", "Воспаления", "Постакне", 
        "Пигментные пятна", "Сухость", "Шелушение", "Покраснение",
        "Расширенные поры", "Неровная текстура", "Тусклость", "Морщины"
      ];

      // Случайный, но логически связанный анализ
      const skinType = skinTypes[Math.floor(Math.random() * skinTypes.length)];
      const oiliness = oilinessLevels[Math.floor(Math.random() * oilinessLevels.length)];
      const sensitivity = Math.floor(Math.random() * 8) + 1; // 1-8
      const hydration = Math.floor(Math.random() * 8) + 2; // 2-9
      
      // Генерируем 2-4 связанные проблемы
      const numConcerns = Math.floor(Math.random() * 3) + 2;
      const concerns = possibleConcerns
        .sort(() => 0.5 - Math.random())
        .slice(0, numConcerns);

      // Логически связанные параметры
      const baseAge = 25;
      const ageVariation = Math.floor(Math.random() * 15) - 7; // -7 to +7
      const perceivedAge = Math.max(18, baseAge + ageVariation);
      const eyeAge = Math.max(16, perceivedAge + Math.floor(Math.random() * 6) - 3);
      
      const smoothness = Math.floor(Math.random() * 6) + 4; // 4-9
      const elasticity = Math.floor(Math.random() * 6) + 4; // 4-9
      const firmness = Math.floor(Math.random() * 6) + 4; // 4-9
      
      const result: Analysis = {
        skinType,
        oiliness,
        sensitivity,
        concerns,
        texture: {
          smoothness,
          poreSize: poreSizes[Math.floor(Math.random() * poreSizes.length)],
          evenness: Math.floor(Math.random() * 6) + 3, // 3-8
        },
        pigmentation: {
          spots: Math.random() > 0.6,
          postAcne: concerns.includes("Постакне"),
          overallTone: tones[Math.floor(Math.random() * tones.length)],
        },
        aging: {
          fineLines: perceivedAge > 28 || Math.random() > 0.7,
          elasticity,
          firmness,
        },
        hydration,
        timestamp: Date.now(),
        previewDataUrl: preview,
        // Добавляем вычисляемые возрасты
        perceivedAge,
        eyeAge,
      };

      if (saveHistoryEnabled) {
        setHistory((h) => [result, ...h].slice(0, 20));
      }

      // показываем результат на странице
      console.log("Analysis completed, setting result:", result);
      setAnalysisResult(result);
    } catch (error) {
      console.error("Analysis error:", error);
      setError("Ошибка при анализе. Попробуйте ещё раз.");
    } finally {
      console.log("Setting isAnalyzing to false");
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
    <div className="max-w-3xl mx-auto">
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
              onClick={() => {
                console.log("Analyze button clicked", { selectedFile: !!selectedFile, error, isAnalyzing });
                analyze();
              }}
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

            {/* Основные характеристики - 4 карточки в ряд */}
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
              <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="text-2xl font-bold text-gray-900">{analysisResult.perceivedAge} лет</div>
                <div className="text-sm text-gray-600 mt-1">Воспринимаемый возраст</div>
              </div>
              <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="text-2xl font-bold text-gray-900">{analysisResult.eyeAge} лет</div>
                <div className="text-sm text-gray-600 mt-1">Возраст глаз</div>
              </div>
            </div>

            {/* Визуальные метрики с изображениями */}
            <div className="grid grid-cols-2 gap-4">
              {/* Левая карточка - Акне */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="relative">
                  {preview && (
                    <img
                      src={preview}
                      alt="Анализ акне"
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                    Акне
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-lg font-semibold text-gray-900">Акне</div>
                  <div className="text-sm text-gray-600 mb-3">
                    {analysisResult.concerns.includes("Воспаления") ? "умеренная форма" : "лёгкая форма"}
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

              {/* Правая карточка - Прозрачность */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="relative">
                  {preview && (
                    <img
                      src={preview}
                      alt="Анализ прозрачности"
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                    Прозрачность
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-lg font-semibold text-gray-900">Прозрачность</div>
                  <div className="text-sm text-gray-600 mb-3">
                    {analysisResult.texture.smoothness > 7 ? "Хорошо" : "Плохо"}
                  </div>
                  <button 
                    type="button"
                    onClick={() => alert('Детальная информация о прозрачности будет доступна в следующих версиях')}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Показать
                  </button>
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
  );
}
