import { useEffect, useState } from "react";

/** Храним все ответы в одном объекте (и в localStorage) */
export type Answers = {
  goals: string[];
  skin_type: "dry"|"normal"|"combo"|"oily"|null;
  sensitivity: boolean|null;
  acne_level: "none"|"mild"|"moderate"|"severe"|null;
  redness: boolean|null;
  dehydration: boolean|null;
  pores: boolean|null;
  tone_dullness: boolean|null;
  aging: boolean|null;

  triggers: string[];                // солнце, жара, духи, алкоголь и т.п.
  allergies: string[];               // известные аллергены
  meds: string[];                    // ретиноиды/изотретиноин/антибиотики
  procedures6m: string[];            // пилинг/лазер/микротоки

  spf_use: "never"|"sometimes"|"daily"|null;
  cleansing_pref: "gel"|"milk"|"oil"|null;
  textures: string[];                // gel/cream/balm
  dislikes: string[];                // perfume/sticky/tingling
  budget: "low"|"mid"|"high"|null;
  morning_time: "1m"|"3m"|"5m+"|null;
  evening_time: "1m"|"3m"|"5m+"|null;

  actives_ok: string[];              // aha/bha/azelaic/vitc/niacin/retinoid/ha
  actives_no: string[];              // что нельзя
  inventory: string[];               // что уже есть (cleanser/moist/spf/actives)
  pregnancy: boolean|null;

  climate: "humid"|"dry"|"cold"|"hot"|null;
  water: "soft"|"medium"|"hard"|null;
  lifestyle: string[];               // gym/swim/office-ac/travel

  // Фото (опционально)
  photo_data_url: string|null;       // data: URL для предпросмотра
  photo_analysis: string|null;       // краткий результат распознавания
};

const DEFAULT_ANS: Answers = {
  goals: [],
  skin_type: null,
  sensitivity: null,
  acne_level: "none",
  redness: null,
  dehydration: null,
  pores: null,
  tone_dullness: null,
  aging: null,

  triggers: [],
  allergies: [],
  meds: [],
  procedures6m: [],

  spf_use: null,
  cleansing_pref: null,
  textures: [],
  dislikes: [],
  budget: "mid",
  morning_time: null,
  evening_time: null,

  actives_ok: [],
  actives_no: [],
  inventory: [],
  pregnancy: null,

  climate: null,
  water: null,
  lifestyle: [],

  photo_data_url: null,
  photo_analysis: null,
};

const save = (a: Answers) => localStorage.setItem("skinplan_answers", JSON.stringify(a));
const load = (): Answers => {
  try { const raw = localStorage.getItem("skinplan_answers"); return raw ? { ...DEFAULT_ANS, ...JSON.parse(raw) } : DEFAULT_ANS; }
  catch { return DEFAULT_ANS; }
};

/* ----------- маленькие кирпичики UI ----------- */
const Pill = ({active, children, onClick}:{active?:boolean;children:React.ReactNode;onClick?:()=>void}) => (
  <button onClick={onClick}
    className={`inline-flex items-center px-3 py-1.5 mr-2 mb-2 rounded-full border text-sm
      ${active ? "bg-black text-white border-black" : "bg-white/60 hover:bg-white/80"}`}>
    {children}
  </button>
);

function Multi({label, options, value, onChange, limit}:{label:string; options:{key:string;label:string}[]; value:string[]; onChange:(v:string[])=>void; limit?:number}) {
  const toggle = (k:string) => {
    const next = value.includes(k) ? value.filter(x=>x!==k) : [...value, k];
    if (limit && next.length>limit) return;
    onChange(next);
  };
  return (
    <Block title={label}>
      <div className="flex flex-wrap">{options.map(o=>(
        <Pill key={o.key} active={value.includes(o.key)} onClick={()=>toggle(o.key)}>{o.label}</Pill>
      ))}</div>
    </Block>
  );
}
function Single({label, options, value, onChange}:{label:string; options:{key:string;label:string}[]; value:string|null; onChange:(v:any)=>void}) {
  return (
    <Block title={label}>
      <div className="flex flex-wrap">{options.map(o=>(
        <Pill key={o.key} active={value===o.key} onClick={()=>onChange(o.key)}>{o.label}</Pill>
      ))}</div>
    </Block>
  );
}
function Bool({label, value, onChange}:{label:string; value:boolean|null; onChange:(v:boolean)=>void}) {
  return (
    <Block title={label}>
      <Pill active={value===true} onClick={()=>onChange(true)}>Да</Pill>
      <Pill active={value===false} onClick={()=>onChange(false)}>Нет</Pill>
    </Block>
  );
}
function Block({title, children}:{title:string; children:React.ReactNode}) {
  return (
    <div className="bg-white/70 border border-white/60 rounded-3xl p-6 mb-5 backdrop-blur-xl">
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      {children}
    </div>
  );
}

