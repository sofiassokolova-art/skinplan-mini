import type { ButtonHTMLAttributes, ReactNode } from "react";

export type TagProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children: ReactNode;
};

export default function Tag({ active = false, children, className = "", ...rest }: TagProps) {
  const baseClasses = "px-3.5 py-1.5 rounded-full border text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8c7ff] focus-visible:ring-offset-0";
  const inactive = "bg-white/25 text-gray-700 border-white/50 shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:bg-white/35 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]";
  const activeCls = "bg-gradient-to-r from-gray-600 to-gray-700 text-white border-transparent shadow-[0_10px_28px_rgba(0,0,0,0.18)]";

  return (
    <button
      type="button"
      className={[baseClasses, active ? activeCls : inactive, className].join(" ").trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
