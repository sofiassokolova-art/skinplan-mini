export type Answers = {
  name?: string; pdConsent?: boolean;
  skinType?: "сухая" | "жирная" | "комбинированная" | "нормальная";
  sensitivity?: boolean;
  concerns?: string[];
  oiliness?: "низкая" | "средняя" | "высокая";
  primaryGoal?: "снять воспаления" | "увлажнить" | "осветлить постакне" | "сузить поры";
};

export type SkinMetrics = {
  skinType: NonNullable<Answers["skinType"]>;
  sensitivity: boolean;
  oiliness: NonNullable<Answers["oiliness"]>;
  concerns: string[];
  primaryGoal: NonNullable<Answers["primaryGoal"]>;
  recommendedActives: string[];
  riskFlags: string[];
};

export type PlanProduct = {
  id: string; name: string;
  step:"cleanser"|"toner"|"hydrator"|"treatment"|"moisturizer"|"spf";
  timeOfDay:"morning"|"evening"; note?: string;
};
export type CarePlan = { morning: PlanProduct[]; evening: PlanProduct[]; };

export type DayPlan = { day:number; morningNotes:string[]; eveningNotes:string[]; };

const has = (arr:string[]|undefined, x:string)=>Array.isArray(arr)&&arr.includes(x);
const uid = (()=>{let i=0; return (p="p")=>`${p}_${++i}`;})();

export function computeSkinMetrics(a: Answers): SkinMetrics {
  const skinType = a.skinType ?? "нормальная";
  const sensitivity = !!a.sensitivity;
  const oiliness = a.oiliness ?? "средняя";
  const concerns = a.concerns ?? [];
  const primaryGoal = a.primaryGoal ?? "увлажнить";

  const recommended = new Set<string>(); const riskFlags:string[] = [];

  if (has(concerns,"акне")) recommended.add("BHA 2% (салициловая) — через день вечером");
  if (has(concerns,"постакне") || primaryGoal==="осветлить постакне") recommended.add("Азелаиновая кислота 10% — вечер/через день");
  if (has(concerns,"расширенные поры") || primaryGoal==="сузить поры") recommended.add("Ниацинамид 4–10% — утро/вечер");
  if (has(concerns,"сухость") || primaryGoal==="увлажнить" || skinType==="сухая") {
    recommended.add("Гиалуроновая кислота / увлажняющий бустер");
    recommended.add("Керамиды / сквалан — базовое восстановление");
  }
  if (has(concerns,"покраснение") || sensitivity) {
    recommended.add("Цика / пантенол — успокаивание");
    if (recommended.has("Азелаиновая кислота 10% — вечер/через день"))
      riskFlags.push("Чувствительная кожа: вводить азелаиновую постепенно");
  }
  if (oiliness==="высокая") recommended.add("Лёгкие флюиды/гели; безкомедогенные формулы");
  if (oiliness==="низкая" || skinType==="сухая") recommended.add("Более плотный крем вечером");

  recommended.add("SPF 50 утром ежедневно");
  if (sensitivity) riskFlags.push("Избегать высоких концентраций кислот в первую неделю");

  return { skinType, sensitivity, oiliness, concerns, primaryGoal,
           recommendedActives:[...recommended], riskFlags };
}

