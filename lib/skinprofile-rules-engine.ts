// lib/skinprofile-rules-engine.ts
// Рантайм для применения JSON-правил к SkinProfile

import { SkinProfile, createEmptySkinProfile } from './skinprofile-types';
import rulesData from './skinprofile-rules.json';

type RuleAction = {
  op: 'set' | 'setIfNull' | 'addToArray';
  path: string;
  value: any;
};

type RuleOption = {
  label: string;
  actions: RuleAction[];
};

type Rule = {
  id: number;
  key: string;
  type: string;
  options?: RuleOption[];
  fields?: Array<{
    subKey: string;
    type: string;
    options?: RuleOption[];
    condition?: {
      dependsOn: string;
      equals: string;
    };
  }>;
};

/**
 * Применяет действие к профилю
 */
function applyAction(profile: SkinProfile, action: RuleAction): void {
  const { op, path, value } = action;

  // Разбираем путь (поддержка вложенных путей, если понадобится)
  const pathParts = path.split('.');
  let target: any = profile;

  // Для простых путей (без вложенности) работаем напрямую
  if (pathParts.length === 1) {
    const key = pathParts[0] as keyof SkinProfile;

    switch (op) {
      case 'set':
        (profile as any)[key] = value;
        break;

      case 'setIfNull':
        if ((profile as any)[key] === null || (profile as any)[key] === undefined) {
          (profile as any)[key] = value;
        }
        break;

      case 'addToArray':
        const currentArray = (profile as any)[key];
        if (Array.isArray(currentArray)) {
          if (!currentArray.includes(value)) {
            currentArray.push(value);
          }
        } else {
          (profile as any)[key] = [value];
        }
        break;
    }
  }
}

/**
 * Применяет правило к профилю на основе ответа пользователя
 */
function applyRule(
  rule: Rule,
  answerValue: string | string[] | { subKey: string; value: string },
  profile: SkinProfile
): void {
  if (rule.type === 'group' && rule.fields) {
    // Для group-правил обрабатываем каждое поле отдельно
    if (typeof answerValue === 'object' && !Array.isArray(answerValue) && 'subKey' in answerValue) {
      const field = rule.fields.find(f => f.subKey === answerValue.subKey);
      if (field && field.options) {
        const option = field.options.find(opt => opt.label === answerValue.value);
        if (option) {
          option.actions.forEach(action => applyAction(profile, action));
        }
      }
    }
  } else if (rule.type === 'compound' && rule.fields) {
    // Для compound-правил обрабатываем subQuestions
    if (typeof answerValue === 'object' && !Array.isArray(answerValue) && 'subKey' in answerValue) {
      const field = rule.fields.find(f => f.subKey === answerValue.subKey);
      if (field) {
        // Проверяем условие, если есть
        if (field.condition) {
          // Для упрощения: если есть условие, проверяем зависимость
          // В реальности нужно проверять предыдущий ответ
          // Пока пропускаем условные правила или применяем всегда
        }

        if (field.options) {
          const option = field.options.find(opt => opt.label === answerValue.value);
          if (option) {
            option.actions.forEach(action => applyAction(profile, action));
          }
        }
      }
    }
  } else if (rule.options) {
    // Для single_choice и multi_choice
    if (Array.isArray(answerValue)) {
      // Множественный выбор
      answerValue.forEach(val => {
        const option = rule.options!.find(opt => opt.label === val);
        if (option) {
          option.actions.forEach(action => applyAction(profile, action));
        }
      });
    } else if (typeof answerValue === 'string') {
      // Одиночный выбор
      const option = rule.options.find(opt => opt.label === answerValue);
      if (option) {
        option.actions.forEach(action => applyAction(profile, action));
      }
    }
  }
}

/**
 * Создает SkinProfile из ответов анкеты, применяя JSON-правила
 */
export function buildSkinProfileFromAnswers(
  userAnswers: Array<{
    questionId: number;
    questionCode?: string;
    answerValue: string | null;
    answerValues: any;
    answerOptionLabels?: string[]; // ИСПРАВЛЕНО: Добавлено для маппинга values -> labels
  }>
): SkinProfile {
  const profile = createEmptySkinProfile();
  const rules = (rulesData as any).rules as Rule[];

  // ИСПРАВЛЕНО: Создаем мапу правил по ID вопроса И по ключу правила
  // Это позволяет маппить правила как по questionId (если совпадает с rule.id), так и по questionCode -> rule.key
  const rulesByQuestionId = new Map<number, Rule>();
  const rulesByKey = new Map<string, Rule>();
  
  rules.forEach(rule => {
    rulesByQuestionId.set(rule.id, rule);
    if (rule.key) {
      rulesByKey.set(rule.key, rule);
    }
  });

  // Маппинг questionCode -> rule.key (для обратной совместимости)
  const codeToKeyMap: Record<string, string> = {
    'skin_goals': 'goals_primary',
    'goals_primary': 'goals_primary',
    'skin_concerns': 'concerns_primary',
    'concerns_primary': 'concerns_primary',
  };

  // Применяем правила для каждого ответа
  userAnswers.forEach(answer => {
    // Сначала пробуем найти правило по questionId
    let rule = rulesByQuestionId.get(answer.questionId);
    
    // Если не найдено, пробуем найти по questionCode -> rule.key
    if (!rule && answer.questionCode) {
      const ruleKey = codeToKeyMap[answer.questionCode] || answer.questionCode;
      rule = rulesByKey.get(ruleKey);
    }
    
    if (!rule) return;

    // Определяем значение ответа
    let answerValue: string | string[] | { subKey: string; value: string } | null = null;

    // ИСПРАВЛЕНО: Если есть answerOptionLabels, используем их вместо answerValues
    // Это позволяет маппить values опций на labels для правил
    if (answer.answerOptionLabels && Array.isArray(answer.answerOptionLabels) && answer.answerOptionLabels.length > 0) {
      answerValue = answer.answerOptionLabels;
    } else if (answer.answerValues && Array.isArray(answer.answerValues)) {
      answerValue = answer.answerValues;
    } else if (answer.answerValue) {
      answerValue = answer.answerValue;
    }

    if (answerValue !== null) {
      applyRule(rule, answerValue, profile);
    }
  });

  return profile;
}

/**
 * Применяет одно правило к профилю (для тестирования/отладки)
 */
export function applyRuleToProfile(
  rule: Rule,
  answerValue: string | string[] | { subKey: string; value: string },
  profile: SkinProfile
): void {
  applyRule(rule, answerValue, profile);
}

