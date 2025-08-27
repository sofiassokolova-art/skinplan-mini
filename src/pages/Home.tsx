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
        <Card title="Личный кабинет" to="/account" />
        <Card title="Корзина продуктов" to="/cart" />
        <Card title="Инсайты/статистика" to="/insights" />
      </section>
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
