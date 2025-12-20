// lib/admin-auth.ts
// Централизованная проверка авторизации админа

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

// ИСПРАВЛЕНО (P0): Убран fallback - критическая уязвимость безопасности
// Проверка перенесена внутрь функций, чтобы не ломать сборку
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Please set JWT_SECRET environment variable.');
  }
  return secret;
}

export interface AdminAuthResult {
  valid: boolean;
  adminId?: string | number;
  role?: string;
  error?: string;
}

/**
 * Проверяет авторизацию админа по JWT токену
 * @param request - NextRequest объект
 * @returns Результат проверки с информацией об админе
 */
// ИСПРАВЛЕНО (P1): Только cookie, убрали поддержку Authorization header
export async function verifyAdmin(request: NextRequest): Promise<AdminAuthResult> {
  try {
    // ИСПРАВЛЕНО (P1): Только cookie, убрали чтение Authorization header
    const token = request.cookies.get('admin_token')?.value;
    
    if (!token) {
      return {
        valid: false,
        error: 'No admin token found in request',
      };
    }

    try {
      // ИСПРАВЛЕНО (P2): Проверяем issuer/audience при верификации
      const decoded = jwt.verify(token, getJwtSecret(), {
        issuer: 'skiniq-admin',
        audience: 'skiniq-admin-ui',
      }) as {
        adminId: string | number;
        role?: string;
        telegramId?: string;
      };

      return {
        valid: true,
        adminId: decoded.adminId,
        role: decoded.role || 'admin',
      };
    } catch (verifyError: any) {
      return {
        valid: false,
        error: verifyError.message || 'Invalid token',
      };
    }
  } catch (err: any) {
    return {
      valid: false,
      error: err.message || 'Error verifying admin token',
    };
  }
}

/**
 * Проверяет авторизацию и возвращает boolean (для обратной совместимости)
 * @deprecated Используйте verifyAdmin вместо этого
 */
export async function verifyAdminBoolean(request: NextRequest): Promise<boolean> {
  const result = await verifyAdmin(request);
  return result.valid;
}
