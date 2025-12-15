// app/api/plan/replace-product/route.ts
// API для замены продукта во всём плане

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { logger, logApiRequest, logApiError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const method = 'POST';
  const path = '/api/plan/replace-product';
  let userId: string | null | undefined;
  
  try {
    // Пробуем оба варианта заголовка (регистронезависимо)
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing Telegram initData' },
        { status: 401 }
      );
    }

    userId = await getUserIdFromInitData(initData);
    
    if (!userId) {
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 401, duration);
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }

    const { oldProductId, newProductId } = await request.json();
    
    logger.info('Product replacement request', {
      userId,
      oldProductId,
      newProductId,
    });

    if (!oldProductId || !newProductId) {
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 400, duration, userId);
      return NextResponse.json(
        { error: 'Missing oldProductId or newProductId' },
        { status: 400 }
      );
    }

    // Проверяем, что продукты существуют
    const oldProduct = await prisma.product.findUnique({
      where: { id: oldProductId },
    });

    const newProduct = await prisma.product.findUnique({
      where: { id: newProductId },
    });

    if (!oldProduct || !newProduct) {
      const duration = Date.now() - startTime;
      logger.warn('Product not found for replacement', {
        userId,
        oldProductId,
        newProductId,
        oldProductExists: !!oldProduct,
        newProductExists: !!newProduct,
      });
      logApiRequest(method, path, 404, duration, userId);
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Сохраняем запись о замене
    await prisma.productReplacement.create({
      data: {
        userId,
        oldProductId,
        newProductId,
        reason: 'feedback_bad',
      },
    });

    // ИСПРАВЛЕНО: Обновляем plan28 - заменяем продукт во всех днях плана
    const plan28 = await prisma.plan28.findFirst({
      where: {
        userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (plan28 && plan28.planData) {
      // ИСПРАВЛЕНО: days находится внутри planData (Json поле)
      const planData = plan28.planData as any;
      const days = (planData.days || []) as any[];
      
      if (!Array.isArray(days) || days.length === 0) {
        logger.warn('Plan28 has no days or invalid structure', { userId, planId: plan28.id });
        return ApiResponse.success({ success: true, message: 'Plan has no days to update' });
      }
      
      let updatedDays = false;
      
      // Проходим по всем дням и заменяем productId
      const updatedDaysArray = days.map((day: any) => {
        let dayUpdated = false;
        
        // Обновляем утренние шаги
        const updatedMorning = day.morning?.map((step: any) => {
          if (step.productId === oldProductId) {
            dayUpdated = true;
            updatedDays = true;
            return { ...step, productId: newProductId };
          }
          // Также обновляем альтернативы
          if (step.alternatives && Array.isArray(step.alternatives)) {
            const updatedAlternatives = step.alternatives.map((altId: number) => 
              altId === oldProductId ? newProductId : altId
            );
            if (JSON.stringify(updatedAlternatives) !== JSON.stringify(step.alternatives)) {
              dayUpdated = true;
              updatedDays = true;
              return { ...step, alternatives: updatedAlternatives };
            }
          }
          return step;
        }) || day.morning;
        
        // Обновляем вечерние шаги
        const updatedEvening = day.evening?.map((step: any) => {
          if (step.productId === oldProductId) {
            dayUpdated = true;
            updatedDays = true;
            return { ...step, productId: newProductId };
          }
          // Также обновляем альтернативы
          if (step.alternatives && Array.isArray(step.alternatives)) {
            const updatedAlternatives = step.alternatives.map((altId: number) => 
              altId === oldProductId ? newProductId : altId
            );
            if (JSON.stringify(updatedAlternatives) !== JSON.stringify(step.alternatives)) {
              dayUpdated = true;
              updatedDays = true;
              return { ...step, alternatives: updatedAlternatives };
            }
          }
          return step;
        }) || day.evening;
        
        // Обновляем еженедельные шаги
        const updatedWeekly = day.weekly?.map((step: any) => {
          if (step.productId === oldProductId) {
            dayUpdated = true;
            updatedDays = true;
            return { ...step, productId: newProductId };
          }
          // Также обновляем альтернативы
          if (step.alternatives && Array.isArray(step.alternatives)) {
            const updatedAlternatives = step.alternatives.map((altId: number) => 
              altId === oldProductId ? newProductId : altId
            );
            if (JSON.stringify(updatedAlternatives) !== JSON.stringify(step.alternatives)) {
              dayUpdated = true;
              updatedDays = true;
              return { ...step, alternatives: updatedAlternatives };
            }
          }
          return step;
        }) || day.weekly;
        
        if (dayUpdated) {
          return {
            ...day,
            morning: updatedMorning,
            evening: updatedEvening,
            weekly: updatedWeekly,
          };
        }
        return day;
      });
      
      if (updatedDays) {
        // ИСПРАВЛЕНО: Обновляем planData, а не days напрямую
        await prisma.plan28.update({
          where: { id: plan28.id },
          data: {
            planData: {
              ...planData,
              days: updatedDaysArray,
            } as any,
          },
        });
        
        logger.info('Plan28 updated with new product', {
          userId,
          plan28Id: plan28.id,
          oldProductId,
          newProductId,
          daysUpdated: updatedDaysArray.filter((d: any, i: number) => 
            JSON.stringify(d) !== JSON.stringify(days[i])
          ).length,
        });
      }
    }

    // Обновляем активную сессию рекомендаций, если она есть
    const activeSession = await prisma.recommendationSession.findFirst({
      where: {
        userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeSession) {
      const products = activeSession.products as number[];
      const updatedProducts = products.map((pid) => 
        pid === oldProductId ? newProductId : pid
      );
      
      await prisma.recommendationSession.update({
        where: { id: activeSession.id },
        data: {
          products: updatedProducts,
        },
      });
      
      logger.info('RecommendationSession updated with new product', {
        userId,
        sessionId: activeSession.id,
        oldProductId,
        newProductId,
      });
    }

    const duration = Date.now() - startTime;
    logger.info('Product replaced successfully', {
      userId,
      oldProductId,
      newProductId,
      sessionUpdated: !!activeSession,
    });
    logApiRequest(method, path, 200, duration, userId);
    
    return NextResponse.json({ 
      success: true,
      message: 'Product replaced successfully. Plan will be updated on next refresh.',
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logger.error('Error replacing product', error, { userId });
    logApiError(method, path, error, userId);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

