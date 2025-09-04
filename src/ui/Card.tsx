
type CardProps = {
  title: string;
  subtitle?: string;
  help?: React.ReactNode;
  children: React.ReactNode;
};

export default function Card({ title, subtitle, help, children }: CardProps) {
  return (
    <div className="p-5 rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-lg">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {subtitle && <p className="text-sm text-zinc-600">{subtitle}</p>}
        </div>
        {help && <div className="text-sm text-zinc-500">{help}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

