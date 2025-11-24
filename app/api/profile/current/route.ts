// app/api/profile/current/route.ts
// Получение текущего профиля пользователя

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function GET(request: NextRequest) {
  try {
    // Проверяем токен
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      userId = decoded.userId;
    } catch {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Получаем последний профиль пользователя
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'No profile found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: profile.id,
      version: profile.version,
      skinType: profile.skinType,
      sensitivityLevel: profile.sensitivityLevel,
      dehydrationLevel: profile.dehydrationLevel,
      acneLevel: profile.acneLevel,
      rosaceaRisk: profile.rosaceaRisk,
      pigmentationRisk: profile.pigmentationRisk,
      ageGroup: profile.ageGroup,
      hasPregnancy: profile.hasPregnancy,
      notes: profile.notes,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
