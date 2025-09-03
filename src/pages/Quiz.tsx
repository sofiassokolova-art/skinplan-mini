import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { analyzeSkinPhoto } from "../lib/skinAnalysis";
import ModernCard from "../ui/ModernCard";
import ModernButton from "../ui/ModernButton";



const STORAGE_KEY = "skiniq.answers";

interface Answers {
  name?: string;
  pdConsent?: boolean;
  skinType?: "сухая" | "жирная" | "комбинированная" | "нормальная";
  sensitivity?: boolean;
  concerns?: string[];
  oiliness?: "низкая" | "средняя" | "высокая";
  primaryGoal?: "снять воспаления" | "увлажнить" | "осветлить постакне" | "сузить поры";
  
  // Фото (опционально)
  photo_data_url?: string | null;
  photo_analysis?: any | null;
  photo_scans?: { ts: number; preview: string; analysis: any; problemAreas?: any[] }[];
}

function loadAnswers(): Answers {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveAnswers(answers: Answers) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
}

const questions = [
  {
    kind: "question" as const,
    id: "name",
    title: "Как вас зовут?",
    description: "Чтобы мы могли обращаться по имени.",
    type: "text" as const,
    required: true,
    needsConsent: true
  },
  {
    kind: "question" as const,
    id: "skinType",
    title: "Какой у вас тип кожи?",
    type: "single" as const,
    required: true,
    options: ["сухая", "жирная", "комбинированная", "нормальная"]
  },
  {
    kind: "question" as const,
    id: "sensitivity",
    title: "Ваша кожа чувствительная?",
    type: "switch" as const,
    required: true
  },
  {
    kind: "question" as const,
    id: "concerns",
    title: "Что вас беспокоит?",
    description: "Можно выбрать несколько вариантов.",
    type: "multi" as const,
    required: true,
    options: ["акне", "постакне", "расширенные поры", "покраснение", "сухость"]
  },
  {
    kind: "question" as const,
    id: "oiliness",
    title: "Насколько кожа склонна к жирности?",
    type: "single" as const,
    required: true,
    options: ["низкая", "средняя", "высокая"]
  },
  {
    kind: "question" as const,
    id: "primaryGoal",
    title: "Главная цель ухода на 28 дней?",
    type: "single" as const,
    required: true,
    options: ["снять воспаления", "увлажнить", "осветлить постакне", "сузить поры"]
  }
];

const insights = questions.map(q => ({
  kind: "insight" as const,
  id: `insight_${q.id}`,
  forQuestionId: q.id,
  title: "Небольшой инсайт",
  renderBody: (answers: Answers) => {
    switch (q.id) {
      case "skinType":
        return (
          <p className="opacity-80">
            Для типа кожи <b>{answers.skinType ?? "—"}</b> мы осторожнее подбираем очищение и активы: избегаем пересушивания и соблюдаем баланс pH.
          </p>
        );
      case "sensitivity":
        return answers.sensitivity ? (
          <p className="opacity-80">
            Чувствительная кожа любит мягкое очищение, SPF без отдушек и постепенный ввод активов.
          </p>
        ) : (
          <p className="opacity-80">
            Отлично: при отсутствии высокой чувствительности можно смелее использовать кислоты и ретиноиды (по схеме).
          </p>
        );
      case "concerns":
        return (
          <p className="opacity-80">
            По вашим жалобам ({(answers.concerns || []).join(", ") || "—"}) мы настроим приоритеты: сначала — снятие воспалений/раздражений, затем работа с текстурой и тонизацией.
          </p>
        );
      case "oiliness":
        return (
          <p className="opacity-80">
            Уровень жирности: <b>{answers.oiliness ?? "—"}</b>. Это влияет на выбор форматов: гели/флюиды днём, более плотное увлажнение — вечером.
          </p>
        );
      case "primaryGoal":
        return (
          <p className="opacity-80">
            Главная цель — <b>{answers.primaryGoal ?? "—"}</b>. План и активы будут выстроены вокруг этой цели на ближайшие 28 дней.
          </p>
        );
      default:
        return null;
    }
  }
}));

