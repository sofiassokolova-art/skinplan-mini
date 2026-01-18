// app/(miniapp)/analysis/page.tsx
// Страница анализа кожи с тремя блоками: проблемы, рекомендации, обратная связь

'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnalysisLoading } from '@/components/AnalysisLoading';
import { UserProfileCard } from '@/components/UserProfileCard';
import { SkinIssuesCarousel } from '@/components/SkinIssuesCarousel';
import { CareRoutine } from '@/components/CareRoutine';
import { FeedbackBlock } from '@/components/FeedbackBlock';
import { api } from '@/lib/api';
import { useAddToWishlist, useRemoveFromWishlist } from '@/hooks/useWishlist';
import toast from 'react-hot-toast';
import { clientLogger } from '@/lib/client-logger';
import type { AnalysisResponse, CareStep } from '@/lib/api-types';

// Используем типы из api-types.ts
type AnalysisData = AnalysisResponse;

function AnalysisPageContent() {
  const router = useRouter();
  const [showLoading, setShowLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [inRoutineProducts, setInRoutineProducts] = useState<Set<number>>(new Set());
  const [wishlistProductIds, setWishlistProductIds] = useState<Set<number>>(new Set());

  const loadAnalysisData = useCallback(async () => {
    try {
      clientLogger.info('📥 Loading analysis data');
      setLoading(true);
      setError(null);

      // Загружаем данные анализа через новый API endpoint
      const analysisData = await api.getAnalysis();
      clientLogger.info('✅ Analysis data loaded', {
        issuesCount: analysisData.issues?.length || 0,
        morningStepsCount: analysisData.morningSteps?.length || 0,
        eveningStepsCount: analysisData.eveningSteps?.length || 0,
      });

      // Загружаем wishlist
      let wishlist: number[] = [];
      try {
        const wishlistData = await api.getWishlist();
        wishlist = (wishlistData.items || []).map((item) => 
          item.product?.id || item.productId
        ).filter((id): id is number => typeof id === 'number');
        setWishlistProductIds(new Set(wishlist));
      } catch (err) {
        clientLogger.warn('Could not load wishlist:', err);
      }

      // Загружаем выбранные продукты из БД
      try {
        const { getRoutineProducts } = await import('@/lib/user-preferences');
        const routineProducts = await getRoutineProducts();
        if (routineProducts && Array.isArray(routineProducts)) {
          setInRoutineProducts(new Set(routineProducts));
        }
      } catch (err) {
        clientLogger.warn('Could not load routine products from DB:', err);
      }

      setAnalysisData(analysisData);
      setLoading(false);
    } catch (err: any) {
      clientLogger.error('❌ Error loading analysis data', {
        error: err?.message || String(err),
        status: err?.status,
        stack: err?.stack?.substring(0, 200),
      });
      
      // Если план еще не готов (404 или ошибка генерации), редиректим на /plan
      // или показываем лоадер вместо ошибки
      if (err?.status === 404 || err?.message?.includes('not found') || err?.message?.includes('не найден')) {
        clientLogger.log('Analysis not ready, redirecting to plan page');
        router.push('/plan');
        return;
      }
      
      // Для других ошибок показываем сообщение
      setError(err?.message || 'Ошибка загрузки данных анализа');
      setLoading(false);
    }
  }, [setLoading, setError, setAnalysisData]);

  useEffect(() => {
    loadAnalysisData();
  }, [loadAnalysisData]);

  // Останавливаем анимацию загрузки, если произошла ошибка
  useEffect(() => {
    if (error && showLoading) {
      setShowLoading(false);
    }
  }, [error, showLoading]);

  const handleAddToRoutine = async (productId: number) => {
    const newSet = new Set(inRoutineProducts);
    const wasInRoutine = newSet.has(productId);
    
    if (wasInRoutine) {
      newSet.delete(productId);
    } else {
      newSet.add(productId);
    }
    
    // ИСПРАВЛЕНО: Сначала сохраняем в БД, только при успехе обновляем локальное состояние
    // Это предотвращает рассинхронизацию между UI и сервером
    try {
      const { setRoutineProducts } = await import('@/lib/user-preferences');
      const routineProducts = Array.from(newSet);
      await setRoutineProducts(routineProducts);
      
      // Только после успешного сохранения обновляем локальное состояние
      setInRoutineProducts(newSet);
      toast.success(wasInRoutine ? 'Удалено из ухода' : 'Добавлено в уход');
    } catch (err) {
      clientLogger.error('Could not save routine products to DB:', err);
      toast.error('Не удалось сохранить изменения. Пожалуйста, попробуйте еще раз.');
      // Не обновляем локальное состояние при ошибке, чтобы UI оставался синхронизированным с сервером
    }
  };

  // ИСПРАВЛЕНО: Используем React Query хуки для автоматической инвалидации кэша
  const addToWishlistMutation = useAddToWishlist();
  const removeFromWishlistMutation = useRemoveFromWishlist();

  const handleToggleWishlist = async (productId: number) => {
    try {
      const isInWishlist = wishlistProductIds.has(productId);
      
      if (isInWishlist) {
        clientLogger.info('Removing product from wishlist', { productId });
        await removeFromWishlistMutation.mutateAsync(productId);
        setWishlistProductIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
        toast.success('Удалено из избранного');
      } else {
        clientLogger.info('Adding product to wishlist', { productId });
        await addToWishlistMutation.mutateAsync(productId);
        setWishlistProductIds(prev => {
          const newSet = new Set(prev);
          newSet.add(productId);
          return newSet;
        });
        toast.success('Добавлено в избранное');
      }
    } catch (err: any) {
      clientLogger.error('Error toggling wishlist', {
        productId,
        error: err?.message || String(err),
      });
      toast.error(err?.message || 'Не удалось изменить избранное');
    }
  };

  const handleFeedbackSubmit = async (feedback: {
    isRelevant: boolean;
    reasons?: string[];
    comment?: string;
  }) => {
    try {
      clientLogger.info('Submitting analysis feedback', {
        isRelevant: feedback.isRelevant,
        hasReasons: !!feedback.reasons?.length,
        hasComment: !!feedback.comment,
      });
      await api.submitAnalysisFeedback(feedback);
      toast.success('Спасибо за обратную связь!');
    } catch (err: any) {
      clientLogger.error('Error submitting feedback', {
        error: err?.message || String(err),
      });
      toast.error(err?.message || 'Не удалось отправить отзыв');
    }
  };


  // ВАЖНО: Проверяем ошибку ПЕРЕД показом анимации загрузки
  // Это гарантирует, что ошибки видны сразу, даже если анимация активна
  if (error) {
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
            {error}
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

  // Показываем анимацию загрузки только если нет ошибки
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

  if (!analysisData) {
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
          onClick={() => router.push('/home')}
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

export default function AnalysisPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <div style={{ color: '#0A5F59', fontSize: '16px' }}>Загрузка...</div>
      </div>
    }>
      <AnalysisPageContent />
    </Suspense>
  );
}
