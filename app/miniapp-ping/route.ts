// GET /miniapp-ping — минимальная страница без React/JS для проверки загрузки в Telegram WebView.
// Если в Telegram открыть этот URL и видите "OK" — домен и заголовки в порядке, проблема в чанках/SPA.

import { NextResponse } from 'next/server';

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SkinIQ ping</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#F5FFFC 0%,#E8FBF7 100%);font-family:system-ui,sans-serif;color:#0A5F59;">
  <p style="font-size:18px;">OK</p>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, max-age=0',
    },
  });
}
