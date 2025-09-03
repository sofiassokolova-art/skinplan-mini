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
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Скан по фото</h1>
      
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

            {previewUrl && (
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
          <div className="mt-4 space-y-2">
            <h3 className="text-lg font-medium">Результат анализа</h3>
            <div className="text-sm">
              <div>
                <strong>Тип кожи:</strong> {analysisResult.skinType}
              </div>
              <div>
                <strong>Проблемы:</strong> {analysisResult.concerns.join(", ")}
              </div>
            </div>
            <div className="pt-2 flex gap-2">
              <Button onClick={createPlan}>
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
            <ul className="space-y-2">
              {history.map((item, index) => (
                <li key={`${item.timestamp}-${index}`} className="flex items-center gap-3">
                  {item.previewDataUrl && (
                    <img
                      src={item.previewDataUrl}
                      alt=""
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div className="text-sm flex-1">
                    <div className="font-medium">
                      {new Date(item.timestamp).toLocaleString()}
                    </div>
                    <div className="text-neutral-600">
                      {item.skinType}; {item.concerns.join(", ")}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={() => removeFromHistory(index)}
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}