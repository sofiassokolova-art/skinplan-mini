// src/data/steps.tsx
import type { ReactNode } from "react";
import type { Answers } from "../lib/storage";

export type Step =
  | { type: "input";  id: string; title: string; placeholder?: string }
  | { type: "single"; id: string; title: string; options: string[] }
  | { type: "multi";  id: string; title: string; options: string[] }
  | { type: "scale";  id: string; title: string; min: number; max: number }
  | { type: "insight"; id: string; title: string; body: ReactNode; when?: (a: Answers) => boolean };

export const STEPS: Step[] = [
  { type: "input", id: "userName", title: "Как тебя зовут?", placeholder: "Имя" },

  { type: "single", id: "skinType", title: "Какой у вас тип кожи?", options: [
    "Сухая", "Нормальная", "Комбинированная", "Жирная"
  ]},

  // инсайт — подсказка
  { type: "insight", id: "ins_after_skinType", title: "Подсказка", body:
      <div className="p-16 rounded bg-amber-50 border border-amber-200 text-amber-800">
        Подбираем базу под тип кожи. Ежедневно используйте SPF.
      </div>
  },

  { type: "multi", id: "goals", title: "Какие у вас цели по уходу?", options: [
    "Покраснение/реактивность", "Ровный тон/сияние", "Пост-акне/пятна", "Жирность/поры"
  ]},

  { type: "scale", id: "sensitivity", title: "Чувствительность кожи", min: 0, max: 10 },

  { type: "insight", id: "ins_tip", title: "Совет", body:
      <div className="p-16 rounded bg-amber-50 border border-amber-200 text-amber-800">
        Активы вводите постепенно. Если кожа реагирует — уменьшайте частоту и начинайте с барьерной защиты.
      </div>
  },
];

