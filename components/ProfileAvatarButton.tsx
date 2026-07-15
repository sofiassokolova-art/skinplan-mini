// components/ProfileAvatarButton.tsx
// Кнопка-аватар в топбаре (ведёт в ЛК). Показывает фото пользователя из Telegram,
// а если фото нет (или не загрузилось) — первую букву реального имени.
// Если данных нет, оставляем круг пустым: не показываем фиктивные fallback-буквы.
// Стиль круга/статус-точки задаётся внешним className (hr-avatar / crd-avatar / fv-avatar).

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/lib/telegram-client';
import { useDisplayName } from '@/hooks/useDisplayName';

interface ProfileAvatarButtonProps {
  className?: string;
  ariaLabel?: string;
}

export function ProfileAvatarButton({ className, ariaLabel = 'Профиль' }: ProfileAvatarButtonProps) {
  const router = useRouter();
  const { user, tg } = useTelegram();
  const { data: name } = useDisplayName();
  const [mounted, setMounted] = useState(false);
  const [imgError, setImgError] = useState(false);

  const telegramUser = tg?.initDataUnsafe?.user || user;
  const photoUrl = mounted ? telegramUser?.photo_url : undefined;
  const initial = mounted
    ? (name?.trim()?.[0] || telegramUser?.first_name?.[0] || '').toUpperCase()
    : '';
  const showPhoto = mounted && Boolean(photoUrl) && !imgError;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <button className={className} aria-label={ariaLabel} onClick={() => router.push('/profile')}>
      {showPhoto ? (
        <img
          src={photoUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        initial
      )}
    </button>
  );
}
