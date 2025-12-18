// components/admin/SelectWithSearch.tsx
// Компонент выпадающего списка с поиском для админки

'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectWithSearchProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

export function SelectWithSearch({
  options,
  value,
  onChange,
  placeholder = 'Выберите опцию...',
  label,
  required = false,
  className,
  disabled = false,
  allowClear = false,
}: SelectWithSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

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
      // Фокус на поле поиска при открытии
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    if (optionValue === value && allowClear) {
      onChange('');
    } else {
      onChange(optionValue);
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {label && (
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            'w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-left',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
            'flex items-center justify-between',
            disabled && 'opacity-50 cursor-not-allowed',
            !disabled && 'hover:border-gray-400 cursor-pointer'
          )}
        >
          <span
            className={cn(
              'flex-1 truncate',
              !selectedOption && 'text-gray-400'
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <div className="flex items-center gap-2 ml-2">
            {allowClear && value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                tabIndex={-1}
              >
                <X size={16} className="text-gray-400" />
              </button>
            )}
            <ChevronDown
              size={20}
              className={cn(
                'text-gray-400 transition-transform',
                isOpen && 'transform rotate-180'
              )}
            />
          </div>
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
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      'w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors',
                      option.value === value &&
                        'bg-indigo-50 text-indigo-900 font-medium',
                      option.disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {option.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

