import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="max-w-3xl mx-auto">
      <section className="bg-white/70 border border-white/60 rounded-3xl p-6 mb-6 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <h1 className="text-2xl font-bold mb-2">Подбор ухода — минимально, но точно</h1>
        <p className="text-zinc-600">Пройди анкету, а я соберу план. Бесплатный короткий и расширенный платный.</p>
        <div className="mt-5 flex gap-3">
          <Link to="/quiz" className="px-5 py-3 rounded-full text-white bg-black">Начать анкету</Link>
          <Link to="/plan" className="px-5 py-3 rounded-full border">Посмотреть пример плана</Link>
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-4">
        <PhotoCard />
        <Card title="Мой план ухода" to="/plan" />
        <Card title="Корзина" to="/cart" />
      </section>
    </div>
  );
}

function PhotoCard() {
  return (
    <div className="bg-white/70 border border-white/60 rounded-3xl p-5">
      <div className="font-semibold">Скан по фото</div>
      <div className="text-sm text-zinc-600 mt-1 mb-3">Загрузите фото — мы подскажем тип кожи и проблемы.</div>
      <Link to="/quiz" className="inline-block px-4 py-2 rounded-full border bg-white/70 text-sm">
        Перейти к скану
      </Link>
    </div>
  );
}

function Card({ title, to }: { title: string; to: string }) {
  return (
    <Link to={to} className="block bg-white/70 border border-white/60 rounded-3xl p-5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition">
      <div className="font-semibold">{title}</div>
      <div className="text-sm text-zinc-600 mt-1">Перейти →</div>
    </Link>
  );
}
