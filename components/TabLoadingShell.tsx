'use client';

interface TabLoadingShellProps {
  title?: string;
  background?: string;
  className?: string;
}

export function TabLoadingShell({
  title,
  background = 'var(--canvas)',
  className,
}: TabLoadingShellProps) {
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
    </div>
  );
}
