// lib/admin-auth.ts
// Централизованная проверка авторизации админа

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
export async function verifyAdmin(request: NextRequest): Promise<AdminAuthResult> {
  try {
    const cookieToken = request.cookies.get('admin_token')?.value;
    const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookieToken || headerToken;
    
    if (!token) {
      return {
        valid: false,
        error: 'No admin token found in request',
      };
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
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
