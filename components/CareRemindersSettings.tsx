// components/CareRemindersSettings.tsx
// Настройки напоминаний об уходе (утро/вечер) — секция в профиле.
// Хранение: UserPreferences.extra.careReminders (см. /api/cron/care-reminders).

'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface ReminderSettings {
  enabled: boolean;
  /** Час МСК или null = не напоминать в этот слот */
  morning: number | null;
  evening: number | null;
}

const DEFAULTS: ReminderSettings = { enabled: true, morning: 8, evening: 21 };

const MORNING_HOURS = [6, 7, 8, 9, 10, 11, 12];
const EVENING_HOURS = [18, 19, 20, 21, 22, 23];

function parseSettings(extra: any): ReminderSettings {
  const raw = extra?.careReminders;
  const hour = (v: any, fallback: number | null): number | null => {
    if (v === null || v === -1) return null;
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 23) return v;
    return fallback;
  };
  return {
    enabled: raw?.enabled !== false,
    morning: hour(raw?.morning, DEFAULTS.morning),
    evening: hour(raw?.evening, DEFAULTS.evening),
  };
}

export function CareRemindersSettings() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [saving, setSaving] = useState(false);
  // extra целиком: POST заменяет весь объект, нельзя затирать чужие ключи
  const extraRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    let cancelled = false;
    api.getUserPreferences()
      .then((prefs: any) => {
        if (cancelled) return;
        extraRef.current = (prefs?.extra && typeof prefs.extra === 'object') ? prefs.extra : {};
        setSettings(parseSettings(prefs?.extra));
      })
      .catch(() => {
        if (!cancelled) setSettings(DEFAULTS);
      });
    return () => { cancelled = true; };
  }, []);

  const save = async (next: ReminderSettings) => {
    setSettings(next);
    setSaving(true);
    try {
      const extra = { ...extraRef.current, careReminders: next };
      await api.updateUserPreferences({ extra });
      extraRef.current = extra;
    } catch {
      // молча: настройка не критичная, при следующем изменении попробуем ещё раз
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return null;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
  };
  const labelStyle: React.CSSProperties = { fontSize: 14, color: 'var(--ink)' };
  const selectStyle: React.CSSProperties = {
    fontSize: 14,
    padding: '6px 10px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.12)',
    background: 'rgba(255,255,255,0.7)',
    color: 'var(--ink)',
  };

  return (
    <section className="glass-card-md">
      <h2 className="pf-card-title">Напоминания об уходе</h2>
      <p style={{ fontSize: 13, color: 'var(--ink-soft, #667085)', margin: '0 0 6px' }}>
        Бот напомнит про утренний и вечерний уход. Время московское.
      </p>

      <div style={rowStyle}>
        <span style={labelStyle}>Напоминать в боте</span>
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={saving}
          onChange={(e) => save({ ...settings, enabled: e.target.checked })}
          style={{ width: 20, height: 20, accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
      </div>

      {settings.enabled && (
        <>
          <div style={rowStyle}>
            <span style={labelStyle}>Утром</span>
            <select
              value={settings.morning === null ? 'off' : String(settings.morning)}
              disabled={saving}
              onChange={(e) =>
                save({ ...settings, morning: e.target.value === 'off' ? null : Number(e.target.value) })
              }
              style={selectStyle}
            >
              {MORNING_HOURS.map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
              <option value="off">Не напоминать</option>
            </select>
          </div>
          <div style={{ ...rowStyle, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <span style={labelStyle}>Вечером</span>
            <select
              value={settings.evening === null ? 'off' : String(settings.evening)}
              disabled={saving}
              onChange={(e) =>
                save({ ...settings, evening: e.target.value === 'off' ? null : Number(e.target.value) })
              }
              style={selectStyle}
            >
              {EVENING_HOURS.map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
              <option value="off">Не напоминать</option>
            </select>
          </div>
        </>
      )}
    </section>
  );
}
