// app/admin/rules/page.tsx
// Страница управления правилами рекомендаций с JSON редактором

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Code, Eye } from 'lucide-react';
import { cn, glassCard, glassCardHover } from '@/lib/utils';

interface Rule {
  id: number;
  name: string;
  priority: number;
  isActive: boolean;
  conditionsJson: any;
  stepsJson: any;
  createdAt: string;
  updatedAt: string;
}

export default function RulesAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [creatingRule, setCreatingRule] = useState(false);
  const [jsonMode, setJsonMode] = useState(true);
  const [jsonText, setJsonText] = useState('');
  const [newRuleName, setNewRuleName] = useState('');
  const [newRulePriority, setNewRulePriority] = useState(0);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/rules', {
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
        throw new Error('Ошибка загрузки правил');
      }

      const data = await response.json();
      setRules(data || []);
    } catch (err: any) {
      console.error('Ошибка загрузки правил:', err);
      setError(err.message || 'Ошибка загрузки правил');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setJsonText(JSON.stringify({ conditions: rule.conditionsJson, steps: rule.stepsJson }, null, 2));
    setJsonMode(true);
  };

  const handleSave = async () => {
    if (!editingRule && !creatingRule) return;

    try {
      const parsed = JSON.parse(jsonText);
      const token = localStorage.getItem('admin_token');
      
      if (creatingRule) {
        // Создание нового правила
        const response = await fetch('/api/admin/rules', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          credentials: 'include',
          body: JSON.stringify({
            name: newRuleName,
            conditionsJson: parsed.conditions || {},
            stepsJson: parsed.steps || {},
            priority: newRulePriority,
            isActive: true,
          }),
        });

        if (response.ok) {
          setCreatingRule(false);
          setNewRuleName('');
          setNewRulePriority(0);
          setJsonText('');
          await loadRules();
        } else {
          const errorData = await response.json();
          alert('Ошибка создания правила: ' + (errorData.error || 'Unknown error'));
        }
      } else if (editingRule) {
        // Редактирование существующего правила
        const response = await fetch(`/api/admin/rules/${editingRule.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          credentials: 'include',
          body: JSON.stringify({
            conditionsJson: parsed.conditions,
            stepsJson: parsed.steps,
          }),
        });

        if (response.ok) {
          setEditingRule(null);
          await loadRules();
        } else {
          alert('Ошибка сохранения правила');
        }
      }
    } catch (err) {
      alert('Неверный JSON формат: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleCreateNew = () => {
    setCreatingRule(true);
    setEditingRule(null);
    setNewRuleName('');
    setNewRulePriority(0);
    setJsonText(JSON.stringify({
      conditions: {},
      steps: {},
    }, null, 2));
    setJsonMode(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Правила рекомендаций</h1>
          <p className="text-gray-600">Всего: {rules.length}</p>
        </div>
        <button
          onClick={handleCreateNew}
          className={cn(
            'px-6 py-3 bg-black text-white rounded-2xl font-bold hover:bg-gray-800',
            'transition-all duration-300',
            'flex items-center gap-2'
          )}
        >
          <Plus size={20} />
          Новое правило
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Модалка редактирования/создания */}
      {(editingRule || creatingRule) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto shadow-xl border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {creatingRule ? 'Создание нового правила' : 'Редактирование правила'}
              </h2>
              <button
                onClick={() => {
                  setEditingRule(null);
                  setCreatingRule(false);
                  setNewRuleName('');
                  setNewRulePriority(0);
                  setJsonText('');
                }}
                className="text-gray-600 hover:text-gray-900"
              >
                ✕
              </button>
            </div>

            {creatingRule && (
              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Название правила *</label>
                  <input
                    type="text"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    placeholder="Например: Базовое правило для жирной кожи"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Приоритет (чем выше, тем важнее)</label>
                  <input
                    type="number"
                    value={newRulePriority}
                    onChange={(e) => setNewRulePriority(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-gray-400"
                  />
                </div>
              </div>
            )}

            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setJsonMode(true)}
                className={cn(
                  'px-4 py-2 rounded-lg transition-colors flex items-center gap-2',
                  jsonMode
                    ? 'bg-gray-200 text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                )}
              >
                <Code size={16} />
                JSON
              </button>
              <button
                onClick={() => setJsonMode(false)}
                className={cn(
                  'px-4 py-2 rounded-lg transition-colors flex items-center gap-2',
                  !jsonMode
                    ? 'bg-gray-200 text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                )}
              >
                <Eye size={16} />
                Визуально
              </button>
            </div>

            {jsonMode ? (
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full h-96 p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-mono text-sm focus:outline-none focus:border-gray-400"
                spellCheck={false}
                placeholder='{"conditions": {}, "steps": {}}'
              />
            ) : (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <pre className="text-gray-700 text-sm whitespace-pre-wrap">
                  {creatingRule ? jsonText : JSON.stringify({ conditions: editingRule?.conditionsJson, steps: editingRule?.stepsJson }, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSave}
                disabled={creatingRule && !newRuleName.trim()}
                className="flex-1 px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingRule ? 'Создать правило' : 'Сохранить'}
              </button>
              <button
                onClick={() => {
                  setEditingRule(null);
                  setCreatingRule(false);
                  setNewRuleName('');
                  setNewRulePriority(0);
                  setJsonText('');
                }}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Список правил */}
      <div className="grid grid-cols-1 gap-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={cn(glassCard, 'p-6')}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{rule.name}</h3>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Приоритет: {rule.priority}</span>
                  <span>
                    {rule.isActive ? (
                      <span className="text-green-600">Активно</span>
                    ) : (
                      <span className="text-gray-400">Неактивно</span>
                    )}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(rule)}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <Edit className="text-gray-700" size={16} />
                </button>
                <button className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors">
                  <Trash2 className="text-red-600" size={16} />
              </button>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-xs text-gray-500 mb-2">Условия:</div>
              <pre className="text-gray-700 text-xs font-mono overflow-x-auto">
                {JSON.stringify(rule.conditionsJson, null, 2).substring(0, 200)}...
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
