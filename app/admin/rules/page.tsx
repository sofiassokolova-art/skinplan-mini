// app/admin/rules/page.tsx
// Страница управления правилами рекомендаций

'use client';

import { useEffect, useState } from 'react';

interface Rule {
  id: number;
  name: string;
  priority: number;
  isActive: boolean;
  conditionsJson: any;
  stepsJson: any;
}

export default function AdminRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const response = await fetch('/api/admin/rules', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load');
      }

      const data = await response.json();
      setRules(data);
    } catch (err) {
      console.error('Error loading rules:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Правила рекомендаций</h1>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
          + Добавить правило
        </button>
      </div>

      <div className="space-y-4">
        {rules.map((rule) => (
          <div key={rule.id} className="bg-white shadow rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center">
                  <h3 className="text-lg font-medium text-gray-900">
                    {rule.name}
                  </h3>
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Приоритет: {rule.priority}
                  </span>
                  {rule.isActive ? (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Активно
                    </span>
                  ) : (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Неактивно
                    </span>
                  )}
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  <p>Условия: {JSON.stringify(rule.conditionsJson).substring(0, 100)}...</p>
                </div>
              </div>
              <button className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">
                Редактировать
              </button>
            </div>
          </div>
        ))}
      </div>

      {rules.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Нет правил. Добавьте первое правило.
        </div>
      )}
    </div>
  );
}

