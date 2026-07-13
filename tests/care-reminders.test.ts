// tests/care-reminders.test.ts

import { describe, expect, it } from 'vitest';
import {
  CARE_REMINDER_OPTIONS,
  buildCareReminderSetupKeyboard,
  buildCareReminderSetupText,
  careReminderCallbackData,
  parseCareReminderCallback,
  parseCareReminderSettings,
  withCareReminderSettings,
} from '@/lib/care-reminders';

describe('care reminders helpers', () => {
  it('uses 08:00/21:00 defaults when settings are missing', () => {
    expect(parseCareReminderSettings(null)).toEqual({
      enabled: true,
      morning: 8,
      evening: 21,
    });
  });

  it('parses Telegram callback data into a predefined option', () => {
    const option = parseCareReminderCallback(careReminderCallbackData('9-22'));
    expect(option?.settings).toEqual({
      enabled: true,
      morning: 9,
      evening: 22,
    });
  });

  it('rejects unknown callback data', () => {
    expect(parseCareReminderCallback('other:9-22')).toBeNull();
    expect(parseCareReminderCallback(careReminderCallbackData('7-23'))).toBeNull();
  });

  it('builds Telegram keyboard with short callback payloads', () => {
    const keyboard = buildCareReminderSetupKeyboard();
    const payloads = keyboard.inline_keyboard.flat().map((button) => button.callback_data);

    expect(payloads).toHaveLength(CARE_REMINDER_OPTIONS.length);
    expect(payloads.every((payload) => payload.length <= 64)).toBe(true);
  });

  it('preserves existing extra keys when saving settings', () => {
    const extra = withCareReminderSettings(
      { favorite: 'serum' },
      { enabled: true, morning: null, evening: 21 },
      'telegram',
      new Date('2026-07-13T10:00:00.000Z'),
    );

    expect(extra.favorite).toBe('serum');
    expect(extra.careReminders).toEqual({
      enabled: true,
      morning: null,
      evening: 21,
      setupSource: 'telegram',
      setupUpdatedAt: '2026-07-13T10:00:00.000Z',
    });
  });

  it('escapes Telegram first name in HTML message text', () => {
    expect(buildCareReminderSetupText('A <B>')).toContain('A &lt;B&gt;');
  });
});
