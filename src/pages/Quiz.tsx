import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SkinAnalysis, { type SkinMetrics, type SkinZone } from "../components/SkinAnalysis";

/** Храним все ответы в одном объекте (и в localStorage) */
export type Answers = {
  // 1. Общая информация
  age: "under18"|"18-24"|"25-34"|"35-44"|"45+"|null;
  gender: "female"|"male"|null;

  // 2. Особенности кожи
  skin_concerns: string[];           // акне, жирность, сухость, пигментация и т.д.
  after_cleansing: "comfortable"|"tight"|null;
  daily_behavior: "oily_2-3h"|"oily_evening"|"stays_matte"|null;
  sensitivity_level: "high"|"medium"|"low"|null;
  seasonal_changes: "summer_oily"|"winter_dry"|"same_year_round"|null;

  // 3. Медицинский анамнез
  medical_diagnoses: string[];       // акне, розацеа, себорея и т.д.
  pregnancy_status: "pregnant"|"breastfeeding"|"none"|null;
  allergies: string[];               // лекарства, косметика, продукты
  medications: string[];             // контрацептивы, витамины, лекарства

  // 4. Опыт ухода
  retinol_experience: "yes"|"no"|null;
  retinol_reaction: "good"|"irritation"|"dont_know"|null;
  prescription_creams: string[];     // азелаиновая, антибактериальные
  oral_medications: string[];       // изотретиноин, антибиотики, гормоны

  // 5. Текущее состояние кожи (будет заполняться из фото или вопросов)
  current_skin_state?: string;

  // 6. Образ жизни
  makeup_frequency: "daily"|"sometimes"|"rarely"|null;
  spf_use: "daily"|"sometimes"|"never"|null;
  sun_exposure: "0-1h"|"1-3h"|"3h+"|"dont_know"|null;
  lifestyle_habits: string[];       // курение, алкоголь, недосып, стресс

  // 7. Предпочтения в уходе
  care_type: "standard"|"natural"|"medical"|"dont_know"|null;
  avoid_ingredients: string[];      // парабены, отдушки, сульфаты и т.д.
  routine_steps: "minimal"|"medium"|"maximum"|"dont_know"|null;
  budget: "light"|"affordable"|"high_end"|"elite"|null;

  // Фото (опционально)
  photo_data_url: string|null;       // data: URL для предпросмотра
  photo_analysis: string|null;       // краткий результат распознавания
  photo_metrics: SkinMetrics|null;   // детальные метрики кожи
  photo_zones: SkinZone[]|null;      // зоны анализа
  photo_scans: { ts:number; preview:string; analysis:string; metrics?:SkinMetrics; zones?:SkinZone[] }[]; // архив

  // Совместимость со старой системой (временно)
  goals: string[];
  skin_type: "dry"|"normal"|"combo"|"oily"|null;
  sensitivity: boolean|null;
  cleansing_pref: "gel"|"milk"|"oil"|null;
  pregnancy: boolean|null;
  actives_ok: string[];
  actives_no: string[];
};

