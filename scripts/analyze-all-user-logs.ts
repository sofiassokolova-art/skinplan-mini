// scripts/analyze-all-user-logs.ts
// Анализ всех пользовательских логов для поиска проблем

import { prisma } from '../lib/db';

interface LogAnalysis {
  message: string;
  count: number;
  level: string;
  users: Set<string>;
  urls: Set<string>;
  firstSeen: Date;
  lastSeen: Date;
  examples: Array<{
    userId: string;
    telegramId: string;
    userName: string;
    url: string | null;
    context: any;
    timestamp: Date;
  }>;
}

async function analyzeAllUserLogs() {
  console.log('🔍 Анализирую все пользовательские логи...\n');
  
  try {
    // Получаем все логи за последние 7 дней (error и warn)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const logs = await prisma.clientLog.findMany({
      where: {
        level: {
          in: ['error', 'warn'],
        },
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1000, // Ограничиваем для производительности
    });
    
    console.log(`📊 Найдено ${logs.length} логов (error/warn) за последние 7 дней\n`);
    
    if (logs.length === 0) {
      console.log('✅ Проблем не найдено!');
      await prisma.$disconnect();
      return;
    }
    
    // Группируем логи по сообщениям
    const logGroups = new Map<string, LogAnalysis>();
    
    for (const log of logs) {
      const key = log.message.toLowerCase().trim();
      
      if (!logGroups.has(key)) {
        logGroups.set(key, {
          message: log.message,
          count: 0,
          level: log.level,
          users: new Set(),
          urls: new Set(),
          firstSeen: log.createdAt,
          lastSeen: log.createdAt,
          examples: [],
        });
      }
      
      const group = logGroups.get(key)!;
      group.count++;
      group.users.add(log.userId);
      if (log.url) {
        group.urls.add(log.url);
      }
      
      if (log.createdAt < group.firstSeen) {
        group.firstSeen = log.createdAt;
      }
      if (log.createdAt > group.lastSeen) {
        group.lastSeen = log.createdAt;
      }
      
      // Сохраняем до 5 примеров
      if (group.examples.length < 5) {
        group.examples.push({
          userId: log.userId,
          telegramId: log.user.telegramId,
          userName: log.user.firstName || log.user.username || 'Unknown',
          url: log.url,
          context: log.context,
          timestamp: log.createdAt,
        });
      }
    }
    
    // Сортируем по количеству вхождений
    const sortedGroups = Array.from(logGroups.values())
      .sort((a, b) => b.count - a.count);
    
    console.log(`\n📋 Найдено ${sortedGroups.length} уникальных проблем:\n`);
    console.log('='.repeat(80));
    
    // Категории проблем
    const categories: Record<string, string[]> = {
      'Ошибки сети/API': [],
      'Ошибки загрузки данных': [],
      'Ошибки плана': [],
      'Ошибки анкеты': [],
      'Rate limiting': [],
      'Ошибки валидации': [],
      'Другие ошибки': [],
    };
    
    for (const group of sortedGroups) {
      const message = group.message.toLowerCase();
      
      // Категоризируем
      if (message.includes('429') || message.includes('rate limit') || message.includes('retryafter')) {
        categories['Rate limiting'].push(group.message);
      } else if (message.includes('network') || message.includes('fetch') || message.includes('timeout') || message.includes('failed to fetch')) {
        categories['Ошибки сети/API'].push(group.message);
      } else if (message.includes('plan') || message.includes('плана') || message.includes('generation')) {
        categories['Ошибки плана'].push(group.message);
      } else if (message.includes('questionnaire') || message.includes('анкет') || message.includes('quiz')) {
        categories['Ошибки анкеты'].push(group.message);
      } else if (message.includes('load') || message.includes('загрузк') || message.includes('not found') || message.includes('404')) {
        categories['Ошибки загрузки данных'].push(group.message);
      } else if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
        categories['Ошибки валидации'].push(group.message);
      } else {
        categories['Другие ошибки'].push(group.message);
      }
      
      // Выводим детали
      console.log(`\n🔴 Проблема: ${group.message}`);
      console.log(`   Уровень: ${group.level.toUpperCase()}`);
      console.log(`   Количество: ${group.count}`);
      console.log(`   Затронуто пользователей: ${group.users.size}`);
      console.log(`   Страниц: ${group.urls.size}`);
      console.log(`   Первое появление: ${group.firstSeen.toLocaleString('ru-RU')}`);
      console.log(`   Последнее появление: ${group.lastSeen.toLocaleString('ru-RU')}`);
      
      if (group.urls.size > 0) {
        console.log(`   URL: ${Array.from(group.urls).slice(0, 3).join(', ')}${group.urls.size > 3 ? '...' : ''}`);
      }
      
      if (group.examples.length > 0) {
        console.log(`   Примеры:`);
        group.examples.forEach((ex, idx) => {
          console.log(`     ${idx + 1}. ${ex.userName} (${ex.telegramId}) - ${ex.timestamp.toLocaleString('ru-RU')}`);
          if (ex.url) {
            console.log(`        URL: ${ex.url}`);
          }
        });
      }
      
      console.log('   ' + '-'.repeat(76));
    }
    
    // Выводим сводку по категориям
    console.log('\n\n📊 СВОДКА ПО КАТЕГОРИЯМ:\n');
    console.log('='.repeat(80));
    
    for (const [category, messages] of Object.entries(categories)) {
      if (messages.length > 0) {
        console.log(`\n${category}: ${messages.length} проблем`);
        const uniqueMessages = Array.from(new Set(messages));
        uniqueMessages.slice(0, 5).forEach((msg, idx) => {
          console.log(`  ${idx + 1}. ${msg}`);
        });
        if (uniqueMessages.length > 5) {
          console.log(`  ... и еще ${uniqueMessages.length - 5}`);
        }
      }
    }
    
    // Топ проблемных пользователей
    const userErrorCounts = new Map<string, { count: number; userName: string; telegramId: string }>();
    
    for (const log of logs) {
      const key = log.userId;
      if (!userErrorCounts.has(key)) {
        userErrorCounts.set(key, {
          count: 0,
          userName: log.user.firstName || log.user.username || 'Unknown',
          telegramId: log.user.telegramId,
        });
      }
      userErrorCounts.get(key)!.count++;
    }
    
    const topProblematicUsers = Array.from(userErrorCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
    
    if (topProblematicUsers.length > 0) {
      console.log('\n\n👥 ТОП-10 ПРОБЛЕМНЫХ ПОЛЬЗОВАТЕЛЕЙ:\n');
      console.log('='.repeat(80));
      topProblematicUsers.forEach(([userId, data], idx) => {
        console.log(`${idx + 1}. ${data.userName} (${data.telegramId}): ${data.count} ошибок`);
      });
    }
    
    // Статистика по уровням
    const levelStats = {
      error: logs.filter(l => l.level === 'error').length,
      warn: logs.filter(l => l.level === 'warn').length,
    };
    
    console.log('\n\n📈 СТАТИСТИКА:\n');
    console.log('='.repeat(80));
    console.log(`Всего логов: ${logs.length}`);
    console.log(`Ошибок (error): ${levelStats.error}`);
    console.log(`Предупреждений (warn): ${levelStats.warn}`);
    console.log(`Уникальных проблем: ${sortedGroups.length}`);
    console.log(`Затронуто пользователей: ${userErrorCounts.size}`);
    
  } catch (error) {
    console.error('❌ Ошибка при анализе логов:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeAllUserLogs();

