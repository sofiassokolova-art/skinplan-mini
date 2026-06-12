// lib/legal/consent.ts
// Версионирование юридических документов и типы согласий (152-ФЗ).
// Версию поднимаем при существенном изменении текста соглашения/политики —
// тогда у пользователя повторно запрашивается согласие.

export const LEGAL_DOCUMENT_VERSION = '2026-06-12';

export const CONSENT_TYPES = {
  /** Обработка персональных данных (общая). */
  PD_PROCESSING: 'pd_processing',
  /** Обработка специальной категории — данные о здоровье (ст. 10 152-ФЗ). */
  HEALTH_DATA: 'health_data',
} as const;

export type ConsentType = (typeof CONSENT_TYPES)[keyof typeof CONSENT_TYPES];

/** Полный набор согласий, обязательный для прохождения анкеты. */
export const REQUIRED_CONSENTS: ConsentType[] = [CONSENT_TYPES.PD_PROCESSING, CONSENT_TYPES.HEALTH_DATA];
