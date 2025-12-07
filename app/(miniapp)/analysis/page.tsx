// app/(miniapp)/analysis/page.tsx
// Страница анализа кожи с тремя блоками: проблемы, рекомендации, обратная связь

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnalysisLoading } from '@/components/AnalysisLoading';
import { UserProfileCard } from '@/components/UserProfileCard';
import { SkinIssuesCarousel } from '@/components/SkinIssuesCarousel';
import { CareRoutine } from '@/components/CareRoutine';
import { FeedbackBlock } from '@/components/FeedbackBlock';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface SkinIssue {
  id: string;
  name: string;
  severity_score: number;
  severity_label: 'критично' | 'плохо' | 'умеренно' | 'хорошо' | 'отлично';
  description: string;
  tags: string[];
  image_url?: string;
}

interface Product {
  id: number;
  name: string;
  brand: { name: string };
  price?: number;
  imageUrl?: string | null;
  description?: string;
  tags?: string[];
}

interface CareStep {
  stepNumber: number;
  stepName: string;
  stepDescription: string;
  stepTags: string[];
  products: Product[];
}

interface AnalysisData {
  profile: {
    gender?: string | null;
    age?: number | null;
    skinType: string;
    skinTypeRu: string;
    keyProblems: string[];
  };
  issues: SkinIssue[];
  morningSteps: CareStep[];
  eveningSteps: CareStep[];
}

