// Выбор варианта инфо-экрана анкеты под цели пользователя.
// Экран ai_comparison меняет текст в зависимости от цели ухода, а mirror-фото
// остаётся общим. Промахи здесь тихие: пользователь просто увидит менее точный
// текст, ошибок в логах не будет.

import { describe, it, expect } from 'vitest';
import {
  pickScreenVariant,
  AI_COMPARISON_FALLBACK,
  AI_COMPARISON_MIRROR_IMAGE,
  type QuizScreenVariant,
} from '@/lib/quiz/screen-variants';

const variant = (focusKey: string, priority: number): QuizScreenVariant => ({
  focusKey,
  priority,
  imageUrl: `/${focusKey}.jpg`,
  eyebrow: focusKey,
  quote: focusKey,
  bodyTitle: focusKey,
  bodyText: focusKey,
});

const VARIANTS = [
  variant('acne', 100),
  variant('pores', 80),
  variant('dehydration', 60),
  variant('default', 0),
];

describe('pickScreenVariant', () => {
  it('матчит цель по человекочитаемому лейблу, а не по коду опции', () => {
    // В ответах анкеты лежат коды ("skin_goals_1"), поэтому вызывающий обязан
    // резолвить их в лейблы — иначе сюда придёт мусор и всё уедет в default.
    expect(pickScreenVariant(VARIANTS, ['Избавиться от акне и высыпаний']).focusKey).toBe('acne');
    expect(pickScreenVariant(VARIANTS, ['Сделать поры менее заметными']).focusKey).toBe('pores');
  });

  it('при нескольких целях берёт вариант с большим priority, а не первый в списке', () => {
    const picked = pickScreenVariant(VARIANTS, [
      'Увлажнить кожу, убрать сухость',
      'Избавиться от акне и высыпаний',
    ]);
    expect(picked.focusKey).toBe('acne');
  });

  it('падает на default, если цель не распознана', () => {
    expect(pickScreenVariant(VARIANTS, ['что-то невнятное']).focusKey).toBe('default');
    expect(pickScreenVariant(VARIANTS, []).focusKey).toBe('default');
  });

  it('падает на default, если под распознанную цель нет своей строки', () => {
    // Цель понята (pigmentation), но контент под неё в БД не залит.
    expect(pickScreenVariant(VARIANTS, ['Выровнять тон, убрать пигментацию']).focusKey).toBe(
      'default'
    );
  });

  it('отдаёт вшитый фолбэк, если БД пуста или недоступна', () => {
    expect(pickScreenVariant([], ['Избавиться от акне и высыпаний'])).toBe(AI_COMPARISON_FALLBACK);
    expect(AI_COMPARISON_FALLBACK.imageUrl).toBe(AI_COMPARISON_MIRROR_IMAGE);
  });

  it('отдаёт вшитый фолбэк, если строки default в БД нет', () => {
    const withoutDefault = [variant('acne', 100)];
    expect(pickScreenVariant(withoutDefault, ['морщины'])).toBe(AI_COMPARISON_FALLBACK);
  });
});
