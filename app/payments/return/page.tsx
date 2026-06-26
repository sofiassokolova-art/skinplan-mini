// app/payments/return/page.tsx
// Страница возврата после оплаты (редирект с ЮKassa в браузере).
// Показываем «Вернитесь в приложение» и ссылку на бота.
//
// ВАЖНО: это СЕРВЕРНЫЙ компонент без 'use client'. Пост-оплатный экран должен
// рендериться прямо в HTML и не зависеть от загрузки JS-чанков — иначе на рваном
// РФ+VPN-канале (особенно во внешнем браузере после редиректа ЮKassa) чанк не
// доезжает, React не монтируется, и платящий юзер видит ошибку вместо «оплата прошла».

// ВАЖНО: фолбэк = РЕАЛЬНЫЙ бот мини-аппа (@skiniq_app_bot). Раньше тут стоял
// несуществующий `skiniq_bot` — если NEXT_PUBLIC_TELEGRAM_BOT_USERNAME не задан
// в окружении, платящего юзера после оплаты выкидывало в чужой/левый бот.
const BOT_LINK = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
  ? `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME.replace(/^@/, '')}`
  : 'https://t.me/skiniq_app_bot';

export default async function PaymentsReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const params = await searchParams;
  const success = params?.success === '1';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 400,
          textAlign: 'center',
          background: 'white',
          borderRadius: 24,
          padding: 32,
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        }}
      >
        {success ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#0A5F59',
                marginBottom: 12,
              }}
            >
              Оплата прошла
            </h1>
            <p
              style={{
                fontSize: 16,
                color: '#475467',
                marginBottom: 24,
                lineHeight: 1.5,
              }}
            >
              Вернитесь в приложение в Telegram, чтобы посмотреть свой план ухода.
            </p>
            <a
              href={BOT_LINK}
              style={{
                display: 'inline-block',
                padding: '14px 28px',
                background: '#0A5F59',
                color: 'white',
                borderRadius: 12,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              Открыть в Telegram
            </a>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📱</div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#0A5F59',
                marginBottom: 12,
              }}
            >
              Вернуться в приложение
            </h1>
            <p
              style={{
                fontSize: 16,
                color: '#475467',
                marginBottom: 24,
                lineHeight: 1.5,
              }}
            >
              Откройте приложение skiniq в Telegram, чтобы продолжить.
            </p>
            <a
              href={BOT_LINK}
              style={{
                display: 'inline-block',
                padding: '14px 28px',
                background: '#0A5F59',
                color: 'white',
                borderRadius: 12,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              Открыть в Telegram
            </a>
          </>
        )}
      </div>
    </div>
  );
}
