// app/api/admin/promo-codes/route.ts
// Админ-CRUD промокодов: список с использованиями, создание/обновление, вкл/выкл, удаление.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminBoolean } from '@/lib/admin-auth';
import { PAYMENT_PRODUCTS } from '@/lib/payment-products';
import { normalizePromoCode, parsePromoCodeInput } from '@/lib/promo-codes';

const KNOWN_PRODUCT_CODES = Object.keys(PAYMENT_PRODUCTS);

// GET — список промокодов с количеством использований
export async function GET(request: NextRequest) {
  try {
    if (!(await verifyAdminBoolean(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const promoCodes = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    });

    const codes = promoCodes.map((promo) => ({
      id: promo.id,
      code: promo.code,
      description: promo.description,
      active: promo.active,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      appliesToProductCodes: promo.appliesToProductCodes,
      maxRedemptions: promo.maxRedemptions,
      maxRedemptionsPerUser: promo.maxRedemptionsPerUser,
      startsAt: promo.startsAt,
      expiresAt: promo.expiresAt,
      createdAt: promo.createdAt,
      redemptionCount: promo._count.redemptions,
    }));

    return NextResponse.json({
      promoCodes: codes,
      products: KNOWN_PRODUCT_CODES.map((code) => ({
        code,
        amount: PAYMENT_PRODUCTS[code].amount,
      })),
    });
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — создание нового промокода (upsert по коду)
export async function POST(request: NextRequest) {
  try {
    if (!(await verifyAdminBoolean(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = parsePromoCodeInput(body, KNOWN_PRODUCT_CODES);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.promoCode.findUnique({
      where: { code: data.code },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Промокод с таким кодом уже существует' },
        { status: 409 },
      );
    }

    const promo = await prisma.promoCode.create({
      data: {
        code: data.code,
        description: data.description,
        active: data.active,
        discountType: data.discountType,
        discountValue: data.discountValue,
        appliesToProductCodes: data.appliesToProductCodes,
        maxRedemptions: data.maxRedemptions,
        maxRedemptionsPerUser: data.maxRedemptionsPerUser,
        startsAt: data.startsAt,
        expiresAt: data.expiresAt,
      },
    });

    return NextResponse.json({ promoCode: { ...promo, redemptionCount: 0 } });
  } catch (error) {
    console.error('Error creating promo code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — обновление промокода (частично: active-переключатель или полная правка)
export async function PATCH(request: NextRequest) {
  try {
    if (!(await verifyAdminBoolean(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const id = typeof (body as Record<string, unknown>)?.id === 'string'
      ? ((body as Record<string, unknown>).id as string)
      : '';
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const bodyObj = body as Record<string, unknown>;

    // Быстрый toggle активности: { id, active } без остальных полей.
    const isToggleOnly =
      typeof bodyObj.active === 'boolean' &&
      bodyObj.discountType === undefined &&
      bodyObj.discountValue === undefined &&
      bodyObj.code === undefined;

    if (isToggleOnly) {
      const promo = await prisma.promoCode.update({
        where: { id },
        data: { active: bodyObj.active as boolean },
        include: { _count: { select: { redemptions: true } } },
      });
      return NextResponse.json({
        promoCode: { ...promo, redemptionCount: promo._count.redemptions },
      });
    }

    const parsed = parsePromoCodeInput(body, KNOWN_PRODUCT_CODES);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const data = parsed.data;

    // Не даём переименовать промокод в уже занятый другим кодом код.
    const clash = await prisma.promoCode.findUnique({
      where: { code: data.code },
      select: { id: true },
    });
    if (clash && clash.id !== id) {
      return NextResponse.json(
        { error: 'Промокод с таким кодом уже существует' },
        { status: 409 },
      );
    }

    const promo = await prisma.promoCode.update({
      where: { id },
      data: {
        code: data.code,
        description: data.description,
        active: data.active,
        discountType: data.discountType,
        discountValue: data.discountValue,
        appliesToProductCodes: { set: data.appliesToProductCodes },
        maxRedemptions: data.maxRedemptions,
        maxRedemptionsPerUser: data.maxRedemptionsPerUser,
        startsAt: data.startsAt,
        expiresAt: data.expiresAt,
      },
      include: { _count: { select: { redemptions: true } } },
    });

    return NextResponse.json({
      promoCode: { ...promo, redemptionCount: promo._count.redemptions },
    });
  } catch (error) {
    console.error('Error updating promo code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — если промокод ещё не использовали, удаляем; иначе только деактивируем.
export async function DELETE(request: NextRequest) {
  try {
    if (!(await verifyAdminBoolean(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const code = searchParams.get('code');

    const where = id
      ? { id }
      : code
        ? { code: normalizePromoCode(code) }
        : null;
    if (!where) {
      return NextResponse.json({ error: 'id or code is required' }, { status: 400 });
    }

    const promo = await prisma.promoCode.findUnique({
      where,
      select: { id: true, _count: { select: { redemptions: true } } },
    });
    if (!promo) {
      return NextResponse.json({ error: 'Промокод не найден' }, { status: 404 });
    }

    if (promo._count.redemptions > 0) {
      // История использований должна сохраниться — только деактивируем.
      await prisma.promoCode.update({
        where: { id: promo.id },
        data: { active: false },
      });
      return NextResponse.json({ deactivated: true });
    }

    await prisma.promoCode.delete({ where: { id: promo.id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Error deleting promo code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
