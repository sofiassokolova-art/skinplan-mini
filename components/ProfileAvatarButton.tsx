// components/ProfileAvatarButton.tsx
// Кнопка-аватар в топбаре (ведёт в ЛК). Показывает фото пользователя из Telegram,
// а если фото нет (или не загрузилось) — первую букву введённого имени.
// Стиль круга/статус-точки задаётся внешним className (hr-avatar / crd-avatar / fv-avatar).

'use client';

import { useState } from 'react';
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
  const [imgError, setImgError] = useState(false);

  const telegramUser = tg?.initDataUnsafe?.user || user;
  const photoUrl = telegramUser?.photo_url;
  const initial = (name?.trim()?.[0] || telegramUser?.first_name?.[0] || 'S').toUpperCase();
  const showPhoto = Boolean(photoUrl) && !imgError;

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
