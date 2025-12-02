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

  const loadAnalysisData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Загружаем профиль
      const profile = await api.getCurrentProfile() as any;
      
      // Загружаем план для получения рекомендаций
      const plan = await api.getPlan() as any;

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

      // TODO: Загрузить проблемы кожи через API endpoint
      // Пока используем заглушку на основе данных профиля
      const issues: SkinIssue[] = [];
      if (profile.acneLevel && profile.acneLevel >= 3) {
        issues.push({
          id: 'acne',
          name: 'Акне / высыпания',
          severity_score: profile.acneLevel * 20,
          severity_label: profile.acneLevel >= 4 ? 'критично' : 'плохо',
          description: 'Активные воспаления требуют специального ухода',
          tags: ['воспаления', 'постакне'],
        });
      }
      if (profile.skinType === 'oily' || profile.skinType === 'combo') {
        issues.push({
          id: 'oiliness',
          name: 'Жирность и блеск кожи',
          severity_score: 60,
          severity_label: 'умеренно',
          description: 'Избыточное выделение кожного сала',
          tags: ['Т-зона'],
        });
      }
      if (profile.sensitivityLevel === 'high' || profile.sensitivityLevel === 'very_high') {
        issues.push({
          id: 'sensitivity',
          name: 'Краснота, раздражение, чувствительность',
          severity_score: 70,
          severity_label: 'плохо',
          description: 'Повышенная чувствительность кожи требует мягкого ухода',
          tags: ['раздражение'],
        });
      }

      // Формируем ключевые проблемы для профиля
      const keyProblems = issues
        .filter(i => i.severity_label === 'критично' || i.severity_label === 'плохо')
        .map(i => i.name);

      // TODO: Преобразовать план в формат CareStep
      // Пока используем заглушку
      const morningSteps: CareStep[] = [];
      const eveningSteps: CareStep[] = [];

      if (plan?.plan28) {
        // Используем первый день плана для рекомендаций
        const firstDay = plan.plan28.days[0];
        
        // Преобразуем morning steps
        firstDay.morning.forEach((step: any, index: number) => {
          const productId = step.productId ? Number(step.productId) : null;
          if (productId && plan.productsMap) {
            const product = plan.productsMap.get(productId);
            if (product) {
              const stepIndex = morningSteps.findIndex(s => s.stepNumber === index + 1);
              if (stepIndex === -1) {
                morningSteps.push({
                  stepNumber: index + 1,
                  stepName: getStepName(step.stepCategory),
                  stepDescription: getStepDescription(step.stepCategory),
                  stepTags: getStepTags(step.stepCategory),
                  products: [product],
                });
              } else {
                morningSteps[stepIndex].products.push(product);
              }
            }
          }
        });

        // Преобразуем evening steps
        firstDay.evening.forEach((step: any, index: number) => {
          const productId = step.productId ? Number(step.productId) : null;
          if (productId && plan.productsMap) {
            const product = plan.productsMap.get(productId);
            if (product) {
              const stepIndex = eveningSteps.findIndex(s => s.stepNumber === index + 1);
              if (stepIndex === -1) {
                eveningSteps.push({
                  stepNumber: index + 1,
                  stepName: getStepName(step.stepCategory),
                  stepDescription: getStepDescription(step.stepCategory),
                  stepTags: getStepTags(step.stepCategory),
                  products: [product],
                });
              } else {
                eveningSteps[stepIndex].products.push(product);
              }
            }
          }
        });
      }

      setAnalysisData({
        profile: {
          gender: profile.gender,
          age: profile.age,
          skinType: profile.skinType || 'normal',
          skinTypeRu: profile.skinTypeRu || 'Нормальная',
          keyProblems,
        },
        issues,
        morningSteps,
        eveningSteps,
      });

      setLoading(false);
    } catch (err: any) {
      console.error('Error loading analysis data:', err);
      setError(err?.message || 'Ошибка загрузки данных анализа');
      setLoading(false);
    }
  };

  const handleAddToRoutine = async (productId: number) => {
    const newSet = new Set(inRoutineProducts);
    if (newSet.has(productId)) {
      newSet.delete(productId);
    } else {
      newSet.add(productId);
    }
    setInRoutineProducts(newSet);
    
    // TODO: Сохранить в БД через API
    toast.success(newSet.has(productId) ? 'Добавлено в уход' : 'Удалено из ухода');
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
    // TODO: Отправить обратную связь через API
    console.log('Feedback submitted:', feedback);
    // await api.submitFeedback(feedback);
  };

  // Вспомогательные функции для преобразования stepCategory
  const getStepName = (stepCategory: string): string => {
    const names: Record<string, string> = {
      cleanser_gentle: 'Очищение',
      cleanser_balancing: 'Очищение',
      cleanser_deep: 'Очищение',
      toner_hydrating: 'Тоник',
      toner_soothing: 'Тоник',
      serum_hydrating: 'Сыворотка',
      serum_niacinamide: 'Сыворотка',
      serum_vitc: 'Сыворотка',
      moisturizer_light: 'Увлажнение',
      moisturizer_balancing: 'Увлажнение',
      spf_50_face: 'SPF защита',
    };
    return names[stepCategory] || 'Уход';
  };

  const getStepDescription = (stepCategory: string): string => {
    const descriptions: Record<string, string> = {
      cleanser_gentle: 'Мягкое очищение кожи от загрязнений',
      cleanser_balancing: 'Балансирующее очищение для нормализации работы сальных желез',
      serum_hydrating: 'Интенсивное увлажнение и питание кожи',
      moisturizer_light: 'Легкое увлажнение без ощущения тяжести',
      spf_50_face: 'Защита от УФ-излучения и преждевременного старения',
    };
    return descriptions[stepCategory] || 'Важный этап ухода за кожей';
  };

  const getStepTags = (stepCategory: string): string[] => {
    const tags: Record<string, string[]> = {
      cleanser_gentle: ['подходит при акне', 'мягкое очищение'],
      serum_niacinamide: ['уменьшает воспаления', 'нормализует работу сальных желез'],
      spf_50_face: ['защита от УФ', 'предотвращение старения'],
    };
    return tags[stepCategory] || [];
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
        <img
          src="/skiniq-logo.png"
          alt="SkinIQ"
          style={{
            height: '120px',
            marginBottom: '8px',
          }}
        />
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

