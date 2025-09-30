import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { Input } from "../ui/Input";
import { Users, Share2, Wallet, ChevronLeft, ChevronRight } from "lucide-react";

// ——— Utils ———
function hashToInt(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = (h ^ str.charCodeAt(i)) * 16777619;
  return Math.abs(h >>> 0);
}

function initials(name: string) {
  return name.split(/\s+/).slice(0,2).map(s => s.charAt(0)).join('').toUpperCase() || 'U';
}

// ——— SVG subcomponents ———
function AvatarHead({ size = 12, name, src }: { size?: number; name: string; src?: string }) {
  const id = React.useId();
  const r = size / 2;
  const gradId = `g-${id}`;
  const clipId = `c-${id}`;
  return (
    <g>
      <defs>
        <radialGradient id={gradId} cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#dbeafe"/>
          <stop offset="100%" stopColor="#93c5fd"/>
        </radialGradient>
        <clipPath id={clipId}>
          <circle cx={0} cy={-14} r={r} />
        </clipPath>
      </defs>
      {src ? (
        <image href={src} x={-r} y={-14 - r} width={size} height={size} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
      ) : (
        <>
          <circle cx={0} cy={-14} r={r} fill={`url(#${gradId})`} />
          <text x={0} y={-14 + 3} textAnchor="middle" fontSize={r} fill="#0b1020" style={{ fontWeight: 700 }}>{initials(name)}</text>
        </>
      )}
    </g>
  );
}

function RunnerBody() {
  return (
    <g>
      <rect x={-3} y={-9} width={6} height={12} rx={3} fill="#2563eb" opacity={0.95} />
      {/* лёгкая «idle»-анимация конечностей */}
      <motion.g style={{ transformOrigin: '0px -6px' }} animate={{ rotate: [10, -10, 10] }} transition={{ repeat: Infinity, duration: 1 }}>
        <line x1={0} y1={-6} x2={-8} y2={0} stroke="currentColor" strokeWidth={2} />
      </motion.g>
      <motion.g style={{ transformOrigin: '0px -6px' }} animate={{ rotate: [-10, 10, -10] }} transition={{ repeat: Infinity, duration: 1 }}>
        <line x1={0} y1={-6} x2={8} y2={0} stroke="currentColor" strokeWidth={2} />
      </motion.g>
      <motion.g style={{ transformOrigin: '0px 3px' }} animate={{ rotate: [18, -18, 18] }} transition={{ repeat: Infinity, duration: 0.6 }}>
        <line x1={0} y1={3} x2={-7} y2={12} stroke="currentColor" strokeWidth={2} />
      </motion.g>
      <motion.g style={{ transformOrigin: '0px 3px' }} animate={{ rotate: [-18, 18, -18] }} transition={{ repeat: Infinity, duration: 0.6 }}>
        <line x1={0} y1={3} x2={7} y2={12} stroke="currentColor" strokeWidth={2} />
      </motion.g>
    </g>
  );
}

