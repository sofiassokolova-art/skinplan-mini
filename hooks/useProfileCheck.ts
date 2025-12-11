// hooks/useProfileCheck.ts
// Хук для проверки наличия профиля пользователя

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';
import type { ProfileResponse } from '@/lib/api-types';

interface UseProfileCheckResult {
  profile: ProfileResponse | null;
  hasProfile: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Хук для проверки наличия профиля пользователя
 * Дедуплицирует запросы и кэширует результат
 */
export function useProfileCheck(): UseProfileCheckResult {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const checkInProgressRef = useRef(false);

  const checkProfile = async () => {
    // Защита от множественных одновременных запросов
    if (checkInProgressRef.current) {
      return;
    }

    checkInProgressRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const profileData = await api.getCurrentProfile();
      setProfile(profileData);
    } catch (err: any) {
      const errorMessage = err?.message || err?.toString() || '';
      const isNotFound = err?.status === 404 || 
                        err?.isNotFound ||
                        errorMessage.includes('404') ||
                        errorMessage.includes('No skin profile') ||
                        errorMessage.includes('Skin profile not found') ||
                        errorMessage.includes('Profile not found') ||
                        errorMessage.includes('No profile found');
      
      if (isNotFound) {
        // Профиль не найден - это нормально для новых пользователей
        setProfile(null);
        setError(null);
      } else {
        // Другая ошибка (сеть, авторизация и т.д.)
        clientLogger.warn('Error checking profile:', errorMessage);
        setError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      setIsLoading(false);
      checkInProgressRef.current = false;
    }
  };

  useEffect(() => {
    checkProfile();
  }, []);

  return {
    profile,
    hasProfile: !!profile && !!profile.id,
    isLoading,
    error,
    refetch: checkProfile,
  };
}