const DEFAULT_ANS: Answers = {
  // 1. Общая информация
  age: null,
  gender: null,

  // 2. Особенности кожи
  skin_concerns: [],
  after_cleansing: null,
  daily_behavior: null,
  sensitivity_level: null,
  seasonal_changes: null,

  // 3. Медицинский анамнез
  medical_diagnoses: [],
  pregnancy_status: null,
  allergies: [],
  medications: [],

  // 4. Опыт ухода
  retinol_experience: null,
  retinol_reaction: null,
  prescription_creams: [],
  oral_medications: [],

  // 6. Образ жизни
  makeup_frequency: null,
  spf_use: null,
  sun_exposure: null,
  lifestyle_habits: [],

  // 7. Предпочтения в уходе
  care_type: null,
  avoid_ingredients: [],
  routine_steps: null,
  budget: null,

  // Фото
  photo_data_url: null,
  photo_analysis: null,
  photo_metrics: null,
  photo_zones: null,
  photo_scans: [],

  // Совместимость со старой системой
  goals: [],
  skin_type: null,
  sensitivity: null,
  cleansing_pref: null,
  pregnancy: null,
  actives_ok: [],
  actives_no: [],
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
      setError("Файл слишком большой. Максимум 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      set({ photo_data_url: dataUrl, photo_analysis: null, photo_metrics: null, photo_zones: null });
    };
    reader.readAsDataURL(file);
  };

  const onAnalysisComplete = (metrics: SkinMetrics, zones: SkinZone[], analysis: string) => {
    set({ 
      photo_analysis: analysis,
      photo_metrics: metrics,
      photo_zones: zones
    });
    
    // Пишем в архив с полными данными
    const entry = { 
      ts: Date.now(), 
      preview: a.photo_data_url!, 
      analysis,
      metrics,
      zones
    };
    set({ photo_scans: [...(a.photo_scans||[]), entry] });
  };

  const clearPhoto = () => {
    set({
      photo_data_url: null, 
      photo_analysis: null,
      photo_metrics: null,
      photo_zones: null
    });
  };

  return (
    <Block title="AI-анализ кожи (опционально)">
      <p className="text-sm text-zinc-600 mb-3">
        Загрузите фото без макияжа при хорошем освещении. 
        Наш ИИ проанализирует состояние кожи и выделит проблемные зоны.
      </p>
      
      {!a.photo_data_url && (
        <label className="inline-flex items-center px-4 py-2 rounded-full border bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer transition">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e)=>{
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          📷 Загрузить фото для анализа
        </label>
      )}
      
      {error && (
        <div role="alert" className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
          {error}
        </div>
      )}

      {a.photo_data_url && (
        <div className="mt-4">
          <SkinAnalysis 
            imageUrl={a.photo_data_url}
            onAnalysisComplete={onAnalysisComplete}
          />
          
          {a.photo_analysis && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl">
              <h4 className="font-bold text-blue-900 mb-2">🔍 Результат AI-анализа:</h4>
              <p className="text-sm text-blue-800">{a.photo_analysis}</p>
            </div>
          )}
          
          <div className="mt-4 flex gap-3">
            <button 
              className="text-sm text-zinc-600 underline hover:text-zinc-800 transition" 
              onClick={clearPhoto}
            >
              🗑️ Очистить фото
            </button>
            <button 
              className="text-sm text-indigo-600 underline hover:text-indigo-800 transition"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/jpeg,image/png,image/webp';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) onFile(file);
                };
                input.click();
              }}
            >
              📸 Загрузить другое фото
            </button>
          </div>
        </div>
      )}

      {a.photo_scans.length>0 && (
        <div className="mt-6">
          <div className="font-semibold mb-3">📊 История анализов</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {a.photo_scans.slice().reverse().map((scan, idx)=> (
              <div key={idx} className="p-3 rounded-xl border bg-white/60 hover:bg-white/80 transition">
                <img src={scan.preview} alt="Анализ" className="w-full h-32 object-cover rounded-lg mb-2" />
                <div className="text-xs text-zinc-600 mb-2">
                  📅 {new Date(scan.ts).toLocaleDateString()} в {new Date(scan.ts).toLocaleTimeString()}
                </div>
                {scan.metrics && (
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Акне:</span>
                      <span className={`font-medium ${scan.metrics.acne > 50 ? 'text-red-600' : 'text-green-600'}`}>
                        {scan.metrics.acne}/100
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Жирность:</span>
                      <span className={`font-medium ${scan.metrics.oiliness > 60 ? 'text-red-600' : 'text-green-600'}`}>
                        {scan.metrics.oiliness}/100
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Увлажненность:</span>
                      <span className={`font-medium ${scan.metrics.hydration < 40 ? 'text-red-600' : 'text-green-600'}`}>
                        {scan.metrics.hydration}/100
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
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
  // 1. Общая информация
  { type:"q", id:"age", render:(a,set)=>(
    <Single label="Возраст"
      options={[
        {key:"under18",label:"До 18 лет"},
        {key:"18-24",label:"18–24"},
        {key:"25-34",label:"25–34"},
        {key:"35-44",label:"35–44"},
        {key:"45+",label:"45+"}
      ]}
      value={a.age} onChange={(v)=>set({age:v})}/>
  )},
  { type:"q", id:"gender", render:(a,set)=>(
    <Single label="Пол"
      options={[
        {key:"female",label:"Женский"},
        {key:"male",label:"Мужской"}
      ]}
      value={a.gender} onChange={(v)=>set({gender:v})}/>
  )},

  // 2. Узнайте особенности вашей кожи
  { type:"q", id:"skin_concerns", render:(a,set)=>(
    <Multi label="Что вас больше всего беспокоит в коже сейчас? (можно выбрать несколько)"
      options={[
        {key:"acne",label:"Акне / высыпания"},
        {key:"oily_shine",label:"Жирность и блеск кожи"},
        {key:"dryness",label:"Сухость и стянутость"},
        {key:"uneven_tone",label:"Неровный тон / пигментация"},
        {key:"wrinkles",label:"Морщины, возрастные изменения"},
        {key:"redness",label:"Краснота, раздражение, чувствительность"},
        {key:"pores",label:"Расширенные поры"},
        {key:"under_eyes",label:"Проблемы в зоне под глазами (отёки, круги, морщины)"},
        {key:"satisfied",label:"В целом всё устраивает, хочу поддерживающий уход"}
      ]}
      value={a.skin_concerns} onChange={(v)=>set({skin_concerns:v})}/>
  )},
  { type:"q", id:"after_cleansing", render:(a,set)=>(
    <Single label="Какие ощущения у вас после умывания?"
      options={[
        {key:"comfortable",label:"Комфортные"},
        {key:"tight",label:"Стянутость и сухость"}
      ]}
      value={a.after_cleansing} onChange={(v)=>set({after_cleansing:v})}/>
  )},
  { type:"q", id:"daily_behavior", render:(a,set)=>(
    <Single label="Как ведёт себя кожа в течение дня?"
      options={[
        {key:"oily_2-3h",label:"Жирный блеск через 2–3 часа после умывания"},
        {key:"oily_evening",label:"Жирный блеск к вечеру"},
        {key:"stays_matte",label:"Кожа остаётся матовой"}
      ]}
      value={a.daily_behavior} onChange={(v)=>set({daily_behavior:v})}/>
  )},
  { type:"q", id:"sensitivity_level", render:(a,set)=>(
    <Single label="Насколько чувствительна кожа?"
      options={[
        {key:"high",label:"Высокая"},
        {key:"medium",label:"Средняя"},
        {key:"low",label:"Низкая"}
      ]}
      value={a.sensitivity_level} onChange={(v)=>set({sensitivity_level:v})}/>
  )},
  { type:"q", id:"seasonal_changes", render:(a,set)=>(
    <Single label="Меняется ли состояние кожи в зависимости от сезона?"
      options={[
        {key:"summer_oily",label:"Летом становится жирнее"},
        {key:"winter_dry",label:"Зимой суше"},
        {key:"same_year_round",label:"Круглый год одинаково"}
      ]}
      value={a.seasonal_changes} onChange={(v)=>set({seasonal_changes:v})}/>
  )},

  // 3. Медицинский анамнез
  { type:"q", id:"medical_diagnoses", render:(a,set)=>(
    <Multi label="Есть ли у вас диагнозы, поставленные врачом?"
      options={[
        {key:"acne",label:"Акне"},
        {key:"rosacea",label:"Розацеа"},
        {key:"seborrheic_dermatitis",label:"Себорейный дерматит"},
        {key:"atopic_dermatitis",label:"Атопический дерматит / сухая кожа"},
        {key:"pigmentation",label:"Пигментация (мелазма)"},
        {key:"none",label:"Нет"}
      ]}
      value={a.medical_diagnoses} onChange={(v)=>set({medical_diagnoses:v})}/>
  )},
  { type:"q", id:"pregnancy_status", render:(a,set)=>(
    <Single label="Вы беременны/ находитесь на грудном вскармливании?"
      options={[
        {key:"pregnant",label:"Да, беременность"},
        {key:"breastfeeding",label:"Да, грудное вскармливание"},
        {key:"none",label:"Нет"}
      ]}
      value={a.pregnancy_status} onChange={(v)=>set({pregnancy_status:v})}/>
  )},
  { type:"q", id:"allergies", render:(a,set)=>(
    <Multi label="Есть ли у вас аллергии?"
      options={[
        {key:"medications",label:"Да, на лекарства"},
        {key:"cosmetics",label:"Да, на косметику"},
        {key:"food",label:"Да, на некоторые продукты"},
        {key:"none",label:"Нет"}
      ]}
      value={a.allergies} onChange={(v)=>set({allergies:v})}/>
  )},
  { type:"q", id:"medications", render:(a,set)=>(
    <Multi label="Принимаете ли вы лекарства или добавки?"
      options={[
        {key:"contraceptives",label:"Контрацептивы"},
        {key:"vitamins",label:"Витамины и БАДы"},
        {key:"chronic_meds",label:"Лекарства по хроническим заболеваниям"},
        {key:"none",label:"Нет"}
      ]}
      value={a.medications} onChange={(v)=>set({medications:v})}/>
  )},

  // 4. Опыт ухода и реакция кожи
  { type:"q", id:"retinol_experience", render:(a,set)=>(
    <Single label="Использовали ли вы ретинол или ретиноиды (третиноин, адапален и др.)?"
      options={[
        {key:"yes",label:"Да"},
        {key:"no",label:"Нет"}
      ]}
      value={a.retinol_experience} onChange={(v)=>set({retinol_experience:v})}/>
  )},
  {type:"q", id:"retinol_reaction", render:(a,set)=>(
    a.retinol_experience === "yes" ? (
      <Single label="Если да, как кожа реагировала?"
        options={[
          {key:"good",label:"Хорошо переносила"},
          {key:"irritation",label:"Появлялось раздражение / сухость"},
          {key:"dont_know",label:"Не знаю"}
        ]}
        value={a.retinol_reaction} onChange={(v)=>set({retinol_reaction:v})}/>
    ) : null
  )},
  { type:"q", id:"prescription_creams", render:(a,set)=>(
    <Multi label="Использовали ли вы рецептурные кремы/гели для кожи?"
      options={[
        {key:"azelaic_acid",label:"Азелаиновая кислота"},
        {key:"antibacterial",label:"Антибактериальные кремы (клиндамицин, метронидазол)"},
        {key:"other",label:"Другие"},
        {key:"none",label:"Нет"}
      ]}
      value={a.prescription_creams} onChange={(v)=>set({prescription_creams:v})}/>
  )},
  { type:"q", id:"oral_medications", render:(a,set)=>(
    <Multi label="Принимали ли вы внутрь препараты для лечения кожи?"
      options={[
        {key:"isotretinoin",label:"Изотретиноин (Аккутан)"},
        {key:"antibiotics",label:"Антибиотики (доксициклин, миноциклин)"},
        {key:"hormones",label:"Гормональные препараты (спиронолактон, контрацептивы)"},
        {key:"none",label:"Нет"}
      ]}
      value={a.oral_medications} onChange={(v)=>set({oral_medications:v})}/>
  )},

  // Инсайт после медицинской части
  { type:"insight", id:"medical_insight", render:(a)=>(
    <Block title="Медицинская оценка">
      <ul className="list-disc pl-5 text-zinc-700 space-y-1">
        {a.medical_diagnoses.includes("acne") && <li>Диагноз акне — учтём специфические потребности кожи.</li>}
        {a.medical_diagnoses.includes("rosacea") && <li>Розацеа требует особо деликатного ухода — исключим агрессивные активы.</li>}
        {a.pregnancy_status !== "none" && <li>Беременность/ГВ — исключим ретиноиды и некоторые кислоты.</li>}
        {a.oral_medications.includes("isotretinoin") && <li>Изотретиноин — минимум активов, максимум увлажнения и защиты.</li>}
        {a.retinol_experience === "yes" && a.retinol_reaction === "good" && <li>Хорошая переносимость ретиноидов — можем включить в план.</li>}
        {a.sensitivity_level === "high" && <li>Высокая чувствительность — начнём с мягких формул и низких концентраций.</li>}
      </ul>
    </Block>
  )},

  // 6. Образ жизни и привычки
  { type:"q", id:"makeup_frequency", render:(a,set)=>(
    <Single label="Как часто вы используете декоративную косметику?"
      options={[
        {key:"daily",label:"Ежедневно"},
        {key:"sometimes",label:"Иногда"},
        {key:"rarely",label:"Почти никогда"}
      ]}
      value={a.makeup_frequency} onChange={(v)=>set({makeup_frequency:v})}/>
  )},
  { type:"q", id:"spf_use", render:(a,set)=>(
    <Single label="Как часто используете солнцезащитный крем?"
      options={[
        {key:"daily",label:"Каждый день"},
        {key:"sometimes",label:"Иногда"},
        {key:"never",label:"Никогда"}
      ]}
      value={a.spf_use} onChange={(v)=>set({spf_use:v})}/>
  )},
  { type:"q", id:"sun_exposure", render:(a,set)=>(
    <Single label="Сколько времени вы проводите на солнце?"
      options={[
        {key:"0-1h",label:"0–1 час в день"},
        {key:"1-3h",label:"1–3 часа в день"},
        {key:"3h+",label:"Более 3 часов в день"},
        {key:"dont_know",label:"Не знаю"}
      ]}
      value={a.sun_exposure} onChange={(v)=>set({sun_exposure:v})}/>
  )},
  { type:"q", id:"lifestyle_habits", render:(a,set)=>(
    <Multi label="Ваши привычки (можно выбрать несколько):"
      options={[
        {key:"smoking",label:"Курю"},
        {key:"alcohol",label:"Употребляю алкоголь"},
        {key:"lack_sleep",label:"Часто не высыпаюсь"},
        {key:"stress",label:"Испытываю стресс"},
        {key:"all_good",label:"Всё в норме"}
      ]}
      value={a.lifestyle_habits} onChange={(v)=>set({lifestyle_habits:v})}/>
  )},

  // 7. Предпочтения в уходе
  { type:"q", id:"care_type", render:(a,set)=>(
    <Single label="Какой тип ухода вам ближе?"
      options={[
        {key:"standard",label:"Стандартные продукты популярных брендов"},
        {key:"natural",label:"Только натуральное / органическое"},
        {key:"medical",label:"Медицинские и аптечные средства"},
        {key:"dont_know",label:"Не знаю, хочу, чтобы подобрали"}
      ]}
      value={a.care_type} onChange={(v)=>set({care_type:v})}/>
  )},
  { type:"q", id:"avoid_ingredients", render:(a,set)=>(
    <Multi label="Какие ингредиенты хотите избегать?"
      options={[
        {key:"parabens",label:"Парабены"},
        {key:"fragrances",label:"Отдушки"},
        {key:"sulfates",label:"Сульфаты (SLS/SLES)"},
        {key:"phthalates",label:"Фталаты"},
        {key:"formaldehyde",label:"Формальдегид"},
        {key:"retinol_pregnancy",label:"Ретинол (во время беременности)"},
        {key:"dont_know",label:"Не знаю"}
      ]}
      value={a.avoid_ingredients} onChange={(v)=>set({avoid_ingredients:v})}/>
  )},
  { type:"q", id:"routine_steps", render:(a,set)=>(
    <Single label="Сколько шагов в уходе для вас комфортно?"
      options={[
        {key:"minimal",label:"Минимум (1–3 шага)"},
        {key:"medium",label:"Средний (3–5 шагов)"},
        {key:"maximum",label:"Максимум (5+ шагов)"},
        {key:"dont_know",label:"Не знаю"}
      ]}
      value={a.routine_steps} onChange={(v)=>set({routine_steps:v})}/>
  )},
  { type:"q", id:"budget", render:(a,set)=>(
    <Single label="Какой бюджет для ухода комфортен?"
      options={[
        {key:"light",label:"Light (базовый)"},
        {key:"affordable",label:"Affordable (средний)"},
        {key:"high_end",label:"High End (премиум)"},
        {key:"elite",label:"Elite (люкс, без ограничений)"}
      ]}
      value={a.budget} onChange={(v)=>set({budget:v})}/>
  )},

  // Финальный инсайт
  { type:"insight", id:"final_insight", render:(a)=>(
    <Block title="Ваш профиль готов!">
      <div className="text-zinc-700 space-y-2">
        <p><strong>Основные проблемы:</strong> {a.skin_concerns.length > 0 ? a.skin_concerns.join(", ") : "не указаны"}</p>
        <p><strong>Чувствительность:</strong> {a.sensitivity_level || "не указана"}</p>
        <p><strong>Бюджет:</strong> {a.budget || "не указан"}</p>
        <p><strong>Предпочтения:</strong> {a.routine_steps || "не указаны"} шагов в уходе</p>
        {a.pregnancy_status !== "none" && <p className="text-amber-600"><strong>Особые условия:</strong> {a.pregnancy_status}</p>}
      </div>
      <div className="mt-4 text-sm text-zinc-500">Теперь можете сделать фото кожи для более точного анализа или сразу перейти к плану ухода.</div>
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
  const navigate = useNavigate();
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
          <button onClick={() => navigate("/plan")} className="px-5 py-3 rounded-full text-white bg-black hover:bg-stone-800 transition">Сформировать план</button>
        )}
      </div>
    </div>
  );
}
