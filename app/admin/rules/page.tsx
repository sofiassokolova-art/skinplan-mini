// app/admin/rules/page.tsx
// Страница управления правилами рекомендаций с JSON редактором

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Code, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

// ИСПРАВЛЕНО (P0): Заменили any на unknown для безопасности типов
interface Rule {
  id: number;
  name: string;
  priority: number;
  isActive: boolean;
  conditionsJson: unknown; // ИСПРАВЛЕНО (P0): unknown вместо any
  stepsJson: unknown; // ИСПРАВЛЕНО (P0): unknown вместо any
  createdAt: string;
  updatedAt: string;
}

// ИСПРАВЛЕНО (P0): Валидация JSON перед сохранением
function isPlainObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function validateRulePayload(parsed: unknown): { valid: boolean; error?: string; data?: { conditions: Record<string, unknown>; steps: Record<string, unknown> } } {
  if (!isPlainObject(parsed)) {
    return { valid: false, error: 'JSON должен быть объектом' };
  }

  if (!isPlainObject(parsed.conditions)) {
    return { valid: false, error: 'Поле "conditions" должно быть объектом' };
  }

  if (!isPlainObject(parsed.steps)) {
    return { valid: false, error: 'Поле "steps" должно быть объектом' };
  }

  return {
    valid: true,
    data: {
      conditions: parsed.conditions,
      steps: parsed.steps,
    },
  };
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
  const [saving, setSaving] = useState(false); // ИСПРАВЛЕНО (P1): Состояние сохранения
  const [saveError, setSaveError] = useState<string | null>(null); // ИСПРАВЛЕНО (P1): Ошибка сохранения

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      // ИСПРАВЛЕНО (P0): Убрали localStorage и Authorization - cookie-only подход
      const response = await fetch('/api/admin/rules', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // ИСПРАВЛЕНО (P0): Редирект на login при 401
      if (response.status === 401) {
        router.replace('/admin/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Ошибка загрузки правил');
      }

      const data = await response.json();
      // ИСПРАВЛЕНО (P2): Сортировка правил по приоритету (уже на бэке, но дублируем на фронте для надёжности)
      const sortedRules = (data || []).sort((a: Rule, b: Rule) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      setRules(sortedRules);
    } catch (err: unknown) {
      console.error('Ошибка загрузки правил:', err);
      setError(err instanceof Error ? err.message : 'Ошибка загрузки правил');
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

    // ИСПРАВЛЕНО (P1): Блокируем повторное сохранение
    if (saving) return;

    setSaving(true);
    setSaveError(null);

    try {
      // ИСПРАВЛЕНО (P0): Валидация JSON перед сохранением
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch (err) {
        const error = 'Неверный JSON формат: ' + (err instanceof Error ? err.message : 'Unknown error');
        setSaveError(error);
        setSaving(false);
        return;
      }

      // ИСПРАВЛЕНО (P0): Валидация структуры через validateRulePayload
      const validation = validateRulePayload(parsed);
      if (!validation.valid || !validation.data) {
        setSaveError(validation.error || 'Неверная структура JSON');
        setSaving(false);
        return;
      }

      const { conditions, steps } = validation.data;
      
      // ИСПРАВЛЕНО (P0): Убрали localStorage и Authorization - cookie-only подход
      if (creatingRule) {
        // ИСПРАВЛЕНО (P1): Оптимистичное обновление
        const tempRule: Rule = {
          id: Date.now(), // Временный ID
          name: newRuleName,
          priority: newRulePriority,
          isActive: true,
          conditionsJson: conditions,
          stepsJson: steps,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setRules([tempRule, ...rules]);

        // Создание нового правила
        const response = await fetch('/api/admin/rules', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            name: newRuleName,
            conditionsJson: conditions,
            stepsJson: steps,
            priority: newRulePriority,
            isActive: true,
          }),
        });

        // ИСПРАВЛЕНО (P0): Редирект на login при 401
        if (response.status === 401) {
          router.replace('/admin/login');
          return;
        }

        if (response.ok) {
          setCreatingRule(false);
          setNewRuleName('');
          setNewRulePriority(0);
          setJsonText('');
          await loadRules(); // Перезагружаем для получения реального ID
        } else {
          // ИСПРАВЛЕНО (P1): Читаем JSON ошибки
          const errorData = await response.json().catch(() => ({}));
          const error = 'Ошибка создания правила: ' + (errorData.error || 'Unknown error');
          setSaveError(error);
          await loadRules(); // Откатываем оптимистичное обновление
        }
      } else if (editingRule) {
        // ИСПРАВЛЕНО (P1): Оптимистичное обновление
        const updatedRules = rules.map(r =>
          r.id === editingRule.id
            ? { ...r, conditionsJson: conditions, stepsJson: steps, updatedAt: new Date().toISOString() }
            : r
        );
        setRules(updatedRules);

        // Редактирование существующего правила
        const response = await fetch(`/api/admin/rules/${editingRule.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            conditionsJson: conditions,
            stepsJson: steps,
          }),
        });

        // ИСПРАВЛЕНО (P0): Редирект на login при 401
        if (response.status === 401) {
          router.replace('/admin/login');
          return;
        }

        if (response.ok) {
          setEditingRule(null);
          await loadRules(); // Перезагружаем для синхронизации
        } else {
          // ИСПРАВЛЕНО (P1): Читаем JSON ошибки
          const errorData = await response.json().catch(() => ({}));
          const error = 'Ошибка сохранения правила: ' + (errorData.error || 'Unknown error');
          setSaveError(error);
          await loadRules(); // Откатываем оптимистичное обновление
        }
      }
    } catch (err) {
      const error = 'Ошибка: ' + (err instanceof Error ? err.message : 'Unknown error');
      setSaveError(error);
      await loadRules(); // Откатываем оптимистичное обновление
    } finally {
      setSaving(false);
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
    setSaveError(null); // ИСПРАВЛЕНО (P1): Сбрасываем ошибку
  };

  // ИСПРАВЛЕНО (P1): Удаление правила
  const handleDelete = async (rule: Rule) => {
    if (!confirm(`Вы уверены, что хотите удалить правило "${rule.name}"?`)) {
      return;
    }

    try {
      // ИСПРАВЛЕНО (P0): Убрали localStorage и Authorization - cookie-only подход
      const response = await fetch(`/api/admin/rules/${rule.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // ИСПРАВЛЕНО (P0): Редирект на login при 401
      if (response.status === 401) {
        router.replace('/admin/login');
        return;
      }

      if (response.ok) {
        await loadRules();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert('Ошибка удаления правила: ' + (errorData.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Ошибка удаления правила:', err);
      alert('Ошибка удаления правила');
    }
  };

  // ИСПРАВЛЕНО (P2): Переключение isActive
  const handleToggleActive = async (rule: Rule) => {
    try {
      // ИСПРАВЛЕНО (P0): Убрали localStorage и Authorization - cookie-only подход
      const response = await fetch(`/api/admin/rules/${rule.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          isActive: !rule.isActive,
        }),
      });

      // ИСПРАВЛЕНО (P0): Редирект на login при 401
      if (response.status === 401) {
        router.replace('/admin/login');
        return;
      }

      if (response.ok) {
        await loadRules();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert('Ошибка обновления правила: ' + (errorData.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Ошибка обновления правила:', err);
      alert('Ошибка обновления правила');
    }
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
                {/* ИСПРАВЛЕНО (P0): Визуальный режим показывает jsonText, а не старые значения */}
                <pre className="text-gray-700 text-sm whitespace-pre-wrap">
                  {(() => {
                    try {
                      const parsed = JSON.parse(jsonText);
                      return JSON.stringify(parsed, null, 2);
                    } catch (err) {
                      return `Ошибка парсинга JSON: ${err instanceof Error ? err.message : 'Unknown error'}`;
                    }
                  })()}
                </pre>
              </div>
            )}

            {/* ИСПРАВЛЕНО (P1): Показываем ошибку сохранения */}
            {saveError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-700 text-sm">{saveError}</p>
              </div>
            )}

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSave}
                disabled={(creatingRule && !newRuleName.trim()) || saving}
                className="flex-1 px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Сохраняю...
                  </>
                ) : (
                  creatingRule ? 'Создать правило' : 'Сохранить'
                )}
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
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6"
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
                {/* ИСПРАВЛЕНО (P1): Удаление правила */}
                <button
                  onClick={() => handleDelete(rule)}
                  className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                >
                  <Trash2 className="text-red-600" size={16} />
                </button>
                {/* ИСПРАВЛЕНО (P2): Переключатель isActive */}
                <button
                  onClick={() => handleToggleActive(rule)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    rule.isActive
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {rule.isActive ? 'Активно' : 'Неактивно'}
                </button>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-xs text-gray-500 mb-2">Условия:</div>
              <pre className="text-gray-700 text-xs font-mono overflow-x-auto">
                {/* ИСПРАВЛЕНО (P1): Условное обрезание превью */}
                {(() => {
                  const s = JSON.stringify(rule.conditionsJson, null, 2);
                  return s.length > 200 ? s.substring(0, 200) + '...' : s;
                })()}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