// ——— Main ———
export default function RubleClubV2() {
  type Contributor = { id: number; name: string; amount: number; avatar?: string };

  const [contributors, setContributors] = useState<Contributor[]>([
    { id: 1, name: "Sofia", amount: 150, avatar: "https://i.pravatar.cc/64?img=47" },
    { id: 2, name: "Alex", amount: 75, avatar: "https://i.pravatar.cc/64?img=12" },
    { id: 3, name: "Nika", amount: 40 },
    { id: 4, name: "Max", amount: 25, avatar: "https://i.pravatar.cc/64?img=31" },
    { id: 5, name: "Luna", amount: 10 },
    { id: 6, name: "Ivan", amount: 5 },
    { id: 7, name: "Mia", amount: 3 },
    { id: 8, name: "Artem", amount: 2 },
    { id: 9, name: "Dina", amount: 1 },
    { id: 10, name: "Oleg", amount: 1 },
  ]);

  // бег только в момент доната
  const [running, setRunning] = useState<Record<number, number>>({}); // id -> timestamp

  const [page, setPage] = useState(0);
  const perPage = 12;

  const total = contributors.reduce((s, c) => s + c.amount, 0);

  const lanes = 3;
  const laneYs = [210, 170, 130];

  const sorted = useMemo(() => [...contributors].sort((a,b)=> b.amount - a.amount), [contributors]);
  const start = page * perPage;
  const current = sorted.slice(start, start + perPage);
  const topOnPage = Math.max(1, ...current.map(c => c.amount));
  const maxPages = Math.max(0, Math.ceil(sorted.length / perPage) - 1);

  function donate(name: string, amount: number) {
    if (!name || amount <= 0) return;
    setContributors(prev => {
      const idx = prev.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], amount: copy[idx].amount + amount };
        return copy;
      }
      const maxId = prev.reduce((m, p) => Math.max(m, p.id), 0);
      return [...prev, { id: maxId + 1, name, amount }];
    });
    const id = contributors.find(p => p.name.toLowerCase() === name.toLowerCase())?.id ?? (contributors.length + 1);
    setRunning(state => ({ ...state, [id]: Date.now() }));
    setTimeout(() => setRunning(state => { const c = { ...state }; delete c[id]; return c; }), 3200);
  }

  const nameRef = useRef<HTMLInputElement>(null);
  const amtRef = useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(96rem_64rem_at_70%_-10%,#f5f7ff_20%,transparent),radial-gradient(72rem_48rem_at_-10%_110%,#eef3ff_25%,transparent)] text-zinc-900 dark:text-zinc-50 flex justify-center">
      <div className="w-full max-w-[420px] px-3 pb-28">
        {/* Top App Bar */}
        <div className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-zinc-900/40 bg-white/90 dark:bg-zinc-900/70 border-b border-zinc-200/60 dark:border-zinc-800/60 rounded-b-2xl">
          <div className="h-14 flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md" />
              <div className="font-semibold tracking-tight">Рубль‑клуб</div>
            </div>
            <Button variant="ghost" size="sm" className="gap-2"><Share2 className="h-4 w-4"/> Поделиться</Button>
          </div>
        </div>

        {/* Summary Card */}
        <div className="mt-4">
          <Card className="border-none shadow-xl rounded-3xl bg-white/80 dark:bg-zinc-900/70 backdrop-blur">
            <div className="pb-2 p-6">
              <div className="text-zinc-500 text-sm">Собрано</div>
              <div className="flex items-end gap-2">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-5xl font-extrabold tracking-tight">
                  {total.toLocaleString("ru-RU")} ₽
                </motion.div>
                <div className="text-sm text-zinc-500">{contributors.length} участника</div>
              </div>
            </div>
            <div className="pt-0 p-6">
              {/* TRACK: 3 lanes, runners with avatars; move only on donate */}
              <div className="relative h-[260px] rounded-2xl bg-gradient-to-b from-white/60 to-white/20 dark:from-zinc-800/40 dark:to-zinc-800/10 overflow-hidden border border-zinc-100/60 dark:border-zinc-800/60">
                <svg viewBox="0 0 360 260" className="absolute inset-0 w-full h-full">
                  <g>
                    {laneYs.map((y, i) => (
                      <g key={`lane-${i}`}>
                        <line x1={10} y1={y} x2={350} y2={y} stroke="currentColor" className="opacity-20" strokeWidth={6} strokeLinecap="round"/>
                        <line x1={10} y1={y-20} x2={350} y2={y-20} stroke="currentColor" className="opacity-10" strokeWidth={1} strokeDasharray="4 6"/>
                      </g>
                    ))}

                    {current.map((c, i) => {
                      const seed = hashToInt(`${c.id}-${c.name}`);
                      const lane = (seed + i * 7) % lanes;
                      const y = laneYs[lane];
                      const idleX = 20 + (seed % 280);
                      const isRunning = running[c.id] != null;
                      const speedK = Math.max(0.7, Math.min(2.6, (c.amount / topOnPage) * 1.6));
                      const duration = 3.0 / speedK;
                      const endX = 360 + (seed % 40);
                      return (
                        <motion.g key={c.id}
                          initial={{ x: idleX }}
                          animate={ isRunning ? { x: endX } : { x: idleX } }
                          transition={ isRunning ? { duration, ease: 'linear' } : { type: 'spring', stiffness: 40, damping: 12 } }
                          transform={`translate(0 ${y})`}
                        >
                          <text x={0} y={-28} textAnchor="middle" fontSize={11} style={{ paintOrder:'stroke', stroke:'#fff', strokeWidth:3 }} fill="#111">{c.name} • {c.amount}₽</text>
                          <AvatarHead name={c.name} size={12} src={c.avatar} />
                          <RunnerBody />
                        </motion.g>
                      );
                    })}
                  </g>
                </svg>

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-zinc-500">
                  <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5"/> 3 дорожки • 1 ₽ = 1 участник</div>
                  <div>На экране {current.length} из {contributors.length}</div>
                </div>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" className="rounded-xl" onClick={()=> setPage(p=> Math.max(0, p-1))}><ChevronLeft className="h-4 w-4"/>Назад</Button>
                <div className="text-xs text-zinc-500">{page+1}/{Math.max(1, Math.ceil(sorted.length/perPage))}</div>
                <Button variant="ghost" size="sm" className="rounded-xl" onClick={()=> setPage(p=> Math.min(maxPages, p+1))}>Вперёд<ChevronRight className="h-4 w-4"/></Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Bottom donate bar */}
        <div className="fixed bottom-0 left-0 right-0 z-30">
          <div className="mx-auto max-w-[420px] px-3 pb-5">
            <div className="rounded-3xl border border-zinc-200/70 dark:border-zinc-800/60 bg-white/90 dark:bg-zinc-900/70 backdrop-blur shadow-2xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4"/>
                <div className="text-sm text-zinc-600 dark:text-zinc-300">Отправьте взнос — бегун стартует</div>
              </div>
              <div className="flex gap-2">
                <Input ref={nameRef} placeholder="Имя или ник" className="rounded-2xl" />
                <Input ref={amtRef} placeholder="Сумма, ₽" className="rounded-2xl w-28" defaultValue="1"/>
                <Button className="rounded-2xl font-semibold px-5" onClick={() => {
                  const name = nameRef.current?.value?.trim() || '';
                  const amount = parseInt(amtRef.current?.value || '1', 10) || 1;
                  donate(name, amount);
                }}>Отправить</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}