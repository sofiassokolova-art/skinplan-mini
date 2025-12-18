// components/admin/MultiSelectWithSearch.tsx
// Компонент множественного выбора с поиском для админки

'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSelectWithSearchProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  maxDisplay?: number; // Максимальное количество отображаемых тегов
}

export function MultiSelectWithSearch({
  options,
  value,
  onChange,
  placeholder = 'Выберите опции...',
  label,
  className,
  disabled = false,
  maxDisplay = 2,
}: MultiSelectWithSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOptions = options.filter((opt) => value.includes(opt.value));

  const filteredOptions = options.filter(
    (opt) =>
      !opt.disabled &&
      (opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opt.value.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleRemove = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
  };

  const displayTags = selectedOptions.slice(0, maxDisplay);
  const remainingCount = selectedOptions.length - maxDisplay;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {label && (
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            'w-full min-h-[48px] px-4 py-2 bg-white border border-gray-300 rounded-lg text-left',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
            'flex items-center flex-wrap gap-2',
            disabled && 'opacity-50 cursor-not-allowed',
            !disabled && 'hover:border-gray-400 cursor-pointer'
          )}
        >
          {selectedOptions.length === 0 ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : (
            <>
              {displayTags.map((option) => (
                <span
                  key={option.value}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 rounded-md text-sm"
                >
                  {option.label}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => handleRemove(option.value, e)}
                      className="hover:bg-indigo-200 rounded p-0.5"
                    >
                      <X size={14} />
                    </button>
                  )}
                </span>
              ))}
              {remainingCount > 0 && (
                <span className="text-sm text-gray-500">
                  +{remainingCount} еще
                </span>
              )}
            </>
          )}
          <ChevronDown
            size={20}
            className={cn(
              'text-gray-400 transition-transform ml-auto',
              isOpen && 'transform rotate-180'
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col">
            {/* Поле поиска */}
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Список опций */}
            <div className="overflow-y-auto max-h-48">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  Ничего не найдено
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = value.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleToggle(option.value)}
                      className={cn(
                        'w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors',
                        'flex items-center gap-2',
                        isSelected && 'bg-indigo-50 text-indigo-900',
                        option.disabled && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div
                        className={cn(
                          'w-4 h-4 border rounded flex items-center justify-center flex-shrink-0',
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'border-gray-300'
                        )}
                      >
                        {isSelected && (
                          <Check size={12} className="text-white" />
                        )}
                      </div>
                      <span>{option.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

