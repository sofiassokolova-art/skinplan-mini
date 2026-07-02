#!/usr/bin/env node
// scripts/scan-secrets.js
// Простой скрипт для сканирования потенциальных секретов в коде

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SENSITIVE_CONTEXT_CHARS = 4;

const SECRET_PATTERNS = [
  // API Keys
  /api[_-]?key\s*[:=]\s*["']?([A-Za-z0-9_./+=:-]{20,})["']?/gi,
  /apikey\s*[:=]\s*["']?([A-Za-z0-9_./+=:-]{20,})["']?/gi,
  
  // Tokens
  /token\s*[:=]\s*["']?([A-Za-z0-9_./+=:-]{20,})["']?/gi,
  /bearer\s+["']?([A-Za-z0-9._~+/=-]{20,})["']?/gi,
  
  // Secrets
  /secret\s*[:=]\s*["']?([A-Za-z0-9_./+=:-]{20,})["']?/gi,
  /jwt[_-]?secret\s*[:=]\s*["']?([A-Za-z0-9_./+=:-]{20,})["']?/gi,
  
  // Passwords
  /password\s*[:=]\s*["']?([A-Za-z0-9_./+=:-]{20,})["']?/gi,
  /pwd\s*[:=]\s*["']?([A-Za-z0-9_./+=:-]{20,})["']?/gi,
  /password\s*[:=]\s*["']?(admin123|password|changeme|qwerty123|12345678)["']?/gi,
  
  // Database URLs (частично)
  /postgres:\/\/[^:]+:[^@]+@/gi,
  /mysql:\/\/[^:]+:[^@]+@/gi,
  /mongodb:\/\/[^:]+:[^@]+@/gi,
  
  // Telegram tokens (формат)
  /\d{8,10}:[A-Za-z0-9_-]{35}/g,
  
  // AWS keys
  /AKIA[0-9A-Z]{16}/g,
  /aws[_-]?secret[_-]?access[_-]?key\s*[:=]/gi,
  
  // GitHub tokens
  /ghp_[A-Za-z0-9]{36}/g,
  /github[_-]?token\s*[:=]/gi,
  
  // JWT tokens (длинные строки)
  /eyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\./g,
];

const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.agents/,
  /\.claude/,
  /\.cursor/,
  /\.design/,
  /\.vercel/,
  /dist/,
  /\.next/,
  /build/,
  /coverage/,
  /test-results/,
  /playwright-report/,
  /(^|\/)\.env($|\.local$|\.(development|production|test)(\.local)?$)/,
  /\.env\.example/,
  /scripts\/scan-secrets\.js/, // Сам скрипт
  /\.md$/, // Документация (может содержать примеры)
];

const ALLOWED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'];

function shouldIgnorePath(filePath) {
  return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
}

function redactSensitiveText(value) {
  if (!value) return '[REDACTED]';
  const text = String(value).replace(/\s+/g, ' ');
  if (text.length <= SENSITIVE_CONTEXT_CHARS * 2) {
    return '[REDACTED]';
  }
  return `${text.slice(0, SENSITIVE_CONTEXT_CHARS)}…${text.slice(-SENSITIVE_CONTEXT_CHARS)}`;
}

function redactLineContext(line, matchedText) {
  if (!line) return '';
  return line.replace(matchedText, redactSensitiveText(matchedText)).slice(0, 120);
}

function isNonSecretReference(candidate, line) {
  const value = String(candidate || '');
  const lowerLine = line.toLowerCase();

  return (
    value.includes('process.env') ||
    value.includes('localStorage') ||
    value.includes('sessionStorage') ||
    value.includes('getItem') ||
    /^[A-Z0-9_]+$/.test(value) ||
    lowerLine.includes('process.env') ||
    lowerLine.includes('localstorage.getitem') ||
    lowerLine.includes('sessionstorage.getitem') ||
    lowerLine.includes('pgpassword')
  );
}

function scanFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const issues = [];
    
    SECRET_PATTERNS.forEach((pattern, index) => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        // Пропускаем комментарии и документацию
        const matchIndex = match.index;
        const beforeMatch = content.substring(Math.max(0, matchIndex - 50), matchIndex);
        
        // Пропускаем, если это в комментарии
        if (beforeMatch.includes('//') || beforeMatch.includes('/*') || beforeMatch.includes('*')) {
          const lastNewline = beforeMatch.lastIndexOf('\n');
          const lineContent = beforeMatch.substring(lastNewline + 1);
          if (lineContent.includes('//') || lineContent.includes('/*')) {
            continue;
          }
        }
        
        // Пропускаем примеры и документацию
        if (beforeMatch.toLowerCase().includes('example') || 
            beforeMatch.toLowerCase().includes('документация') ||
            beforeMatch.toLowerCase().includes('TODO') ||
            beforeMatch.toLowerCase().includes('FIXME')) {
          continue;
        }
        
        const lineNumber = content.substring(0, matchIndex).split('\n').length;
        const line = content.split('\n')[lineNumber - 1];
        const lowerLine = line.toLowerCase();
        const candidate = match[1] || match[0];

        if (
          lowerLine.includes('example') ||
          lowerLine.includes('например') ||
          lowerLine.includes('your_') ||
          lowerLine.includes('your-') ||
          lowerLine.includes('user:pass') ||
          lowerLine.includes('user:password') ||
          lowerLine.includes('placeholder')
        ) {
          continue;
        }

        if (isNonSecretReference(candidate, line)) {
          continue;
        }
        
        issues.push({
          line: lineNumber,
          column: matchIndex - content.lastIndexOf('\n', matchIndex - 1),
          match: redactSensitiveText(match[0]),
          pattern: `Pattern ${index + 1}`,
          context: redactLineContext(line.trim(), match[0]),
        });
      }
    });
    
    return issues;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return [];
  }
}

function scanDirectory(dir, allIssues = []) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const filePath = join(dir, file);
    
    if (shouldIgnorePath(filePath)) {
      continue;
    }
    
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      scanDirectory(filePath, allIssues);
    } else if (stat.isFile()) {
      const ext = extname(filePath);
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        const issues = scanFile(filePath);
        if (issues.length > 0) {
          allIssues.push({ file: filePath, issues });
        }
      }
    }
  }
  
  return allIssues;
}

// Main
const projectRoot = join(process.cwd());
console.log('🔍 Scanning for potential secrets...\n');

const allIssues = scanDirectory(projectRoot);

if (allIssues.length === 0) {
  console.log('✅ No potential secrets found!');
  process.exit(0);
} else {
  console.log(`⚠️  Found ${allIssues.length} file(s) with potential secrets:\n`);
  
  allIssues.forEach(({ file, issues }) => {
    console.log(`📄 ${file}`);
    issues.forEach(({ line, match, context }) => {
      console.log(`   Line ${line}: ${match}`);
      console.log(`   Context: ${context}`);
    });
    console.log();
  });
  
  console.log('❌ Please review these findings and ensure no real secrets are committed!');
  console.log('💡 Tips:');
  console.log('   - Move secrets to environment variables (.env)');
  console.log('   - Add .env to .gitignore');
  console.log('   - Use .env.example for documentation');
  console.log('   - Review false positives (comments, examples, documentation)');
  
  process.exit(1);
}
