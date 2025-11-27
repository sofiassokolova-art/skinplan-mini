// app/admin/support/page.tsx
// Страница поддержки с чатами

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Send, User, Clock, AlertCircle, X } from 'lucide-react';
import { cn, glassCard } from '@/lib/utils';
// Простая функция форматирования времени
const formatTime = (date: string | Date) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

interface Chat {
  id: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    telegramId: string;
    profile?: any; // JSON с типом кожи, проблемами и т.д.
    createdAt: string;
  };
  lastMessage: string | null;
  unread: number;
  updatedAt: string;
  status: string;
}

interface Message {
  id: string;
  text: string;
  isAdmin: boolean;
  createdAt: string;
}

export default function SupportAdmin() {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id);
      // Polling для обновления сообщений каждые 2 секунды
      const interval = setInterval(() => {
        loadMessages(selectedChat.id);
        loadChats(); // Обновляем список чатов для счетчиков
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [selectedChat]);

  // Убрано автолистание - пользователь сам управляет прокруткой

  const loadChats = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/support/chats', {
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

      if (response.ok) {
        const data = await response.json();
        setChats(data.chats || []);
        // Не выбираем автоматически первый чат - показываем общий список
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (chatId: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/support/messages?chatId=${chatId}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const messagesList = data.messages || [];
        setMessages(messagesList);
        
        // Автоматически определяем статус на основе сообщений
        if (selectedChat && selectedChat.status !== 'closed') {
          // Проверяем, есть ли ответы оператора (не автоответ)
          const hasAdminReply = messagesList.some((msg: Message) => 
            msg.isAdmin && !msg.text.includes('Привет! Это поддержка SkinIQ') && !msg.text.includes('за пределами рабочего времени')
          );
          
          // Обновляем статус в selectedChat
          const newStatus = hasAdminReply ? 'in_progress' : 'active';
          if (selectedChat.status !== newStatus) {
            setSelectedChat({ ...selectedChat, status: newStatus });
            // Обновляем статус в БД
            updateChatStatus(selectedChat.id, newStatus);
          }
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedChat || sending) return;

    setSending(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/support/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
        body: JSON.stringify({
          chatId: selectedChat.id,
          text: replyText,
        }),
      });

      if (response.ok) {
        setReplyText('');
        await loadMessages(selectedChat.id);
        await loadChats();
        // Прокручиваем вниз только после отправки нового сообщения
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        alert('Ошибка отправки сообщения');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Ошибка отправки сообщения');
    } finally {
      setSending(false);
    }
  };

  const sendTemplate = (template: string) => {
    setReplyText(template);
  };

  const openUserProfile = (userId: string) => {
    router.push(`/admin/users?userId=${userId}`);
  };

  const updateChatStatus = async (chatId: string, status: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      await fetch('/api/admin/support/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
        body: JSON.stringify({
          chatId,
          status,
        }),
      });
    } catch (error) {
      console.error('Error updating chat status:', error);
    }
  };

  const handleCloseChat = async () => {
    if (!selectedChat) return;
    
    if (!confirm('Вы уверены, что хотите закрыть это обращение? При новом сообщении от пользователя будет создано новое обращение.')) {
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/support/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
        body: JSON.stringify({
          chatId: selectedChat.id,
          status: 'closed',
        }),
      });

      if (response.ok) {
        // Обновляем статус в текущем чате
        setSelectedChat({ ...selectedChat, status: 'closed' });
        // Обновляем список чатов
        await loadChats();
      } else {
        const error = await response.json();
        alert('Ошибка закрытия обращения: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error closing chat:', error);
      alert('Ошибка закрытия обращения');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 h-[calc(100vh-4rem)] bg-gray-100">
      {/* Левая колонка — список чатов */}
      <div className={cn(glassCard, 'border-r border-gray-200 overflow-y-auto bg-white', selectedChat && 'hidden lg:block')}>
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Чаты поддержки</h2>
          <p className="text-sm text-gray-600 mt-1">{chats.length} активных</p>
        </div>
        {chats.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>Нет активных чатов</p>
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={cn(
                'p-4 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-200',
                selectedChat?.id === chat.id && 'bg-gray-100'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-white font-bold">
                  {chat.user.firstName?.[0]?.toUpperCase() || chat.user.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-bold text-gray-900 truncate">
                      {chat.user.firstName || chat.user.username || 'Аноним'}
                    </div>
                    {/* Статус обращения */}
                    <div className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      chat.status === 'closed' 
                        ? 'bg-gray-200 text-gray-700'
                        : chat.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-yellow-100 text-yellow-700'
                    )}>
                      {chat.status === 'closed' 
                        ? 'Закрыто'
                        : chat.status === 'in_progress'
                        ? 'В работе'
                        : 'Ждет ответа'}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 truncate">{chat.lastMessage || 'Нет сообщений'}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {formatTime(chat.updatedAt)}
                  </div>
                </div>
                {chat.unread > 0 && (
                  <div className="px-2 py-1 bg-gradient-to-r from-[#EC4899] to-[#8B5CF6] text-white text-xs font-bold rounded-full min-w-[24px] text-center">
                    {chat.unread}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Правая часть — выбранный чат */}
      <div className={cn('flex flex-col bg-white', selectedChat ? 'lg:col-span-3' : 'lg:col-span-4')}>
        {selectedChat ? (
          <>
            {/* Хедер чата */}
            <div className={cn(glassCard, 'p-4 border-b border-gray-200 flex items-center justify-between bg-white')}>
              <div className="flex items-center gap-4 flex-1">
                {/* Кнопка "Назад" для мобильных */}
                <button
                  onClick={() => setSelectedChat(null)}
                  className="lg:hidden px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ←
                </button>
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-white font-bold text-2xl">
                  {selectedChat.user.firstName?.[0]?.toUpperCase() || selectedChat.user.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xl text-gray-900">
                    {selectedChat.user.firstName || selectedChat.user.username || 'Аноним'}
                    {selectedChat.user.lastName && ` ${selectedChat.user.lastName}`}
                  </div>
                  <div className="text-sm text-gray-600">
                    @{selectedChat.user.username || 'нет username'} • ID: {selectedChat.user.telegramId}
                  </div>
                  {selectedChat.user.profile && (
                    <div className="text-xs text-gray-500 mt-1">
                      {selectedChat.user.profile.skinType && (
                        <span className="mr-2">Тип кожи: {selectedChat.user.profile.skinType}</span>
                      )}
                      {selectedChat.user.profile.concerns && Array.isArray(selectedChat.user.profile.concerns) && selectedChat.user.profile.concerns.length > 0 && (
                        <span>Проблемы: {selectedChat.user.profile.concerns.join(', ')}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Статус отображается автоматически */}
                <div className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium',
                  selectedChat.status === 'closed' 
                    ? 'bg-gray-200 text-gray-700'
                    : selectedChat.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-yellow-100 text-yellow-700'
                )}>
                  {selectedChat.status === 'closed' 
                    ? 'Закрыто'
                    : selectedChat.status === 'in_progress'
                    ? 'В работе'
                    : 'Ждет ответа'}
                </div>
                {selectedChat.status !== 'closed' && (
                  <button
                    onClick={handleCloseChat}
                    className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all flex items-center gap-2"
                  >
                    <X size={16} />
                    Закрыть
                  </button>
                )}
                <button
                  onClick={() => openUserProfile(selectedChat.user.id)}
                  className="px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all"
                >
                  Профиль →
                </button>
                {/* Кнопка "Назад к списку" для десктопа */}
                <button
                  onClick={() => setSelectedChat(null)}
                  className="hidden lg:block px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                  title="Назад к списку чатов"
                >
                  ← Назад
                </button>
              </div>
            </div>

            {/* Сообщения */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <p>Нет сообщений</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={msg.isAdmin ? 'text-right' : 'text-left'}>
                    <div
                      className={cn(
                        'inline-block max-w-lg p-4 rounded-2xl',
                        msg.isAdmin
                          ? 'bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white'
                          : 'bg-white border border-gray-200 text-gray-900'
                      )}
                    >
                      {msg.text}
                    </div>
                    <div className="text-xs text-gray-400 mt-1 px-2">
                      {formatTime(msg.createdAt)}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Поле ввода */}
            <div className={cn(glassCard, 'p-4 border-t border-gray-200 bg-white')}>
              <div className="flex gap-4">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Напишите ответ..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  rows={3}
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 resize-none"
                />
                <button
                  onClick={sendReply}
                  disabled={sending || !replyText.trim()}
                  className="px-8 py-4 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send size={20} />
                  Отправить
                </button>
              </div>
              <div className="flex gap-4 mt-4">
                <button
                  onClick={() => sendTemplate('Спасибо за обращение! Ваш план уже обновлён')}
                  className="text-sm px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  Спасибо, план обновлён
                </button>
                <button
                  onClick={() => sendTemplate('Скидка 15% на ваш следующий заказ → https://t.me/skiniq_bot')}
                  className="text-sm px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  Скидка 15%
                </button>
                <button
                  onClick={() => sendTemplate('Проверьте ваш план ухода, он был обновлён с учётом ваших потребностей')}
                  className="text-sm px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  План обновлён
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <User size={64} className="mx-auto mb-4 opacity-20" />
              <p>Выберите чат</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

