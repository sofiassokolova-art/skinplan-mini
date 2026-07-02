// components/ServiceFeedbackPopup.tsx
// Сервисный попап для отзыва о skiniq.
// Логика показа: до первого ответа («Нравится» / отправленный комментарий) — после
// ответа не показывается никогда. Закрытие крестиком = «не сейчас»: ставит кулдаун
// FEEDBACK_COOLDOWN_DAYS, попап вернётся через неделю.
// Новый стиль: лайм-акцент, glass-карточка, без зелёного #0A5F59 — синхронизирован
// с дизайном плана и главной (см. .pv2-* и .home-rd в проекте).

'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

const FEEDBACK_COOLDOWN_DAYS = 7; // Кулдаун после закрытия крестиком

export function ServiceFeedbackPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [stage, setStage] = useState<'ask' | 'comment' | 'thanks'>('ask');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Компонент живёт в layout и не перемонтируется при клиентской навигации,
  // поэтому условия показа перепроверяются на каждую смену pathname.
  const pathname = usePathname();

  useEffect(() => {
    const checkShouldShow = async () => {
      if (typeof window === 'undefined') return;
      const path = window.location.pathname;
      if (path === '/quiz' || path.startsWith('/quiz/')) return;
      if (path === '/home') {
        // На главной показываем только пользователям с планом. getHasPlanProgress
        // читает preferences через общий кэш (sessionStorage/память, дедуп запросов) —
        // в отличие от прямого чтения sessionStorage не подавляет попап, когда кэш
        // ещё не записан или только что инвалидирован.
        try {
          const { getHasPlanProgress } = await import('@/lib/user-preferences');
          const hasPlanProgress = await getHasPlanProgress();
          if (!hasPlanProgress) return;
        } catch {
          return;
        }
      }

      try {
        const profile = await api.getCurrentProfile() as any;
        if (!profile || !profile.createdAt) return;

        const profileCreatedAt = new Date(profile.createdAt);
        const now = new Date();
        const daysSincePlanGeneration = Math.floor(
          (now.getTime() - profileCreatedAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysSincePlanGeneration < 3) return;
      } catch {
        return;
      }

      try {
        const { getServiceFeedbackSent } = await import('@/lib/user-preferences');
        const feedbackSent = await getServiceFeedbackSent();
        if (feedbackSent) {
          setIsVisible(false);
          return;
        }
      } catch {
        // продолжаем
      }

      try {
        const { getLastServiceFeedbackDate } = await import('@/lib/user-preferences');
        const lastFeedbackDate = await getLastServiceFeedbackDate();
        if (lastFeedbackDate) {
          const lastDate = new Date(lastFeedbackDate);
          const now = new Date();
          const daysSinceLastFeedback =
            (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceLastFeedback < FEEDBACK_COOLDOWN_DAYS) {
            setIsVisible(false);
            return;
          }
        }
      } catch {
        // продолжаем
      }

      setIsVisible(true);
    };

    const timer = setTimeout(() => {
      checkShouldShow();
    }, 3000);

    return () => clearTimeout(timer);
  }, [pathname]);

  const persistAfterSend = async () => {
    try {
      const {
        setLastServiceFeedbackDate,
        setServiceFeedbackSent,
      } = await import('@/lib/user-preferences');
      await setLastServiceFeedbackDate(new Date().toISOString());
      await setServiceFeedbackSent(true);
    } catch (err) {
      console.warn('Failed to save service feedback flag:', err);
    }
  };

  const submitFeedback = async (isRelevant: boolean) => {
    setIsSubmitting(true);
    try {
      await api.submitAnalysisFeedback({
        isRelevant,
        comment: comment.trim() || undefined,
        type: 'service',
      });
      await persistAfterSend();
      setStage('thanks');
      setTimeout(() => setIsVisible(false), 2200);
    } catch (err) {
      console.error('Error submitting service feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    // Закрытие крестиком = «не сейчас»: ставим только дату (кулдаун на неделю),
    // но не serviceFeedbackSent — попап вернётся через FEEDBACK_COOLDOWN_DAYS.
    void (async () => {
      try {
        const { setLastServiceFeedbackDate } = await import('@/lib/user-preferences');
        await setLastServiceFeedbackDate(new Date().toISOString());
      } catch (err) {
        console.warn('Failed to save service feedback dismiss date:', err);
      }
    })();
  };

  if (!isVisible) return null;

  return (
    <div className="sf-pop" role="dialog" aria-modal="false" aria-label="Расскажите, как вам skiniq">
      <style>{`
        @keyframes sf-rise {
          from { opacity: 0; transform: translate(-50%, 12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        .sf-pop{
          position:fixed; left:50%; bottom:calc(20px + env(safe-area-inset-bottom, 0px));
          transform:translateX(-50%);
          width:calc(100% - 32px); max-width:460px; z-index:9999;
          animation: sf-rise .28s ease-out;
          font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .sf-card{
          position:relative;
          background: rgba(255,255,255,0.78);
          border: 1px solid rgba(255,255,255,0.85);
          border-radius: 24px;
          padding: 18px 18px 18px;
          box-shadow: 0 18px 48px rgba(10,10,10,0.16), 0 6px 18px rgba(10,10,10,0.06);
          backdrop-filter: blur(28px) saturate(160%);
          -webkit-backdrop-filter: blur(28px) saturate(160%);
          color: var(--ink);
          overflow:hidden;
        }
        .sf-card::before{
          content:""; position:absolute; right:-40px; top:-40px;
          width:140px; height:140px; pointer-events:none;
          background: radial-gradient(circle, rgba(var(--accent-rgb),0.32) 0%, transparent 70%);
        }
        .sf-close{
          position:absolute; top:10px; right:10px;
          width:30px; height:30px; border-radius:50%;
          background: rgba(10,10,10,0.06); border:0;
          display:grid; place-items:center; cursor:pointer; color: var(--ink);
          z-index:2;
        }
        .sf-close:active{ transform:scale(0.92); background: rgba(10,10,10,0.12); }
        .sf-eyebrow{
          position:relative; display:inline-flex; align-items:center; gap:6px;
          font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase;
          color: var(--ink-soft);
        }
        .sf-eyebrow::before{
          content:""; width:6px; height:6px; border-radius:50%; background: var(--accent);
          box-shadow: 0 0 0 4px rgba(var(--accent-rgb),0.25);
        }
        .sf-title{
          position:relative;
          margin: 8px 36px 4px 0;
          font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 18px; font-weight:700; letter-spacing:-0.3px; line-height:1.2;
        }
        .sf-sub{
          position:relative;
          margin: 0 0 14px;
          font-size: 13px; color: var(--ink-soft); line-height: 1.45;
        }
        .sf-actions{ position:relative; display:flex; gap:10px; }
        .sf-btn{
          flex:1; height: 46px; border-radius: 999px; cursor:pointer;
          font-family: var(--font-inter), sans-serif;
          font-weight:600; font-size: 14px; letter-spacing:-0.1px;
          display:inline-flex; align-items:center; justify-content:center; gap:8px;
          transition: transform .12s ease, background .12s ease;
        }
        .sf-btn:active{ transform: scale(0.98); }
        .sf-btn.primary{
          background: var(--accent); color: var(--ink); border:0;
          box-shadow: 0 10px 22px rgba(var(--accent-rgb),0.32);
        }
        .sf-btn.ghost{
          background: transparent; color: var(--ink);
          border: 1.5px solid rgba(10,10,10,0.12);
        }
        .sf-textarea{
          width:100%; box-sizing:border-box;
          min-height: 88px; resize: vertical;
          padding: 12px 14px;
          border-radius: 16px;
          border: 1px solid rgba(10,10,10,0.12);
          background: rgba(255,255,255,0.78);
          font-family: inherit; font-size: 14px; color: var(--ink);
          margin-bottom: 12px;
          outline:none;
        }
        .sf-textarea:focus{ border-color: var(--ink); }
        .sf-thanks{
          position:relative;
          display:flex; align-items:center; gap:12px;
        }
        .sf-thanks-icon{
          width:44px; height:44px; border-radius:50%;
          background: var(--accent);
          display:grid; place-items:center; flex-shrink:0;
          box-shadow: 0 8px 18px rgba(var(--accent-rgb),0.32);
        }
        .sf-thanks-title{
          font-family: var(--font-unbounded), sans-serif;
          font-weight:700; font-size:16px; letter-spacing:-0.2px;
        }
        .sf-thanks-text{ font-size:13px; color: var(--ink-soft); margin-top:2px; }
      `}</style>

      <div className="sf-card">
        <button className="sf-close" onClick={handleClose} aria-label="Закрыть">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18"/>
          </svg>
        </button>

        {stage === 'ask' && (
          <>
            <div className="sf-eyebrow">skiniq feedback</div>
            <h3 className="sf-title">Расскажите, как вам skiniq?</h3>
            <p className="sf-sub">Ваше мнение поможет нам подбирать уход точнее</p>
            <div className="sf-actions">
              <button
                className="sf-btn ghost"
                onClick={() => setStage('comment')}
                disabled={isSubmitting}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 2v12M22 2h-5v12h5zM4 15h6l-1 5a2 2 0 0 0 2 2l3-7V4H4.3a2 2 0 0 0-2 1.7L1 12.7A2 2 0 0 0 3 15z"/>
                </svg>
                Не очень
              </button>
              <button
                className="sf-btn primary"
                onClick={() => submitFeedback(true)}
                disabled={isSubmitting}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 22V10M2 22h5V10H2zM20 9h-6l1-5a2 2 0 0 0-2-2l-3 7v11h9.7a2 2 0 0 0 2-1.7l1.3-7A2 2 0 0 0 20 9z"/>
                </svg>
                Нравится
              </button>
            </div>
          </>
        )}

        {stage === 'comment' && (
          <>
            <div className="sf-eyebrow">skiniq feedback</div>
            <h3 className="sf-title">Что можно улучшить?</h3>
            <p className="sf-sub">Любая деталь — продукты, рутина, интерфейс</p>
            <textarea
              className="sf-textarea"
              placeholder="Например: хочется больше альтернатив в плане..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isSubmitting}
            />
            <div className="sf-actions">
              <button
                className="sf-btn ghost"
                onClick={() => {
                  // Сбрасываем черновик, чтобы текст не утёк в позитивный отзыв,
                  // если после «Назад» пользователь нажмёт «Нравится»
                  setComment('');
                  setStage('ask');
                }}
                disabled={isSubmitting}
              >
                Назад
              </button>
              <button
                className="sf-btn primary"
                onClick={() => submitFeedback(false)}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Отправляем...' : 'Отправить'}
              </button>
            </div>
          </>
        )}

        {stage === 'thanks' && (
          <div className="sf-thanks">
            <div className="sf-thanks-icon" aria-hidden>
              <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                <path d="M2 7l5 5L18 1" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="sf-thanks-title">Спасибо!</div>
              <div className="sf-thanks-text">Ваш отзыв уже у команды</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
