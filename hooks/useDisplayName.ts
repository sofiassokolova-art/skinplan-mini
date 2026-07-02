// hooks/useDisplayName.ts
// Имя пользователя для отображения (аватар-инициал, приветствие).
// Приоритет: ответ USER_NAME (введённое имя) > firstName из профиля. Кэшируется
// через React Query, чтобы разные экраны (главная, корзина, избранное) не дёргали
// сеть повторно.

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDisplayName() {
  return useQuery({
    queryKey: ['display-name'],
    queryFn: async (): Promise<string | null> => {
      try {
        const answers = (await api.getUserAnswers()) as any;
        if (Array.isArray(answers)) {
          const nameAnswer = answers.find((a: any) => a?.question?.code === 'USER_NAME');
          const value = nameAnswer?.answerValue ? String(nameAnswer.answerValue).trim() : '';
          if (value) return value;
        }
      } catch {
        // ниже — fallback на профиль
      }
      try {
        const profile = (await api.getUserProfile()) as any;
        if (profile?.firstName) return String(profile.firstName).trim();
      } catch {
        // нет данных — вернём null, аватар покажет инициал из Telegram
      }
      return null;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
}
