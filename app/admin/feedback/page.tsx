// app/admin/feedback/page.tsx
// Страница обратной связи

'use client';

import { useEffect, useState } from 'react';

export default function FeedbackAdmin() {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<any[]>([]);

  useEffect(() => {
    // TODO: Загрузить все отзывы
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-8">Обратная связь</h1>
      <div className="bg-white rounded-3xl p-6 shadow-lg">
        <p className="text-gray-500">Страница в разработке</p>
      </div>
    </div>
  );
}