/* ----------- Шаг: Фото (опционально) ----------- */
function PhotoStep({a, set}:{a:Answers; set:(p:Partial<Answers>)=>void}) {
  const [error, setError] = useState<string|null>(null);

  const onFile = async (file: File) => {
    setError(null);
    if (!file) return;

    const allowed = ["image/jpeg","image/png","image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Формат не поддерживается. Загрузите JPEG/PNG/WebP.");
      return;
    }
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      setError("Слишком большой файл. До 5 МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      set({ photo_data_url: dataUrl });
      // Демонстрационный «анализ» — в реальности тут вызов API
      set({ photo_analysis: "Обнаружены признаки лёгкой жирности T-зоны, единичные воспаления." });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Block title="Фото-скан (опционально)">
      <p className="text-sm text-zinc-600 mb-3">Можно добавить фото без макияжа при дневном свете — я учту это при планировании. Можно пропустить.</p>
      <label className="inline-flex items-center px-4 py-2 rounded-full border bg-white/70 cursor-pointer">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e)=>{
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        Загрузить фото
      </label>

      {error && (
        <div role="alert" className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
          {error}
        </div>
      )}

      {a.photo_data_url && (
        <div className="mt-4">
          <img src={a.photo_data_url} alt="Предпросмотр" className="max-h-64 rounded-2xl border" />
          {a.photo_analysis && (
            <div className="mt-2 text-sm text-zinc-700">{a.photo_analysis}</div>
          )}
          <button className="mt-3 text-sm text-zinc-600 underline" onClick={()=>set({photo_data_url:null, photo_analysis:null})}>Очистить фото</button>
        </div>
      )}
    </Block>
  );
}

/* ----------- Анкета с шагами и инсайтами ----------- */
type Step =
 | { type:"q"; id:string; render:(a:Answers, set:(p:Partial<Answers>)=>void)=>React.ReactNode }
 | { type:"insight"; id:string; render:(a:Answers)=>React.ReactNode }
 | { type:"done" };

