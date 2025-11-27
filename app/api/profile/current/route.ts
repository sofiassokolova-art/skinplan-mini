// app/api/profile/current/route.ts
// Получение текущего профиля пользователя

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';

export async function GET(request: NextRequest) {
  try {
    // Получаем initData из заголовков (пробуем оба варианта)
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      console.error('⚠️ Missing initData in headers:', {
        availableHeaders: Array.from(request.headers.keys()),
      });
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
      console.error(`⚠️ Profile not found for userId: ${userId}`);
      
      // Проверяем, существует ли пользователь
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      console.error(`   User exists: ${!!user}, userId: ${userId}`);
      
      // Проверяем, есть ли вообще профили в БД
      const totalProfiles = await prisma.skinProfile.count();
      console.error(`   Total profiles in DB: ${totalProfiles}`);
      
      return NextResponse.json(
        { error: 'No profile found' },
        { status: 404 }
      );
    }

    // Преобразуем тип кожи в русский для отображения
    const skinTypeRuMap: Record<string, string> = {
      dry: 'Сухая',
      oily: 'Жирная',
      combo: 'Комбинированная',
      normal: 'Нормальная',
      sensitive: 'Чувствительная',
    };

    return NextResponse.json({
      id: profile.id,
      version: profile.version,
      skinType: profile.skinType,
      skinTypeRu: skinTypeRuMap[profile.skinType || 'normal'] || 'Нормальная',
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
      primaryConcernRu: 'Акне', // TODO: Вычислить из профиля
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
