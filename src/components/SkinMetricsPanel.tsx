import SkinMetrics from "../ui/SkinMetrics";
import type { Answers } from "../lib/storage";
import { getUserName } from "../lib/storage";

/**
 * Преобразуем ответы анкеты к формату, понятному SkinMetrics.
 * Если у твоего SkinMetrics другой интерфейс — подправь эту функцию:
 * главное, чтобы на выходе было то, что он ожидает через пропсы.
 */
function toMetricsModel(a: Answers) {
  const goals = (a["goals"] as string[] | undefined) ?? [];
  const skinType = (a["skin_type"] as string | undefined) ?? "—";
  const sensitivity = Number(a["reactivity"] ?? NaN);
  const budget = (a["budget"] as string | undefined) ?? "—";
  const amTime = (a["am_time"] as string | undefined) ?? "—";
  const pmTime = (a["pm_time"] as string | undefined) ?? "—";
  const name = getUserName() ?? "";

  // ——— ВАРИАНТ 1: SkinMetrics ожидает объект { items: [...], score? } ———
  // верни такой объект:
  return {
    header: { title: "Твои метрики", subtitle: name ? `Для: ${name}` : undefined },
    items: [
      { label: "Цели", value: goals.length ? goals.join(", ") : "—" },
      { label: "Тип кожи", value: skinType },
      { label: "Реактивность", value: isFinite(sensitivity) ? String(sensitivity) : "—" },
      { label: "Время (AM)", value: amTime },
      { label: "Время (PM)", value: pmTime },
      { label: "Бюджет", value: budget },
    ],
    // если у SkinMetrics есть круговой индикатор/скор — подкинем шкалу
    score: isFinite(sensitivity) ? sensitivity : undefined,
  };

  // ——— ВАРИАНТ 2: SkinMetrics ожидает совсем другой набор пропсов ———
  // просто верни нужную структуру; всё меняется тут, а в Home.tsx трогать не надо.
}

export default function SkinMetricsPanel({ a }: { a: Answers }) {
  const model = toMetricsModel(a);

  // большинство виджетов принимают один проп вроде `data` или конкретные props.
  // попробуем самый частый вариант: data={model}. Если у тебя другой интерфейс,
  // поменяй строчку ниже (например: <SkinMetrics {...model} />).
  // @ts-expect-error – если TS ругается: поменяй пропсы под твой интерфейс
  return <SkinMetrics data={model} />;
}

