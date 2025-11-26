// components/WeekCalendar.tsx
// Горизонтальный календарь недель

'use client';

interface WeekCalendarProps {
  weeks: Array<{
    week: number;
    days: Array<{
      morning: number[];
      evening: number[];
    }>;
  }>;
  currentWeek: number;
  completedDays: number[];
  onWeekChange?: (week: number) => void;
}

export function WeekCalendar({ 
  weeks, 
  currentWeek, 
  completedDays,
  onWeekChange 
}: WeekCalendarProps) {
  const getWeekProgress = (week: number) => {
    const startDay = (week - 1) * 7 + 1;
    const endDay = week * 7;
    const weekDays = Array.from({ length: 7 }, (_, i) => startDay + i);
    const completed = weekDays.filter(day => completedDays.includes(day)).length;
    return Math.round((completed / 7) * 100);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
      {weeks.map((week) => {
        const progress = getWeekProgress(week.week);
        const isActive = week.week === currentWeek;
        
        return (
          <button
            key={week.week}
            onClick={() => onWeekChange?.(week.week)}
            className={`px-6 py-4 rounded-2xl font-bold transition-all whitespace-nowrap ${
              isActive
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="text-lg">Неделя {week.week}</div>
            <div className={`text-xs mt-1 ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
              {progress}% выполнено
            </div>
          </button>
        );
      })}
    </div>
  );
}
