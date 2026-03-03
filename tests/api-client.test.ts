import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Мокаем зависимости до импорта клиента
const fetchWithTimeoutMock = vi.fn();
const handleNetworkErrorMock = vi.fn((err: unknown) => (err as Error)?.message || 'network error');
const shouldBlockApiRequestMock = vi.fn(() => false);

vi.mock('../lib/network-utils', () => ({
  fetchWithTimeout: (...args: any[]) => fetchWithTimeoutMock(...args),
  handleNetworkError: (...args: any[]) => handleNetworkErrorMock(...args),
}));

vi.mock('../lib/route-utils', () => ({
  shouldBlockApiRequest: (...args: any[]) => shouldBlockApiRequestMock(...args),
}));

// Теперь можно импортировать клиент
import { request } from '../lib/api/client';

describe('lib/api/client.ts — request', () => {
  const originalEnv = process.env;
  const originalWindow = global.window;

  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom уже есть, но подчистим Telegram поле
    // @ts-expect-error jsdom window
    global.window = {
      ...originalWindow,
      Telegram: undefined,
      sessionStorage: {
        store: {} as Record<string, string>,
        getItem(key: string) {
          return (this.store as any)[key] ?? null;
        },
        setItem(key: string, value: string) {
          (this.store as any)[key] = value;
        },
        removeItem(key: string) {
          delete (this.store as any)[key];
        },
      },
    } as any;

    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    // @ts-expect-error restore window
    global.window = originalWindow;
  });

  it('добавляет X-Telegram-Init-Data, если initData есть в Telegram WebApp', async () => {
    process.env.NODE_ENV = 'production';

    // @ts-expect-error jsdom window
    global.window.Telegram = {
      WebApp: {
        initData: 'telegram_init_data',
      },
    };

    fetchWithTimeoutMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await request('/profile/current');

    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(1);
    const [, fetchInit, timeout] = fetchWithTimeoutMock.mock.calls[0];

    expect(timeout).toBe(8000); // critical read имеет короткий таймаут
    expect(fetchInit.headers['X-Telegram-Init-Data']).toBe('telegram_init_data');
  });

  it('использует initData из sessionStorage, если Telegram WebApp пустой', async () => {
    process.env.NODE_ENV = 'production';

    // @ts-expect-error jsdom window
    global.window.Telegram = { WebApp: {} };
    // @ts-expect-error jsdom window
    global.window.sessionStorage.setItem('tg_init_data', 'stored_init_data');

    fetchWithTimeoutMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await request('/user/preferences');

    // Проверяем, что запрос вообще ушёл и не упал из-за отсутствия initData.
    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(1);
  });

  it('для /questionnaire/progress без initData возвращает пустой прогресс без запроса к API', async () => {
    process.env.NODE_ENV = 'production';

    // Telegram и sessionStorage пустые
    // @ts-expect-error jsdom window
    global.window.Telegram = { WebApp: {} };

    const result = await request<{ progress: unknown; isCompleted: boolean }>(
      '/questionnaire/progress',
    );

    expect(result).toEqual({ progress: null, isCompleted: false });
    expect(fetchWithTimeoutMock).not.toHaveBeenCalled();
  });

  it('обрабатывает 401 без initData в production как ошибку с подсказкой открыть mini app', async () => {
    process.env.NODE_ENV = 'production';

    // нет Telegram.initData, нет sessionStorage
    // @ts-expect-error jsdom window
    global.window.Telegram = { WebApp: {} };

    const response = new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
    fetchWithTimeoutMock.mockResolvedValueOnce(response);

    await expect(request('/profile/current')).rejects.toThrow(
      'Откройте приложение через Telegram Mini App. initData не доступен.',
    );
  });

  it('в development при 401 без initData возвращает текст ошибки из ответа', async () => {
    process.env.NODE_ENV = 'development';

    // @ts-expect-error jsdom window
    global.window.Telegram = { WebApp: {} };

    const response = new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
    fetchWithTimeoutMock.mockResolvedValueOnce(response);

    await expect(request('/profile/current')).rejects.toThrow('Unauthorized');
  });

  it('ретраит сетевые ошибки и в конце использует handleNetworkError', async () => {
    process.env.NODE_ENV = 'production';

    const networkError = new Error('Failed to fetch');
    fetchWithTimeoutMock.mockRejectedValue(networkError);
    handleNetworkErrorMock.mockReturnValue('pretty network error');

    await expect(request('/wishlist')).rejects.toThrow('pretty network error');

    // 1 попытка + 2 ретрая для GET (MAX_RETRIES + 1)
    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(3);
    expect(handleNetworkErrorMock).toHaveBeenCalledWith(networkError);
  });

  it('не ретраит мутации (не-GET запросы)', async () => {
    process.env.NODE_ENV = 'production';

    const serverError = new Response('Internal error', { status: 500 });
    fetchWithTimeoutMock.mockResolvedValueOnce(serverError);

    await expect(
      request('/feedback', {
        method: 'POST',
        body: JSON.stringify({ message: 'hi' }),
      }),
    ).rejects.toThrow('Internal error');

    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(1);
  });

  it('для 404 в dev логирует предупреждение и кидает ошибку Not found', async () => {
    process.env.NODE_ENV = 'development';

    const notFound = new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    fetchWithTimeoutMock.mockResolvedValueOnce(notFound);

    await expect(request('/non-existing-endpoint')).rejects.toThrow('Not found');
  });
});

