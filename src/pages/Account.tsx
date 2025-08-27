
export default function Account() {
  return (
    <div className="max-w-3xl mx-auto bg-white/70 border border-white/60 rounded-3xl p-6 backdrop-blur-xl">
      <h2 className="text-lg font-bold mb-3">Личный кабинет</h2>
      <ul className="list-disc pl-5 text-zinc-700 space-y-2">
        <li>Мои планы (текущий и архив)</li>
        <li>Подписка и платежи</li>
        <li>Настройки напоминаний</li>
      </ul>
    </div>
  );
}
