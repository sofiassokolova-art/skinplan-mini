// app/admin/webhook-status/page.tsx
// Страница для проверки и настройки Telegram webhook

'use client';

import { useState } from 'react';

export default function WebhookStatusPage() {
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const checkWebhook = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      console.log('🔍 Checking webhook status...');
      const response = await fetch('/api/telegram/webhook?action=check');
      const data = await response.json();
      
      console.log('📊 Webhook status response:', data);
      setWebhookInfo(data);
      
      if (data.ok && data.result) {
        const url = data.result.url;
        if (url && url !== '') {
          setSuccess(`✅ Webhook установлен: ${url}`);
        } else {
          setError('⚠️ Webhook не установлен');
        }
      } else if (data.error) {
        setError(`Ошибка: ${data.error}${data.details ? ` - ${data.details}` : ''}`);
      } else {
        setError('Не удалось получить информацию о webhook');
      }
    } catch (err: any) {
      console.error('❌ Error checking webhook:', err);
      setError(err.message || 'Ошибка при проверке webhook');
    } finally {
      setLoading(false);
    }
  };

  const setWebhook = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const webhookUrl = `${window.location.origin}/api/telegram/webhook`;
      console.log('🔧 Setting webhook to:', webhookUrl);
      
      const response = await fetch(`/api/telegram/webhook?action=set-webhook&url=${encodeURIComponent(webhookUrl)}`);
      const data = await response.json();
      
      console.log('📊 Set webhook response:', data);
      setWebhookInfo(data);
      
      if (data.ok) {
        setSuccess(`✅ Webhook успешно установлен! URL: ${webhookUrl}`);
      } else {
        setError(`Ошибка установки webhook: ${data.description || data.error || 'Неизвестная ошибка'}`);
      }
    } catch (err: any) {
      console.error('❌ Error setting webhook:', err);
      setError(err.message || 'Ошибка при установке webhook');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Статус Telegram Webhook
          </h1>

          <div className="space-y-4">
            <div className="flex gap-4">
              <button
                onClick={checkWebhook}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Проверка...' : 'Проверить webhook'}
              </button>
              
              <button
                onClick={setWebhook}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Установка...' : 'Установить webhook'}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {success}
              </div>
            )}

            {webhookInfo && (
              <div className="mt-4">
                <h2 className="text-lg font-semibold mb-2">Информация о webhook:</h2>
                <div className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                  {webhookInfo.result && (
                    <div className="space-y-2 mb-4">
                      <div><strong>URL:</strong> {webhookInfo.result.url || 'не установлен'}</div>
                      <div><strong>Pending updates:</strong> {webhookInfo.result.pending_update_count || 0}</div>
                      {webhookInfo.result.last_error_date && (
                        <div className="text-red-600">
                          <strong>Last error:</strong> {webhookInfo.result.last_error_message || 'нет ошибок'}
                          <br />
                          <span className="text-xs">Date: {new Date(webhookInfo.result.last_error_date * 1000).toLocaleString()}</span>
                        </div>
                      )}
                      {webhookInfo.result.last_synchronization_error_date && (
                        <div className="text-yellow-600">
                          <strong>Last sync error:</strong> {webhookInfo.result.last_synchronization_error_message || 'нет'}
                        </div>
                      )}
                    </div>
                  )}
                  <details>
                    <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                      Полный JSON ответ
                    </summary>
                    <pre className="mt-2 text-xs">
                      {JSON.stringify(webhookInfo, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            )}

            <div className="mt-6 p-4 bg-blue-50 rounded">
              <h3 className="font-semibold mb-2">Пошаговая инструкция:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Убедитесь, что в Cloudflare установлена переменная окружения <code className="bg-blue-100 px-1 rounded">TELEGRAM_BOT_TOKEN</code></li>
                <li>Нажмите кнопку <strong>&quot;Установить webhook&quot;</strong> выше</li>
                <li>Нажмите <strong>&quot;Проверить webhook&quot;</strong> чтобы увидеть текущий статус</li>
                <li>Если в статусе есть ошибки - проверьте логи ниже</li>
                <li>Отправьте команду <code className="bg-blue-100 px-1 rounded">/start</code> боту <code className="bg-blue-100 px-1 rounded">@skiniq_app_bot</code> в Telegram</li>
              </ol>
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="font-semibold text-yellow-800 text-sm mb-1">⚠️ Если бот не отвечает:</p>
                <ul className="text-xs text-yellow-700 list-disc list-inside space-y-1">
                  <li>Проверьте логи Cloudflare Workers в разделе &quot;Logs&quot;</li>
                  <li>Убедитесь, что webhook URL правильный (должен быть <code className="bg-yellow-100 px-1 rounded">https://skinplan-mini.pages.dev/api/telegram/webhook</code>)</li>
                  <li>Проверьте, что <code className="bg-yellow-100 px-1 rounded">TELEGRAM_BOT_TOKEN</code> установлен и правильный</li>
                  <li>Подождите 1-2 минуты после установки webhook, затем попробуйте снова</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <h3 className="font-semibold mb-2 text-sm">Прямые ссылки:</h3>
              <div className="space-y-2 text-xs">
                <div>
                  <strong>Проверить webhook:</strong>
                  <a 
                    href="/api/telegram/webhook?action=check" 
                    target="_blank"
                    className="text-blue-600 hover:underline ml-2"
                  >
                    /api/telegram/webhook?action=check
                  </a>
                </div>
                <div>
                  <strong>Установить webhook:</strong>
                  <a 
                    href="/api/telegram/webhook?action=set-webhook" 
                    target="_blank"
                    className="text-blue-600 hover:underline ml-2"
                  >
                    /api/telegram/webhook?action=set-webhook
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

