import { describe, it, expect } from "vitest";
import {
  computeSkinMetrics, generateCarePlan, generate28DaySchedule, Answers
} from "../lib/plan";

describe("computeSkinMetrics", () => {
  it("BHA для акне и керамиды для сухости/увлажнения", () => {
    const a: Answers = { skinType:"комбинированная", sensitivity:false, concerns:["акне","сухость"], oiliness:"средняя", primaryGoal:"снять воспаления" };
    const m = computeSkinMetrics(a);
    expect(m.recommendedActives.join(" ")).toMatch(/BHA 2%/i);
    expect(m.recommendedActives.join(" ")).toMatch(/Керамиды/i);
  });

  it("при чувствительной коже есть риск-флаги и SPF в рекомендациях", () => {
    const a: Answers = { skinType:"нормальная", sensitivity:true, concerns:["покраснение"], oiliness:"низкая", primaryGoal:"увлажнить" };
    const m = computeSkinMetrics(a);
    expect(m.riskFlags.length).toBeGreaterThan(0);
    expect(m.recommendedActives.join(" ")).toMatch(/SPF/i);
  });
});

describe("generateCarePlan", () => {
  it("SPF всегда есть утром", () => {
    const m = computeSkinMetrics({ skinType:"жирная", sensitivity:false, concerns:[], oiliness:"высокая", primaryGoal:"сузить поры" });
    const plan = generateCarePlan(m);
    expect(plan.morning.some(p=>p.step==="spf")).toBe(true);
  });

  it("при акне включает вечерний BHA", () => {
    const m = computeSkinMetrics({ skinType:"комбинированная", sensitivity:false, concerns:["акне"], oiliness:"высокая", primaryGoal:"снять воспаления" });
    const plan = generateCarePlan(m);
    expect(plan.evening.some(p=>/bha/i.test(p.name))).toBe(true);
  });

  it("для сухой/чувствительной кожи вечерний крем более плотный", () => {
    const m = computeSkinMetrics({ skinType:"сухая", sensitivity:true, concerns:["сухость"], oiliness:"низкая", primaryGoal:"увлажнить" });
    const plan = generateCarePlan(m);
    const eveningMoist = plan.evening.find(p=>p.step==="moisturizer");
    expect(eveningMoist?.name.toLowerCase()).toMatch(/керамидами|сквалан/);
  });
});

describe("generate28DaySchedule", () => {
  it("28 дней и SPF в утренних заметках", () => {
    const m = computeSkinMetrics({ skinType:"нормальная", sensitivity:false, concerns:["постакне"], oiliness:"средняя", primaryGoal:"осветлить постакне" });
    const days = generate28DaySchedule(m);
    expect(days.length).toBe(28);
    [1,7,14,21,28].forEach(d=> expect(days[d-1].morningNotes.join(" ")).toMatch(/SPF/i));
  });
});
