// components/UserProfileCard.tsx
// Карточка профиля пользователя с полом, возрастом, типом кожи и ключевыми проблемами

'use client';

interface UserProfileCardProps {
  gender?: string | null;
  age?: number | null;
  skinType: string;
  skinTypeRu: string;
  keyProblems: string[];
}

export function UserProfileCard({
  gender,
  age,
  skinType,
  skinTypeRu,
  keyProblems,
}: UserProfileCardProps) {
  return (
    <div style={{
      backgroundColor: 'rgba(255, 255, 255, 0.58)',
      backdropFilter: 'blur(26px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '24px',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
    }}>
      <h3 style={{
        fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: 700,
        fontSize: '20px',
        color: '#0A5F59',
        marginBottom: '16px',
      }}>
        Ваш профиль
      </h3>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {/* Пол и возраст */}
        {(gender || age) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: '14px',
              color: '#475467',
              fontWeight: 500,
            }}>
              {gender && (
                <span style={{ textTransform: 'capitalize' }}>
                  {gender === 'male' ? 'Мужчина' : gender === 'female' ? 'Женщина' : gender}
                </span>
              )}
              {gender && age && ' • '}
              {age && `${age} лет`}
            </span>
          </div>
        )}

        {/* Тип кожи */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: '14px',
            color: '#475467',
            fontWeight: 500,
          }}>
            Тип кожи:
          </span>
          <span style={{
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: '14px',
            color: '#0A5F59',
            fontWeight: 600,
          }}>
            {skinTypeRu}
          </span>
        </div>

        {/* Ключевые проблемы */}
        {keyProblems.length > 0 && (
          <div>
            <span style={{
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: '14px',
              color: '#475467',
              fontWeight: 500,
              display: 'block',
              marginBottom: '8px',
            }}>
              Ключевые проблемы:
            </span>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              {keyProblems.map((problem, index) => (
                <span
                  key={index}
                  style={{
                    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                    fontSize: '12px',
                    color: '#0A5F59',
                    backgroundColor: 'rgba(10, 95, 89, 0.1)',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    fontWeight: 500,
                  }}
                >
                  {problem}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

