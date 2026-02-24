// app/(miniapp)/quiz/screens/ResumeScreen.tsx
// Экран "Продолжить анкету" - показывается когда есть сохраненный прогресс

'use client';

interface ResumeScreenProps {
  answeredCount: number;
  totalQuestions: number;
  progressPercent: number;
  onResume: () => void;
  onStartOver: () => void;
}

export function ResumeScreen({
  answeredCount,
  totalQuestions,
  progressPercent,
  onResume,
  onStartOver,
}: ResumeScreenProps) {
  return (
    <div style={{ 
      padding: '20px',
      minHeight: '100vh',
      background: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '88%',
        maxWidth: '420px',
        backgroundColor: 'rgba(255, 255, 255, 0.58)',
        backdropFilter: 'blur(26px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '44px',
        padding: '36px 28px 32px 28px',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
      }}>
        <h1 className="quiz-title" style={{
          fontFamily: "'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 700,
          fontSize: '32px',
          lineHeight: '38px',
          color: '#0A5F59',
          margin: '0 0 16px 0',
          textAlign: 'center',
        }}>
          Вы не завершили анкету
        </h1>

        <p style={{
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 400,
          fontSize: '18px',
          lineHeight: '1.5',
          color: '#475467',
          margin: '0 0 24px 0',
          textAlign: 'center',
        }}>
          Продолжите, чтобы получить персональный план ухода
        </p>

        {/* Прогресс */}
        <div style={{
          marginBottom: '28px',
          padding: '16px',
          backgroundColor: 'rgba(10, 95, 89, 0.08)',
          borderRadius: '16px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
            fontSize: '14px',
            color: '#0A5F59',
            fontWeight: 600,
          }}>
            <span>Прогресс</span>
            <span>{answeredCount} из {totalQuestions} вопросов</span>
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: 'rgba(10, 95, 89, 0.2)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progressPercent}%`,
              height: '100%',
              backgroundColor: '#0A5F59',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Выгоды */}
        <div style={{
          marginBottom: '28px',
          padding: '0',
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#0A5F59',
            marginBottom: '12px',
          }}>
            Что вы получите:
          </h3>
          {[
            'Персональный план ухода на 12 недель',
            'Рекомендации от косметолога-дерматолога',
            'Точная диагностика типа и состояния кожи',
          ].map((benefit, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              marginBottom: index < 2 ? '12px' : '0',
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#0A5F59',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px',
              }}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span style={{
                fontSize: '15px',
                color: '#1F2A44',
                lineHeight: '1.5',
              }}>
                {String(benefit || '')}
              </span>
            </div>
          ))}
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <button
            onClick={onResume}
            style={{
              width: '100%',
              padding: '16px 24px',
              borderRadius: '16px',
              backgroundColor: '#0A5F59',
              color: 'white',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(10, 95, 89, 0.3)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Продолжить
          </button>
          <button
            onClick={onStartOver}
            style={{
              width: '100%',
              padding: '12px 24px',
              borderRadius: '16px',
              backgroundColor: 'transparent',
              color: '#0A5F59',
              border: '1px solid #0A5F59',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(10, 95, 89, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Начать заново
          </button>
        </div>
      </div>
    </div>
  );
}

