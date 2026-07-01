// tests/medical-contraindications.test.ts
// Проверяем сквозной маршрут «ответ на медицинский вопрос → contraindications →
// блокировка степов в canApplyStep». Без этих гарантий пользователь на изотретиноине
// мог получить рекомендацию с ретинолом — это медицинская дыра, которую закрывает
// этот файл и связанные правки в:
//   - lib/skinprofile-rules-engine.ts (codeToKeyMap: prescription_topical/oral_medications)
//   - lib/skinprofile-rules.json (canonical no_retinol / no_strong_acids на медикаментах)

import { describe, it, expect } from 'vitest';
import { buildSkinProfileFromAnswers } from '@/lib/skinprofile-rules-engine';
import { canApplyStep } from '@/lib/step-category-rules';
import { createEmptySkinProfile, type SkinProfile } from '@/lib/skinprofile-types';

// Лейблы должны побайтово совпадать с опциями в lib/skinprofile-rules.json и
// scripts/seed-questionnaire-v2.ts — иначе rules engine не найдёт option.
const LABELS = {
  isotretinoin: 'Изотретиноин (Аккутан, Роаккутан и аналоги)',
  oralAntibiotics: 'Антибиотики (Доксициклин, Миноциклин, Эритромицин и др.)',
  spironolactone: 'Спиронолактон / антиандрогенная терапия',
  hormonal: 'Оральные контрацептивы или другая гормональная терапия',
  thyroid: 'Тиреоидные препараты (L-тироксин, Эутирокс и аналоги)',
  legacyHormonal: 'Гормональные препараты (Спиронолактон, оральные контрацептивы)',
  topicalRetinoids: 'Ретиноиды наружные (Адапален — Дифферин, Адаклин; Изотретиноин — Изотрекс)',
  benzoylPeroxide: 'Бензоилпероксид (Базирон АС, Эффезел)',
  corticosteroids: 'Кортикостероидные кремы/мази (Гидрокортизон, Адвантан, Локоид)',
  azelaic: 'Азелаиновая кислота (Skinoren, Азелик, Finacea)',
  rosacea: 'Розацеа',
  strongSensitivity: 'Сильное и стойкое покраснение, возможны диагнозы (розацеа, дерматит)',
} as const;

function answer(
  questionCode: 'prescription_topical' | 'oral_medications' | 'medical_diagnoses' | 'skin_sensitivity',
  labels: string[]
) {
  // questionId не критичен — rules engine падает обратно на codeToKeyMap[questionCode].
  // 22 = topical_rx, 23 = oral_meds; даём -1, чтобы доказать что lookup идёт по коду.
  return {
    questionId: -1,
    questionCode,
    answerValue: null,
    answerValues: labels,
    answerOptionLabels: labels,
  };
}

function profileWithContras(contraindications: string[], overrides: Partial<SkinProfile> = {}): SkinProfile {
  return {
    ...createEmptySkinProfile(),
    skinType: 'normal',
    sensitivity: 'low',
    ...overrides,
    contraindications,
  };
}