export default function AnalysisPage() {
  const router = useRouter();
  const [showLoading, setShowLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [inRoutineProducts, setInRoutineProducts] = useState<Set<number>>(new Set());
  const [wishlistProductIds, setWishlistProductIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadAnalysisData();
  }, []);

  // Останавливаем анимацию загрузки, если произошла ошибка
  useEffect(() => {
    if (error && showLoading) {
      setShowLoading(false);
    }
  }, [error, showLoading]);

  const loadAnalysisData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Загружаем данные анализа через новый API endpoint
      const analysisData = await api.getAnalysis() as AnalysisData;

      // Загружаем wishlist
      let wishlist: number[] = [];
      try {
        const wishlistData = await api.getWishlist() as any;
        wishlist = (wishlistData.items || []).map((item: any) => 
          item.product?.id || item.productId
        ).filter((id: any): id is number => typeof id === 'number');
        setWishlistProductIds(new Set(wishlist));
      } catch (err) {
        console.warn('Could not load wishlist:', err);
      }

      // Загружаем выбранные продукты из localStorage
      if (typeof window !== 'undefined') {
        try {
          const savedRoutine = localStorage.getItem('routine_products');
          if (savedRoutine) {
            const routineProducts = JSON.parse(savedRoutine) as number[];
            setInRoutineProducts(new Set(routineProducts));
          }
        } catch (err) {
          console.warn('Could not load routine products from localStorage:', err);
        }
      }

      setAnalysisData(analysisData);
      setLoading(false);
    } catch (err: any) {
      console.error('Error loading analysis data:', err);
      
      // Если план еще не готов (404 или ошибка генерации), редиректим на /plan
      // или показываем лоадер вместо ошибки
      if (err?.status === 404 || err?.message?.includes('not found') || err?.message?.includes('не найден')) {
        console.log('Analysis not ready, redirecting to plan page');
        router.push('/plan');
        return;
      }
      
      // Для других ошибок показываем сообщение
      setError(err?.message || 'Ошибка загрузки данных анализа');
      setLoading(false);
    }
  };

  const handleAddToRoutine = async (productId: number) => {
    const newSet = new Set(inRoutineProducts);
    const wasInRoutine = newSet.has(productId);
    
    if (wasInRoutine) {
      newSet.delete(productId);
    } else {
      newSet.add(productId);
    }
    setInRoutineProducts(newSet);
    
    // Сохраняем в localStorage для сохранения состояния между сессиями
    // План будет использовать выбранные продукты при генерации
    if (typeof window !== 'undefined') {
      const routineProducts = Array.from(newSet);
      localStorage.setItem('routine_products', JSON.stringify(routineProducts));
    }
    
    toast.success(wasInRoutine ? 'Удалено из ухода' : 'Добавлено в уход');
  };

  const handleToggleWishlist = async (productId: number) => {
    try {
      const isInWishlist = wishlistProductIds.has(productId);
      
      if (isInWishlist) {
        await api.removeFromWishlist(productId);
        setWishlistProductIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
        toast.success('Удалено из избранного');
      } else {
        await api.addToWishlist(productId);
        setWishlistProductIds(prev => new Set(prev).add(productId));
        toast.success('Добавлено в избранное');
      }
    } catch (err: any) {
      console.error('Error toggling wishlist:', err);
      toast.error(err?.message || 'Не удалось изменить избранное');
    }
  };

  const handleFeedbackSubmit = async (feedback: {
    isRelevant: boolean;
    reasons?: string[];
    comment?: string;
  }) => {
    try {
      await api.submitAnalysisFeedback(feedback);
      toast.success('Спасибо за обратную связь!');
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      toast.error(err?.message || 'Не удалось отправить отзыв');
    }
  };


  if (showLoading) {
    return (
      <AnalysisLoading
        onComplete={() => setShowLoading(false)}
        duration={6000}
      />
    );
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <div style={{ color: '#0A5F59', fontSize: '16px' }}>Загрузка анализа...</div>
      </div>
    );
  }

  if (error || !analysisData) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        padding: '20px',
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '24px',
          padding: '32px',
          textAlign: 'center',
          maxWidth: '400px',
        }}>
          <h2 style={{ color: '#0A5F59', marginBottom: '12px' }}>Ошибка</h2>
          <p style={{ color: '#475467', marginBottom: '24px' }}>
            {error || 'Не удалось загрузить данные анализа'}
          </p>
          <button
            onClick={() => router.push('/plan')}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: '#0A5F59',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
            }}
          >
            Перейти к плану
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      padding: '20px',
      paddingBottom: '100px',
    }}>
      {/* Логотип */}
      <div style={{
        padding: '20px',
        textAlign: 'center',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-block',
          }}
        >
        <img
          src="/skiniq-logo.png"
          alt="SkinIQ"
          style={{
            height: '120px',
            marginBottom: '8px',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
          }}
        />
        </button>
      </div>

      <h1 style={{
        fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: 700,
        fontSize: '32px',
        lineHeight: '40px',
        color: '#0A5F59',
        marginBottom: '32px',
        textAlign: 'center',
      }}>
        Ваш анализ
      </h1>

      {/* Блок 1: Профиль пользователя */}
      <UserProfileCard
        gender={analysisData.profile.gender}
        age={analysisData.profile.age}
        skinType={analysisData.profile.skinType}
        skinTypeRu={analysisData.profile.skinTypeRu}
        keyProblems={analysisData.profile.keyProblems}
      />

      {/* Блок 2: Ключевые проблемы кожи */}
      {analysisData.issues.length > 0 && (
        <SkinIssuesCarousel issues={analysisData.issues} />
      )}

      {/* Блок 3: Ваши рекомендации */}
      {(analysisData.morningSteps.length > 0 || analysisData.eveningSteps.length > 0) && (
        <CareRoutine
          morningSteps={analysisData.morningSteps}
          eveningSteps={analysisData.eveningSteps}
          onAddToRoutine={handleAddToRoutine}
          inRoutineProducts={inRoutineProducts}
          onToggleWishlist={handleToggleWishlist}
          wishlistProductIds={wishlistProductIds}
        />
      )}

      {/* Блок 4: Обратная связь */}
      <FeedbackBlock onSubmit={handleFeedbackSubmit} />

      {/* Кнопка перехода к плану */}
      <div style={{
        marginTop: '32px',
        textAlign: 'center',
      }}>
        <button
          onClick={() => router.push('/plan')}
          style={{
            padding: '16px 32px',
            borderRadius: '16px',
            backgroundColor: '#0A5F59',
            color: 'white',
            border: 'none',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            fontSize: '16px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(10, 95, 89, 0.3)',
          }}
        >
          Перейти к плану →
        </button>
      </div>
    </div>
  );
}
