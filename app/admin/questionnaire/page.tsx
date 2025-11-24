// app/admin/questionnaire/page.tsx
// Страница управления анкетой

'use client';

import { useEffect, useState } from 'react';

interface Questionnaire {
  id: number;
  name: string;
  version: number;
  isActive: boolean;
  questionGroups: Array<{
    id: number;
    title: string;
    position: number;
    questions: Array<{
      id: number;
      code: string;
      text: string;
      type: string;
      position: number;
    }>;
  }>;
}

export default function AdminQuestionnaire() {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuestionnaire();
  }, []);

  const loadQuestionnaire = async () => {
    try {
      const response = await fetch('/api/questionnaire/active');
      if (!response.ok) {
        throw new Error('Failed to load');
      }
      const data = await response.json();
      setQuestionnaire(data);
    } catch (err) {
      console.error('Error loading questionnaire:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  if (!questionnaire) {
    return <div className="text-center py-12">Анкета не найдена</div>;
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Анкета</h1>
        <p className="mt-2 text-sm text-gray-600">
          {questionnaire.name} (версия {questionnaire.version})
        </p>
      </div>

      <div className="space-y-6">
        {questionnaire.questionGroups?.map((group) => (
          <div key={group.id} className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {group.title}
            </h2>
            <div className="space-y-4">
              {group.questions.map((question) => (
                <div
                  key={question.id}
                  className="border-l-4 border-indigo-500 pl-4 py-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {question.text}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Код: {question.code} • Тип: {question.type}
                      </p>
                    </div>
                    <button className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">
                      Редактировать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

