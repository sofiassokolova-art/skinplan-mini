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

    const rule = await prisma.recommendationRule.create({
      data: {
        name,
        conditionsJson: conditionsJson || {},
        stepsJson: stepsJson || {},
        priority: priority || 0,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error creating rule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

