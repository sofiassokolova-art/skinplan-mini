// lib/protocol-plan-integration.ts
// ИСПРАВЛЕНО: Интеграция дерматологических протоколов в генерацию плана
// Использует протоколы для определения дней (active/barrier/recovery) и ограничения частоты активных ингредиентов

import type { DermatologyProtocol } from './dermatology-protocols';
import type { PlanPhases } from './plan-types';
import type { ActiveIngredient } from './ingredient-compatibility';
import { logger } from './logger';

/**
 * Определяет фазу дня на основе протокола
 * ИСПРАВЛЕНО: Использует протокол для определения active/barrier/recovery дней
 */
export function getPhaseForDayFromProtocol(
  dayIndex: number,
  protocol: DermatologyProtocol,
  week: number
): PlanPhases {
  // Базовые фазы по дням (1-7: adaptation, 8-21: active, 22-28: support)
  const basePhase = dayIndex <= 7 ? 'adaptation' : dayIndex <= 21 ? 'active' : 'support';
  
  // ИСПРАВЛЕНО: Используем протокол для определения barrier/recovery дней
  // Если протокол требует постепенного введения активных ингредиентов,
  // первые дни могут быть barrier (только базовый уход)
  
  // Для протоколов с titrationSchedule первые дни могут быть barrier
  if (protocol.titrationSchedule && protocol.titrationSchedule.length > 0) {
    const weekFrequency = protocol.titrationSchedule[0];
    const allowedFrequency = week === 1 ? weekFrequency.week1 :
                            week === 2 ? weekFrequency.week2 :
                            week === 3 ? weekFrequency.week3 :
                            weekFrequency.week4;
    
    // Если частота применения очень низкая (1-2 раза в неделю), первые дни - barrier
    if (week === 1 && allowedFrequency <= 2) {
      const dayOfWeek = ((dayIndex - 1) % 7) + 1;
      // Если это не день применения активного ингредиента - barrier
      if (dayOfWeek > allowedFrequency) {
        return 'adaptation'; // Используем adaptation как barrier
      }
    }
  }
  
  return basePhase;
}

/**
 * Проверяет, можно ли применять активный ингредиент в этот день согласно протоколу
 * ИСПРАВЛЕНО: Использует cyclingRules и titrationSchedule из протокола
 */
export function canApplyActiveIngredient(
  ingredient: ActiveIngredient,
  dayIndex: number,
  week: number,
  protocol: DermatologyProtocol
): { allowed: boolean; reason?: string } {
  // Проверяем, разрешен ли ингредиент в протоколе
  if (protocol.forbiddenIngredients.includes(ingredient)) {
    return {
      allowed: false,
      reason: `Ингредиент ${ingredient} запрещен в протоколе ${protocol.name}`,
    };
  }
  
  // Проверяем titrationSchedule
  if (protocol.titrationSchedule) {
    const schedule = protocol.titrationSchedule.find(s => s.ingredient === ingredient);
    if (schedule) {
      const allowedFrequency = week === 1 ? schedule.week1 :
                              week === 2 ? schedule.week2 :
                              week === 3 ? schedule.week3 :
                              schedule.week4;
      
      // Подсчитываем, сколько раз уже применяли в этой неделе
      const dayOfWeek = ((dayIndex - 1) % 7) + 1;
      const weekStartDay = ((week - 1) * 7) + 1;
      const daysInWeek = Math.min(7, 28 - weekStartDay + 1);
      
      // Упрощенная проверка: если частота ограничена, применяем через день
      if (allowedFrequency < daysInWeek) {
        const daysBetween = Math.floor(daysInWeek / allowedFrequency);
        if (dayOfWeek % (daysBetween + 1) !== 1 && dayOfWeek !== 1) {
          return {
            allowed: false,
            reason: `Ингредиент ${ingredient} можно применять только ${allowedFrequency} раз(а) в неделю согласно протоколу`,
          };
        }
      }
    }
  }
  
  // Проверяем cyclingRules
  if (protocol.cyclingRules) {
    const rule = protocol.cyclingRules.find(r => r.ingredient === ingredient);
    if (rule) {
      const dayOfWeek = ((dayIndex - 1) % 7) + 1;
      
      if (rule.frequency === 'every_other_day') {
        // Через день: применяем в нечетные дни недели
        if (dayOfWeek % 2 === 0) {
          return {
            allowed: false,
            reason: `Ингредиент ${ingredient} применяется через день согласно протоколу`,
          };
        }
      } else if (rule.frequency === '2x_week') {
        // 2 раза в неделю: применяем в указанные дни или по умолчанию во вторник и пятницу
        const allowedDays = rule.days || [2, 5];
        if (!allowedDays.includes(dayOfWeek)) {
          return {
            allowed: false,
            reason: `Ингредиент ${ingredient} применяется только ${allowedDays.join(' и ')} день(дня) недели согласно протоколу`,
          };
        }
      } else if (rule.frequency === '1x_week') {
        // 1 раз в неделю: применяем только в указанный день
        const allowedDays = rule.days || [3];
        if (!allowedDays.includes(dayOfWeek)) {
          return {
            allowed: false,
            reason: `Ингредиент ${ingredient} применяется только ${allowedDays[0]} день недели согласно протоколу`,
          };
        }
      }
    }
  }
  
  return { allowed: true };
}

/**
 * Определяет, является ли день barrier/recovery днем на основе протокола
 * ИСПРАВЛЕНО: Использует протокол для определения дней восстановления
 */
export function isBarrierDay(
  dayIndex: number,
  week: number,
  protocol: DermatologyProtocol
): boolean {
  // Для протоколов с низкой частотой применения активных ингредиентов
  // некоторые дни могут быть barrier (только базовый уход)
  if (protocol.titrationSchedule && protocol.titrationSchedule.length > 0) {
    const schedule = protocol.titrationSchedule[0];
    const allowedFrequency = week === 1 ? schedule.week1 :
                            week === 2 ? schedule.week2 :
                            week === 3 ? schedule.week3 :
                            schedule.week4;
    
    // Если частота очень низкая (1-2 раза в неделю), большинство дней - barrier
    if (allowedFrequency <= 2) {
      const dayOfWeek = ((dayIndex - 1) % 7) + 1;
      // Первые дни недели могут быть barrier
      if (dayOfWeek <= 2 && week === 1) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Получает максимальную частоту применения активного ингредиента для недели
 * ИСПРАВЛЕНО: Использует протокол для определения частоты
 */
export function getMaxFrequencyForWeek(
  ingredient: ActiveIngredient,
  week: number,
  protocol: DermatologyProtocol
): number {
  if (protocol.titrationSchedule) {
    const schedule = protocol.titrationSchedule.find(s => s.ingredient === ingredient);
    if (schedule) {
      return week === 1 ? schedule.week1 :
             week === 2 ? schedule.week2 :
             week === 3 ? schedule.week3 :
             schedule.week4;
    }
  }
  
  // Если нет расписания, возвращаем максимальную частоту (7 раз в неделю)
  return 7;
}

