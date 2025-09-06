import React, { useState } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { getUserName } from "../lib/storage";

export default function Consult(){
  const [name, setName] = useState(getUserName() || "");
  const [tg, setTg] = useState("");
  const [email, setEmail] = useState("");
  const [when, setWhen] = useState("");
  const [text, setText] = useState("");

  function submit(e:React.FormEvent){
    e.preventDefault();
    const body = encodeURIComponent(
      `Имя: ${name}\nTelegram: ${tg}\nEmail: ${email}\nКогда удобно: ${when}\n\nЗапрос:\n${text}`
    );
    // Простой способ: открыть письмо
    window.location.href = `mailto:hello@skiniq.app?subject=Запись на консультацию&body=${body}`;
  }

  return (
    <div>
      <h1>Запись на консультацию</h1>
      <Card>
        <form onSubmit={submit} className="row" style={{flexDirection:"column", gap:12}}>
          <input className="input" placeholder="Имя" value={name} onChange={e=>setName(e.target.value)} />
          <input className="input" placeholder="Telegram @" value={tg} onChange={e=>setTg(e.target.value)} />
          <input className="input" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="input" placeholder="Желаемое время/дата" value={when} onChange={e=>setWhen(e.target.value)} />
          <textarea className="input" rows={5} placeholder="Кратко опишите запрос" value={text} onChange={e=>setText(e.target.value)} />
          <div>
            <Button type="submit">Отправить</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

