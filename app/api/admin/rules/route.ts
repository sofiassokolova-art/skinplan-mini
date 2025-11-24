// app/api/admin/rules/route.ts
// API для управления правилами рекомендаций

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function verifyAdminToken(request: NextRequest): { valid: boolean; adminId?: string } {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                request.cookies.get('admin_token')?.value;

  if (!token) {
    return { valid: false };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { adminId: string; role?: string };
    if (decoded.role !== 'admin') {
      return { valid: false };
    }
    return { valid: true, adminId: decoded.adminId };
  } catch {
    return { valid: false };
  }
}

// GET - список всех правил
export async function GET(request: NextRequest) {
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rules = await prisma.recommendationRule.findMany({
      orderBy: {
        priority: 'desc',
      },
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error('Error fetching rules:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - создание правила
export async function POST(request: NextRequest) {
  const auth = verifyAdminToken(request);
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