const steps: Step[] = [
  // Блок 1 — цели и базовая кожа
  { type:"q", id:"goals", render:(a, set)=>(
      <Multi label="Цели на 4–8 недель (до 3)"
        options={[
          {key:"acne",label:"Высыпания/комедоны"},
          {key:"postacne",label:"Пост-акне/пятна"},
          {key:"redness",label:"Покраснение/чувствительность"},
          {key:"pores",label:"Жирность/поры"},
          {key:"dry",label:"Сухость/шелушение"},
          {key:"tone",label:"Ровный тон/сияние"},
          {key:"aging",label:"Анти-эйдж"},
        ]}
        value={a.goals} limit={3} onChange={(v)=>set({goals:v})} />
  )},
  { type:"q", id:"type", render:(a,set)=>(
      <Single label="Тип кожи"
        options={[{key:"dry",label:"Сухая"},{key:"normal",label:"Нормальная"},{key:"combo",label:"Комбинированная"},{key:"oily",label:"Жирная"}]}
        value={a.skin_type} onChange={(v)=>set({skin_type:v})}/>
  )},
  { type:"q", id:"acne", render:(a,set)=>(
      <Single label="Уровень высыпаний"
        options={[{key:"none",label:"Нет"},{key:"mild",label:"Лёгкие"},{key:"moderate",label:"Средние"},{key:"severe",label:"Выраженные"}]}
        value={a.acne_level} onChange={(v)=>set({acne_level:v})}/>
  )},
  { type:"q", id:"symptoms", render:(a,set)=>(
      <>
        <Bool label="Есть склонность к покраснению/реактивности?" value={a.redness} onChange={(v)=>set({redness:v})}/>
        <Bool label="Есть чувство стянутости/обезвоживание?" value={a.dehydration} onChange={(v)=>set({dehydration:v})}/>
        <Bool label="Беспокоят расширенные поры/жирный блеск?" value={a.pores} onChange={(v)=>set({pores:v})}/>
        <Bool label="Тусклый тон?" value={a.tone_dullness} onChange={(v)=>set({tone_dullness:v})}/>
        <Bool label="Есть цель замедлить возрастные изменения?" value={a.aging} onChange={(v)=>set({aging:v})}/>
      </>
  )},
  // Инсайт после блока 1
  { type:"insight", id:"insight1", render:(a)=>(
    <Block title="Предварительные наблюдения">
      <ul className="list-disc pl-5 text-zinc-700 space-y-1">
        {a.goals.length>0 && <li>Фокус на: {a.goals.map(g=>({
          acne:"высыпания",postacne:"пост-акне",redness:"покраснение",
          pores:"поры/жирность",dry:"сухость",tone:"тон",aging:"анти-эйдж"
        } as any)[g]).join(", ")}.</li>}
        {a.skin_type && <li>Базовый тип: {({dry:"сухая",normal:"нормальная",combo:"комбинированная",oily:"жирная"} as any)[a.skin_type]}.</li>}
        {a.redness && <li>Отмечена реактивность — будем смягчать формулы и частоту активов.</li>}
        {a.dehydration && <li>Добавим увлажнение/барьерные шаги для снятия стянутости.</li>}
      </ul>
      <div className="mt-4 text-sm text-zinc-500">Нажми «Далее», продолжим уточнения.</div>
    </Block>
  )},

  // Блок 2 — чувствительность, триггеры, ограничения
  { type:"q", id:"sensitivity", render:(a,set)=>(
    <Bool label="Кожа чувствительная?" value={a.sensitivity} onChange={(v)=>set({sensitivity:v})}/>
  )},
  { type:"q", id:"triggers", render:(a,set)=>(
    <Multi label="Известные триггеры"
      options={[
        {key:"sun",label:"Солнце/жара"},
        {key:"fragrance",label:"Отдушки"},
        {key:"alcohol",label:"Спирты"},
        {key:"overwash",label:"Частое умывание"},
        {key:"peels",label:"Жёсткие скрабы/пилинги"},
      ]}
      value={a.triggers} onChange={(v)=>set({triggers:v})}/>
  )},
  { type:"q", id:"allergies", render:(a,set)=>(
    <Multi label="Аллергии/непереносимость"
      options={[{key:"niacin",label:"Ниацинамид"},{key:"vitc",label:"Кисл. витамин C"},{key:"aha",label:"AHA"},{key:"bha",label:"BHA"}]}
      value={a.allergies} onChange={(v)=>set({allergies:v})}/>
  )},
  { type:"q", id:"meds", render:(a,set)=>(
    <Multi label="Текущие препараты (по назначению врача)"
      options={[{key:"topical_retinoid",label:"Топический ретиноид"},{key:"isotretinoin",label:"Изотретиноин"},{key:"antibiotics",label:"Антибиотики"}]}
      value={a.meds} onChange={(v)=>set({meds:v})}/>
  )},
  { type:"q", id:"procedures6m", render:(a,set)=>(
    <Multi label="Процедуры за 6 мес."
      options={[{key:"peel",label:"Пилинг"},{key:"laser",label:"Лазер"},{key:"microneedling",label:"Микронидлинг"}]}
      value={a.procedures6m} onChange={(v)=>set({procedures6m:v})}/>
  )},
  // инсайт после блока 2
  { type:"insight", id:"insight2", render:(a)=>(
    <Block title="Безопасность и частота активов">
      <div className="text-zinc-700">
        {a.meds.includes("isotretinoin") && <p>Изотретиноин — исключаем кислоты и ретиноиды; упор на барьер.</p>}
        {a.procedures6m.includes("peel") && <p>Недавний пилинг — аккуратный ввод кислот не раньше 2–3 недель от процедуры.</p>}
        {a.sensitivity && <p>Чувствительность — начнём с «через день», патч-тест обязателен.</p>}
        {!a.sensitivity && a.actives_ok.length===0 && <p>Можно стартовать мягко: азелаиновая/ниацинамид, затем при необходимости ретиноид.</p>}
      </div>
    </Block>
  )},

  // Блок 3 — привычки и предпочтения
  { type:"q", id:"spf", render:(a,set)=>(
    <Single label="SPF привычка" options={[{key:"never",label:"Почти не наношу"},{key:"sometimes",label:"Иногда"},{key:"daily",label:"Ежедневно"}]}
      value={a.spf_use} onChange={(v)=>set({spf_use:v})}/>
  )},
  { type:"q", id:"cleansing", render:(a,set)=>(
    <Single label="Предпочитаемый формат очищения"
      options={[{key:"gel",label:"Гель/пенка"},{key:"milk",label:"Крем/молочко"},{key:"oil",label:"Масло/бальзам"}]}
      value={a.cleansing_pref} onChange={(v)=>set({cleansing_pref:v})}/>
  )},
  { type:"q", id:"textures", render:(a,set)=>(
    <Multi label="Любимые текстуры"
      options={[{key:"gel",label:"Гель"},{key:"lotion",label:"Лосьон"},{key:"cream",label:"Крем"},{key:"balm",label:"Бальзам"}]}
      value={a.textures} onChange={(v)=>set({textures:v})}/>
  )},
  { type:"q", id:"dislikes", render:(a,set)=>(
    <Multi label="Не люблю"
      options={[{key:"perfume",label:"Ароматы"},{key:"sticky",label:"Липкость"},{key:"tingling",label:"Пощипывание"}]}
      value={a.dislikes} onChange={(v)=>set({dislikes:v})}/>
  )},
  { type:"q", id:"budget", render:(a,set)=>(
    <Single label="Бюджет" options={[{key:"low",label:"Бюджетно"},{key:"mid",label:"Средний"},{key:"high",label:"Премиум"}]}
      value={a.budget} onChange={(v)=>set({budget:v})}/>
  )},
  { type:"q", id:"time", render:(a,set)=>(
    <>
      <Single label="Время утром" options={[{key:"1m",label:"~1 мин"},{key:"3m",label:"~3 мин"},{key:"5m+",label:"5+ мин"}]}
        value={a.morning_time} onChange={(v)=>set({morning_time:v})}/>
      <Single label="Время вечером" options={[{key:"1m",label:"~1 мин"},{key:"3m",label:"~3 мин"},{key:"5m+",label:"5+ мин"}]}
        value={a.evening_time} onChange={(v)=>set({evening_time:v})}/>
    </>
  )},
  // Блок 4 — активы, инвентарь, условия среды
  { type:"q", id:"actives_ok", render:(a,set)=>(
    <Multi label="Какие активы уже нормально переносишь?"
      options={[{key:"aha",label:"AHA"},{key:"bha",label:"BHA"},{key:"azelaic",label:"Азелаиновая"},{key:"niacin",label:"Ниацинамид"},{key:"vitc",label:"Витамин C"},{key:"retinoid",label:"Ретиноид"},{key:"ha",label:"Гиалуронка"}]}
      value={a.actives_ok} onChange={(v)=>set({actives_ok:v})}/>
  )},
  { type:"q", id:"actives_no", render:(a,set)=>(
    <Multi label="Что точно НЕ подходит?"
      options={[{key:"aha",label:"AHA"},{key:"bha",label:"BHA"},{key:"azelaic",label:"Азелаиновая"},{key:"niacin",label:"Ниацинамид"},{key:"vitc",label:"Витамин C"},{key:"retinoid",label:"Ретиноид"}]}
      value={a.actives_no} onChange={(v)=>set({actives_no:v})}/>
  )},
  { type:"q", id:"inventory", render:(a,set)=>(
    <Multi label="Что уже есть дома?"
      options={[{key:"cleanser",label:"Очищение"},{key:"moist",label:"Крем"},{key:"spf",label:"SPF"},{key:"actives",label:"Активы"}]}
      value={a.inventory} onChange={(v)=>set({inventory:v})}/>
  )},
  { type:"q", id:"pregnancy", render:(a,set)=>(
    <Bool label="Беременность/ГВ?" value={a.pregnancy} onChange={(v)=>set({pregnancy:v})}/>
  )},
  { type:"q", id:"env", render:(a,set)=>(
    <>
      <Single label="Климат" options={[{key:"humid",label:"Влажно"},{key:"dry",label:"Сухо"},{key:"cold",label:"Холодно"},{key:"hot",label:"Жарко"}]}
        value={a.climate} onChange={(v)=>set({climate:v})}/>
      <Single label="Жёсткость воды" options={[{key:"soft",label:"Мягкая"},{key:"medium",label:"Средняя"},{key:"hard",label:"Жёсткая"}]}
        value={a.water} onChange={(v)=>set({water:v})}/>
      <Multi label="Образ жизни"
        options={[{key:"gym",label:"Зал/потливость"},{key:"swim",label:"Бассейн"},{key:"office-ac",label:"Офис/кондиционер"},{key:"travel",label:"Частые перелёты"}]}
        value={a.lifestyle} onChange={(v)=>set({lifestyle:v})}/>
    </>
  )},
  // инсайт после блока 4
  { type:"insight", id:"insight3", render:(a)=>(
    <Block title="Что это значит для плана">
      <ul className="list-disc pl-5 text-zinc-700 space-y-1">
        {a.budget && <li>Бюджет: {({low:"бюджет",mid:"средний",high:"премиум"} as any)[a.budget]} — под него подберу бренды.</li>}
        {a.morning_time && <li>Утренний лимит времени: {a.morning_time}. Никаких лишних шагов.</li>}
        {a.inventory.length>0 && <li>Учту, что уже есть: {a.inventory.join(", ")} — не дублирую.</li>}
        {a.pregnancy && <li>Исключим ретиноиды и сильные кислоты; акцент на мягких активах.</li>}
      </ul>
    </Block>
  )},
  // Финальный шаг: опциональное фото
  { type:"q", id:"photo", render:(a,set)=>(
      <PhotoStep a={a} set={set} />
  )},
  { type:"done" },
];

