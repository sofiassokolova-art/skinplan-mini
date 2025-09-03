import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const Button = ({ children, onClick, variant = "primary", ...props }: any) => {
  const baseClass = "inline-flex items-center justify-center rounded-xl transition focus:outline-none px-4 py-2";
  const variantClass = variant === "primary" ? "border border-black hover:bg-black hover:text-white" :
                      variant === "secondary" ? "border border-neutral-300 hover:border-black" :
                      "border border-transparent hover:bg-neutral-100";
  
  return (
    <button onClick={onClick} className={`${baseClass} ${variantClass}`} {...props}>
      {children}
    </button>
  );
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>
    {children}
  </div>
);

export default function PhotoResults() {
  const navigate = useNavigate();
  const location = useLocation();
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [selectedProblem, setSelectedProblem] = useState<any | null>(null);

  useEffect(() => {
    // Получаем данные анализа из state или localStorage
    const data = location.state?.analysisData || getLatestPhotoAnalysis();
    if (data) {
      setAnalysisData(data);
    } else {
      navigate("/photo");
    }
  }, [location, navigate]);

  function getLatestPhotoAnalysis() {
    try {
      const answers = localStorage.getItem("skiniq.answers");
      if (!answers) return null;
      const parsed = JSON.parse(answers);
      return parsed.photo_analysis || null;
    } catch {
      return null;
    }
  }

  const saveAndContinue = () => {
    // Сохраняем результаты анализа в ответы анкеты
    try {
      const answers = JSON.parse(localStorage.getItem("skiniq.answers") || "{}");
      const updatedAnswers = {
        ...answers,
        photo_analysis: analysisData,
        hasPhotoAnalysis: true
      };
      localStorage.setItem("skiniq.answers", JSON.stringify(updatedAnswers));
    } catch {}
    
    navigate("/plan");
  };

  const retakePhoto = () => {
    navigate("/photo");
  };

  if (!analysisData) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Card className="p-6 text-center">
          <h2 className="text-lg font-bold mb-2">Результаты не найдены</h2>
          <p className="text-zinc-600 mb-4">Сначала загрузите фото для анализа</p>
          <Button onClick={() => navigate("/photo")}>
            Перейти к фото-скану
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-4">
        <button 
          onClick={() => navigate(-1)}
          className="text-sm text-zinc-600 hover:text-zinc-800"
        >
          ← Назад
        </button>
      </div>

      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-4 text-center">🎯 Результаты анализа</h1>
        
        {/* Фото с интерактивными областями */}
        <div className="relative inline-block mb-6 w-full flex justify-center">
          <img 
            src={analysisData.imageUrl || analysisData.preview} 
            alt="Анализируемое фото" 
            className="max-h-96 rounded-xl border shadow-lg"
          />
          
          {/* Интерактивные проблемные области */}
          {analysisData.problemAreas?.map((area: any, idx: number) => {
            const colors = {
              'акне': 'border-red-500 bg-red-500/30',
              'жирность': 'border-yellow-500 bg-yellow-500/30', 
              'поры': 'border-orange-500 bg-orange-500/30',
              'покраснение': 'border-pink-500 bg-pink-500/30',
              'сухость': 'border-blue-500 bg-blue-500/30'
            };
            
            const colorClass = colors[area.type as keyof typeof colors] || 'border-red-500 bg-red-500/30';
            
            return (
              <div key={idx} className="absolute">
                <div
                  className={`absolute border-3 rounded-lg cursor-pointer hover:opacity-80 transition ${colorClass}`}
                  style={{
                    left: `${area.coordinates?.x || 0}%`,
                    top: `${area.coordinates?.y || 0}%`,
                    width: `${area.coordinates?.width || 10}%`,
                    height: `${area.coordinates?.height || 10}%`,
                  }}
                  onClick={() => setSelectedProblem(selectedProblem?.type === area.type ? null : area)}
                />
                
                <div
                  className="absolute text-sm font-bold px-3 py-1 rounded-full bg-white border-2 shadow-lg whitespace-nowrap pointer-events-none"
                  style={{
                    left: `${(area.coordinates?.x || 0) + (area.coordinates?.width || 10)}%`,
                    top: `${area.coordinates?.y || 0}%`,
                    transform: 'translateX(8px)'
                  }}
                >
                  {area.type}
                </div>
              </div>
            );
          })}
        </div>

        {/* Основные результаты */}
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="text-sm text-blue-600 mb-1">Тип кожи</div>
              <div className="text-lg font-bold">{analysisData.skinType}</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-green-50 border border-green-200">
              <div className="text-sm text-green-600 mb-1">Уверенность</div>
              <div className="text-lg font-bold">{Math.round((analysisData.confidence || 0) * 100)}%</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-purple-50 border border-purple-200">
              <div className="text-sm text-purple-600 mb-1">Проблемы</div>
              <div className="text-sm font-medium">{analysisData.concerns?.length || 0} найдено</div>
            </div>
          </div>

          {/* Детали выбранной проблемы */}
          {selectedProblem && (
            <Card className="p-4 border-l-4 border-blue-500 bg-blue-50">
              <div className="font-bold mb-2">
                🎯 {selectedProblem.type} 
                <span className="ml-2 text-sm font-normal text-zinc-600">
                  ({selectedProblem.severity === 'high' ? 'высокая' : selectedProblem.severity === 'medium' ? 'средняя' : 'низкая'} степень)
                </span>
              </div>
              <div className="text-sm text-zinc-700 mb-3">{selectedProblem.description}</div>
              
              <div className="text-sm">
                <strong>Рекомендации:</strong>
                {selectedProblem.type === 'акне' && " BHA 2-3 раза в неделю, точечные средства, избегать пересушивания"}
                {selectedProblem.type === 'жирность' && " Лёгкие гели, матирующие средства, ниацинамид утром"}
                {selectedProblem.type === 'поры' && " BHA, ретиноиды, ниацинамид для сужения пор"}
                {selectedProblem.type === 'покраснение' && " Успокаивающие средства, цика, пантенол, избегать агрессивных активов"}
                {selectedProblem.type === 'сухость' && " Интенсивное увлажнение, керамиды, гиалуроновая кислота"}
              </div>
            </Card>
          )}

          {!selectedProblem && (
            <div className="text-center text-sm text-zinc-500">
              💡 Кликните на цветные области для детальной информации
            </div>
          )}
        </div>

        {/* Общие рекомендации */}
        {analysisData.recommendations && (
          <Card className="p-4 mb-6">
            <h3 className="font-bold mb-3">📋 Общие рекомендации</h3>
            <ul className="space-y-2">
              {analysisData.recommendations.map((rec: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span className="text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Действия */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={saveAndContinue} className="flex-1">
            💎 Создать персональный план
          </Button>
          <Button variant="secondary" onClick={retakePhoto} className="flex-1">
            📷 Сделать новое фото
          </Button>
        </div>
      </Card>
    </div>
  );
}