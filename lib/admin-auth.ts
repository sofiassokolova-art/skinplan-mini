// lib/admin-auth.ts
// Централизованная проверка авторизации админа

import { NextRequest } from 'next/server';
import { verifyAdminToken } from './jwt';

export interface AdminAuthResult {
  valid: boolean;
  adminId?: string | number;
  role?: string;
  error?: string;
}

export async function verifyAdmin(request: NextRequest): Promise<AdminAuthResult> {
  try {
    const token = request.cookies.get('admin_token')?.value;

    if (!token) {
      return { valid: false, error: 'No admin token found in request' };
    }

    const result = await verifyAdminToken(token);
    if (!result.valid || !result.payload) {
      return { valid: false, error: result.error || 'Invalid token' };
    }

    return {
      valid: true,
      adminId: result.payload.adminId,
      role: result.payload.role || 'admin',
    };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Error verifying admin token' };
  }
}

/** @deprecated Используйте verifyAdmin вместо этого */
export async function verifyAdminBoolean(request: NextRequest): Promise<boolean> {
  const result = await verifyAdmin(request);
  return result.valid;
}
