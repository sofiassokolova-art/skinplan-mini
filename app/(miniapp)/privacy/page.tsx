// app/(miniapp)/privacy/page.tsx
// Политика в отношении обработки персональных данных (152-ФЗ).
// ВНИМАНИЕ ОПЕРАТОРУ: поля в [квадратных скобках] нужно заполнить реальными
// реквизитами ИП (ИНН, ОГРНИП, адрес) до публикации в проде.

'use client';

import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

const TITLE_FONT =
  "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT =
  "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

export default function PrivacyPage() {
  const router = useRouter();

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        router.back();
        return;
      }

      if (window.opener && !window.opener.closed) {
        window.close();
        return;
      }
    }

    router.replace('/profile');
  };

  return (
    <div
      className="animate-fade-in pv-rd"
      style={{
        minHeight: '100vh',
        padding: 'calc(env(safe-area-inset-top, 0px) + 72px) 20px calc(env(safe-area-inset-bottom, 0px) + 28px)',
        fontFamily: BODY_FONT,
        color: 'var(--ink)',
      }}
    >
      <style>{`
        html, body { background-color: var(--canvas); }
        .pv-rd{position:relative;isolation:isolate;}
        .pv-rd::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background:
          radial-gradient(72% 32% at 0% 0%, rgba(255,224,188,0.7) 0%, transparent 62%),
          radial-gradient(50% 22% at 100% 18%, rgba(213,254,97,0.42) 0%, transparent 70%),
          radial-gradient(64% 26% at 100% 55%, rgba(220,210,196,0.55) 0%, transparent 65%),
          radial-gradient(78% 32% at 10% 92%, rgba(213,254,97,0.46) 0%, transparent 62%),
          var(--canvas);}
        .pv-rd::after{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background:rgba(10,10,10,0.34);backdrop-filter:blur(8px) saturate(82%);-webkit-backdrop-filter:blur(8px) saturate(82%);}
        .pv-rd > *{position:relative;z-index:1;}
        .pv-rd .pv-close{position:fixed;top:calc(env(safe-area-inset-top, 0px) + 14px);right:16px;z-index:4;width:44px;height:44px;border:1px solid rgba(255,255,255,0.16);border-radius:999px;background:rgba(10,10,10,0.74);color:#fff;display:grid;place-items:center;box-shadow:0 14px 32px rgba(10,10,10,0.24),inset 0 1px 0 rgba(255,255,255,0.12);backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);cursor:pointer;}
        .pv-rd .pv-close:active{transform:scale(0.94);}
        .pv-rd .pv-title{font-family:${TITLE_FONT};font-size:22px;font-weight:700;line-height:1.2;letter-spacing:-0.5px;color:var(--ink);margin:6px 0 6px;}
        .pv-rd .pv-sub{font-size:13px;font-weight:500;color:var(--ink-soft);margin:0 0 18px;}
        .pv-rd .pv-body{font-size:14px;line-height:1.7;color:var(--ink);}
        .pv-rd .pv-section + .pv-section{margin-top:22px;padding-top:22px;border-top:1px solid rgba(10,10,10,0.06);}
        .pv-rd .pv-h2{font-family:${TITLE_FONT};font-size:15px;font-weight:600;letter-spacing:-0.3px;color:var(--ink);margin:0 0 10px;}
        .pv-rd .pv-body p{margin:0 0 12px;}
        .pv-rd .pv-body p:last-child{margin-bottom:0;}
        .pv-rd .pv-body ul{margin:0 0 12px;padding-left:20px;}
        .pv-rd .pv-body li{margin-bottom:4px;}
        .pv-rd .pv-body a{color:var(--ink);text-decoration:underline;font-weight:600;}
      `}</style>

      <button type="button" className="pv-close" aria-label="Закрыть" onClick={handleClose}>
        <X size={22} strokeWidth={2.2} aria-hidden />
      </button>

      <h1 className="pv-title">Политика конфиденциальности</h1>
      <p className="pv-sub">Обработка персональных данных в приложении SkinIQ</p>

      <div className="glass-card-lg">
        <div className="pv-body">

          <section className="pv-section">
            <h2 className="pv-h2">1. Оператор персональных данных</h2>
            <p>
              Оператором, обрабатывающим персональные данные, является ИП Биктимирова (далее — «Оператор»).
            </p>
            <ul>
              <li>ИНН: 645004894342</li>
              <li>ОГРНИП: 324645700069191 (от 11 июля 2024 г.)</li>
              <li>E-mail для обращений по вопросам ПДн: privacy@proskiniq.ru</li>
            </ul>
            <p>
              Настоящая Политика определяет порядок обработки и защиты персональных данных
              пользователей в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ
              «О персональных данных».
            </p>
          </section>

          <section className="pv-section">
            <h2 className="pv-h2">2. Какие данные мы обрабатываем</h2>
            <ul>
              <li>Данные профиля Telegram: идентификатор, имя, фамилия, username, язык;</li>
              <li>Номер телефона (если указан для оформления покупки/чека);</li>
              <li>Ответы анкеты о состоянии кожи, образе жизни и предпочтениях;</li>
              <li>
                <strong>Данные о здоровье</strong> (специальная категория, ст. 10 152-ФЗ): тип и
                чувствительность кожи, склонность к акне/розацеа/пигментации, беременность,
                принимаемые препараты, аллергии и иные медицинские маркеры;
              </li>
              <li>Технические данные: сведения об использовании приложения, журналы событий.</li>
            </ul>
          </section>

          <section className="pv-section">
            <h2 className="pv-h2">3. Цели обработки</h2>
            <ul>
              <li>Составление персонального плана ухода и подбор рекомендаций;</li>
              <li>Отслеживание прогресса и работа функций приложения;</li>
              <li>Оформление и проведение оплаты, формирование кассовых чеков (54-ФЗ);</li>
              <li>Поддержка пользователей и улучшение сервиса.</li>
            </ul>
          </section>

          <section className="pv-section">
            <h2 className="pv-h2">4. Правовое основание</h2>
            <p>
              Обработка персональных данных, включая данные о здоровье, осуществляется на основании
              вашего согласия. Согласие на обработку специальной категории персональных данных
              запрашивается отдельно и явно.
            </p>
          </section>

          <section className="pv-section">
            <h2 className="pv-h2">5. Передача третьим лицам</h2>
            <p>
              Оператор не продаёт персональные данные. Данные могут передаваться привлекаемым лицам
              исключительно для целей оказания сервиса:
            </p>
            <ul>
              <li>Telegram — как платформа доставки мини-приложения;</li>
              <li>ЮKassa — для проведения платежей и формирования чеков;</li>
              <li>Поставщик облачной инфраструктуры (хостинг базы данных и приложения).</li>
            </ul>
            <p>Передача данных о здоровье иным третьим лицам без вашего согласия не осуществляется.</p>
          </section>

          <section className="pv-section">
            <h2 className="pv-h2">6. Защита и шифрование</h2>
            <p>
              Передача данных осуществляется по защищённому соединению (TLS). База данных применяет
              шифрование хранимых данных. Дополнительно чувствительные сведения — данные о здоровье и
              номер телефона — хранятся в зашифрованном виде на уровне приложения (AES-256-GCM).
              Доступ к данным ограничен.
            </p>
          </section>

          <section className="pv-section">
            <h2 className="pv-h2">7. Сроки хранения</h2>
            <p>
              Персональные данные хранятся в течение срока использования приложения и до отзыва
              согласия. После отзыва согласия или запроса на удаление данные удаляются, за исключением
              сведений, которые Оператор обязан хранить по закону (например, данные о платежах для
              целей бухгалтерского и налогового учёта).
            </p>
          </section>

          <section className="pv-section">
            <h2 className="pv-h2">8. Ваши права</h2>
            <ul>
              <li>Получить информацию об обработке ваших данных;</li>
              <li>Требовать уточнения, блокирования или удаления данных;</li>
              <li>Отозвать согласие на обработку в любой момент;</li>
              <li>Удалить все свои данные через раздел профиля в приложении.</li>
            </ul>
            <p>
              Для реализации прав обратитесь по адресу privacy@proskiniq.ru или используйте функцию
              удаления данных в профиле.
            </p>
          </section>

          <section className="pv-section">
            <h2 className="pv-h2">9. Изменения политики</h2>
            <p>
              Оператор вправе изменять настоящую Политику. О существенных изменениях пользователи
              уведомляются через приложение; при изменении объёма обрабатываемых данных согласие
              запрашивается повторно.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
