// app/(miniapp)/terms/page.tsx
// Страница пользовательских соглашений

'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';

const TITLE_FONT =
  "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT =
  "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

export default function TermsPage() {
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
      className="animate-fade-in tr-rd"
      style={{
        minHeight: '100vh',
        padding: 'calc(env(safe-area-inset-top, 0px) + 72px) 20px calc(env(safe-area-inset-bottom, 0px) + 28px)',
        fontFamily: BODY_FONT,
        color: 'var(--ink)',
      }}
    >
      <style>{`
        html, body { background-color: var(--canvas); }
        /* Фон — фиксированный псевдо-слой с градиентными пятнами, тот же рецепт,
           что на /home и /profile (background-attachment:fixed не работает в Telegram iOS WebView). */
        .tr-rd{position:relative;isolation:isolate;}
        .tr-rd::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background:
          radial-gradient(72% 32% at 0% 0%, rgba(255,224,188,0.7) 0%, transparent 62%),
          radial-gradient(50% 22% at 100% 18%, rgba(213,254,97,0.42) 0%, transparent 70%),
          radial-gradient(64% 26% at 100% 55%, rgba(220,210,196,0.55) 0%, transparent 65%),
          radial-gradient(78% 32% at 10% 92%, rgba(213,254,97,0.46) 0%, transparent 62%),
          var(--canvas);}
        .tr-rd::after{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background:rgba(10,10,10,0.34);backdrop-filter:blur(8px) saturate(82%);-webkit-backdrop-filter:blur(8px) saturate(82%);}
        .tr-rd > *{position:relative;z-index:1;}
        .tr-rd .tr-close{position:fixed;top:calc(env(safe-area-inset-top, 0px) + 14px);right:16px;z-index:4;width:44px;height:44px;border:1px solid rgba(255,255,255,0.16);border-radius:999px;background:rgba(10,10,10,0.74);color:#fff;display:grid;place-items:center;box-shadow:0 14px 32px rgba(10,10,10,0.24),inset 0 1px 0 rgba(255,255,255,0.12);backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);cursor:pointer;}
        .tr-rd .tr-close:active{transform:scale(0.94);}
        .tr-rd .tr-title{font-family:${TITLE_FONT};font-size:22px;font-weight:700;line-height:1.2;letter-spacing:-0.5px;color:var(--ink);margin:6px 0 6px;}
        .tr-rd .tr-sub{font-size:13px;font-weight:500;color:var(--ink-soft);margin:0 0 18px;}
        .tr-rd .tr-body{font-size:14px;line-height:1.7;color:var(--ink);}
        .tr-rd .tr-section + .tr-section{margin-top:22px;padding-top:22px;border-top:1px solid rgba(10,10,10,0.06);}
        .tr-rd .tr-h2{font-family:${TITLE_FONT};font-size:15px;font-weight:600;letter-spacing:-0.3px;color:var(--ink);margin:0 0 10px;}
        .tr-rd .tr-body p{margin:0 0 12px;}
        .tr-rd .tr-body p:last-child{margin-bottom:0;}
        .tr-rd .tr-body ul{margin:0 0 12px;padding-left:20px;}
        .tr-rd .tr-body li{margin-bottom:4px;}
      `}</style>

      <button type="button" className="tr-close" aria-label="Закрыть" onClick={handleClose}>
        <X size={22} strokeWidth={2.2} aria-hidden />
      </button>

      <h1 className="tr-title">Пользовательские соглашения</h1>
      <p className="tr-sub">Условия использования приложения skiniq</p>

      <div className="glass-card-lg">
        <div className="tr-body">
          <section className="tr-section">
            <h2 className="tr-h2">1. Общие положения</h2>
            <p>
              Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует отношения между
              пользователем приложения skiniq (далее — «Пользователь») и разработчиком приложения
              ИП Биктимирова (далее — «Разработчик»).
            </p>
            <p>
              Используя приложение skiniq, Пользователь соглашается с условиями настоящего Соглашения.
            </p>
          </section>

          <section className="tr-section">
            <h2 className="tr-h2">2. Описание сервиса</h2>
            <p>
              skiniq — это приложение для создания персонального плана ухода за кожей на основе
              анализа ответов пользователя в анкете. Приложение предоставляет рекомендации по средствам
              ухода и помогает отслеживать прогресс.
            </p>
            <p>
              Все рекомендации носят информационный характер и не заменяют консультацию с врачом-дерматологом.
            </p>
          </section>

          <section className="tr-section">
            <h2 className="tr-h2">3. Персональные данные</h2>
            <p>
              Приложение собирает и обрабатывает персональные данные пользователя, включая:
            </p>
            <ul>
              <li>Данные профиля Telegram (имя, username, фото)</li>
              <li>Ответы в анкете о состоянии кожи и данные о здоровье</li>
              <li>Номер телефона (при оформлении покупки)</li>
              <li>Информацию об использовании приложения</li>
            </ul>
            <p>
              Передача данных осуществляется по защищённому соединению (TLS), а чувствительные сведения
              (данные о здоровье и номер телефона) дополнительно хранятся в зашифрованном виде.
              Разработчик не передаёт персональные данные третьим лицам без согласия пользователя,
              за исключением лиц, привлекаемых для оказания сервиса. Порядок обработки, цели, сроки
              хранения и ваши права описаны в{' '}
              <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'underline', fontWeight: 600 }}>Политике конфиденциальности</Link>.
            </p>
          </section>

          <section className="tr-section">
            <h2 className="tr-h2">4. Ограничение ответственности</h2>
            <p>
              Разработчик не несет ответственности за:
            </p>
            <ul>
              <li>Результаты использования рекомендованных средств</li>
              <li>Аллергические реакции или побочные эффекты</li>
              <li>Доступность средств в магазинах и аптеках</li>
              <li>Изменения цен на рекомендованные продукты</li>
            </ul>
            <p>
              Пользователь понимает, что рекомендации приложения не являются медицинским советом
              и перед использованием любых средств следует проконсультироваться с врачом, особенно
              при наличии кожных заболеваний или аллергий.
            </p>
          </section>

          <section className="tr-section">
            <h2 className="tr-h2">5. Интеллектуальная собственность</h2>
            <p>
              Все материалы приложения, включая дизайн, алгоритмы, тексты и изображения, являются
              интеллектуальной собственностью Разработчика и защищены авторским правом.
            </p>
          </section>

          <section className="tr-section">
            <h2 className="tr-h2">6. Контакты</h2>
            <p>
              <strong>Разработчик:</strong> ИП Биктимирова
            </p>
            <p>
              По вопросам использования приложения обращайтесь в поддержку через раздел "Поддержка"
              в приложении.
            </p>
          </section>

          <section className="tr-section">
            <h2 className="tr-h2">7. Изменения в Соглашении</h2>
            <p>
              Разработчик оставляет за собой право изменять настоящее Соглашение. Пользователь будет
              уведомлен о существенных изменениях через приложение. Продолжение использования приложения
              после изменений означает согласие с новыми условиями.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
