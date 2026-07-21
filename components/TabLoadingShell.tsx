'use client';

interface TabLoadingShellProps {
  title?: string;
  background?: string;
  className?: string;
  variant?: 'default' | 'cart-list';
}

export function TabLoadingShell({
  title,
  background = 'var(--canvas)',
  className,
  variant = 'default',
}: TabLoadingShellProps) {
  const showCartList = variant === 'cart-list';

  return (
    <div
      className={className}
      style={{
        minHeight: '100svh',
        background,
        padding: '8px 20px var(--bottom-nav-clearance)',
        boxSizing: 'border-box',
        fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 0 14px',
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: '18px',
            fontWeight: 500,
            letterSpacing: '0',
            color: 'var(--ink)',
            textTransform: 'lowercase',
          }}
        >
          skiniq
        </div>
      </div>

      {title && (
        <h1
          style={{
            margin: '6px 2px 18px',
            fontFamily: "var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: '26px',
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.6px',
            color: 'var(--ink)',
          }}
        >
          {title}
        </h1>
      )}

      {showCartList && (
        <>
          <style>{`
            @keyframes tabShellPulse {
              0%, 100% { opacity: 0.56; }
              50% { opacity: 1; }
            }
          `}</style>
          <div
            aria-hidden="true"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '2px',
            }}
          >
            {[0, 1].map((item) => (
              <div
                key={item}
                style={{
                  height: '154px',
                  borderRadius: '28px',
                  border: '1px solid var(--glass-border)',
                  background: '#fff',
                  boxShadow: 'var(--glass-shadow-lg)',
                  padding: '16px',
                  boxSizing: 'border-box',
                  animation: 'tabShellPulse 1.35s ease-in-out infinite',
                }}
              >
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '82px',
                      height: '82px',
                      borderRadius: '20px',
                      background: 'linear-gradient(135deg, rgba(10,10,10,0.06), rgba(213,254,97,0.34))',
                      flex: '0 0 auto',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ width: '36%', height: '10px', borderRadius: '999px', background: 'rgba(10,10,10,0.08)', marginBottom: '10px' }} />
                    <div style={{ width: '88%', height: '18px', borderRadius: '999px', background: 'rgba(10,10,10,0.1)', marginBottom: '8px' }} />
                    <div style={{ width: '64%', height: '18px', borderRadius: '999px', background: 'rgba(10,10,10,0.08)' }} />
                  </div>
                </div>
                <div
                  style={{
                    height: '44px',
                    borderRadius: '999px',
                    background: 'rgba(10,10,10,0.08)',
                    marginTop: '12px',
                  }}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
