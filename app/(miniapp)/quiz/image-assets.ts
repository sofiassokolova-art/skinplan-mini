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
] as const;

export function getQuizInfoBackgroundImage(key: string): string {
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
