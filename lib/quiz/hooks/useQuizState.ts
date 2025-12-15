// lib/quiz/hooks/useQuizState.ts
// ИСПРАВЛЕНО: Хук для управления основным состоянием анкеты
// Вынесен из quiz/page.tsx для разделения логики

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';

interface Questionnaire {
  id: number;
  name: string;
  version: number;
  groups: Array<{
    id: number;
    title: string;
    questions: any[];
  }>;
  questions: any[];
}

export function useQuizState() {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initInProgressRef = useRef(false);

  useEffect(() => {
    if (initInProgressRef.current) return;
    initInProgressRef.current = true;

    const loadQuestionnaire = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getActiveQuestionnaire();
        setQuestionnaire(data as Questionnaire);
        clientLogger.log('✅ Questionnaire loaded', { id: data.id, version: data.version });
      } catch (err: any) {
        clientLogger.error('❌ Error loading questionnaire', err);
        setError(err?.message || 'Ошибка загрузки анкеты');
      } finally {
        setLoading(false);
      }
    };

    loadQuestionnaire();
  }, []);

  return {
    questionnaire,
    loading,
    error,
    setQuestionnaire,
    setLoading,
    setError,
  };
}