/* ----------- Главный компонент ----------- */
export default function Quiz() {
  const [ans, setAns] = useState<Answers>(load());
  const [idx, setIdx] = useState(0);

  useEffect(()=> save(ans), [ans]);

  const step = steps[idx];
  const total = steps.length;

  const go = (d:number) => setIdx(i => Math.min(total-1, Math.max(0, i + d)));

  const setter = (patch: Partial<Answers>) => setAns(a => ({ ...a, ...patch }));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-3 text-sm text-zinc-600">Шаг {idx+1}/{total}</div>
      <div className="w-full h-2 bg-white/70 rounded-full overflow-hidden mb-5">
        <div className="h-2 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" style={{width:`${Math.round(((idx+1)/total)*100)}%`}}/>
      </div>

      {step.type==="q" && step.render(ans, setter)}
      {step.type==="insight" && step.render(ans)}
      {step.type==="done" && (
        <Block title="Готово">
          <p className="text-zinc-700">Анкета заполнена. На основе ответов я соберу план на 28 дней, бюджет и продукты — на следующем экране.</p>
        </Block>
      )}

      <div className="mt-6 flex justify-between">
        <button disabled={idx===0} onClick={()=>go(-1)} className="px-5 py-3 rounded-full border disabled:opacity-50">Назад</button>
        {idx<total-1 ? (
          <button onClick={()=>go(+1)} className="px-5 py-3 rounded-full text-white bg-black">Далее</button>
        ) : (
          <a href="/plan" className="px-5 py-3 rounded-full text-white bg-black">Сформировать план</a>
        )}
      </div>
    </div>
  );
}
