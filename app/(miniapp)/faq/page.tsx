// app/(miniapp)/faq/page.tsx
// Часто задаваемые вопросы — редизайн (чистый флэт / editorial).
// Ответы отражают реальную текущую логику приложения: план по фазам,
// отметка ухода + streak + индекс кожи на главной, покупка через корзину →
// «В магазин» (с VPN-памяткой), замена средства, перепрохождение анкеты в ЛК,
// напоминания в боте, учёт беременности/ограничений.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

const TITLE_FONT =
  "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT =
  "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: 'Как работает skiniq?',
    answer:
      'skiniq строит персональный план ухода на 28 дней по вашим ответам в анкете. Мы учитываем тип кожи, цели, чувствительность и ограничения и подбираем средства по шагам — очищение, увлажнение, SPF и активы.',
  },
  {
    question: 'Из чего состоит план?',
    answer:
      'План разбит на фазы: адаптация, активная фаза и поддержка. Средства подключаются постепенно, по фазам, чтобы не перегружать кожу. На каждый день есть утренний и вечерний уход.',
  },
  {
    question: 'Как отмечать уход и следить за прогрессом?',
    answer:
      'На главной, в разделе «Уход на сегодня», отмечайте выполненные шаги утром и вечером. За регулярность растёт streak, а индекс кожи повышается по мере прохождения плана.',
  },
  {
    question: 'Где купить рекомендованные средства?',
    answer:
      'Добавляйте средства в корзину, а из неё переходите в магазин по кнопке «В магазин» (Золотое Яблоко, Яндекс Маркет и др.). Перед переходом отключите VPN — иначе магазин может не открыться или показать неверные цены.',
  },
  {
    question: 'Что делать, если средство не подошло?',
    answer:
      'Нажмите «Заменить» на карточке средства — подберём аналог с похожим действием. Понравившиеся средства можно сохранять в избранное.',
  },
  {
    question: 'Как обновить план, если что-то изменилось?',
    answer:
      'Перепройдите анкету в личном кабинете («Перепройти анкету»). План пересоберётся под текущее состояние кожи, новые цели или изменения в образе жизни.',
  },
  {
    question: 'Как настроить напоминания об уходе?',
    answer:
      'В личном кабинете включите напоминания и выберите удобное время для утреннего и вечернего ухода — бот пришлёт напоминание в Telegram.',
  },
  {
    question: 'Можно ли пользоваться при беременности и кормлении?',
    answer:
      'Да. Если вы укажете это в анкете, алгоритм исключит нежелательные компоненты (например, ретиноиды) и подберёт безопасные средства. При кожных заболеваниях всё же проконсультируйтесь с врачом.',
  },
];

export default function FAQPage() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));

  const toggle = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleClose = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace('/profile');
  };

  return (
    <div
      className="animate-fade-in fq-rd"
      style={{
        minHeight: '100vh',
        padding: 'calc(env(safe-area-inset-top, 0px) + 72px) 20px calc(env(safe-area-inset-bottom, 0px) + 28px)',
        fontFamily: BODY_FONT,
        color: 'var(--ink)',
      }}
    >
      <style>{`
        html, body { background-color: var(--canvas); }
        .fq-rd{position:relative;isolation:isolate;}
        .fq-rd::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background:var(--canvas);}
        .fq-rd > *{position:relative;z-index:1;}
        .fq-rd .fq-close{position:fixed;top:calc(env(safe-area-inset-top, 0px) + 14px);right:16px;z-index:4;width:44px;height:44px;border:1px solid var(--glass-border);border-radius:999px;background:var(--canvas-white);color:var(--ink);display:grid;place-items:center;box-shadow:0 1px 2px rgba(10,10,10,0.04),0 10px 24px -12px rgba(10,10,10,0.18);cursor:pointer;}
        .fq-rd .fq-close:active{transform:scale(0.94);}
        .fq-rd .fq-title{font-family:${TITLE_FONT};font-size:26px;font-weight:700;line-height:1.16;letter-spacing:-0.6px;color:var(--ink);margin:6px 0 6px;}
        .fq-rd .fq-title::after{content:"";display:block;width:56px;height:5px;margin-top:14px;border-radius:3px;background:var(--accent);}
        .fq-rd .fq-sub{font-size:13px;font-weight:500;color:var(--ink-soft);margin:16px 0 22px;}
        .fq-rd .fq-list{display:flex;flex-direction:column;gap:10px;}
        .fq-rd .fq-item{border:1px solid var(--glass-border);background:var(--glass-bg);border-radius:20px;box-shadow:var(--glass-shadow);overflow:hidden;}
        .fq-rd .fq-q{width:100%;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:18px;background:none;border:0;cursor:pointer;text-align:left;font-family:${TITLE_FONT};font-size:15px;font-weight:600;line-height:1.3;letter-spacing:-0.2px;color:var(--ink);}
        .fq-rd .fq-chevron{flex-shrink:0;width:30px;height:30px;border-radius:50%;background:rgba(10,10,10,0.05);display:grid;place-items:center;transition:transform 0.2s ease,background 0.2s ease;}
        .fq-rd .fq-q.open .fq-chevron{transform:rotate(180deg);background:rgba(var(--accent-rgb),0.35);}
        .fq-rd .fq-chevron svg{width:16px;height:16px;fill:none;stroke:var(--ink);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
        .fq-rd .fq-a{margin:0;padding:0 18px 18px;font-size:13.5px;line-height:1.6;color:#475467;}
      `}</style>

      <button type="button" className="fq-close" aria-label="Закрыть" onClick={handleClose}>
        <X size={22} strokeWidth={2.2} aria-hidden />
      </button>

      <h1 className="fq-title">Частые вопросы</h1>
      <p className="fq-sub">Как работает план и уход в skiniq</p>

      <div className="fq-list">
        {faqItems.map((item, index) => {
          const isOpen = expanded.has(index);
          return (
            <div className="fq-item" key={index}>
              <button
                type="button"
                className={`fq-q${isOpen ? ' open' : ''}`}
                aria-expanded={isOpen}
                onClick={() => toggle(index)}
              >
                {item.question}
                <span className="fq-chevron" aria-hidden>
                  <svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
                </span>
              </button>
              {isOpen && <p className="fq-a">{item.answer}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
