// app/api/consent/route.ts
// Фиксация и проверка согласия на обработку ПДн (152-ФЗ: доказуемость согласия).
// GET  — есть ли действующее согласие на текущую версию документов.
// POST — записать согласие (типы, версия, время, user-agent, хэш IP).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { LEGAL_DOCUMENT_VERSION, REQUIRED_CONSENTS, type ConsentType } from '@/lib/legal/consent';

export const runtime = 'nodejs';

/** Необратимый хэш IP — для аудита без хранения самого адреса. */
async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function GET(request: NextRequest) {
  const auth = await requireTelegramAuth(request, { ensureUser: true });
  if (!auth.ok) return auth.response;

  const consents = await prisma.consent.findMany({
    where: {
      userId: auth.ctx.userId,
      documentVersion: LEGAL_DOCUMENT_VERSION,
      accepted: true,
      revokedAt: null,
    },
    select: { consentTypes: true },
  });

  const granted = new Set<string>();
  for (const c of consents) for (const t of c.consentTypes) granted.add(t);
  const hasAll = REQUIRED_CONSENTS.every((t) => granted.has(t));

  return NextResponse.json({
    hasConsent: hasAll,
    documentVersion: LEGAL_DOCUMENT_VERSION,
    granted: Array.from(granted),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireTelegramAuth(request, { ensureUser: true });
  if (!auth.ok) return auth.response;

  let body: { consentTypes?: string[]; accepted?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // пустое тело — трактуем как согласие на полный обязательный набор
  }

  const accepted = body.accepted !== false;
  const requested = Array.isArray(body.consentTypes) && body.consentTypes.length > 0
    ? (body.consentTypes.filter((t) => (REQUIRED_CONSENTS as string[]).includes(t)) as ConsentType[])
    : REQUIRED_CONSENTS;

  if (accepted) {
    const missing = REQUIRED_CONSENTS.filter((t) => !requested.includes(t));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'Required consents missing', missing },
        { status: 400 },
      );
    }
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null;

  await prisma.consent.create({
    data: {
      userId: auth.ctx.userId,
      telegramId: auth.ctx.telegramId,
      documentVersion: LEGAL_DOCUMENT_VERSION,
      consentTypes: requested,
      accepted,
      userAgent: request.headers.get('user-agent')?.slice(0, 512) ?? null,
      ipHash: await hashIp(ip),
    },
  });

  return NextResponse.json({ ok: true, documentVersion: LEGAL_DOCUMENT_VERSION });
}