function createSteps() {
  const steps: any[] = [];
  questions.forEach((question, index) => {
    steps.push(question);
    if (index > 0) {
      steps.push(insights[index]);
    }
  });
  
  // Добавляем финальный опциональный шаг фото
  steps.push({
    kind: "question" as const,
    id: "photo",
    title: "Фото-скан (опционально)",
    description: "Можно добавить фото без макияжа при дневном свете — я учту это при планировании. Можно пропустить.",
    type: "photo" as const,
    required: false
  });
  
  return steps;
}

const allSteps = createSteps();

function PhotoStep({ answers, setAnswers }: { answers: Answers; setAnswers: (a: Answers) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState<any | null>(null);
  const [modalPhoto, setModalPhoto] = useState<any | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Формат не поддерживается. Загрузите JPEG/PNG/WebP.");
      return;
    }
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      setError("Слишком большой файл. До 5 МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || "");
      setAnswers({ ...answers, photo_data_url: dataUrl, photo_analysis: null });
      
      setIsAnalyzing(true);
      
      try {
        const analysis = await analyzeSkinPhoto(dataUrl);
        
        if (!analysis) {
          throw new Error('No analysis result received');
        }
        
        const scanEntry = { 
          ts: Date.now(), 
          preview: dataUrl, 
          analysis,
          problemAreas: analysis.problemAreas || []
        };
        
        const updatedAnswers = { 
          ...answers, 
          photo_data_url: dataUrl, 
          photo_analysis: analysis,
          photo_scans: [...(answers.photo_scans || []), scanEntry]
        };
        
        setAnswers(updatedAnswers);
        
        // Просто обновляем состояние, не переходим на другую страницу
        // Все результаты показываем inline в анкете
        
      } catch (err) {
        console.error('Photo analysis error:', err);
        setError("Ошибка анализа. Используем демо-результат.");
        
        // Fallback на демо-анализ при ошибке
        const demoAnalysis = {
          skinType: "комбинированная",
          concerns: ["жирность T-зоны", "единичные воспаления"],
          problemAreas: [
            {
              type: "жирность",
              description: "Повышенная жирность в T-зоне",
              severity: "medium",
              coordinates: { x: 35, y: 25, width: 30, height: 15 }
            }
          ],
          recommendations: ["Используйте мягкое очищение", "BHA 2-3 раза в неделю"],
          confidence: 0.75
        };
        
        try {
          const updatedAnswers = { 
            ...answers, 
            photo_data_url: dataUrl, 
            photo_analysis: demoAnalysis,
            photo_scans: [...(answers.photo_scans || []), { 
              ts: Date.now(), 
              preview: dataUrl, 
              analysis: demoAnalysis,
              problemAreas: demoAnalysis.problemAreas || []
            }]
          };
          
          setAnswers(updatedAnswers);
          saveAnswers(updatedAnswers);
        } catch (saveError) {
          console.error('Error saving photo analysis:', saveError);
          setError("Ошибка сохранения. Попробуйте ещё раз.");
        }
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-bold mb-2">📸 Фото-скан (опционально)</h3>
        <p className="text-sm text-neutral-600 mb-4">
          Можно добавить фото без макияжа при дневном свете — я учту это при планировании. Можно пропустить.
        </p>
      </div>
      
      <label className="block w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-center cursor-pointer hover:border-gray-400 transition">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <div className="text-2xl mb-2">📷</div>
        <div className="text-sm font-medium text-gray-600">
          {isAnalyzing ? "Анализируем..." : "Нажмите для загрузки фото"}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          JPEG, PNG, WebP до 5 МБ
        </div>
      </label>

      {error && (
        <div role="alert" className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
          {error}
        </div>
      )}

      {answers.photo_data_url && (
        <div className="mt-4">
          <div className="relative inline-block">
            <img 
              src={answers.photo_data_url} 
              alt="Предпросмотр" 
              className="max-h-64 rounded-2xl border" 

            />
            
            {/* Интерактивные проблемные области */}
            {answers.photo_analysis?.problemAreas?.map((area: any, idx: number) => {
              console.log('Quiz rendering area:', area); // Для отладки
              
              const colors = {
                'акне': 'border-red-600 bg-red-600/50',
                'жирность': 'border-yellow-600 bg-yellow-600/50', 
                'поры': 'border-orange-600 bg-orange-600/50',
                'покраснение': 'border-pink-600 bg-pink-600/50',
                'сухость': 'border-blue-600 bg-blue-600/50'
              };
              
              const colorClass = colors[area.type as keyof typeof colors] || 'border-red-600 bg-red-600/50';
              
              return (
                <div key={idx}>
                  {/* Цветная область - увеличенная */}
                  <div
                    className={`absolute border-4 rounded-lg cursor-pointer hover:opacity-70 transition-all duration-200 ${colorClass}`}
                    style={{
                      left: `${area.coordinates?.x || 0}%`,
                      top: `${area.coordinates?.y || 0}%`,
                      width: `${area.coordinates?.width || 15}%`,
                      height: `${area.coordinates?.height || 15}%`,
                      zIndex: 10,
                      minWidth: '40px',
                      minHeight: '40px'
                    }}
                    onClick={() => setSelectedProblem(selectedProblem?.type === area.type ? null : area)}
                  />
                  
                  {/* Подпись проблемы - более заметная */}
                  <div
                    className="absolute text-sm font-bold px-3 py-1 rounded-full bg-white border-2 shadow-lg whitespace-nowrap pointer-events-none"
                    style={{
                      left: `${(area.coordinates?.x || 0) + (area.coordinates?.width || 15) + 2}%`,
                      top: `${(area.coordinates?.y || 0) + 5}%`,
                      zIndex: 20,
                      color: area.type === 'жирность' ? '#d97706' : 
                             area.type === 'акне' ? '#dc2626' :
                             area.type === 'поры' ? '#ea580c' : '#6366f1'
                    }}
                  >
                    {area.type}
                  </div>
                </div>
              );
            })}
          </div>
          
          {isAnalyzing && (
            <div className="mt-2 text-sm text-blue-600">
              🔍 Анализируем кожу с помощью ИИ...
            </div>
          )}
          
          {answers.photo_analysis && !isAnalyzing && (
            <div className="mt-4 space-y-3">
              {/* Упрощённый единый вид для всех устройств */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="text-center mb-3">
                  <h3 className="text-lg font-bold text-green-700">✅ Анализ завершён!</h3>
                  <div className="text-sm text-zinc-600">Результаты ИИ-анализа кожи</div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div><strong>Тип кожи:</strong> {answers.photo_analysis?.skinType || "не определён"}</div>
                  <div><strong>Проблемы:</strong> {(answers.photo_analysis?.concerns || []).join(", ") || "не обнаружены"}</div>
                  <div><strong>Уверенность:</strong> {Math.round((answers.photo_analysis?.confidence || 0) * 100)}%</div>
                </div>
              </div>
              
              {/* Детали выбранной проблемной области */}
              {selectedProblem && (
                <div className="mt-3 p-3 rounded-xl border-l-4 border-blue-500 bg-blue-50">
                  <div className="text-sm font-medium mb-1">
                    🎯 {selectedProblem.type} ({selectedProblem.severity === 'high' ? 'высокая' : selectedProblem.severity === 'medium' ? 'средняя' : 'низкая'} степень)
                  </div>
                  <div className="text-xs text-zinc-600 mb-2">{selectedProblem.description}</div>
                  
                  {/* Рекомендации для конкретной проблемы */}
                  <div className="text-xs text-zinc-700">
                    <strong>Что делать:</strong>
                    {selectedProblem.type === 'акне' && " BHA 2-3 раза в неделю, точечные средства"}
                    {selectedProblem.type === 'жирность' && " Лёгкие гели, матирующие средства, ниацинамид"}
                    {selectedProblem.type === 'поры' && " BHA, ретиноиды, ниацинамид для сужения пор"}
                    {selectedProblem.type === 'покраснение' && " Успокаивающие средства, цика, пантенол"}
                    {selectedProblem.type === 'сухость' && " Интенсивное увлажнение, керамиды, гиалуронка"}
                  </div>
                </div>
              )}
              
              <div className="text-xs text-zinc-500 mt-2">
                💡 Кликни на цветные области для детальной информации
              </div>
              
              {answers.photo_analysis.recommendations && (
                <div className="mt-2">
                  <div className="text-sm font-medium mb-1">Общие рекомендации:</div>
                  <ul className="text-xs text-zinc-600 list-disc list-inside space-y-1">
                    {answers.photo_analysis.recommendations.map((rec: string, idx: number) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          <button 
            className="mt-3 text-sm text-zinc-600 underline" 
            onClick={() => setAnswers({...answers, photo_data_url: null, photo_analysis: null})}
          >
            Очистить фото
          </button>
        </div>
      )}

      {(answers.photo_scans?.length || 0) > 0 && (
        <div className="mt-5">
          <div className="font-semibold mb-2">История сканов</div>
          <div className="grid sm:grid-cols-3 gap-3">
            {answers.photo_scans!.slice().reverse().map((s, idx) => (
              <div 
                key={idx} 
                className="p-2 rounded-xl border bg-white/60 cursor-pointer hover:shadow-md transition"
                onClick={() => setModalPhoto(s)}
              >
                <img src={s.preview} alt="Скан" className="h-28 w-full object-cover rounded-lg" />
                <div className="mt-1 text-xs text-zinc-600">{new Date(s.ts).toLocaleString()}</div>
                <div className="text-xs text-zinc-500">👁️ Кликни для деталей</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Модальное окно для архивного фото */}
      {modalPhoto && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setModalPhoto(null)}
        >
          <div 
            className="bg-white rounded-2xl p-6 max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Детальный анализ</h3>
              <button 
                className="text-2xl text-zinc-400 hover:text-zinc-600"
                onClick={() => setModalPhoto(null)}
              >
                ×
              </button>
            </div>
            
            <div className="relative inline-block mb-4">
              <img 
                src={modalPhoto.preview} 
                alt="Архивное фото" 
                className="max-h-80 rounded-xl border"
              />
              
              {/* Проблемные области на архивном фото */}
              {modalPhoto.problemAreas?.map((area: any, idx: number) => {
                const colors = {
                  'акне': 'border-red-500 bg-red-500/20',
                  'жирность': 'border-yellow-500 bg-yellow-500/20', 
                  'поры': 'border-orange-500 bg-orange-500/20',
                  'покраснение': 'border-pink-500 bg-pink-500/20',
                  'сухость': 'border-blue-500 bg-blue-500/20'
                };
                
                const colorClass = colors[area.type as keyof typeof colors] || 'border-red-500 bg-red-500/20';
                
                return (
                  <div key={idx} className="absolute">
                    <div
                      className={`absolute border-2 rounded ${colorClass}`}
                      style={{
                        left: `${area.coordinates?.x || 0}%`,
                        top: `${area.coordinates?.y || 0}%`,
                        width: `${area.coordinates?.width || 10}%`,
                        height: `${area.coordinates?.height || 10}%`,
                      }}
                    />
                    <div
                      className="absolute text-xs font-medium px-2 py-1 rounded bg-white border shadow-sm whitespace-nowrap"
                      style={{
                        left: `${(area.coordinates?.x || 0) + (area.coordinates?.width || 10)}%`,
                        top: `${area.coordinates?.y || 0}%`,
                        transform: 'translateX(4px)'
                      }}
                    >
                      {area.type}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="space-y-3">
              <div className="text-sm">
                <div><strong>Дата:</strong> {new Date(modalPhoto.ts).toLocaleString()}</div>
                <div><strong>Тип кожи:</strong> {modalPhoto.analysis?.skinType}</div>
                <div><strong>Проблемы:</strong> {modalPhoto.analysis?.concerns?.join(", ")}</div>
                {modalPhoto.analysis?.confidence && (
                  <div><strong>Уверенность:</strong> {Math.round(modalPhoto.analysis.confidence * 100)}%</div>
                )}
              </div>
              
              {modalPhoto.analysis?.recommendations && (
                <div>
                  <div className="text-sm font-medium mb-1">Рекомендации:</div>
                  <ul className="text-xs text-zinc-600 list-disc list-inside space-y-1">
                    {modalPhoto.analysis.recommendations.map((rec: string, idx: number) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ currentStepIndex }: { currentStepIndex: number }) {
  const completedQuestions = useMemo(() => {
    const questionSteps = allSteps.slice(0, currentStepIndex + 1).filter(step => step.kind === "question");
    // Исключаем опциональный фото-шаг из подсчёта
    return questionSteps.filter(step => step.id !== "photo").length;
  }, [currentStepIndex]);
  
  const totalRequiredQuestions = questions.length; // Без фото-шага
  const percentage = Math.min(100, Math.round((completedQuestions / totalRequiredQuestions) * 100));

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between text-sm mb-1">
        <span>Шаг {completedQuestions} из {totalRequiredQuestions}</span>
        <span>{percentage}%</span>
      </div>
      <div className="h-2 w-full bg-neutral-200 rounded">
        <div 
          className="h-2 bg-black rounded" 
          style={{ width: `${percentage}%` }}
          aria-label="Прогресс анкеты"
        />
      </div>
    </div>
  );
}

function SingleChoice({ options, value, onChange }: { options: string[]; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {options.map(option => {
        const isSelected = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`px-6 py-4 rounded-2xl border-2 transition-all duration-200 text-left font-medium shadow-lg ${
              isSelected 
                ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white border-blue-500 shadow-blue-500/25 scale-105" 
                : "bg-white/80 text-gray-700 border-gray-200/50 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function MultiChoice({ options, value, onChange }: { options: string[]; value?: string[]; onChange: (v: string[]) => void }) {
  const selected = new Set(value || []);
  
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => {
        const isSelected = selected.has(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => {
              const newSelected = new Set(selected);
              if (isSelected) {
                newSelected.delete(option);
              } else {
                newSelected.add(option);
              }
              onChange(Array.from(newSelected));
            }}
            className={`px-3 py-2 rounded-full border text-sm transition ${
              isSelected ? "bg-black text-white border-black" : "border-neutral-300 hover:border-black"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function SwitchInput({ checked, onChange, labelYes = "Да", labelNo = "Нет" }: { checked?: boolean; onChange: (v: boolean) => void; labelYes?: string; labelNo?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm ${checked ? "opacity-60" : "font-semibold"}`}>
        {labelNo}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full relative transition ${
          checked ? "bg-black" : "bg-neutral-300"
        }`}
      >
        <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition ${
          checked ? "translate-x-5" : "translate-x-0"
        }`} />
      </button>
      <span className={`text-sm ${checked ? "font-semibold" : "opacity-60"}`}>
        {labelYes}
      </span>
    </div>
  );
}

export default function Quiz() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Answers>(loadAnswers);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    saveAnswers(answers);
  }, [answers]);

  const currentStep = allSteps[currentStepIndex];
  
  const isStepValid = useMemo(() => {
    if (currentStep.kind !== "question") return true;
    
    switch (currentStep.id) {
      case "name":
        return currentStep.needsConsent && !answers.pdConsent ? false : !!(answers.name && answers.name.trim().length > 0);
      case "skinType":
        return !!answers.skinType;
      case "sensitivity":
        return typeof answers.sensitivity === "boolean";
      case "concerns":
        return Array.isArray(answers.concerns) && answers.concerns.length > 0;
      case "oiliness":
        return !!answers.oiliness;
      case "primaryGoal":
        return !!answers.primaryGoal;
      case "photo":
        return true; // Опциональный шаг
      default:
        return false;
    }
  }, [currentStep, answers]);

  const goNext = () => {
    if (currentStepIndex < allSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      navigate("/plan");
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const renderQuestionInput = (step: any) => {
    switch (step.id) {
      case "name":
        return (
          <>
            <input
              autoFocus
              type="text"
              placeholder="Введите имя"
              className="w-full px-4 py-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-black"
              value={answers.name ?? ""}
              onChange={e => setAnswers({ ...answers, name: e.target.value })}
            />
            <label className="flex items-start gap-2 mt-3 text-sm">
              <input
                type="checkbox"
                checked={!!answers.pdConsent}
                onChange={e => setAnswers({ ...answers, pdConsent: e.target.checked })}
              />
              <span>Я согласен(-на) на обработку персональных данных.</span>
            </label>
          </>
        );
      case "skinType":
        return (
          <SingleChoice
            options={step.options}
            value={answers.skinType}
            onChange={v => setAnswers({ ...answers, skinType: v as any })}
          />
        );
      case "sensitivity":
        return (
          <SwitchInput
            checked={!!answers.sensitivity}
            onChange={v => setAnswers({ ...answers, sensitivity: v })}
            labelNo="Нет"
            labelYes="Да"
          />
        );
      case "concerns":
        return (
          <MultiChoice
            options={step.options}
            value={answers.concerns}
            onChange={v => setAnswers({ ...answers, concerns: v })}
          />
        );
      case "oiliness":
        return (
          <SingleChoice
            options={step.options}
            value={answers.oiliness}
            onChange={v => setAnswers({ ...answers, oiliness: v as any })}
          />
        );
      case "primaryGoal":
        return (
          <SingleChoice
            options={step.options}
            value={answers.primaryGoal}
            onChange={v => setAnswers({ ...answers, primaryGoal: v as any })}
          />
        );
      case "photo":
        return <PhotoStep answers={answers} setAnswers={setAnswers} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {currentStepIndex > 0 && (
        <button
          type="button"
          onClick={goBack}
          className="text-sm text-neutral-600 flex items-center gap-1 mb-2"
          aria-label="Назад"
        >
          ← Назад
        </button>
      )}

      <ProgressBar currentStepIndex={currentStepIndex} />

      <ModernCard variant="gradient" className="p-6">
        {currentStep.kind === "question" ? (
          <>
            <h1 className="text-xl md:text-2xl font-semibold mb-2">
              {currentStep.title}
            </h1>
            {currentStep.description && (
              <p className="opacity-70 mb-4">{currentStep.description}</p>
            )}
            <div className="mb-6">
              {renderQuestionInput(currentStep)}
            </div>
            <div className="mt-6">
              <ModernButton
                onClick={goNext}
                disabled={!isStepValid}
                fullWidth
                size="lg"
              >
                {currentStepIndex >= allSteps.length - 2 ? "Завершить анкету" : "Далее"}
              </ModernButton>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl md:text-2xl font-semibold mb-2">
              {currentStep.title}
            </h2>
            <div className="mb-6">
              {currentStep.renderBody(answers)}
            </div>
            <ModernButton
              onClick={goNext}
              fullWidth
              size="lg"
            >
              Продолжить
            </ModernButton>
          </>
        )}
      </ModernCard>
    </div>
  );
}