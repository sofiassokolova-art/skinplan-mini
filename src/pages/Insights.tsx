import { useState } from "react";

export default function Insights() {
  const scans = getScans();
  const [modalPhoto, setModalPhoto] = useState<any | null>(null);
  
  return (
    <div className="w-full min-h-screen relative">
      {/* Background layers: CSS gradient */}
      <div 
        className="absolute inset-0 -z-10"
        style={{
          background: "radial-gradient(120% 140% at 70% 0%, #ffe7ef 0%, #f3e6cf 35%, #efeef2 65%, #e7e7ea 100%)"
        }}
      />
      
      <div className="relative z-20 max-w-3xl mx-auto space-y-6 p-4">
        <section className="bg-white/20 backdrop-blur-xl border border-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.08)] rounded-3xl p-6">
        <h2 className="text-lg font-bold mb-3">Инсайты</h2>
        <ul className="list-disc pl-5 text-zinc-700 space-y-2">
          <li>Стадия кожи: склонность к обезвоживанию</li>
          <li>Реакции: нет</li>
          <li>Приоритет: барьер + мягкие кислоты</li>
        </ul>
      </section>
      
        <section className="bg-white/20 backdrop-blur-xl border border-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.08)] rounded-3xl p-6">
          <h3 className="text-lg font-bold mb-3">Архив фото-сканов</h3>
        {scans.length === 0 ? (
          <div className="text-zinc-600">Пока нет сохранённых сканов. Добавь фото на последнем шаге анкеты.</div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            {scans.map((s, i) => (
              <div 
                key={i} 
                className="p-2 rounded-xl border bg-white/60 cursor-pointer hover:shadow-md transition"
                onClick={() => setModalPhoto(s)}
              >
                <img src={s.preview} alt="Скан" className="h-28 w-full object-cover rounded-lg" />
                <div className="mt-1 text-xs text-zinc-600">{new Date(s.ts).toLocaleString()}</div>
                <div className="text-xs text-zinc-500">👁️ Кликни для деталей</div>
              </div>
            ))}
          </div>
        )}
      </section>

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
                  'покраснение': 'border-purple-500 bg-purple-500/20',
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
    </div>
  );
}

type Scan = { ts: number; preview: string; analysis: any; problemAreas?: any[] };
function getScans(): Scan[] {
  try {
    const raw = localStorage.getItem("skiniq.answers");
    if (!raw) return [];
    const obj = JSON.parse(raw) as { photo_scans?: Scan[] };
    return Array.isArray(obj.photo_scans) ? obj.photo_scans : [];
  } catch {
    return [];
  }
}