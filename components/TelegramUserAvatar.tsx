// components/TelegramUserAvatar.tsx
// Компонент для отображения аватара пользователя Telegram

'use client';

interface TelegramUser {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

interface TelegramUserAvatarProps {
  user?: TelegramUser | null;
  size?: 'sm' | 'md' | 'lg';
}

export function TelegramUserAvatar({ user, size = 'md' }: TelegramUserAvatarProps) {
  const sizeClasses = {
    sm: 'w-12 h-12 text-lg',
    md: 'w-16 h-16 text-xl',
    lg: 'w-20 h-20 text-2xl',
  };

  const sizeClass = sizeClasses[size];

  // Если есть фото, показываем его
  if (user?.photo_url) {
    return (
      <img
        src={user.photo_url}
        alt={user.first_name || 'User'}
        className={`${sizeClass} rounded-full object-cover border-2 border-white shadow-lg`}
      />
    );
  }

  // Иначе показываем инициалы
  const initials = user?.first_name
    ? user.first_name.charAt(0).toUpperCase()
    : user?.username
    ? user.username.charAt(0).toUpperCase()
    : '?';

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-white flex items-center justify-center font-bold shadow-lg border-2 border-white`}
    >
      {initials}
    </div>
  );
}

