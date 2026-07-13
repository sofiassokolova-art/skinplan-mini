// lib/care-reminders.ts
// Shared care-reminder settings helpers used by the profile UI, cron jobs and
// Telegram callback handlers.

export interface CareReminderSettings {
  enabled: boolean;
  /** Moscow-time hour, or null to skip this slot. */
  morning: number | null;
  evening: number | null;
}

export interface CareReminderOption {
  id: string;
  label: string;
  settings: CareReminderSettings;
}

export const DEFAULT_CARE_REMINDERS: CareReminderSettings = {
  enabled: true,
  morning: 8,
  evening: 21,
};

export const CARE_REMINDER_SETUP_PROMPT_TYPE = 'care_reminder_setup_prompt';
export const CARE_REMINDER_SETUP_CONFIRM_TYPE = 'care_reminder_setup_confirm';

const CALLBACK_PREFIX = 'care-reminders:';

export const CARE_REMINDER_OPTIONS: CareReminderOption[] = [
  {
    id: '8-21',
    label: '08:00 и 21:00',
    settings: { enabled: true, morning: 8, evening: 21 },
  },
  {
    id: '9-22',
    label: '09:00 и 22:00',
    settings: { enabled: true, morning: 9, evening: 22 },
  },
  {
    id: 'evening-21',
    label: 'Только вечер 21:00',
    settings: { enabled: true, morning: null, evening: 21 },
  },
  {
    id: 'off',
    label: 'Не напоминать',
    settings: { enabled: false, morning: null, evening: null },
  },
];

export function parseCareReminderSettings(extra: unknown): CareReminderSettings {
  const raw = (extra as any)?.careReminders;
  const parseHour = (value: unknown, fallback: number | null): number | null => {
    if (value === null || value === -1) return null;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23) return value;
    return fallback;
  };

  return {
    enabled: raw?.enabled !== false,
    morning: parseHour(raw?.morning, DEFAULT_CARE_REMINDERS.morning),
    evening: parseHour(raw?.evening, DEFAULT_CARE_REMINDERS.evening),
  };
}

export function careReminderCallbackData(optionId: string): string {
  return `${CALLBACK_PREFIX}${optionId}`;
}

export function parseCareReminderCallback(data: unknown): CareReminderOption | null {
  if (typeof data !== 'string' || !data.startsWith(CALLBACK_PREFIX)) return null;
  const optionId = data.slice(CALLBACK_PREFIX.length);
  return CARE_REMINDER_OPTIONS.find((option) => option.id === optionId) ?? null;
}

export function buildCareReminderSetupKeyboard() {
  return {
    inline_keyboard: [
      CARE_REMINDER_OPTIONS.slice(0, 2).map((option) => ({
        text: option.label,
        callback_data: careReminderCallbackData(option.id),
      })),
      CARE_REMINDER_OPTIONS.slice(2).map((option) => ({
        text: option.label,
        callback_data: careReminderCallbackData(option.id),
      })),
    ],
  };
}

export function buildCareReminderSetupText(firstName?: string | null): string {
  const name = (firstName || '').trim().replace(/[&<>]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  } as Record<string, string>)[char] || char);
  const greeting = name ? `${name}, выберите удобное время` : 'Выберите удобное время';
  return (
    `${greeting} для напоминаний об уходе.\n\n` +
    'Я буду присылать короткое сообщение утром и вечером, чтобы план было легче соблюдать. ' +
    'Время указано по Москве, его можно поменять в профиле.'
  );
}

export function formatCareReminderSettingsSummary(settings: CareReminderSettings): string {
  if (!settings.enabled || (settings.morning === null && settings.evening === null)) {
    return 'напоминания выключены';
  }

  const parts: string[] = [];
  if (settings.morning !== null) {
    parts.push(`утром в ${String(settings.morning).padStart(2, '0')}:00`);
  }
  if (settings.evening !== null) {
    parts.push(`вечером в ${String(settings.evening).padStart(2, '0')}:00`);
  }
  return parts.join(' и ');
}

export function withCareReminderSettings(
  extra: unknown,
  settings: CareReminderSettings,
  source: 'profile' | 'telegram',
  updatedAt = new Date(),
): Record<string, unknown> {
  const base =
    extra && typeof extra === 'object' && !Array.isArray(extra)
      ? { ...(extra as Record<string, unknown>) }
      : {};

  return {
    ...base,
    careReminders: {
      ...settings,
      setupSource: source,
      setupUpdatedAt: updatedAt.toISOString(),
    },
  };
}
