import { Link } from "react-router-dom";

export default function Home() {

  return (
    <div className="max-w-3xl mx-auto">
      <section className="bg-white/70 border border-white/60 rounded-3xl p-6 mb-6 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <h1 className="text-2xl font-bold mb-2">Подбор ухода — минимально, но точно</h1>
        <p className="text-zinc-600">Пройди анкету, а я соберу план. Бесплатный короткий и расширенный платный.</p>
          
          <div className="mt-5 flex gap-3">
            <Link to="/quiz" className="px-5 py-3 rounded-full text-white bg-black hover:bg-stone-800 transition">
              ✨ Начать анкету
            </Link>
            <Link to="/plan" className="px-5 py-3 rounded-full border hover:bg-white/70 transition">
              👀 Посмотреть пример плана
            </Link>
          </div>
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          <Card title="🛒 Корзина продуктов" to="/cart" description="Сохраненные товары из планов" />
          <Card title="📊 Анализ кожи" to="/insights" description="История AI-анализов" />
        </section>

        {/* Дополнительные карточки */}
        <section className="mt-6 grid sm:grid-cols-3 gap-4">
          <FeatureCard 
            icon="🔬"
            title="AI-анализ"
            description="12 показателей кожи с зонированием"
          />
          <FeatureCard 
            icon="📋"
            title="Персональный план"
            description="28 дней детального ухода"
          />
          <FeatureCard 
            icon="📄"
            title="PDF отчеты"
            description="Сохраните план в красивом формате"
          />
        </section>
      </div>
    );
}

function Card({ title, to, description }: { title: string; to: string; description: string }) {
  return (
    <Link to={to} className="block bg-white/70 border border-white/60 rounded-3xl p-5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition">
      <div className="font-semibold">{title}</div>
      <div className="text-sm text-zinc-600 mt-1">{description}</div>
      <div className="text-xs text-indigo-600 mt-2">Перейти →</div>
    </Link>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white/70 border border-white/60 rounded-3xl p-4 backdrop-blur-xl">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-xs text-zinc-600 mt-1">{description}</div>
    </div>
  );
}
