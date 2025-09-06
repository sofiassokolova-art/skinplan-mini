import Card from "./Card";
import { loadAnswers, type Answers } from "../lib/storage";

type Props = { answers?: Answers };

export default function SkinMetrics({ answers }: Props) {
  const a: Answers = answers ?? (loadAnswers() ?? {});

  const skinType = (a["skinType"] as string) || "—";
  const sensitivity = clampInt(a["sensitivity"], 0, 10);      // 0..10, без NaN
  const sunRaw = a["sun"] ?? a["sunLoad"] ?? a["uv"] ?? 0;     // поддержим разные ключи
  const sun = clampInt(sunRaw, 0, 100);                         // в процентах

  return (
    <Card>
      <h2>Твои показатели</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
        <div>
          <div className="muted">Тип кожи</div>
          <div className="h3">{skinType}</div>
        </div>

        <div>
          <div className="muted">Чувствительность</div>
          <div className="h3">{sensitivity}</div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="muted">Солнечная нагрузка (оценка)</div>
        <div
          style={{
            marginTop: 8,
            height: 10,
            borderRadius: 999,
            background: "rgba(0,0,0,.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${sun}%`,
              background: "linear-gradient(90deg,#7C3AED,#EC4899)",
            }}
          />
        </div>
      </div>
    </Card>
  );
}

function clampInt(v: unknown, min: number, max: number) {
  const n = Math.round(Number(v ?? 0));
  if (Number.isNaN(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

