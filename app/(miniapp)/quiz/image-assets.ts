export const GOAL_IMAGE_URLS = [
  '/wrinkles6.webp',
  '/acne6.webp',
  '/pores6.webp',
  '/puff6.webp',
  '/pigmentation6.webp',
  '/tone6.webp',
] as const;

export const SKIN_TYPE_IMAGE_URLS = [
  '/dry.webp',
  '/dry (combi).webp',
  '/normal.webp',
  '/oily (combi).webp',
  '/oily.webp',
] as const;

export const QUIZ_INFO_BACKGROUND_IMAGE_URLS = [
  '/back1.jpg',
  '/back2.jpg',
  '/back3.jpg',
  '/back4.jpg',
  '/back5.jpg',
  '/back6.jpg',
  '/back7.jpg',
  '/back8.jpg',
  '/back9.jpg',
] as const;

// Явная раскладка текстур по инфо-экранам в порядке их показа в анкете:
// personal_analysis → skin_preview → simple_care → health_trust → ai_comparison → want_improve.
// Это заменяет прежний хеш по ключу, который давал коллизии (два экрана получали одну текстуру).
//
// Подбор по контенту и читаемости:
// - back5–9 — полнокадровые абстрактные текстуры (пенка/крем/глина), идеальны под текст поверх.
//   Используем их преимущественно. back1–4 — предметка с центральным объектом, под фон хуже;
//   из них берём только back3 (мазок крема, почти текстура, много белого) на остаточный экран.
// - Заголовки сидят на фоне тёмным var(--ink) без подложки, поэтому светлые текстуры идут на
//   экраны с «голым» фоном, а единственная серая back7 — на skin_preview, где есть светлый
//   скрим (rgba(244,242,238,0.45→0.65)), который её осветляет и держит контраст текста.
const QUIZ_INFO_BACKGROUND_BY_KEY: Record<string, (typeof QUIZ_INFO_BACKGROUND_IMAGE_URLS)[number]> = {
  personal_analysis: '/back8.jpg', // айвори-волны — премиальный флагман «персональный анализ»
  skin_preview: '/back7.jpg',      // серая глина — под светлым скримом; «диагностика/профиль»
  simple_care: '/back9.jpg',       // чистые мазки — минимализм «просто и понятно»
  health_trust: '/back6.jpg',      // мягкие кремовые завитки — «забота о здоровье»
  ai_comparison: '/back5.jpg',     // пенка — свежесть/динамика «быстро и точно»
  want_improve: '/back3.jpg',      // остаточный из back1–4: самый текстурный, много белого
};

export function getQuizInfoBackgroundImage(key: string): string {
  const explicit = QUIZ_INFO_BACKGROUND_BY_KEY[key];
  if (explicit) return explicit;

  // Фолбэк для незнакомых ключей — детерминированный хеш по строке.
  const hash = Array.from(key).reduce((acc, char) => {
    const next = acc ^ char.charCodeAt(0);
    return Math.imul(next, 16777619) >>> 0;
  }, 2166136261);

  return QUIZ_INFO_BACKGROUND_IMAGE_URLS[hash % QUIZ_INFO_BACKGROUND_IMAGE_URLS.length];
}

export const QUIZ_INFO_IMAGE_URLS = [
  '/onboarding/welcome.jpg',
  '/onboarding/how-it-works.webp',
  ...QUIZ_INFO_BACKGROUND_IMAGE_URLS,
] as const;

export const QUIZ_TESTIMONIAL_IMAGE_URLS = [
  '/отзыв1до.webp',
  '/отзыв1после.webp',
  '/отзыв4до.webp',
  '/отзыв4после.webp',
] as const;

export const ALL_QUIZ_IMAGE_URLS = Array.from(new Set([
  ...QUIZ_INFO_IMAGE_URLS,
  ...GOAL_IMAGE_URLS,
  ...SKIN_TYPE_IMAGE_URLS,
  ...QUIZ_TESTIMONIAL_IMAGE_URLS,
])) as readonly string[];

const preloadedQuizImages = new Set<string>();

export function preloadQuizImages(urls: readonly string[] = ALL_QUIZ_IMAGE_URLS): void {
  if (typeof window === 'undefined') return;

  urls.forEach((src, index) => {
    if (preloadedQuizImages.has(src)) return;
    preloadedQuizImages.add(src);

    const image = new window.Image();
    image.decoding = 'async';
    if (index < 6) {
      (image as any).fetchPriority = 'high';
    }
    image.src = src;
  });
}
