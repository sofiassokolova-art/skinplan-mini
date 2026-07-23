// app/admin/analytics/page.tsx
// Страница аналитики

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from '@/lib/charts';
import { AdminPageSkeleton } from '@/components/ui/SkeletonLoader';
import MetricsDashboard from '@/components/MetricsDashboard';

const COLORS = ['#8B5CF6', '#EC4899', '#6366F1', '#10B981', '#F59E0B'];

// ИСПРАВЛЕНО (P2): Типизация stats
interface AdminStats {
  users?: number;
  products?: number;
  plans?: number;
  badFeedback?: number;
  replacements?: number;
  churnRate?: number;
  avgLTV?: number;
  newUsersLast7Days?: number;
  newUsersLast30Days?: number;
  activeUsersLast7Days?: number;
  activeUsersLast30Days?: number;
  totalWishlistItems?: number;
  totalProductFeedback?: number;
  avgFeedbackRating?: number;
}

interface TopProduct {
  id: number;
  name: string;
  brand: string;
  wishlistCount: number;
  feedbackCount: number;
  avgRating: number;
}

interface QuestionnaireOptionBreakdown {
  label: string;
  value: string;
  count: number;
  percent: number;
}

interface QuestionnaireAnswerBreakdown {
  questionCode: string;
  questionText: string;
  groupTitle: string | null;
  questionType: string;
  totalAnswers: number;
  totalSelections: number;
  unansweredStarted: number;
  options: QuestionnaireOptionBreakdown[];
}

interface QuestionnaireStage {
  id: string;
  title: string;
  questionCount: number;
  reachedCount: number;
  completedCount: number;
  completionRate: number;
  dropOffFromPrev: number;
}

interface QuestionnaireAnalytics {
  overview: {
    id: number;
    name: string;
    version: number;
    totalGroups: number;
    totalQuestions: number;
    started: number;
    completed: number;
    inProgress: number;
    averageAnsweredQuestions: number;
    completionRate: number;
  };
  answerBreakdowns: QuestionnaireAnswerBreakdown[];
  stages: QuestionnaireStage[];
}

type Period = 'day' | 'week' | 'month';

