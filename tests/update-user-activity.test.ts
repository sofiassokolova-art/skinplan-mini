import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateManyMock = vi.fn();
const warnMock = vi.fn();

vi.mock('../lib/db', () => ({
  prisma: {
    user: {
      updateMany: (...args: unknown[]) => updateManyMock(...args),
    },
  },
}));

vi.mock('../lib/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => warnMock(...args),
  },
}));

import { updateUserActivity } from '@/lib/update-user-activity';

describe('updateUserActivity', () => {
  beforeEach(() => {
    updateManyMock.mockReset();
    warnMock.mockReset();
  });

  it('не пишет lastActive повторно для того же пользователя в пределах интервала', async () => {
    updateManyMock.mockResolvedValue(undefined);

    await updateUserActivity('throttled-user');
    await updateUserActivity('throttled-user');

    expect(updateManyMock).toHaveBeenCalledTimes(1);
  });

  it('разрешает повторную попытку после ошибки записи', async () => {
    updateManyMock
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValue(undefined);

    await updateUserActivity('retry-user');
    await updateUserActivity('retry-user');

    expect(updateManyMock).toHaveBeenCalledTimes(2);
    expect(warnMock).toHaveBeenCalledTimes(1);
  });
});
