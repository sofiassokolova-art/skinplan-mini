// app/admin/set-webhook/page.tsx
// Простая страница для установки webhook одним кликом

'use client';

import { useState, useEffect } from 'react';

export default function SetWebhookPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [currentWebhookInTelegram, setCurrentWebhookInTelegram] = useState<string | null>(null);
  const [checkLoading, setCheckLoading] = useState(true);

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/telegram/webhook`);
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/api/telegram/webhook?action=check', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        const url = data?.result?.url || null;
        setCurrentWebhookInTelegram(url);
      })
      .catch(() => {
        if (mounted) setCurrentWebhookInTelegram(null);
      })
      .finally(() => {
        if (mounted) setCheckLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const setWebhook = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/telegram/webhook?action=set-webhook');
      const data = await response.json();
      
      setResult(data);
      
      if (data.ok) {
        // Автоматически проверяем статус через 2 секунды
        setTimeout(async () => {
          try {
            const checkResponse = await fetch('/api/telegram/webhook?action=check');
            const checkData = await checkResponse.json();
            setResult((prev: any) => ({ ...prev, checkResult: checkData }));
          } catch (e) {
            console.error('Error checking webhook:', e);
          }
        }, 2000);
      } else {
        setError(data.description || data.error || 'Неизвестная ошибка');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка при установке webhook');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '24px',
        padding: '32px',
        maxWidth: '600px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#0A5F59',
          marginBottom: '8px',
        }}>
          Установка Telegram Webhook
        </h1>
        
        <p style={{
          color: '#475467',
          marginBottom: '24px',
          lineHeight: '1.6',
        }}>
          Нажмите кнопку ниже, чтобы установить webhook для Telegram бота. 
          Это позволит боту отвечать на команды.
        </p>
        <p style={{
          color: '#0A5F59',
          marginBottom: '24px',
          lineHeight: '1.6',
          fontSize: '14px',
          background: 'rgba(10, 95, 89, 0.08)',
          padding: '12px 16px',
          borderRadius: '8px',
        }}>
          <strong>Прод не отвечает на /start?</strong> У бота может быть только один webhook. Откройте эту страницу на <strong>продакшен-домене</strong> (например https://www.proskiniq.ru/admin/set-webhook), войдите в админку и нажмите «Установить Webhook» — тогда Telegram будет слать обновления на прод.
        </p>
        {!checkLoading && (
          <p style={{ color: '#374151', fontSize: '13px', marginBottom: '12px' }}>
            <strong>Сейчас в Telegram указан webhook:</strong>{' '}
            {currentWebhookInTelegram ? (
              <code style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 4, wordBreak: 'break-all' }}>
                {currentWebhookInTelegram}
              </code>
            ) : (
              <span style={{ color: '#DC2626' }}>не установлен или ошибка проверки</span>
            )}
            {currentWebhookInTelegram && webhookUrl && currentWebhookInTelegram !== webhookUrl && (
              <span style={{ display: 'block', marginTop: '6px', color: '#B45309', fontWeight: 600 }}>
                ⚠️ Не совпадает с этим доменом — бот не получает сообщения. Нажмите «Установить Webhook».
              </span>
            )}
          </p>
        )}
        <p style={{ color: '#0A5F59', fontSize: '13px', marginBottom: '16px', fontWeight: 600 }}>
          После нажатия кнопки webhook будет установлен на: <br />
          <code style={{ background: 'rgba(0,0,0,0.06)', padding: '4px 8px', borderRadius: 4 }}>
            {webhookUrl || '…'}
          </code>
          <br />
          Убедитесь, что открыт прод-домен (например www.proskiniq.ru), а не develop.
        </p>
        <p style={{ color: '#475467', fontSize: '13px', marginBottom: '16px' }}>
          Без браузера: в Vercel задайте <code>WEBHOOK_SET_SECRET</code>, затем <code>curl "…/api/telegram/webhook?action=set-webhook&amp;secret=..."</code>. См. docs/TELEGRAM_BOT_PRODUCTION.md.
        </p>

        <button
          onClick={setWebhook}
          disabled={loading}
          style={{
            width: '100%',
            padding: '16px 24px',
            backgroundColor: loading ? '#94A3B8' : '#0A5F59',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            marginBottom: '24px',
          }}
        >
          {loading ? 'Установка...' : '🚀 Установить Webhook'}
        </button>

        {error && (
          <div style={{
            backgroundColor: '#FEE2E2',
            border: '1px solid #FCA5A5',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
          }}>
            <div style={{
              color: '#DC2626',
              fontWeight: '600',
              marginBottom: '4px',
            }}>
              ❌ Ошибка
            </div>
            <div style={{ color: '#991B1B', fontSize: '14px' }}>
              {error}
            </div>
          </div>
        )}

        {result && (
          <div style={{
            backgroundColor: result.ok ? '#D1FAE5' : '#FEE2E2',
            border: `1px solid ${result.ok ? '#86EFAC' : '#FCA5A5'}`,
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
          }}>
            <div style={{
              color: result.ok ? '#065F46' : '#DC2626',
              fontWeight: '600',
              marginBottom: '8px',
            }}>
              {result.ok ? '✅ Успешно!' : '❌ Ошибка'}
            </div>
            
            <div style={{
              color: result.ok ? '#047857' : '#991B1B',
              fontSize: '14px',
              marginBottom: '12px',
            }}>
              {result.description || result.error || JSON.stringify(result)}
            </div>

            {result.checkResult && (
              <details style={{ marginTop: '12px' }}>
                <summary style={{
                  cursor: 'pointer',
                  color: '#0A5F59',
                  fontWeight: '600',
                  fontSize: '14px',
                  marginBottom: '8px',
                }}>
                  Проверка статуса webhook:
                </summary>
                <div style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginTop: '8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  overflow: 'auto',
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>URL:</strong>{' '}
                    <span style={{ color: result.checkResult.result?.url ? '#059669' : '#DC2626' }}>
                      {result.checkResult.result?.url || 'не установлен'}
                    </span>
                  </div>
                  {result.checkResult.result?.pending_update_count !== undefined && (
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Pending updates:</strong> {result.checkResult.result.pending_update_count}
                    </div>
                  )}
                  <pre style={{
                    marginTop: '8px',
                    fontSize: '11px',
                    overflow: 'auto',
                    maxHeight: '200px',
                  }}>
                    {JSON.stringify(result.checkResult, null, 2)}
                  </pre>
                </div>
              </details>
            )}

            <details style={{ marginTop: '12px' }}>
              <summary style={{
                cursor: 'pointer',
                color: '#0A5F59',
                fontWeight: '600',
                fontSize: '14px',
              }}>
                Полный ответ:
              </summary>
              <pre style={{
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                borderRadius: '8px',
                padding: '12px',
                marginTop: '8px',
                fontSize: '12px',
                fontFamily: 'monospace',
                overflow: 'auto',
                maxHeight: '300px',
              }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}

        <div style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#EFF6FF',
          borderRadius: '12px',
          border: '1px solid #BFDBFE',
        }}>
          <div style={{
            color: '#1E40AF',
            fontWeight: '600',
            marginBottom: '8px',
          }}>
            💡 Что дальше?
          </div>
          <ol style={{
            color: '#1E3A8A',
            fontSize: '14px',
            lineHeight: '1.8',
            paddingLeft: '20px',
          }}>
            <li>Если webhook установлен успешно, отправьте команду <code>/start</code> боту @skiniq_app_bot</li>
            <li>Бот должен ответить приветственным сообщением с кнопкой для открытия Mini App</li>
            <li>Если не работает, проверьте логи в Vercel Dashboard</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

