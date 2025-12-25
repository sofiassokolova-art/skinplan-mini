// app/(miniapp)/insights/page.tsx
// Страница с инсайтами после завершения анкеты

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';

interface Profile {
  id: string;
  skinType: string;
  sensitivityLevel: string;
  acneLevel: number;
  dehydrationLevel: number;
  rosaceaRisk: string;
  pigmentationRisk: string;
  notes: string;
}

interface PhotoScan {
  ts: number;
  preview: string;
  analysis: {
    skinType?: string;
    concerns?: string[];
    confidence?: number;
  };
  problemAreas?: Array<{
    type: string;
    description: string;
    severity: string;
    coordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
}

export default function InsightsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [scans, setScans] = useState<PhotoScan[]>([]);
  const [modalPhoto, setModalPhoto] = useState<PhotoScan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      // Загружаем профиль из API
      try {
        const profileData = await api.getCurrentProfile();
        if (profileData) {
          // Маппим ProfileResponse в Profile
          setProfile({
            id: profileData.id,
            skinType: profileData.skinType,
            sensitivityLevel: profileData.sensitivityLevel || 'medium',
            acneLevel: profileData.acneLevel ?? 0,
            dehydrationLevel: 0, // Не доступно в ProfileResponse
            rosaceaRisk: 'none', // Не доступно в ProfileResponse
            pigmentationRisk: 'none', // Не доступно в ProfileResponse
            notes: profileData.notes || '',
          });
        }
      } catch (err) {
        clientLogger.warn('Profile not found, using fallback');
      }

      // Загружаем фото-сканы из localStorage
      if (typeof window !== 'undefined') {
        const answersRaw = localStorage.getItem('skiniq.answers');
        if (answersRaw) {
          const answers = JSON.parse(answersRaw);
          if (Array.isArray(answers.photo_scans)) {
            setScans(answers.photo_scans);
          }
        }
      }
    } catch (err) {
      console.error('Error loading insights:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSkinTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      dry: 'Сухая',
      oily: 'Жирная',
      combo: 'Комбинированная',
      normal: 'Нормальная',
      sensitive: 'Чувствительная',
    };
    return labels[type] || type;
  };

  const getSensitivityLabel = (level: string) => {
    const labels: Record<string, string> = {
      high: 'Высокая',
      medium: 'Средняя',
      low: 'Низкая',
    };
    return labels[level] || level;
  };

  const getPriority = () => {
    if (!profile) return 'Определяется...';
    
    const priorities: string[] = [];
    if (profile.dehydrationLevel >= 3) {
      priorities.push('барьер');
    }
    if (profile.acneLevel >= 3) {
      priorities.push('мягкие кислоты');
    } else if (profile.sensitivityLevel === 'high') {
      priorities.push('успокоение');
    }
    
    return priorities.length > 0 ? priorities.join(' + ') : 'базовый уход';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F5FFFC] to-[#E8FBF7]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-4 border-t-[#0A5F59] border-gray-200 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-[#0A5F59]">Загрузка инсайтов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen relative">
      {/* Background */}
      <div 
        className="absolute inset-0 -z-10"
        style={{
          background: "radial-gradient(120% 140% at 70% 0%, #ffe7ef 0%, #f3e6cf 35%, #efeef2 65%, #e7e7ea 100%)"
        }}
      />
      
      <div className="relative z-20 max-w-3xl mx-auto space-y-6 p-4 pt-24">
        {/* Инсайты */}
        <section className="bg-white/20 backdrop-blur-xl border border-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.08)] rounded-3xl p-6">
          <h2 className="text-lg font-bold mb-3 text-[#0A5F59]">Инсайты</h2>
          {profile ? (
            <ul className="list-disc pl-5 text-zinc-700 space-y-2">
              <li>Тип кожи: {getSkinTypeLabel(profile.skinType)}</li>
              <li>Чувствительность: {getSensitivityLabel(profile.sensitivityLevel)}</li>
              <li>Приоритет: {getPriority()}</li>
              {profile.acneLevel > 0 && (
                <li>Акне: уровень {profile.acneLevel}/5</li>
              )}
              {profile.dehydrationLevel > 0 && (
                <li>Обезвоженность: уровень {profile.dehydrationLevel}/5</li>
              )}
            </ul>
          ) : (
            <div className="text-zinc-600">Загружаем данные профиля...</div>
          )}
        </section>
        
        {/* Архив фото-сканов */}
        <section className="bg-white/20 backdrop-blur-xl border border-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.08)] rounded-3xl p-6">
          <h3 className="text-lg font-bold mb-3 text-[#0A5F59]">Архив фото-сканов</h3>
          {scans.length === 0 ? (
            <div className="text-zinc-600">Пока нет сохранённых сканов. Добавьте фото на последнем шаге анкеты.</div>
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

        {/* Кнопка перехода к плану */}
        <div className="flex justify-center pt-4">
          <button
            onClick={() => router.push('/home')}
            className="w-full max-w-md h-14 rounded-2xl font-bold text-base bg-[#0A5F59] text-white hover:bg-[#0A5F59]/90 shadow-lg hover:shadow-xl transition-all"
          >
            Перейти к плану ухода →
          </button>
        </div>
      </div>

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
              <h3 className="text-lg font-bold text-[#0A5F59]">Детальный анализ</h3>
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
              
              {/* Проблемные области */}
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
                <div><strong>Тип кожи:</strong> {modalPhoto.analysis?.skinType || 'не определён'}</div>
                <div><strong>Проблемы:</strong> {modalPhoto.analysis?.concerns?.join(", ") || "не обнаружены"}</div>
                {modalPhoto.analysis?.confidence && (
                  <div><strong>Уверенность:</strong> {Math.round(modalPhoto.analysis.confidence * 100)}%</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

