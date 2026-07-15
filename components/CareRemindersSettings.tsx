// components/CareRemindersSettings.tsx
// Настройки напоминаний об уходе (утро/вечер) — секция в профиле.
// Хранение: UserPreferences.extra.careReminders (см. /api/cron/care-reminders).

'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import {
  DEFAULT_CARE_REMINDERS,
  type CareReminderSettings,
  parseCareReminderSettings,
  withCareReminderSettings,
} from '@/lib/care-reminders';

const MORNING_HOURS = [6, 7, 8, 9, 10, 11, 12];
const EVENING_HOURS = [18, 19, 20, 21, 22, 23];

export function CareRemindersSettings() {
  const [settings, setSettings] = useState<CareReminderSettings | null>(null);
  const [saving, setSaving] = useState(false);
  // extra целиком: POST заменяет весь объект, нельзя затирать чужие ключи
  const extraRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    let cancelled = false;
    api.getUserPreferences()
      .then((prefs: any) => {
        if (cancelled) return;
        extraRef.current = (prefs?.extra && typeof prefs.extra === 'object') ? prefs.extra : {};
        setSettings(parseCareReminderSettings(prefs?.extra));
      })
      .catch(() => {
        if (!cancelled) setSettings(DEFAULT_CARE_REMINDERS);
      });
    return () => { cancelled = true; };
  }, []);

  const save = async (next: CareReminderSettings) => {
    setSettings(next);
    setSaving(true);
    try {
      const extra = withCareReminderSettings(extraRef.current, next, 'profile');
      await api.updateUserPreferences({ extra });
      extraRef.current = extra;
    } catch {
      // молча: настройка не критичная, при следующем изменении попробуем ещё раз
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return null;

  return (
    <div className="crs">
      <div className="crs-head">
        <span className="crs-ic" aria-hidden>
          <svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0" /></svg>
        </span>
        <span className="crs-titles">
          <span className="crs-title">Напоминания об уходе</span>
          <span className="crs-sub">Бот напомнит про утренний и вечерний уход. Время московское.</span>
        </span>
      </div>

      <div className="crs-row crs-master">
        <span className="crs-label">Напоминать в боте</span>
        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          aria-label="Напоминать в боте"
          className={`crs-switch${settings.enabled ? ' on' : ''}`}
          disabled={saving}
          onClick={() => save({ ...settings, enabled: !settings.enabled })}
        >
          <span className="crs-knob" />
        </button>
      </div>

      {settings.enabled && (
        <>
          <div className="crs-row">
            <span className="crs-label">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
              Утро
            </span>
            <select
              className="crs-select"
              value={settings.morning === null ? 'off' : String(settings.morning)}
              disabled={saving}
              onChange={(e) =>
                save({ ...settings, morning: e.target.value === 'off' ? null : Number(e.target.value) })
              }
            >
              {MORNING_HOURS.map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
              <option value="off">Не напоминать</option>
            </select>
          </div>
          <div className="crs-row">
            <span className="crs-label">
              <svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg>
              Вечер
            </span>
            <select
              className="crs-select"
              value={settings.evening === null ? 'off' : String(settings.evening)}
              disabled={saving}
              onChange={(e) =>
                save({ ...settings, evening: e.target.value === 'off' ? null : Number(e.target.value) })
              }
            >
              {EVENING_HOURS.map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
              <option value="off">Не напоминать</option>
            </select>
          </div>
        </>
      )}

      <style jsx>{`
        .crs {
          border: 1px solid var(--glass-border);
          background: var(--glass-bg);
          border-radius: 20px;
          box-shadow: var(--glass-shadow);
          padding: 16px 18px 6px;
        }
        .crs-head { display: flex; align-items: flex-start; gap: 14px; padding: 2px 0 6px; }
        .crs-ic {
          width: 38px; height: 38px; flex-shrink: 0; border-radius: 12px;
          background: rgba(var(--accent-rgb), 0.3); display: grid; place-items: center; color: var(--ink);
        }
        .crs-ic svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .crs-titles { flex: 1; min-width: 0; }
        .crs-title { display: block; font-size: 14.5px; font-weight: 600; letter-spacing: -0.01em; color: var(--ink); }
        .crs-sub { display: block; margin-top: 3px; font-size: 12px; line-height: 1.35; color: var(--ink-soft); }
        .crs-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 0; border-top: 1px solid rgba(10,10,10,0.06); }
        .crs-master { margin-top: 8px; }
        .crs-label { display: flex; align-items: center; gap: 9px; font-size: 14px; font-weight: 600; color: var(--ink); }
        .crs-label svg { width: 16px; height: 16px; fill: none; stroke: var(--ink-soft); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
        .crs-select {
          font-family: inherit; font-size: 14px; font-weight: 600; padding: 8px 12px;
          border-radius: 12px; border: 1px solid var(--glass-border); background: #fff; color: var(--ink); cursor: pointer;
        }
        .crs-select:disabled { opacity: 0.6; }
        .crs-switch {
          position: relative; width: 44px; height: 26px; flex-shrink: 0;
          border: 0; border-radius: 999px; background: rgba(10,10,10,0.15);
          cursor: pointer; padding: 0; transition: background 0.18s ease;
        }
        .crs-switch.on { background: var(--accent-deep, #C2F03C); }
        .crs-switch:disabled { opacity: 0.6; cursor: default; }
        .crs-knob {
          position: absolute; top: 3px; left: 3px; width: 20px; height: 20px;
          border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 0.18s ease;
        }
        .crs-switch.on .crs-knob { transform: translateX(18px); }
      `}</style>
    </div>
  );
}
