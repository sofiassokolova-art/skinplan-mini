// app/admin/replacements/page.tsx
// Страница замен продуктов

'use client';

import { useEffect, useState } from 'react';

export default function ReplacementsAdmin() {
  const [loading, setLoading] = useState(true);
  const [replacements, setReplacements] = useState<any[]>([]);

  useEffect(() => {
    // TODO: Загрузить все замены
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-8">Замены продуктов</h1>
      <div className="bg-white rounded-3xl p-6 shadow-lg">
        <p className="text-gray-500">Страница в разработке</p>
      </div>
    </div>
  );
}

