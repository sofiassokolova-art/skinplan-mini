// scripts/check-hooks-order.ts
// Скрипт для проверки порядка хуков React в компонентах
// Проверяет, что все хуки вызываются до ранних return'ов

import { readFileSync } from 'fs';
import { join } from 'path';

interface HookIssue {
  type: 'hook_after_return';
  hookLine: number;
  returnLine: number;
  hook: string;
  return: string;
}

function checkHooksOrder(filePath: string): { issues: HookIssue[]; hookCount: number; hooksBeforeReturn: boolean } {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  let hookCount = 0;
  let earlyReturnLine: number | null = null;
  let hooksBeforeReturn = true;
  let functionStartLine: number | null = null;
  const issues: HookIssue[] = [];

  // Находим начало функции компонента
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('export default function') || lines[i].includes('function ') && lines[i].includes('()')) {
      // Проверяем, что это не вложенная функция
      const indent = lines[i].length - lines[i].trimStart().length;
      if (indent <= 2) {
        functionStartLine = i + 1;
        break;
      }
    }
  }

  if (!functionStartLine) {
    console.error('❌ Function not found');
    return { issues: [], hookCount: 0, hooksBeforeReturn: false };
  }

  console.log(`📍 Function starts at line ${functionStartLine}\n`);

  // Проверяем хуки и ранние return'ы
  for (let i = functionStartLine - 1; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmedLine = line.trim();
    
    // Проверяем, вышли ли мы из функции компонента
    // Ищем закрывающую скобку на уровне компонента (мало отступов)
    if (trimmedLine === '}' && line.match(/^}$/)) {
      const indentLevel = line.length - trimmedLine.length;
      if (indentLevel <= 2) {
        // Вероятно, это конец компонента
        break;
      }
    }
    
    // Проверяем хуки
    const hookMatch = line.match(/(useState|useRef|useEffect|useMemo|useCallback|useRouter|useTelegram|useContext|useReducer|useLayoutEffect)/);
    if (hookMatch) {
      hookCount++;
      if (earlyReturnLine) {
        const issue: HookIssue = {
          type: 'hook_after_return',
          hookLine: lineNum,
          returnLine: earlyReturnLine,
          hook: trimmedLine.substring(0, 100),
          return: lines[earlyReturnLine - 1].trim().substring(0, 100),
        };
        issues.push(issue);
        hooksBeforeReturn = false;
      }
    }
    
    // Проверяем ранние return'ы
    // Ищем паттерны:
    // 1. "if (...)" за которым следует "return" на следующей строке
    // 2. "if (...) return" на одной строке
    // 3. "return (" на отдельной строке (но не в конце функции)
    const isEarlyReturn = 
      trimmedLine.match(/^if \(.*\) \{?\s*return/) || // if (...) return или if (...) { return
      (trimmedLine.match(/^if \(.*\)$/) && i + 1 < lines.length && lines[i + 1].trim().startsWith('return')) || // if (...) на одной строке, return на следующей
      (trimmedLine.match(/^return \(/) && i < lines.length - 50); // return ( но не в конце функции
    
    if (isEarlyReturn) {
      // Проверяем, что это не внутри вложенной функции
      let isInNestedFunction = false;
      const indentLevel = line.length - trimmedLine.length;
      
      // Проверяем предыдущие строки на наличие объявлений функций
      for (let j = i - 1; j >= functionStartLine - 1; j--) {
        const prevLine = lines[j];
        const prevTrimmed = prevLine.trim();
        
        // Ищем объявления функций, стрелочных функций, методов
        if (prevTrimmed.match(/^(const|let|var|function|async function|class)\s+\w+\s*[=:]/) ||
            prevTrimmed.match(/^\w+\s*[:=]\s*(async\s+)?\(/)) {
          const prevIndent = prevLine.length - prevTrimmed.length;
          if (prevIndent >= indentLevel - 2) {
            isInNestedFunction = true;
            break;
          }
        }
      }
      
      if (!isInNestedFunction && !earlyReturnLine) {
        earlyReturnLine = lineNum;
      }
    }
  }

  return { issues, hookCount, hooksBeforeReturn };
}

// Запускаем проверку для quiz/page.tsx
const filePath = join(process.cwd(), 'app/(miniapp)/quiz/page.tsx');
const result = checkHooksOrder(filePath);

console.log(`📊 Summary:`);
console.log(`   Total hooks found: ${result.hookCount}`);
console.log(`   Hooks before early returns: ${result.hooksBeforeReturn ? '✅ YES' : '❌ NO'}`);
console.log(`   Issues found: ${result.issues.length}`);

if (result.issues.length > 0) {
  console.log(`\n❌ Found ${result.issues.length} hooks after early returns!`);
  console.log(`   This can cause React Error #310: "Rendered more hooks than during the previous render"\n`);
  
  result.issues.forEach((issue, idx) => {
    console.log(`   Issue ${idx + 1}:`);
    console.log(`     Return at line ${issue.returnLine}: ${issue.return}`);
    console.log(`     Hook at line ${issue.hookLine}: ${issue.hook}`);
    console.log('');
  });
  
  process.exit(1);
} else {
  console.log(`\n✅ All hooks are before early returns!`);
  process.exit(0);
}