describe('medical contraindications: questionnaire → SkinProfile', () => {
  it('маппит questionCode medical_diagnoses → правило diagnoses', () => {
    const profile = buildSkinProfileFromAnswers([
      answer('medical_diagnoses', [LABELS.rosacea]),
    ]);

    expect(profile.diagnoses).toContain('rosacea');
    expect(profile.sensitivity).toBe('high');
  });

  it('маппит questionCode skin_sensitivity → sensitivity high', () => {
    const profile = buildSkinProfileFromAnswers([
      answer('skin_sensitivity', [LABELS.strongSensitivity]),
    ]);

    expect(profile.sensitivity).toBe('high');
  });

  it('маппит questionCode prescription_topical → правило topical_rx (codeToKeyMap)', () => {
    // Если codeToKeyMap не содержит prescription_topical, contraindications останутся пустыми
    // и тест упадёт — это регрессия, которую мы и хотим поймать.
    const profile = buildSkinProfileFromAnswers([
      answer('prescription_topical', [LABELS.topicalRetinoids]),
    ]);

    expect(profile.currentTopicals).toContain('topical_retinoids');
    expect(profile.contraindications).toContain('no_retinol');
  });

  it('маппит questionCode oral_medications → правило oral_meds (codeToKeyMap)', () => {
    const profile = buildSkinProfileFromAnswers([
      answer('oral_medications', [LABELS.isotretinoin]),
    ]);

    expect(profile.currentOralMeds).toContain('isotretinoin');
  });

  it('изотретиноин добавляет канонические no_retinol и no_strong_acids', () => {
    // Это ядро задачи: пациент на изотретиноине не должен получить ретинол/кислоты.
    const profile = buildSkinProfileFromAnswers([
      answer('oral_medications', [LABELS.isotretinoin]),
    ]);

    expect(profile.contraindications).toContain('no_retinol');
    expect(profile.contraindications).toContain('no_strong_acids');
    // Семантические псевдонимы оставлены для аналитики/UI — тоже проверяем.
    expect(profile.contraindications).toContain('no_additional_retinoids');
    expect(profile.contraindications).toContain('no_aggressive_acids');
  });

  it('наружные ретиноиды блокируют дополнительный ретинол (без дублирования)', () => {
    const profile = buildSkinProfileFromAnswers([
      answer('prescription_topical', [LABELS.topicalRetinoids]),
    ]);

    expect(profile.contraindications).toContain('no_retinol');
    expect(profile.currentTopicals).toContain('topical_retinoids');
  });

  it('бензоилпероксид несовместим с ретинолом → блокирует no_retinol', () => {
    const profile = buildSkinProfileFromAnswers([
      answer('prescription_topical', [LABELS.benzoylPeroxide]),
    ]);

    expect(profile.contraindications).toContain('no_retinol');
    expect(profile.currentTopicals).toContain('benzoyl_peroxide');
  });

  it('кортикостероиды → no_strong_acids (мягкий уход, истончённый барьер)', () => {
    const profile = buildSkinProfileFromAnswers([
      answer('prescription_topical', [LABELS.corticosteroids]),
    ]);

    expect(profile.contraindications).toContain('no_strong_acids');
    expect(profile.contraindications).toContain('no_aggressive_acids');
    expect(profile.currentTopicals).toContain('topical_steroids');
  });

  it('пероральные антибиотики попадают в currentOralMeds (для photosensitivity-флага в API)', () => {
    const profile = buildSkinProfileFromAnswers([
      answer('oral_medications', [LABELS.oralAntibiotics]),
    ]);

    expect(profile.currentOralMeds).toContain('oral_antibiotics');
    // Антибиотики не добавляют contraindications — фотозащита поднимается через
    // отдельный photosensitivity-флаг в medicalMarkers (см. app/api/questionnaire/answers/route.ts).
    expect(profile.contraindications).not.toContain('no_retinol');
  });

  it('спиронолактон хранится как antiandrogen/spironolactone, а не как hormonal', () => {
    const profile = buildSkinProfileFromAnswers([
      answer('oral_medications', [LABELS.spironolactone]),
    ]);

    expect(profile.currentOralMeds).toContain('spironolactone');
    expect(profile.currentOralMeds).not.toContain('hormonal');
  });

  it('тиреоидные препараты сохраняются отдельным флагом', () => {
    const profile = buildSkinProfileFromAnswers([
      answer('oral_medications', [LABELS.thyroid]),
    ]);

    expect(profile.currentOralMeds).toContain('thyroid_hormone');
    expect(profile.contraindications).toHaveLength(0);
  });

  it('азелаиновая кислота не добавляет contraindications (безопасна как первая линия)', () => {
    const profile = buildSkinProfileFromAnswers([
      answer('prescription_topical', [LABELS.azelaic]),
    ]);

    expect(profile.currentTopicals).toContain('azelaic_acid');
    expect(profile.contraindications).toHaveLength(0);
  });

  it('мультивыбор аккумулирует contraindications без дублей', () => {
    const profile = buildSkinProfileFromAnswers([
      answer('prescription_topical', [LABELS.topicalRetinoids, LABELS.benzoylPeroxide]),
      answer('oral_medications', [LABELS.isotretinoin]),
    ]);

    // Все три источника пытались добавить no_retinol — он должен быть, но один (engine ставит addToArray с проверкой).
    const noRetinolCount = profile.contraindications.filter(c => c === 'no_retinol').length;
    expect(noRetinolCount).toBe(1);
    expect(profile.contraindications).toContain('no_strong_acids');
    expect(profile.currentTopicals).toEqual(expect.arrayContaining(['topical_retinoids', 'benzoyl_peroxide']));
    expect(profile.currentOralMeds).toContain('isotretinoin');
  });

  it('«Нет, не применяю/не принимал(а)» не добавляет ни currentTopicals, ни contraindications', () => {
    const topical = buildSkinProfileFromAnswers([
      answer('prescription_topical', ['Нет, не применяю']),
    ]);
    expect(topical.currentTopicals).toHaveLength(0);
    expect(topical.contraindications).toHaveLength(0);

    const oral = buildSkinProfileFromAnswers([
      answer('oral_medications', ['Нет, не принимал(а)']),
    ]);
    expect(oral.currentOralMeds).toHaveLength(0);
    expect(oral.contraindications).toHaveLength(0);
  });
});

