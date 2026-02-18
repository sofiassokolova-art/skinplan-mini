// lib/quiz/styles/quizStyles.ts
// Общие стили для анкеты
// Уменьшает дублирование инлайн-стилей

export const quizColors = {
  primary: '#0A5F59',
  primaryLight: 'rgba(10, 95, 89, 0.1)',
  primaryBorder: 'rgba(10, 95, 89, 0.2)',
  primaryBorderLight: 'rgba(10, 95, 89, 0.3)',
  secondary: '#D5FE61',
  text: '#000000',
  textSecondary: '#475467',
  textTertiary: '#6B7280',
  textMuted: '#9D9D9D',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  errorBorder: '#FCA5A5',
  errorText: '#991B1B',
  background: '#FFFFFF',
  backgroundGradient: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
  backgroundOverlay: 'rgba(255, 255, 255, 0.56)',
  backgroundOverlayDark: 'rgba(255, 255, 255, 0.9)',
  backgroundOverlayLight: 'rgba(255, 255, 255, 0.8)',
  backgroundCard: 'rgba(255, 255, 255, 0.58)',
  white: '#FFFFFF',
  gray: '#CCCCCC',
} as const;

export const quizFonts = {
  unbounded: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
  inter: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  system: '-apple-system, BlinkMacSystemFont, sans-serif',
} as const;

export const quizBorderRadius = {
  small: '8px',
  medium: '12px',
  large: '16px',
  xlarge: '20px',
  xxlarge: '24px',
  xxxlarge: '32px',
  round: '50%',
} as const;

export const quizSpacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  xxxl: '32px',
  xxxxl: '40px',
  xxxxxl: '48px',
} as const;

export const quizShadows = {
  small: '0 4px 12px rgba(0, 0, 0, 0.1)',
  medium: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
  large: '0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
  card: '0 8px 32px rgba(0, 0, 0, 0.1)',
} as const;

export const quizButtonStyles = {
  primary: {
    backgroundColor: quizColors.primary,
    color: quizColors.white,
    border: 'none',
    borderRadius: quizBorderRadius.large,
    fontFamily: quizFonts.inter,
    fontWeight: 600,
    fontSize: '16px',
    cursor: 'pointer',
    boxShadow: quizShadows.medium,
    transition: 'all 0.2s',
  },
  secondary: {
    backgroundColor: quizColors.secondary,
    color: quizColors.text,
    border: 'none',
    borderRadius: quizBorderRadius.xlarge,
    fontFamily: quizFonts.inter,
    fontWeight: 600,
    fontSize: 'clamp(14px, 4vw, 16px)',
    cursor: 'pointer',
    boxShadow: quizShadows.small,
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  outline: {
    backgroundColor: 'transparent',
    color: quizColors.primary,
    border: `1px solid ${quizColors.primary}`,
    borderRadius: quizBorderRadius.large,
    fontFamily: quizFonts.inter,
    fontWeight: 500,
    fontSize: '14px',
    cursor: 'pointer',
  },
  disabled: {
    backgroundColor: quizColors.gray,
    color: quizColors.text,
    cursor: 'not-allowed',
    opacity: 0.6,
  },
} as const;

export const quizContainerStyles = {
  page: {
    padding: '20px',
    minHeight: '100vh',
    background: quizColors.backgroundGradient,
    position: 'relative' as const,
  },
  card: {
    backgroundColor: quizColors.backgroundOverlay,
    backdropFilter: 'blur(28px)',
    borderRadius: quizBorderRadius.xxlarge,
    padding: quizSpacing.xxl,
    maxWidth: '600px',
    margin: '0 auto',
    boxShadow: quizShadows.large,
  },
  errorCard: {
    backgroundColor: quizColors.backgroundOverlayDark,
    borderRadius: quizBorderRadius.xxlarge,
    padding: quizSpacing.xxxl,
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center' as const,
    boxShadow: quizShadows.card,
  },
} as const;

export const quizTextStyles = {
  title: {
    fontFamily: quizFonts.unbounded,
    fontSize: '24px',
    fontWeight: 700,
    color: quizColors.primary,
    marginBottom: quizSpacing.xxl,
  },
  subtitle: {
    fontFamily: quizFonts.inter,
    fontSize: '16px',
    color: quizColors.textSecondary,
    lineHeight: '1.5',
  },
  body: {
    fontFamily: quizFonts.inter,
    fontSize: '16px',
    color: quizColors.text,
    lineHeight: '1.5',
  },
  small: {
    fontFamily: quizFonts.inter,
    fontSize: '14px',
    color: quizColors.textTertiary,
  },
} as const;

