import type { ButtonHTMLAttributes, ReactNode } from "react";

export type TagProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children: ReactNode;
};

export default function Tag({ active = false, children, className = "", ...rest }: TagProps) {
  const baseClasses = "px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2";
  const inactive = "bg-pink-50/60 text-pink-800 border-pink-200/60 hover:bg-pink-50 hover:shadow-sm";
  const activeCls = "bg-pink-500 text-white border-pink-500 shadow-[0_8px_24px_rgba(233,30,99,0.25)]";

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
