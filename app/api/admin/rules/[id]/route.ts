// app/api/admin/rules/[id]/route.ts
// API для управления конкретным правилом рекомендаций

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdmin } from '@/lib/admin-auth';

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

// PUT - обновление правила
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const auth = await verifyAdmin(request);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const { conditionsJson, stepsJson } = data;

    // ИСПРАВЛЕНО (P0): Валидация JSON перед сохранением
    const validation = validateRulePayload({ conditionsJson, stepsJson });
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid rule payload' },
        { status: 400 }
      );
    }

    const updateData: {
      conditionsJson?: any;
      stepsJson?: any;
    } = {};

    if (conditionsJson !== undefined) {
      updateData.conditionsJson = conditionsJson as any; // Prisma Json type
    }
    if (stepsJson !== undefined) {
      updateData.stepsJson = stepsJson as any; // Prisma Json type
    }

    const rule = await prisma.recommendationRule.update({
      where: { id: parseInt(params.id) },
      data: updateData,
    });

    return NextResponse.json(rule);
  } catch (error: any) {
    console.error('Error updating rule:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - частичное обновление (для isActive)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const auth = await verifyAdmin(request);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const { isActive, name, priority } = data;

    const updateData: {
      isActive?: boolean;
      name?: string;
      priority?: number;
    } = {};

    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }
    if (typeof name === 'string' && name.trim()) {
      updateData.name = name.trim();
    }
    if (typeof priority === 'number') {
      updateData.priority = priority;
    }

    const rule = await prisma.recommendationRule.update({
      where: { id: parseInt(params.id) },
      data: updateData,
    });

    return NextResponse.json(rule);
  } catch (error: any) {
    console.error('Error updating rule:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - удаление правила
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const auth = await verifyAdmin(request);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await prisma.recommendationRule.delete({
      where: { id: parseInt(params.id) },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting rule:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

