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
  // ИСПРАВЛЕНО: Поддержка subQuestions для compound-правил (как в JSON)
  subQuestions?: Array<{
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
 * ИСПРАВЛЕНО: Применяет правило к профилю на основе ответа пользователя
 * Поддерживает subQuestions для compound-правил и single_choice_conditional
 */
function applyRule(
  rule: Rule,
  answerValue: string | string[] | { subKey: string; value: string },
  profile: SkinProfile,
  // ИСПРАВЛЕНО: Добавлен answersByCode для проверки условий в single_choice_conditional
  answersByCode?: Map<string, string | string[]>
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
  } else if (rule.type === 'compound') {
    // ИСПРАВЛЕНО: Для compound-правил используем subQuestions (как в JSON), а не fields
    const subQuestions = rule.subQuestions || rule.fields || [];
    
    if (typeof answerValue === 'object' && !Array.isArray(answerValue) && 'subKey' in answerValue) {
      const subQuestion = subQuestions.find(sq => sq.subKey === answerValue.subKey);
      if (subQuestion) {
        // ИСПРАВЛЕНО: Проверяем условие для single_choice_conditional
        if (subQuestion.type === 'single_choice_conditional' && subQuestion.condition && answersByCode) {
          const dependsOnValue = answersByCode.get(subQuestion.condition.dependsOn);
          const conditionMet = Array.isArray(dependsOnValue)
            ? dependsOnValue.includes(subQuestion.condition.equals)
            : dependsOnValue === subQuestion.condition.equals;
          
          // Если условие не выполнено, не применяем правило
          if (!conditionMet) {
            return;
          }
        }

        if (subQuestion.options) {
          const option = subQuestion.options.find(opt => opt.label === answerValue.value);
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

  // ИСПРАВЛЕНО: Создаем мапу ответов по кодам для проверки условий в single_choice_conditional
  const answersByCode = new Map<string, string | string[]>();
  userAnswers.forEach(answer => {
    if (answer.questionCode) {
      let value: string | string[] | null = null;
      if (answer.answerOptionLabels && Array.isArray(answer.answerOptionLabels) && answer.answerOptionLabels.length > 0) {
        value = answer.answerOptionLabels.length === 1 ? answer.answerOptionLabels[0] : answer.answerOptionLabels;
      } else if (answer.answerValues && Array.isArray(answer.answerValues)) {
        value = answer.answerValues.length === 1 ? answer.answerValues[0] : answer.answerValues;
      } else if (answer.answerValue) {
        value = answer.answerValue;
      }
      if (value !== null) {
        answersByCode.set(answer.questionCode, value);
      }
    }
  });

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
      // Если массив содержит один элемент, используем строку (для single_choice)
      // Если несколько элементов, используем массив (для multi_choice)
      answerValue = answer.answerOptionLabels.length === 1 
        ? answer.answerOptionLabels[0] 
        : answer.answerOptionLabels;
    } else if (answer.answerValues && Array.isArray(answer.answerValues)) {
      answerValue = answer.answerValues;
    } else if (answer.answerValue) {
      answerValue = answer.answerValue;
    }

    if (answerValue !== null) {
      // ИСПРАВЛЕНО: Передаем answersByCode для проверки условий
      applyRule(rule, answerValue, profile, answersByCode);
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

