// lib/charts.tsx
// Динамические re-exports recharts с ssr:false — recharts не попадает
// в server-bundle CF Workers (экономит ~100 KiB gzipped).
// Используется только на admin-страницах (page, analytics, funnel).
//
// `import type` стирается компилятором и не тянет recharts в бандл —
// типы используются только для cast'ов, runtime-импорт идёт через dynamic().
'use client';

import dynamic from 'next/dynamic';
import type {
  LineChart as TLineChart,
  Line as TLine,
  BarChart as TBarChart,
  Bar as TBar,
  PieChart as TPieChart,
  Pie as TPie,
  XAxis as TXAxis,
  YAxis as TYAxis,
  CartesianGrid as TCartesianGrid,
  Tooltip as TTooltip,
  Legend as TLegend,
  ResponsiveContainer as TResponsiveContainer,
  Cell as TCell,
} from 'recharts';

export const LineChart = dynamic(
  () => import('recharts').then(m => ({ default: m.LineChart as any })),
  { ssr: false }
) as unknown as typeof TLineChart;

export const Line = dynamic(
  () => import('recharts').then(m => ({ default: m.Line as any })),
  { ssr: false }
) as unknown as typeof TLine;

export const BarChart = dynamic(
  () => import('recharts').then(m => ({ default: m.BarChart as any })),
  { ssr: false }
) as unknown as typeof TBarChart;

export const Bar = dynamic(
  () => import('recharts').then(m => ({ default: m.Bar as any })),
  { ssr: false }
) as unknown as typeof TBar;

export const PieChart = dynamic(
  () => import('recharts').then(m => ({ default: m.PieChart as any })),
  { ssr: false }
) as unknown as typeof TPieChart;

export const Pie = dynamic(
  () => import('recharts').then(m => ({ default: m.Pie as any })),
  { ssr: false }
) as unknown as typeof TPie;

export const XAxis = dynamic(
  () => import('recharts').then(m => ({ default: m.XAxis as any })),
  { ssr: false }
) as unknown as typeof TXAxis;

export const YAxis = dynamic(
  () => import('recharts').then(m => ({ default: m.YAxis as any })),
  { ssr: false }
) as unknown as typeof TYAxis;

export const CartesianGrid = dynamic(
  () => import('recharts').then(m => ({ default: m.CartesianGrid as any })),
  { ssr: false }
) as unknown as typeof TCartesianGrid;

export const Tooltip = dynamic(
  () => import('recharts').then(m => ({ default: m.Tooltip as any })),
  { ssr: false }
) as unknown as typeof TTooltip;

export const Legend = dynamic(
  () => import('recharts').then(m => ({ default: m.Legend as any })),
  { ssr: false }
) as unknown as typeof TLegend;

export const ResponsiveContainer = dynamic(
  () => import('recharts').then(m => ({ default: m.ResponsiveContainer as any })),
  { ssr: false }
) as unknown as typeof TResponsiveContainer;

export const Cell = dynamic(
  () => import('recharts').then(m => ({ default: m.Cell as any })),
  { ssr: false }
) as unknown as typeof TCell;
