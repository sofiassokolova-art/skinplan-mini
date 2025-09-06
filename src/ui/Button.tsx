import React from "react";

type Props = {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  "aria-label"?: string;
};

const Button: React.FC<Props> = ({
  children,
  onClick,
  type = "button",
  disabled,
  className = "",
  variant = "primary",
  size = "md",
  ...rest
}) => {
  const base = "inline-flex items-center justify-center rounded-xl transition focus:outline-none disabled:opacity-50 disabled:pointer-events-none";
  const sizeCls =
    size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2";
  const variantCls =
    variant === "primary"
      ? "border border-black hover:bg-black hover:text-white"
      : variant === "secondary"
      ? "border border-neutral-300 hover:border-black"
      : "border border-transparent hover:bg-neutral-100"; // ghost

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${sizeCls} ${variantCls} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;

