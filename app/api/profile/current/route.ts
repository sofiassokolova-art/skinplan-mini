// app/api/profile/current/route.ts
// Получение текущего профиля пользователя

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';

export async function GET(request: NextRequest) {
  try {
    // Получаем initData из заголовков
    const initData = request.headers.get('x-telegram-init-data');

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing Telegram initData. Please open the app through Telegram Mini App.' },
        { status: 401 }
      );
    }

    // Получаем userId из initData
    const userId = await getUserIdFromInitData(initData);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
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
