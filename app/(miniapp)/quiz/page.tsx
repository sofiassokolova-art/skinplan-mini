// app/(miniapp)/quiz/page.tsx
// Страница анкеты.
// ВАЖНО: тело анкеты грузится через next/dynamic с ssr:false.
// Причина: SSR тяжёлого дерева квиза на «холодном» Cloudflare-воркере
// застревал на ~середине потокового HTML, соединение обрывалось
// (net::ERR_CONNECTION_CLOSED) → белый экран у новых пользователей,
// которые с / редиректятся прямо на /quiz. Квиз полностью клиентский,
// серверный HTML всё равно выбрасывался при гидрации — поэтому отдаём
// с сервера только лёгкий лоадер, а само дерево монтируем на клиенте.

'use client';

import dynamic from 'next/dynamic';
import { QuizInitialLoader } from './components/QuizInitialLoader';

const QuizClient = dynamic(() => import('./QuizClient'), {
  ssr: false,
  loading: () => <QuizInitialLoader />,
});

export default function QuizPage() {
  return <QuizClient />;
}
