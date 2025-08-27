import { useEffect, useState } from "react";
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
    <div className="max-w-3xl mx-auto space-y-6">
      <section className="bg-white/70 border border-white/60 rounded-3xl p-6 backdrop-blur-xl">
        <h2 className="text-xl font-bold mb-3">Корзина продуктов</h2>

        {items.length===0 ? (
          <div className="text-zinc-600">
            Корзина пуста. Перейди в <a href="/plan" className="underline">План</a> и добавь всё в корзину.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((it, i)=>(
              <div key={it.id} className="border rounded-2xl p-4 bg-white/60">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <input
                    value={it.name}
                    onChange={e=>update(i,{name:e.target.value})}
                    className="flex-1 rounded-xl border px-3 py-2"
                  />
                  <div className="flex items-center gap-2">
                    <button onClick={()=>update(i,{qty: Math.max(1, it.qty-1)})} className="px-3 py-2 rounded-full border">−</button>
                    <span className="min-w-6 text-center">{it.qty}</span>
                    <button onClick={()=>update(i,{qty: it.qty+1})} className="px-3 py-2 rounded-full border">+</button>
                  </div>
                  <button onClick={()=>remove(i)} className="px-3 py-2 rounded-full border text-red-600">Удалить</button>
                </div>
                <textarea
                  value={it.feedback || ""}
                  onChange={e=>update(i,{feedback:e.target.value})}
                  placeholder="Фидбек по продукту (например: липкий, сильная отдушка, хочу альтернативу без отдушек)"
                  className="mt-3 w-full rounded-xl border px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={addCustom} className="px-5 py-3 rounded-full border">Добавить позицию</button>
          <button onClick={()=>save(items)} className="px-5 py-3 rounded-full border">Сохранить</button>
          <button onClick={clear} className="px-5 py-3 rounded-full border">Очистить</button>
          <button onClick={handleSend} className="px-5 py-3 rounded-full bg-black text-white">
            {tg ? "Отправить в Telegram" : "Скопировать для Telegram"}
          </button>
        </div>
      </section>

      <section className="bg-white/70 border border-white/60 rounded-3xl p-6 backdrop-blur-xl">
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
  );
}
