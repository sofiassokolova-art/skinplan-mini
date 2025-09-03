
export default function Insights() {
  const scans = getScans();
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <section className="bg-white/70 border border-white/60 rounded-3xl p-6 backdrop-blur-xl">
        <h2 className="text-lg font-bold mb-3">Инсайты</h2>
        <ul className="list-disc pl-5 text-zinc-700 space-y-2">
          <li>Стадия кожи: склонность к обезвоживанию</li>
          <li>Реакции: нет</li>
          <li>Приоритет: барьер + мягкие кислоты</li>
        </ul>
      </section>
      <section className="bg-white/70 border border-white/60 rounded-3xl p-6 backdrop-blur-xl">
        <h3 className="text-lg font-bold mb-3">Архив фото-сканов</h3>
        {scans.length===0 ? (
          <div className="text-zinc-600">Пока нет сохранённых сканов. Добавь фото на последнем шаге анкеты.</div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            {scans.map((s, i)=> (
              <div key={i} className="p-2 rounded-xl border bg-white/60">
                <img src={s.preview} alt="Скан" className="h-28 w-full object-cover rounded-lg" />
                <div className="mt-1 text-xs text-zinc-600">{new Date(s.ts).toLocaleString()}</div>
                <div className="mt-1 text-xs text-zinc-700 line-clamp-3">{s.analysis}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type Scan = { ts:number; preview:string; analysis:string };
function getScans(): Scan[] {
  try {
    const raw = localStorage.getItem("skinplan_answers");
    if (!raw) return [];
    const obj = JSON.parse(raw) as { photo_scans?: Scan[] };
    return Array.isArray(obj.photo_scans) ? obj.photo_scans : [];
  } catch {
    return [];
  }
}
