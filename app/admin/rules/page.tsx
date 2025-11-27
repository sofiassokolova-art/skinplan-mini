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
  const [jsonMode, setJsonMode] = useState(true);
  const [jsonText, setJsonText] = useState('');

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
    if (!editingRule) return;

    try {
      const parsed = JSON.parse(jsonText);
      const token = localStorage.getItem('admin_token');
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
    } catch (err) {
      alert('Неверный JSON формат');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-white/60">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Правила рекомендаций</h1>
          <p className="text-white/60">Всего: {rules.length}</p>
        </div>
        <button
          className={cn(
            'px-6 py-3 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white rounded-2xl font-bold',
            'hover:shadow-[0_8px_32px_rgba(139,92,246,0.5)] transition-all duration-300',
            'flex items-center gap-2'
          )}
        >
          <Plus size={20} />
          Новое правило
        </button>
      </div>

      {error && (
        <div className={cn(glassCard, 'p-4 bg-red-500/20 border-red-500/50')}>
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Модалка редактирования */}
      {editingRule && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={cn(glassCard, 'p-6 max-w-4xl w-full max-h-[90vh] overflow-auto')}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Редактирование правила</h2>
              <button
                onClick={() => setEditingRule(null)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setJsonMode(true)}
                className={cn(
                  'px-4 py-2 rounded-lg transition-colors flex items-center gap-2',
                  jsonMode
                    ? 'bg-white/20 text-white'
                    : 'bg-white/10 text-white/60 hover:text-white'
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
                    ? 'bg-white/20 text-white'
                    : 'bg-white/10 text-white/60 hover:text-white'
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
                className="w-full h-96 p-4 bg-[#050505] border border-white/10 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-white/20"
                spellCheck={false}
              />
            ) : (
              <div className="p-4 bg-white/5 rounded-xl">
                <pre className="text-white/80 text-sm whitespace-pre-wrap">
                  {JSON.stringify({ conditions: editingRule.conditionsJson, steps: editingRule.stepsJson }, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSave}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white rounded-xl font-bold hover:shadow-[0_8px_32px_rgba(139,92,246,0.5)] transition-all"
              >
                Сохранить
              </button>
              <button
                onClick={() => setEditingRule(null)}
                className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
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
            className={cn(glassCard, glassCardHover, 'p-6')}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{rule.name}</h3>
                <div className="flex items-center gap-4 text-sm text-white/60">
                  <span>Приоритет: {rule.priority}</span>
                  <span>
                    {rule.isActive ? (
                      <span className="text-green-400">Активно</span>
                    ) : (
                      <span className="text-white/40">Неактивно</span>
                    )}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(rule)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Edit className="text-white/80" size={16} />
                </button>
                <button className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors">
                  <Trash2 className="text-red-400" size={16} />
                </button>
              </div>
            </div>
            <div className="p-4 bg-white/5 rounded-xl">
              <div className="text-xs text-white/40 mb-2">Условия:</div>
              <pre className="text-white/60 text-xs font-mono overflow-x-auto">
                {JSON.stringify(rule.conditionsJson, null, 2).substring(0, 200)}...
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
