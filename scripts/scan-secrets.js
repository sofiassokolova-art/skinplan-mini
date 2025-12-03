#!/usr/bin/env node
// scripts/scan-secrets.js
// Простой скрипт для сканирования потенциальных секретов в коде

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SECRET_PATTERNS = [
  // API Keys
  /api[_-]?key\s*[:=]\s*["']([^"']{20,})["']/gi,
  /apikey\s*[:=]\s*["']([^"']{20,})["']/gi,
  
  // Tokens
  /token\s*[:=]\s*["']([^"']{20,})["']/gi,
  /bearer\s+["']([^"']{20,})["']/gi,
  
  // Secrets
  /secret\s*[:=]\s*["']([^"']{20,})["']/gi,
  /jwt[_-]?secret\s*[:=]\s*["']([^"']{10,})["']/gi,
  
  // Passwords
  /password\s*[:=]\s*["']([^"']{8,})["']/gi,
  /pwd\s*[:=]\s*["']([^"']{8,})["']/gi,
  
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
  /dist/,
  /\.next/,
  /build/,
  /coverage/,
  /\.env\.example/,
  /scripts\/scan-secrets\.js/, // Сам скрипт
  /\.md$/, // Документация (может содержать примеры)
];

const ALLOWED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'];

function shouldIgnorePath(filePath) {
  return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
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
        
        issues.push({
          line: lineNumber,
          column: matchIndex - content.lastIndexOf('\n', matchIndex - 1),
          match: match[0].substring(0, 50) + (match[0].length > 50 ? '...' : ''),
          pattern: `Pattern ${index + 1}`,
          context: line.trim(),
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
      console.log(`   Line ${line}: ${match.substring(0, 30)}...`);
      console.log(`   Context: ${context.substring(0, 80)}${context.length > 80 ? '...' : ''}`);
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

