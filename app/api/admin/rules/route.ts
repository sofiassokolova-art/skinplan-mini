// app/api/admin/rules/route.ts
// API для управления правилами рекомендаций

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdmin } from '@/lib/admin-auth';

// GET - список всех правил
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('📋 Fetching recommendation rules...');
    const rules = await prisma.recommendationRule.findMany({
      orderBy: {
        priority: 'desc',
      },
    });

    console.log(`✅ Found ${rules.length} rules`);
    return NextResponse.json(rules);
  } catch (error: any) {
    console.error('❌ Error fetching rules:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// ИСПРАВЛЕНО (P0): Валидация JSON перед сохранением
function isPlainObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function validateRulePayload(data: {
  conditionsJson?: unknown;
  stepsJson?: unknown;
}): { valid: boolean; error?: string } {
  if (data.conditionsJson !== undefined && !isPlainObject(data.conditionsJson)) {
    return { valid: false, error: 'conditionsJson must be an object' };
  }

  if (data.stepsJson !== undefined && !isPlainObject(data.stepsJson)) {
    return { valid: false, error: 'stepsJson must be an object' };
  }

  return { valid: true };
}

// POST - создание правила
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const {
      name,
      conditionsJson,
      stepsJson,
      priority,
      isActive,
    } = data;

    // ИСПРАВЛЕНО (P0): Валидация обязательных полей
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // ИСПРАВЛЕНО (P0): Валидация JSON перед сохранением
    const validation = validateRulePayload({ conditionsJson, stepsJson });
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid rule payload' },
        { status: 400 }
      );
    }

    const rule = await prisma.recommendationRule.create({
      data: {
        name: name.trim(),
        conditionsJson: (conditionsJson || {}) as any, // Prisma Json type
        stepsJson: (stepsJson || {}) as any, // Prisma Json type
        priority: priority || 0,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json(rule);
  } catch (error: any) {
    console.error('Error creating rule:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Rule with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

