// components/SkinIssuesCarousel.tsx
// Карусель проблем кожи с горизонтальным скроллом

'use client';

interface SkinIssue {
  id: string;
  name: string;
  severity_score: number;
  severity_label: 'критично' | 'плохо' | 'умеренно' | 'хорошо' | 'отлично';
  description: string;
  tags: string[];
  image_url?: string;
}

interface SkinIssuesCarouselProps {
  issues: SkinIssue[];
}

const severityColors: Record<string, { bg: string; text: string; border: string }> = {
  критично: { bg: 'rgba(239, 68, 68, 0.1)', text: '#DC2626', border: 'rgba(239, 68, 68, 0.3)' },
  плохо: { bg: 'rgba(245, 158, 11, 0.1)', text: '#D97706', border: 'rgba(245, 158, 11, 0.3)' },
  умеренно: { bg: 'rgba(59, 130, 246, 0.1)', text: '#2563EB', border: 'rgba(59, 130, 246, 0.3)' },
  хорошо: { bg: 'rgba(34, 197, 94, 0.1)', text: '#16A34A', border: 'rgba(34, 197, 94, 0.3)' },
  отлично: { bg: 'rgba(34, 197, 94, 0.1)', text: '#16A34A', border: 'rgba(34, 197, 94, 0.3)' },
};

export function SkinIssuesCarousel({ issues }: SkinIssuesCarouselProps) {
  // Сортируем проблемы: сначала критичные, потом плохо, умеренно, хорошо, отлично
  const sortedIssues = [...issues].sort((a, b) => {
    const order: Record<string, number> = {
      'критично': 0,
      'плохо': 1,
      'умеренно': 2,
      'хорошо': 3,
      'отлично': 4,
    };
    return (order[a.severity_label] || 5) - (order[b.severity_label] || 5);
  });

  if (sortedIssues.length === 0) {
    return null;
  }

  return (
    <div style={{
      marginBottom: '32px',
    }}>
      <h2 style={{
        fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: 700,
        fontSize: '24px',
        color: '#0A5F59',
        marginBottom: '16px',
      }}>
        Ключевые проблемы кожи
      </h2>

      <div style={{
        display: 'flex',
        gap: '16px',
        overflowX: 'auto',
        padding: '8px 0',
        scrollbarWidth: 'thin',
        WebkitOverflowScrolling: 'touch',
        msOverflowStyle: '-ms-autohiding-scrollbar',
        scrollSnapType: 'x mandatory',
      }}>
        {sortedIssues.map((issue) => {
          const severityStyle = severityColors[issue.severity_label] || severityColors['хорошо'];
          
          return (
            <div
              key={issue.id}
              style={{
                minWidth: '280px',
                maxWidth: '320px',
                backgroundColor: 'rgba(255, 255, 255, 0.58)',
                backdropFilter: 'blur(26px)',
                border: `1px solid ${severityStyle.border}`,
                borderRadius: '20px',
                padding: '20px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                scrollSnapAlign: 'start',
                flexShrink: 0,
              }}
            >
              {/* Иконка/изображение проблемы */}
              {issue.image_url ? (
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  overflow: 'hidden',
                  backgroundColor: severityStyle.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <img
                    src={issue.image_url}
                    alt={issue.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </div>
              ) : (
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  backgroundColor: severityStyle.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg
                    viewBox="0 0 24 24"
                    width="32"
                    height="32"
                    fill="none"
                    stroke={severityStyle.text}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
              )}

              {/* Название проблемы */}
              <h3 style={{
                fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 700,
                fontSize: '18px',
                color: '#0A5F59',
                marginBottom: '8px',
              }}>
                {issue.name}
              </h3>

              {/* Индикатор выраженности */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
              }}>
                <span style={{
                  fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontSize: '12px',
                  color: severityStyle.text,
                  backgroundColor: severityStyle.bg,
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}>
                  {issue.severity_label}
                </span>
                <div style={{
                  flex: 1,
                  height: '4px',
                  backgroundColor: 'rgba(10, 95, 89, 0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${issue.severity_score}%`,
                    height: '100%',
                    backgroundColor: severityStyle.text,
                    borderRadius: '2px',
                  }} />
                </div>
              </div>

              {/* Описание */}
              <p style={{
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontSize: '14px',
                color: '#475467',
                lineHeight: '1.5',
                marginBottom: '12px',
              }}>
                {issue.description}
              </p>

              {/* Теги */}
              {issue.tags.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}>
                  {issue.tags.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      style={{
                        fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                        fontSize: '11px',
                        color: '#0A5F59',
                        backgroundColor: 'rgba(10, 95, 89, 0.08)',
                        padding: '4px 8px',
                        borderRadius: '8px',
                        fontWeight: 500,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

