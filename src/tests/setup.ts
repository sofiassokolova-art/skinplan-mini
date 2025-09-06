import '@testing-library/jest-dom';

// Глушим alert/print, чтобы не сыпались в лог
// @ts-expect-error
window.alert = vi.fn();
// @ts-expect-error
window.print = vi.fn();

// Телега не обязательна, но если вдруг кликнешь экспорт в чат — не упадёт
// @ts-expect-error
window.Telegram = { WebApp: { sendData: vi.fn() } };

