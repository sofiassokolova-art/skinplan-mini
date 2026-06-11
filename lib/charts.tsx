// lib/charts.tsx
// Реэкспорт recharts для admin-страниц (page, analytics, funnel).
//
// ВАЖНО: компоненты реэкспортируются НАПРЯМУЮ, а не через per-primitive
// next/dynamic. recharts определяет свои под-элементы (<Bar>, <XAxis>, <Line>,
// <Cell> и т.д.) по ТИПУ дочернего компонента. Если каждый примитив обернуть в
// next/dynamic, дети превращаются в dynamic-обёртки, recharts их не распознаёт и
// рисует ПУСТОЙ контейнер графика — без баров/осей/линий и без ошибок в консоли.
//
// Прежняя ленивая загрузка (ssr:false на каждый примитив) делалась ради лимита
// server-bundle Cloudflare Workers (≤3 MiB). После переезда на Vercel это
// ограничение неактуально, поэтому возвращаем прямой импорт — графики рендерятся.
'use client';

export {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
