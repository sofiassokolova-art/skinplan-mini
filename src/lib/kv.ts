import { kv } from '@vercel/kv';

const PREFIX = 'user:';

export interface UserData {
  quizCompleted?: boolean;
  quizAnswers?: any;
  morningSteps?: any[];
  eveningSteps?: any[];
  completedToday?: { [key: number]: boolean };
  hintShown?: boolean;
  settings?: {
    notifications?: boolean;
    theme?: string;
  };
  lastSynced?: number;
}

export async function getUserData(userId: number | string): Promise<UserData> {
  try {
    const data = await kv.get<UserData>(`${PREFIX}${userId}`);
    return data || {};
  } catch (error) {
    console.error('Error getting user data from KV:', error);
    return {};
  }
}

export async function saveUserData(userId: number | string, data: Partial<UserData>): Promise<void> {
  try {
    const existingData = await getUserData(userId);
    const updatedData = {
      ...existingData,
      ...data,
      lastSynced: Date.now()
    };
    await kv.set(`${PREFIX}${userId}`, updatedData);
  } catch (error) {
    console.error('Error saving user data to KV:', error);
  }
}

// Helper function to get Telegram user ID
export function getTelegramUserId(): number | null {
  try {
    const tg = (window as any)?.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    return user?.id || null;
  } catch (error) {
    console.error('Error getting Telegram user ID:', error);
    return null;
  }
}

