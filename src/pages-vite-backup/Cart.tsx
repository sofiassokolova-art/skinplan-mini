import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { tg, sendToTG } from "../lib/tg";

type CartItem = { id:string; name:string; qty:number; feedback?:string };
const LS_KEY = "skinplan_cart";
const NOTE_KEY = "skinplan_cart_note";

const load = (): CartItem[] => {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
};
const save = (items: CartItem[]) => localStorage.setItem(LS_KEY, JSON.stringify(items));

export default function Cart() {
  const [items, setItems] = useState<CartItem[]>(load());
  const [note, setNote] = useState<string>(() => localStorage.getItem(NOTE_KEY) || "");

  useEffect(()=> save(items), [items]);
  useEffect(()=> localStorage.setItem(NOTE_KEY, note), [note]);

  const update = (i:number, patch: Partial<CartItem>) =>
    setItems(list => list.map((it,idx)=> idx===i ? {...it, ...patch} : it));

  const addCustom = () =>
    setItems(list => [...list, { id: "custom-"+Date.now(), name:"Мой продукт", qty:1 }]);

  const remove = (i:number) => setItems(list => list.filter((_,idx)=> idx!==i));

  const clear = () => { setItems([]); setNote(""); };

  const handleSend = () => {
    const payload = { type: "skinplan_cart", items, note, ts: Date.now() };
    const res = sendToTG(payload);
    if (!res.ok) {
      // фолбэк: копируем JSON в буфер, чтобы можно было вставить в чат вручную
      const json = JSON.stringify(payload, null, 2);
      navigator.clipboard.writeText(json).then(()=>{
        alert("Я не вижу Telegram WebApp (браузерный режим). Скопировала данные в буфер — вставь в чат вручную.");
      }).catch(()=>{
        alert("Не удалось отправить. Открой в Telegram Mini App или скопируй содержимое вручную.");
      });
    }
  };

  return (
    <div className="w-full min-h-screen relative overflow-x-hidden">
      {/* Background gradient */}
      <div 
        className="fixed inset-0 -z-10 bg-gradient-to-br from-gray-100 via-slate-100 to-gray-200"
      />
      
      {/* Header */}
      <div className="absolute top-4 left-4 z-20">
        <Link to="/" className="block cursor-pointer hover:opacity-80 transition-opacity">
          <img 
            src="/skiniq-logo.png" 
            alt="SkinIQ" 
            className="h-32 w-auto object-contain"
          />
        </Link>
      </div>
      
      <div className="relative z-20 max-w-7xl mx-auto space-y-6 px-2 sm:px-4 pt-32">
        <section className="bg-white/20 backdrop-blur-xl border border-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.08)] rounded-3xl p-6">
        <h2 className="text-[18px] font-semibold text-gray-900 mb-3">Корзина продуктов</h2>

        {items.length===0 ? (
          <div className="text-[14px] text-gray-600">
            Корзина пуста. Перейди в <a href="/plan" className="underline text-gray-800 hover:text-gray-600">План</a> и добавь всё в корзину.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((it, i)=>(
              <div key={it.id} className="border border-white/40 rounded-2xl p-4 bg-white/30 backdrop-blur-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <input
                    value={it.name}
                    onChange={e=>update(i,{name:e.target.value})}
                    className="flex-1 rounded-xl border border-gray-200/50 px-3 py-2 bg-white/50 backdrop-blur-sm text-[14px] focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  />
                  <div className="flex items-center gap-2">
                    <button onClick={()=>update(i,{qty: Math.max(1, it.qty-1)})} className="w-8 h-8 rounded-full border border-gray-200/50 bg-white/50 backdrop-blur-sm flex items-center justify-center text-[14px] font-semibold hover:bg-white/70 transition-colors">−</button>
                    <span className="min-w-6 text-center text-[14px] font-semibold text-gray-800">{it.qty}</span>
                    <button onClick={()=>update(i,{qty: it.qty+1})} className="w-8 h-8 rounded-full border border-gray-200/50 bg-white/50 backdrop-blur-sm flex items-center justify-center text-[14px] font-semibold hover:bg-white/70 transition-colors">+</button>
                  </div>
                  <button onClick={()=>remove(i)} className="px-4 py-2 rounded-xl border border-red-200/50 bg-red-50/50 backdrop-blur-sm text-red-600 text-[14px] font-medium hover:bg-red-100/50 transition-colors">Удалить</button>
                </div>
                <textarea
                  value={it.feedback || ""}
                  onChange={e=>update(i,{feedback:e.target.value})}
                  placeholder="Фидбек по продукту (например: липкий, сильная отдушка, хочу альтернативу без отдушек)"
                  className="mt-3 w-full rounded-xl border border-gray-200/50 px-3 py-2 text-[12px] bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  rows={2}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={addCustom} className="px-4 py-2 rounded-xl border border-gray-200/50 bg-white/50 backdrop-blur-sm text-[14px] font-medium hover:bg-white/70 transition-colors">Добавить позицию</button>
          <button onClick={()=>save(items)} className="px-4 py-2 rounded-xl border border-gray-200/50 bg-white/50 backdrop-blur-sm text-[14px] font-medium hover:bg-white/70 transition-colors">Сохранить</button>
          <button onClick={clear} className="px-4 py-2 rounded-xl border border-red-200/50 bg-red-50/50 backdrop-blur-sm text-red-600 text-[14px] font-medium hover:bg-red-100/50 transition-colors">Очистить</button>
          <button onClick={handleSend} className="px-4 py-2 rounded-xl bg-gradient-to-r from-gray-600 to-gray-700 text-white text-[14px] font-semibold hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
            {tg ? "Отправить в Telegram" : "Скопировать для Telegram"}
          </button>
        </div>
      </section>

        <section className="bg-white/20 backdrop-blur-xl border border-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.08)] rounded-3xl p-6">
          <h3 className="text-lg font-bold mb-2">Общий комментарий</h3>
        <textarea
          value={note}
          onChange={e=>setNote(e.target.value)}
          placeholder="Общее: бюджет, магазины, аллергии, что заменить или чего опасаешься"
          className="w-full rounded-xl border px-3 py-2"
          rows={3}
        />
        <div className="mt-3 text-sm text-zinc-500">
          Комментарий сохранится и будет приложен к сообщению/заявке.
        </div>
        </section>
      </div>
    </div>
  );
}