describe('integration: contraindications → canApplyStep блокирует степы', () => {
  it('изотретиноин блокирует treatment_antiage (ретинол)', () => {
    const profile = buildSkinProfileFromAnswers([
      answer('oral_medications', [LABELS.isotretinoin]),
    ]);
    const stepProfile = profileWithContras(profile.contraindications);

    const result = canApplyStep('treatment_antiage', stepProfile);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/contraindications|no_retinol/i);
  });

  it('изотретиноин блокирует кислотные степы (mask_acid, toner_acid, treatment_acid и пр.)', () => {
    const profile = buildSkinProfileFromAnswers([
      answer('oral_medications', [LABELS.isotretinoin]),
    ]);
    const stepProfile = profileWithContras(profile.contraindications);

    for (const step of ['mask_acid', 'toner_acid', 'treatment_acid', 'serum_exfoliant', 'mask_peel'] as const) {
      const result = canApplyStep(step, stepProfile);
      expect(result.allowed, `expected ${step} blocked under isotretinoin`).toBe(false);
    }
  });

  it('наружные ретиноиды блокируют treatment_antiage (не дублируем ретинол)', () => {
    const profile = buildSkinProfileFromAnswers([
      answer('prescription_topical', [LABELS.topicalRetinoids]),
    ]);
    const stepProfile = profileWithContras(profile.contraindications);

    const result = canApplyStep('treatment_antiage', stepProfile);
    expect(result.allowed).toBe(false);
  });

  it('бензоилпероксид блокирует treatment_antiage (BPO+ретинол несовместимы)', () => {
    const profile = buildSkinProfileFromAnswers([
      answer('prescription_topical', [LABELS.benzoylPeroxide]),
    ]);
    const stepProfile = profileWithContras(profile.contraindications);

    const result = canApplyStep('treatment_antiage', stepProfile);
    expect(result.allowed).toBe(false);
  });

  it('кортикостероиды блокируют кислотные степы (истончённый барьер)', () => {
    const profile = buildSkinProfileFromAnswers([
      answer('prescription_topical', [LABELS.corticosteroids]),
    ]);
    const stepProfile = profileWithContras(profile.contraindications);

    const result = canApplyStep('mask_acid', stepProfile);
    expect(result.allowed).toBe(false);
  });

  it('пациент без медикаментов получает treatment_antiage без блокировки', () => {
    // Контроль: без медицинских противопоказаний степ должен быть разрешён по типу/чувствительности.
    const stepProfile: SkinProfile = {
      ...createEmptySkinProfile(),
      skinType: 'normal',
      sensitivity: 'low',
    };

    const result = canApplyStep('treatment_antiage', stepProfile);
    expect(result.allowed).toBe(true);
  });
});
