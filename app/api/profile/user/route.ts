// app/api/profile/user/route.ts
// API для работы с данными пользователя (имя, телефон)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

// GET - получить данные пользователя
export async function GET(request: NextRequest) {
  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.ctx.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        language: true,
        phoneNumber: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      language: user.language,
      phoneNumber: user.phoneNumber || null,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - обновить данные пользователя
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.ctx.userId;

    const { firstName, lastName, phoneNumber } = await request.json();

    // ИСПРАВЛЕНО: При обновлении имени также обновляем ответ USER_NAME в анкете
    // Это гарантирует, что имя из ответов всегда актуально и имеет приоритет при отображении
    await prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (firstName !== undefined) updateData.firstName = firstName || null;
      if (lastName !== undefined) updateData.lastName = lastName || null;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber || null;

      // Обновляем данные пользователя
      await tx.user.update({
        where: { id: userId },
        data: updateData,
        select: { id: true },
      });

      // Если обновляется firstName, также обновляем ответ USER_NAME
      if (firstName !== undefined) {
        // Находим вопрос USER_NAME
        const nameQuestion = await tx.question.findFirst({
          where: { code: 'USER_NAME' },
          select: { id: true },
        });

        if (nameQuestion) {
          // Находим активную анкету
          const activeQuestionnaire = await tx.questionnaire.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          });

          if (activeQuestionnaire) {
            // Обновляем или создаем ответ USER_NAME
            await tx.userAnswer.upsert({
              where: {
                userId_questionId: {
                  userId,
                  questionId: nameQuestion.id,
                },
              },
              update: {
                answerValue: firstName || null,
                updatedAt: new Date(),
              },
              create: {
                userId,
                questionId: nameQuestion.id,
                questionnaireId: activeQuestionnaire.id,
                answerValue: firstName || null,
              },
            });
          }
        }
      }
    });

    // Получаем обновленные данные пользователя
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        language: true,
        phoneNumber: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        language: user.language,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