export default function AnalyticsAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireAnalytics | null>(null);
  const [period, setPeriod] = useState<Period>('month'); // ИСПРАВЛЕНО (P0): Добавлен state для периода

  useEffect(() => {
    loadAnalytics();
  }, [period]); // ИСПРАВЛЕНО (P0): Перезагружаем при смене периода

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      // ИСПРАВЛЕНО (P0): Используем только cookie для авторизации и передаём period
      const response = await fetch(`/api/admin/stats?period=${period}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setTopProducts(data.topProducts || []);
        setQuestionnaire(data.questionnaire || null);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <AdminPageSkeleton cards={4} rows={4} />;
  }

  if (!stats) {
    return (
      <div className="space-y-6 pt-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Аналитика</h1>
          <p className="text-gray-600">Детальная статистика системы</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="text-center py-12 text-gray-500">
            Нет данных для отображения
          </div>
        </div>
      </div>
    );
  }

  const chartData = [
    { name: 'Пользователи', value: stats?.users || 0 },
    { name: 'Продукты', value: stats?.products || 0 },
    { name: 'Планы', value: stats?.plans || 0 },
    { name: 'Негативные отзывы', value: stats?.badFeedback || 0 }, // ИСПРАВЛЕНО (P1): Переименовано для ясности
  ];

  return (
    <div className="space-y-6 pt-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Аналитика</h1>
          <p className="text-gray-600">Детальная статистика системы</p>
        </div>
        {/* ИСПРАВЛЕНО (P0): Переключатель периодов */}
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-[#8B5CF6] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p === 'day' ? 'День' : p === 'week' ? 'Неделя' : 'Месяц'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* График распределения */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Распределение данных</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
              <XAxis dataKey="name" stroke="rgba(0,0,0,0.6)" style={{ fontSize: '12px' }} />
              <YAxis stroke="rgba(0,0,0,0.6)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: '12px',
                  color: '#000',
                }}
              />
              <Bar dataKey="value" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Круговая диаграмма */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Соотношение</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Legend 
                verticalAlign="bottom" 
                height={36}
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: '12px',
                  color: '#000',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Дополнительная статистика */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Детальная статистика</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="text-gray-600 text-sm mb-1">Новые пользователи (7 дней)</div>
            <div className="text-2xl font-bold text-gray-900">{stats?.newUsersLast7Days || 0}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="text-gray-600 text-sm mb-1">Новые пользователи (30 дней)</div>
            <div className="text-2xl font-bold text-gray-900">{stats?.newUsersLast30Days || 0}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="text-gray-600 text-sm mb-1">Активные пользователи (7 дней)</div>
            <div className="text-2xl font-bold text-gray-900">{stats?.activeUsersLast7Days || 0}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="text-gray-600 text-sm mb-1">Активные пользователи (30 дней)</div>
            <div className="text-2xl font-bold text-gray-900">{stats?.activeUsersLast30Days || 0}</div>
          </div>
        </div>
      </div>

      {questionnaire && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Новая анкета</h2>
              <p className="text-sm text-gray-600 mt-1">
                {questionnaire.overview.name} · {questionnaire.overview.totalQuestions} вопросов · {questionnaire.overview.started} начали
              </p>
            </div>
            <div className="text-sm font-semibold text-emerald-700">
              {questionnaire.overview.completionRate.toFixed(1)}% завершили
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {questionnaire.answerBreakdowns.slice(0, 8).map((breakdown) => (
              <div key={breakdown.questionCode} className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="text-xs font-medium uppercase text-gray-400 tracking-wide">
                      {breakdown.groupTitle || breakdown.questionCode}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mt-1 line-clamp-2">
                      {breakdown.questionText}
                    </h3>
                  </div>
                  <div className="text-right text-xs text-gray-500 flex-shrink-0">
                    <div className="font-semibold text-gray-900">{breakdown.totalAnswers}</div>
                    ответов
                  </div>
                </div>

                <div className="space-y-3">
                  {breakdown.options.slice(0, 4).map((option) => (
                    <div key={`${breakdown.questionCode}-${option.value}-${option.label}`}>
                      <div className="flex items-center justify-between gap-3 text-xs mb-1">
                        <span className="text-gray-700 truncate" title={option.label}>{option.label}</span>
                        <span className="font-medium text-gray-900 flex-shrink-0">
                          {option.count} · {option.percent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#8B5CF6]"
                          style={{ width: `${Math.min(100, option.percent)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {breakdown.options.length === 0 && (
                    <div className="text-sm text-gray-500 py-4">Пока нет ответов</div>
                  )}
                  {breakdown.unansweredStarted > 0 && (
                    <div className="text-xs text-gray-500 pt-1">
                      Не ответили после старта: {breakdown.unansweredStarted}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {questionnaire && questionnaire.stages.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Прохождение блоков анкеты</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Блок</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Вопросов</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Дошли</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Завершили блок</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Completion</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Drop-off</th>
                </tr>
              </thead>
              <tbody>
                {questionnaire.stages.map((stage) => (
                  <tr key={stage.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900 font-medium">{stage.title}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{stage.questionCount}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{stage.reachedCount}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{stage.completedCount}</td>
                    <td className="py-3 px-4 text-right text-emerald-600 font-medium">
                      {stage.completionRate.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">{stage.dropOffFromPrev}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ИСПРАВЛЕНО (#8): Расширенные метрики (churn, retention, LTV, топ продуктов) */}
      <MetricsDashboard
        data={{
          users: stats?.users ?? 0,
          products: stats?.products ?? 0,
          plans: stats?.plans ?? 0,
          badFeedback: stats?.badFeedback ?? 0,
          replacements: stats?.replacements ?? 0,
          churnRate: stats?.churnRate ?? 0,
          avgLTV: stats?.avgLTV ?? 0,
          topProducts,
          newUsersLast7Days: stats?.newUsersLast7Days ?? 0,
          newUsersLast30Days: stats?.newUsersLast30Days ?? 0,
          activeUsersLast7Days: stats?.activeUsersLast7Days ?? 0,
          activeUsersLast30Days: stats?.activeUsersLast30Days ?? 0,
          totalWishlistItems: stats?.totalWishlistItems ?? 0,
          totalProductFeedback: stats?.totalProductFeedback ?? 0,
          avgFeedbackRating: stats?.avgFeedbackRating ?? 0,
        }}
      />
    </div>
  );
}
