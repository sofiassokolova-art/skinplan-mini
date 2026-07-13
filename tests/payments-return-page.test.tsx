// tests/payments-return-page.test.tsx
// Пост-оплатный экран /payments/return (кейс Галимат).
// Два инварианта:
// 1) Страница остаётся СЕРВЕРНОЙ (без 'use client'/useSearchParams) — иначе на рваном
//    РФ+VPN-канале JS-чанк не доезжает и платящий юзер видит ошибку после оплаты.
// 2) При success=1 в HTML попадает ИНЛАЙН-скрипт автовозврата на /plan (webview
//    мини-аппа), а кнопка t.me остаётся фолбэком для внешнего браузера.

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import PaymentsReturnPage from '@/app/payments/return/page';

async function renderPage(searchParams: Record<string, string>) {
  const element = await PaymentsReturnPage({
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(element);
}

describe('/payments/return — серверный рендер', () => {
  it('исходник остаётся server component: без use client и client-хуков', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/payments/return/page.tsx'),
      'utf8'
    );
    // Директива — только как отдельный стейтмент (в комментариях упоминание допустимо)
    expect(source).not.toMatch(/^\s*['"]use client['"]\s*;?\s*$/m);
    expect(source).not.toContain('useSearchParams');
    expect(source).not.toContain('useEffect');
  });

  it('success=1: инлайн-скрипт автовозврата на /plan присутствует в HTML', () => {
    return renderPage({ success: '1' }).then((html) => {
      expect(html).toContain('Оплата прошла');
      // Скрипт проверяет webview-маркер и возвращает на план
      expect(html).toContain('tg_init_data');
      expect(html).toContain('/plan?from=payment');
      // Фолбэк для внешнего браузера — кнопка в Telegram
      expect(html).toContain('https://t.me/');
    });
  });

  it('без success=1: нейтральный экран, БЕЗ скрипта автовозврата', async () => {
    for (const params of [{}, { success: '0' }, { success: 'true' }]) {
      const html = await renderPage(params);
      expect(html).not.toContain('tg_init_data');
      expect(html).not.toContain('Оплата прошла');
      expect(html).toContain('Вернуться в приложение');
      expect(html).toContain('https://t.me/');
    }
  });

  it('фолбэк ссылки — реальный бот мини-аппа, а не мёртвый skiniq_bot', async () => {
    const html = await renderPage({ success: '1' });
    // NEXT_PUBLIC_TELEGRAM_BOT_USERNAME может быть задан в окружении —
    // важно лишь, что дефолт не ведёт в несуществующий @skiniq_bot.
    expect(html).not.toContain('t.me/skiniq_bot"');
  });
});
