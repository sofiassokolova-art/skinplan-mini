import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { analyzeSkinPhoto } from "../lib/skinAnalysis";

const Button = ({ children, onClick, disabled, variant = "primary", ...props }: any) => {
  const baseClass = "inline-flex items-center justify-center rounded-xl transition focus:outline-none disabled:opacity-50 disabled:pointer-events-none px-4 py-2";
  const variantClass = variant === "primary" ? "border border-black hover:bg-black hover:text-white" :
                      "border border-transparent hover:bg-neutral-100";
  
  return (
    <button 
      disabled={disabled}
      onClick={onClick} 
      className={`${baseClass} ${variantClass}`} 
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>
    {children}
  </div>
);

async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export default function Photo() {
  const navigate = useNavigate();
  const [showHowTo, setShowHowTo] = useState(() => 
    typeof window !== "undefined" ? localStorage.getItem("photo.hideHowto") !== "1" : true
  );
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [selectedProblem, setSelectedProblem] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("skiniq.photo.history");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("skiniq.photo.history", JSON.stringify(history));
      } catch {}
    }
  }, [history]);

  const dismissHowTo = () => {
    setShowHowTo(false);
    if (dontShowAgain && typeof window !== "undefined") {
      try {
        localStorage.setItem("photo.hideHowto", "1");
      } catch {}
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setError("Формат не поддерживается. Загрузите JPG/PNG до 10 МБ.");
      return;
    }

    const file = files[0];
    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setError("Формат не поддерживается. Загрузите JPG/PNG до 10 МБ.");
      event.currentTarget.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setError("Файл слишком большой. Максимум 10 МБ.");
      event.currentTarget.value = "";
      return;
    }

    setError(null);
    setSelectedFile(file);
    readFileAsDataURL(file)
      .then(dataUrl => setPreviewUrl(dataUrl))
      .catch(() => setPreviewUrl(null));
  };

  const resetScan = () => {
    setError(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsAnalyzing(false);
    setAnalysisResult(null);
    setSelectedProblem(null);
  };

  const analyzePhoto = async () => {
    if (selectedFile && previewUrl) {
      setIsAnalyzing(true);
      try {
        const analysis = await analyzeSkinPhoto(previewUrl);
        
        const result = {
          skinType: analysis.skinType,
          concerns: analysis.concerns,
          timestamp: Date.now(),
          previewDataUrl: previewUrl,
          problemAreas: analysis.problemAreas,
          recommendations: analysis.recommendations,
          confidence: analysis.confidence
        };

        // Add to history
        setHistory(prev => [result, ...prev].slice(0, 20));
        setAnalysisResult(result);
        
        // Также сохраняем в answers для синхронизации с Quiz
        try {
          const existingAnswers = localStorage.getItem("skiniq.answers");
          const answers = existingAnswers ? JSON.parse(existingAnswers) : {};
          const updatedAnswers = {
            ...answers,
            photo_data_url: previewUrl,
            photo_analysis: analysis,
            photo_scans: [...(answers.photo_scans || []), {
              ts: Date.now(),
              preview: previewUrl,
              analysis,
              problemAreas: analysis.problemAreas
            }]
          };
          localStorage.setItem("skiniq.answers", JSON.stringify(updatedAnswers));
        } catch (syncError) {
          console.error('Error syncing to answers:', syncError);
        }
      } catch (err) {
        setError("Ошибка анализа. Попробуйте другое фото.");
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const createPlan = () => {
    if (analysisResult) {
      // Save analysis to localStorage
      if (typeof window !== "undefined") {
        try {
          const existingAnswers = localStorage.getItem("skiniq.answers");
          const answers = {
            ...(existingAnswers ? JSON.parse(existingAnswers) : {}),
            source: "photo",
            analysis: analysisResult
          };
          localStorage.setItem("skiniq.answers", JSON.stringify(answers));
        } catch {}
      }
      navigate("/plan");
    }
  };

  const removeFromHistory = (index: number) => {
    setHistory(prev => {
      const newHistory = [...prev];
      newHistory.splice(index, 1);
      return newHistory;
    });
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl sm:text-2xl font-bold mb-2">📸 Скан по фото</h1>
        <p className="text-sm text-neutral-600">Загрузите фото лица для ИИ-анализа кожи</p>
      </div>
      
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Загрузите фото</h2>
            <p className="text-sm text-neutral-600">Поддерживаются JPG/PNG до 10 МБ.</p>
          </div>
          <div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl transition focus:outline-none disabled:opacity-50 disabled:pointer-events-none px-4 py-2 border border-transparent hover:bg-neutral-100"
              onClick={() => setShowHowTo(prev => !prev)}
            >
              Как сделать фото?
            </button>
          </div>
        </div>

        {showHowTo && (
          <div className="mt-3 rounded-xl bg-neutral-50 border border-neutral-200 p-3" data-testid="howto">
            <p className="text-sm text-neutral-700">
              Делайте фото при естественном освещении, без фильтров и макияжа.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={e => setDontShowAgain(e.target.checked)}
                />
                Больше не показывать
              </label>
              <button
                type="button"
                className="text-sm px-3 py-1 rounded border hover:bg-neutral-100"
                onClick={dismissHowTo}
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
                onChange={handleFileChange}
              />
              <label className="text-xs text-neutral-500">
                Фото используется только для анализа и не хранится дольше 24 часов.
              </label>
            </div>

            <div role="alert" aria-live="assertive" className={error ? "text-sm text-red-600 mt-1" : "sr-only"}>
              {error ?? ""}
            </div>

            {previewUrl && !analysisResult && (
              <div className="pt-2">
                <img
                  src={previewUrl}
                  alt="Предпросмотр фото"
                  className="w-full max-h-72 object-contain rounded-xl border"
                  data-testid="preview"
                />
              </div>
            )}

            <div className="pt-2 flex gap-2">
              <Button
                disabled={!selectedFile || !!error || isAnalyzing}
                onClick={analyzePhoto}
              >
                Отправить на анализ
              </Button>
              <Button variant="ghost" onClick={resetScan}>
                Повторить скан
              </Button>
            </div>
          </div>
        )}

        {isAnalyzing && (
          <div className="mt-4">
            <p>Анализируем...</p>
          </div>
        )}

        {analysisResult && !isAnalyzing && (
          <div className="mt-4 space-y-3">
            {/* Фото с интерактивными областями */}
            <div className="relative">
              <img
                src={analysisResult.previewDataUrl || previewUrl}
                alt="Анализ фото"
                className="w-full max-h-72 object-contain rounded-xl border"
              />
              
              {/* Интерактивные проблемные области */}
              {analysisResult?.problemAreas?.map((area: any, idx: number) => {
                console.log('Rendering area:', area); // Для отладки
                
                
                return (
                  <div key={idx}>
                    {/* Цветная область как на референсе - органичная форма */}
                    <div
                      className="absolute cursor-pointer hover:scale-110 transition-all duration-300"
                      style={{
                        left: `${area.coordinates?.x || 0}%`,
                        top: `${area.coordinates?.y || 0}%`,
                        width: `${area.coordinates?.width || 15}%`,
                        height: `${area.coordinates?.height || 15}%`,
                        zIndex: 10,
                        minWidth: '60px',
                        minHeight: '40px'
                      }}
                      onClick={() => setSelectedProblem(selectedProblem?.type === area.type ? null : area)}
                    >
                      {/* Точечная маркировка как на профессиональных анализах */}
                      <div
                        className="w-full h-full relative flex items-center justify-center"
                        style={{
                          background: area.type === 'жирность' ? 'rgba(234, 179, 8, 0.9)' : 
                                     area.type === 'акне' ? 'rgba(239, 68, 68, 0.9)' :
                                     area.type === 'поры' ? 'rgba(249, 115, 22, 0.9)' :
                                     area.type === 'пигментация' ? 'rgba(147, 51, 234, 0.9)' :
                                     area.type === 'сухость' ? 'rgba(59, 130, 246, 0.9)' :
                                     area.type === 'морщины' ? 'rgba(107, 114, 128, 0.9)' :
                                     area.type === 'черные точки' ? 'rgba(0, 0, 0, 0.95)' :
                                     area.type === 'текстура' ? 'rgba(79, 70, 229, 0.9)' :
                                     area.type === 'тон' ? 'rgba(217, 119, 6, 0.9)' :
                                     area.type === 'упругость' ? 'rgba(5, 150, 105, 0.9)' :
                                     area.type === 'покраснения' ? 'rgba(236, 72, 153, 0.9)' : 'rgba(99, 102, 241, 0.9)',
                          borderRadius: area.type === 'морщины' ? '50px' : 
                                       area.type === 'поры' ? '50%' :
                                       area.type === 'черные точки' ? '50%' :
                                       area.type === 'акне' ? '60% 40% 50% 70%' :
                                       '45% 55% 60% 40%',
                          border: `2px solid ${
                            area.type === 'жирность' ? '#eab308' : 
                            area.type === 'акне' ? '#ef4444' :
                            area.type === 'поры' ? '#f97316' :
                            area.type === 'пигментация' ? '#9333ea' :
                            area.type === 'сухость' ? '#3b82f6' :
                            area.type === 'морщины' ? '#6b7280' :
                            area.type === 'черные точки' ? '#000000' :
                            area.type === 'текстура' ? '#4f46e5' :
                            area.type === 'тон' ? '#d97706' :
                            area.type === 'упругость' ? '#059669' :
                            area.type === 'покраснения' ? '#ec4899' : '#6366f1'
                          }`,
                          boxShadow: `0 0 15px ${
                            area.type === 'жирность' ? 'rgba(234, 179, 8, 0.7)' : 
                            area.type === 'акне' ? 'rgba(239, 68, 68, 0.7)' :
                            area.type === 'поры' ? 'rgba(249, 115, 22, 0.7)' :
                            area.type === 'пигментация' ? 'rgba(147, 51, 234, 0.7)' :
                            area.type === 'сухость' ? 'rgba(59, 130, 246, 0.7)' :
                            area.type === 'морщины' ? 'rgba(107, 114, 128, 0.7)' :
                            'rgba(99, 102, 241, 0.7)'
                          }, inset 0 1px 2px rgba(255,255,255,0.3)`
                        }}
                      >
                        {/* Центральная точка для лучшей видимости */}
                        <div 
                          className="w-2 h-2 rounded-full bg-white/80"
                          style={{
                            boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* Подпись проблемы - яркая и заметная */}
                    <div
                      className="absolute text-sm font-bold px-3 py-1.5 rounded-full bg-white border-3 shadow-xl whitespace-nowrap pointer-events-none animate-bounce"
                      style={{
                        left: `${(area.coordinates?.x || 0) + (area.coordinates?.width || 15) + 3}%`,
                        top: `${(area.coordinates?.y || 0) + 8}%`,
                        zIndex: 20,
                        color: area.type === 'жирность' ? '#d97706' : 
                               area.type === 'акне' ? '#dc2626' :
                               area.type === 'поры' ? '#ea580c' :
                               area.type === 'пигментация' ? '#9333ea' :
                               area.type === 'сухость' ? '#2563eb' :
                               area.type === 'морщины' ? '#4b5563' :
                               area.type === 'черные точки' ? '#000000' :
                               area.type === 'текстура' ? '#4f46e5' :
                               area.type === 'тон' ? '#d97706' :
                               area.type === 'упругость' ? '#059669' :
                               area.type === 'покраснения' ? '#ec4899' : '#6366f1',
                        borderColor: area.type === 'жирность' ? '#d97706' : 
                                     area.type === 'акне' ? '#dc2626' :
                                     area.type === 'поры' ? '#ea580c' :
                                     area.type === 'пигментация' ? '#9333ea' :
                                     area.type === 'сухость' ? '#2563eb' :
                                     area.type === 'морщины' ? '#4b5563' :
                                     area.type === 'черные точки' ? '#000000' :
                                     area.type === 'текстура' ? '#4f46e5' :
                                     area.type === 'тон' ? '#d97706' :
                                     area.type === 'упругость' ? '#059669' :
                                     area.type === 'покраснения' ? '#ec4899' : '#6366f1'
                      }}
                    >
                      {area.type.toUpperCase()}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h3 className="text-lg font-medium text-green-700 mb-3">✅ Анализ завершён!</h3>
              
              {/* Профессиональные метрики как у HautAI */}
              {analysisResult.metrics && (
                <div className="space-y-3 mb-4">
                  <h4 className="text-sm font-bold text-gray-700 mb-3">📊 Детальные показатели</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {Object.entries(analysisResult.metrics).map(([key, metric]: [string, any]) => {
                      const getScoreColor = (score: number) => {
                        if (score <= 30) return '#10b981'; // green
                        if (score <= 60) return '#f59e0b'; // yellow
                        return '#ef4444'; // red
                      };
                      
                      const getScoreLevel = (score: number) => {
                        if (score <= 30) return 'Хорошо';
                        if (score <= 60) return 'Умеренно';
                        return 'Требует внимания';
                      };

                      const metricLabels: Record<string, string> = {
                        skinType: 'Тип кожи',
                        skinColor: 'Цвет кожи', 
                        perceivedAge: 'Воспринимаемый возраст',
                        eyeAge: 'Возраст глаз',
                        redness: 'Покраснение',
                        evenness: 'Однородность',
                        acne: 'Акне',
                        wrinkles: 'Морщины',
                        darkCircles: 'Темные круги',
                        pores: 'Поры',
                        oiliness: 'Жирность',
                        hydration: 'Увлажненность'
                      };

                      return (
                        <div key={key} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-sm text-gray-600 mb-1">{metricLabels[key]}</div>
                              <div className="font-semibold text-gray-900">{metric.value}</div>
                              <div className="text-xs text-gray-500 mt-1">{getScoreLevel(metric.score)}</div>
                            </div>
                            
                            {/* Круговой индикатор как у HautAI */}
                            <div className="relative w-16 h-16">
                              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                                <circle
                                  cx="32" cy="32" r="28"
                                  fill="none"
                                  stroke="#e5e7eb"
                                  strokeWidth="6"
                                />
                                <circle
                                  cx="32" cy="32" r="28"
                                  fill="none"
                                  stroke={getScoreColor(metric.score)}
                                  strokeWidth="6"
                                  strokeLinecap="round"
                                  strokeDasharray={`${metric.score * 1.76} 176`}
                                  className="transition-all duration-1000"
                                />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-lg font-bold" style={{color: getScoreColor(metric.score)}}>
                                  {metric.score}
                                </span>
                                <span className="text-xs text-gray-500">из 100</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2 text-sm">
                <div><strong>Общая оценка:</strong> {Math.round((analysisResult.confidence || 0) * 100)}% точность</div>
                <div><strong>Обнаружено проблем:</strong> {analysisResult.problemAreas?.length || 0} зон</div>
              </div>
            </div>
            
            {/* Детали выбранной проблемной области */}
            {selectedProblem && (
              <div className="p-3 rounded-xl border-l-4 border-blue-500 bg-blue-50">
                <div className="text-sm font-medium mb-1">
                  🎯 {selectedProblem.type} ({selectedProblem.severity === 'high' ? 'высокая' : selectedProblem.severity === 'medium' ? 'средняя' : 'низкая'} степень)
                </div>
                <div className="text-xs text-zinc-600 mb-2">{selectedProblem.description}</div>
                
                {/* Рекомендации для конкретной проблемы */}
                <div className="text-xs text-zinc-700">
                  <strong>Что делать:</strong>
                  {selectedProblem.type === 'акне' && " BHA 2-3 раза в неделю, точечные средства с бензоилпероксидом"}
                  {selectedProblem.type === 'жирность' && " Лёгкие гели, матирующие средства, ниацинамид 5-10%"}
                  {selectedProblem.type === 'поры' && " BHA, ретиноиды, ниацинамид для сужения пор"}
                  {selectedProblem.type === 'покраснение' && " Успокаивающие средства, цика, пантенол"}
                  {selectedProblem.type === 'покраснения' && " Успокаивающие средства, цика, пантенол"}
                  {selectedProblem.type === 'сухость' && " Интенсивное увлажнение, керамиды, гиалуронка"}
                  {selectedProblem.type === 'пигментация' && " Витамин C 10-20%, арбутин, койевая кислота"}
                  {selectedProblem.type === 'морщины' && " Ретинол 0.25-1%, пептиды, гиалуроновая кислота"}
                  {selectedProblem.type === 'чувствительность' && " Мягкие формулы без отдушек, цика"}
                  {selectedProblem.type === 'черные точки' && " BHA ежедневно, глиняные маски 1-2 раза в неделю"}
                  {selectedProblem.type === 'текстура' && " AHA-пилинги, ретинол, энзимные маски"}
                  {selectedProblem.type === 'тон' && " Витамин C, ниацинамид, отшелушивание AHA"}
                  {selectedProblem.type === 'упругость' && " Пептиды, витамин C, массаж лица, ретинол"}
                </div>
              </div>
            )}
            
            <div className="text-xs text-zinc-500 text-center">
              💡 Кликни на цветные области на фото для детальной информации
            </div>
            
            {analysisResult.recommendations && (
              <div>
                <div className="text-sm font-medium mb-2">Общие рекомендации:</div>
                <ul className="text-xs text-zinc-600 list-disc list-inside space-y-1">
                  {analysisResult.recommendations.map((rec: string, idx: number) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="pt-2 flex gap-2">
              <Button onClick={createPlan} className="flex-1">
                Создать план ухода
              </Button>
              <Button variant="ghost" onClick={resetScan}>
                Повторить скан
              </Button>
            </div>
          </div>
        )}
      </Card>

      {history.length > 0 && (
        <div className="mt-6">
          <Card className="p-4">
            <h3 className="text-lg font-medium mb-2">История сканов</h3>
            <ul className="space-y-3">
              {history.map((item, index) => (
                <li key={`${item.timestamp}-${index}`} className="border border-neutral-200 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    {item.previewDataUrl && (
                      <div 
                        className="w-16 h-16 rounded-lg overflow-hidden cursor-pointer border-2 border-blue-200 hover:border-blue-400 transition"
                        onClick={() => {
                          setAnalysisResult({
                            ...item,
                            previewDataUrl: item.previewDataUrl
                          });
                          setSelectedProblem(null);
                        }}
                      >
                        <img
                          src={item.previewDataUrl}
                          alt="Клик для просмотра"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="text-sm flex-1">
                      <div className="font-medium">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                      <div className="text-neutral-600">
                        {item.skinType}; {item.concerns?.join(", ") || "анализ"}
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        👆 Нажмите на фото для просмотра с зонами
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-red-600 underline"
                      onClick={() => removeFromHistory(index)}
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}