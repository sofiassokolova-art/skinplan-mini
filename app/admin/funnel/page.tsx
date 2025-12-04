// app/admin/funnel/page.tsx
// Страница аналитики воронки конверсии

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { TrendingUp, Users, FileText, CheckCircle, Target } from 'lucide-react';

const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B'];

export default function FunnelAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [funnelData, setFunnelData] = useState<any>(null);
  const [periodData, setPeriodData] = useState<any[]>([]);
  const [screenConversions, setScreenConversions] = useState<any[]>([]);

  useEffect(() => {
    loadFunnelData();
  }, []);

  const loadFunnelData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/funnel', {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
      });

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Ошибка загрузки данных воронки');
      }

      const data = await response.json();
      setFunnelData(data.funnel);
      setPeriodData(data.periodData || []);
      setScreenConversions(data.screenConversions || []);
    } catch (error: any) {
      console.error('Error loading funnel data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (!funnelData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-red-600">Ошибка загрузки данных</div>
      </div>
    );
  }

  // Данные для графика воронки
  const funnelChartData = [
    { name: 'Открыли приложение', value: funnelData.totalUsers, conversion: 100 },
    { name: 'Начали анкету', value: funnelData.startedQuiz, conversion: funnelData.conversionToStarted },
    { name: 'Завершили анкету', value: funnelData.completedQuiz, conversion: funnelData.conversionToCompleted },
    { name: 'Получили план', value: funnelData.hasPlan, conversion: funnelData.conversionToPlan },
  ];

  // Данные для графика конверсий по периодам
  const conversionChartData = periodData.map(p => ({
    period: p.period,
    'Конверсия в начало': p.conversionToStarted.toFixed(1),
    'Конверсия в завершение': p.conversionToCompleted.toFixed(1),
    'Конверсия в план': p.conversionToPlan.toFixed(1),
    'Общая конверсия': p.overallConversion.toFixed(1),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Аналитика воронки</h1>
        <p className="text-gray-600">Конверсия пользователей от открытия приложения до получения плана</p>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="text-blue-500" size={24} />
            <div className="text-sm text-gray-600">Открыли приложение</div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{funnelData.totalUsers}</div>
          <div className="text-xs text-gray-500 mt-1">100%</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="text-purple-500" size={24} />
            <div className="text-sm text-gray-600">Начали анкету</div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{funnelData.startedQuiz}</div>
          <div className="text-xs text-green-600 mt-1">
            {funnelData.conversionToStarted.toFixed(1)}% конверсия
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="text-green-500" size={24} />
            <div className="text-sm text-gray-600">Завершили анкету</div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{funnelData.completedQuiz}</div>
          <div className="text-xs text-green-600 mt-1">
            {funnelData.conversionToCompleted.toFixed(1)}% конверсия
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <Target className="text-orange-500" size={24} />
            <div className="text-sm text-gray-600">Получили план</div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{funnelData.hasPlan}</div>
          <div className="text-xs text-green-600 mt-1">
            {funnelData.conversionToPlan.toFixed(1)}% конверсия
          </div>
        </div>
      </div>

      {/* График воронки */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Воронка конверсии</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={funnelChartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" stroke="#6b7280" />
            <YAxis dataKey="name" type="category" stroke="#6b7280" width={150} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0,0,0,0.8)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '12px',
                color: '#fff',
              }}
              formatter={(value: any, name: string) => {
                if (name === 'value') {
                  return [value, 'Количество пользователей'];
                }
                return [`${value}%`, 'Конверсия'];
              }}
            />
            <Bar dataKey="value" fill="#8B5CF6" radius={[0, 8, 8, 0]}>
              {funnelChartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* График конверсий по периодам */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Конверсия по периодам</h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={periodData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="period" stroke="#6b7280" />
            <YAxis stroke="#6b7280" label={{ value: 'Конверсия (%)', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0,0,0,0.8)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '12px',
                color: '#fff',
              }}
              formatter={(value: any) => `${value}%`}
            />
            <Legend />
            <Line type="monotone" dataKey="conversionToStarted" stroke="#8B5CF6" strokeWidth={2} name="Конверсия в начало" />
            <Line type="monotone" dataKey="conversionToCompleted" stroke="#EC4899" strokeWidth={2} name="Конверсия в завершение" />
            <Line type="monotone" dataKey="conversionToPlan" stroke="#10B981" strokeWidth={2} name="Конверсия в план" />
            <Line type="monotone" dataKey="overallConversion" stroke="#F59E0B" strokeWidth={2} name="Общая конверсия" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Таблица данных по периодам */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Детальные данные по периодам</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Период</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Пользователей</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Начали</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Завершили</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">План</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Конв. в начало</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Конв. в завершение</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Конв. в план</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Общая конв.</th>
              </tr>
            </thead>
            <tbody>
              {periodData.map((period, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{period.period}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{period.users}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{period.started}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{period.completed}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{period.hasPlan}</td>
                  <td className="py-3 px-4 text-right text-green-600 font-medium">
                    {period.conversionToStarted.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right text-green-600 font-medium">
                    {period.conversionToCompleted.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right text-green-600 font-medium">
                    {period.conversionToPlan.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right text-blue-600 font-bold">
                    {period.overallConversion.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Конверсия по экранам анкеты */}
      {screenConversions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Конверсия по экранам анкеты (41 экран)</h2>
          <div className="overflow-x-auto">
            <div className="mb-4 text-sm text-gray-600">
              Всего начали анкету: {funnelData.startedQuiz} пользователей
            </div>
            <ResponsiveContainer width="100%" height={600}>
              <BarChart data={screenConversions} layout="vertical" margin={{ top: 20, right: 30, left: 200, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  type="number" 
                  stroke="#6b7280"
                  label={{ value: 'Конверсия (%)', position: 'insideBottom', offset: -10 }}
                  domain={[0, 100]}
                />
                <YAxis 
                  dataKey="screenNumber" 
                  type="category" 
                  stroke="#6b7280" 
                  width={50}
                  label={{ value: 'Экран', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                  formatter={(value: any, name: string, props: any) => {
                    if (name === 'conversion') {
                      return [`${value.toFixed(1)}%`, 'Конверсия'];
                    }
                    if (name === 'reachedCount') {
                      return [value, 'Дошли до экрана'];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      const data = payload[0].payload;
                      return `Экран ${data.screenNumber}: ${data.screenTitle.substring(0, 50)}${data.screenTitle.length > 50 ? '...' : ''}`;
                    }
                    return `Экран ${label}`;
                  }}
                />
                <Bar dataKey="conversion" fill="#8B5CF6" radius={[0, 8, 8, 0]}>
                  {screenConversions.map((entry: any, index: number) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.screenType === 'question' ? '#8B5CF6' : '#EC4899'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Таблица с детальными данными */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">№</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Тип</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Название экрана</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Дошли</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Конверсия</th>
                </tr>
              </thead>
              <tbody>
                {screenConversions.map((screen: any, index: number) => (
                  <tr 
                    key={index} 
                    className="border-b border-gray-100 hover:bg-gray-50"
                    style={{
                      backgroundColor: screen.screenType === 'question' ? '#F9FAFB' : 'white',
                    }}
                  >
                    <td className="py-3 px-4 text-gray-900 font-medium">{screen.screenNumber}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        screen.screenType === 'question' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-pink-100 text-pink-700'
                      }`}>
                        {screen.screenType === 'question' ? 'Вопрос' : 'Инфо'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-700" style={{ maxWidth: '400px' }}>
                      <div className="truncate" title={screen.screenTitle}>
                        {screen.screenTitle}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">{screen.reachedCount}</td>
                    <td className="py-3 px-4 text-right text-green-600 font-medium">
                      {screen.conversion.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Общая статистика */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp size={32} />
          <h2 className="text-2xl font-bold">Общая конверсия</h2>
        </div>
        <div className="text-5xl font-bold mb-2">{funnelData.overallConversion.toFixed(1)}%</div>
        <div className="text-white/80">
          {funnelData.hasPlan} из {funnelData.totalUsers} пользователей прошли полный путь от открытия до получения плана
        </div>
      </div>
    </div>
  );
}