export function generateCarePlan(m: SkinMetrics): CarePlan {
  const cleanser = (m.skinType==="сухая"||m.sensitivity) ? "Мягкое очищение (крем/гель, pH≈5.5)" : "Гель-очищение";
  const hydrator = (m.primaryGoal==="увлажнить"||m.skinType==="сухая") ? "Увлажняющая сыворотка (гиалуроновая кислота)" : "Тонер/эссенция";
  const amT:string[]=[]; if (m.primaryGoal==="сузить поры"||has(m.concerns,"расширенные поры")) amT.push("Ниацинамид 4–10%");
  if (has(m.concerns,"покраснение")) amT.push("Цика/пантенол");

  const pmT:string[]=[]; if (has(m.concerns,"акне")) pmT.push("BHA 2% (2–3 р/нед)");
  if (has(m.concerns,"постакне")||m.primaryGoal==="осветлить постакне") pmT.push("Азелаиновая 10% (через день)");
  if (m.sensitivity) pmT.push("Минималистичный буфер (алоэ/цина)");

  const light="Лёгкий флюид/гель-крем (некомедогенный)", rich="Крем с керамидами/скваланом";

  const morning:CarePlan["morning"]=[
    {id:uid("cl"),name:cleanser,step:"cleanser",timeOfDay:"morning"},
    {id:uid("hy"),name:hydrator,step:"hydrator",timeOfDay:"morning"},
    ...amT.map(t=>({id:uid("tr"),name:t,step:"treatment" as const,timeOfDay:"morning" as const})),
    {id:uid("mo"),name:m.skinType==="сухая"?rich:light,step:"moisturizer",timeOfDay:"morning"},
    {id:uid("sp"),name:"SPF 50",step:"spf",timeOfDay:"morning"},
  ];

  const evening:CarePlan["evening"]=[
    {id:uid("cl"),name:cleanser,step:"cleanser",timeOfDay:"evening"},
    {id:uid("hy"),name:"Успокаивающая эссенция/сыворотка (по необходимости)",step:"hydrator",timeOfDay:"evening"},
    ...pmT.map(t=>({id:uid("tr"),name:t,step:"treatment" as const,timeOfDay:"evening" as const})),
    {id:uid("mo"),name:(m.sensitivity||m.skinType==="сухая")?rich:light,step:"moisturizer",timeOfDay:"evening"},
  ];

  return { morning, evening };
}

export function generate28DaySchedule(m: SkinMetrics): DayPlan[] {
  const res:DayPlan[]=[]; const acne=has(m.concerns,"акне"), post=has(m.concerns,"постакне"),
        red=has(m.concerns,"покраснение"), gentle=(m.sensitivity||m.skinType==="сухая");

  for(let d=1; d<=28; d++){
    const am=["Очищение → увлажнение → SPF 50"];
    const pm=["Очищение → увлажнение → крем"];

    if(d<=7){
      if(red||gentle) pm.push("Успокаивающее (цика/пантенол)");
      if(post) pm.push("Азелаиновая 10% (1 раз в эту неделю)");
    }
    if(d>=8&&d<=14){
      if(acne&&(d===9||d===12)) pm.push("BHA 2% (точечно/тонкий слой)");
      if(post&&d===10) pm.push("Азелаиновая 10%");
      if(m.primaryGoal==="сузить поры"&&(d===11||d===14)) am.push("Ниацинамид 4–10%");
    }
    if(d>=15&&d<=21){
      if(acne&&(d===15||d===18||d===21)) pm.push("BHA 2%");
      if(post&&(d===16||d===20)) pm.push("Азелаиновая 10%");
      if(!gentle&&m.primaryGoal!=="увлажнить"&&d===19) pm.push("Мягкий ретиноид (если есть опыт)");
    }
    if(d>=22){
      if(acne&&(d===23||d===26)) pm.push("BHA 2%");
      if(post&&(d===22||d===25||d===28)) pm.push("Азелаиновая 10%");
      if(m.primaryGoal==="увлажнить"||gentle) pm.push("Плотнее крем (керамиды)");
    }
    res.push({day:d,morningNotes:am,eveningNotes:pm});
  }
  return res;
}

/** Утилита: перечитать answers из LS, пересчитать план и сохранить его в LS */
export function recomputeAndPersistPlanFromLS() {
  let answers: Answers = {};
  try { answers = JSON.parse(localStorage.getItem("skiniq.answers") || "{}"); } catch {}
  const metrics = computeSkinMetrics(answers);
  const plan = generateCarePlan(metrics);
  localStorage.setItem("skiniq.plan", JSON.stringify(plan));
  return { metrics, plan };
}
