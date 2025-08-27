import type { ReactNode } from "react";

export type TagProps = {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
};

export default function Tag({ active = false, onClick, children }: TagProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full border text-sm transition ${
        active
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-zinc-100 text-zinc-800 border-zinc-200 hover:bg-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}
