// components/DayRoutine.tsx
// Одна рутина дня (утро/вечер)

'use client';

import { ReactNode } from 'react';

interface DayRoutineProps {
  product: {
    id: number;
    name: string;
    brand: { name: string };
    price: number;
    imageUrl?: string | null;
    step: string;
  };
  stepNumber: number;
  children: ReactNode;
  isNew?: boolean;
}

const stepLabels: Record<string, string> = {
  cleanser: 'Очищение',
  toner: 'Тонер',
  serum: 'Сыворотка',
  treatment: 'Актив',
  moisturizer: 'Увлажнение',
  spf: 'SPF',
};

export function DayRoutine({ product, stepNumber, children, isNew }: DayRoutineProps) {
  return (
    <div className="bg-white/56 backdrop-blur-[28px] rounded-2xl p-5 border border-white/20">
      <div className="flex items-start gap-4">
        {/* Номер шага */}
        <div className="w-12 h-12 rounded-full bg-[#0A5F59] text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
          {stepNumber}
        </div>
        
        {/* Контент */}
        <div className="flex-1">
          <div className="text-sm font-medium text-[#475467] mb-1">
            {stepLabels[product.step] || product.step}
          </div>
          
          {children}
          
          {isNew && (
            <span className="inline-block mt-2 px-4 py-1 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-bold rounded-full">
              New Актив недели
            </span>
          )}
        </div>
        
        {/* Изображение продукта */}
        {product.imageUrl && (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-16 h-16 object-cover rounded-xl flex-shrink-0"
          />
        )}
      </div>
    </div>
  );
}
