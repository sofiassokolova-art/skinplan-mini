import Tag from "./Tag";

type Option = { key: string; label: string };

export default function PillGrid(
  { options, value = [], onChange, limit }: 
  { options: Option[]; value?: string[]; onChange: (arr: string[]) => void; limit?: number }
) {
  const toggle = (k: string) => {
    const next = value.includes(k) ? value.filter(x => x !== k) : [...value, k];
    if (limit && next.length > limit) return;
    onChange(next);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <Tag 
          key={o.key} 
          active={value.includes(o.key)} 
          onClick={() => toggle(o.key)}
        >
          {o.label}
        </Tag>
      ))}
    </div>
  );
}


