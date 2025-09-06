// src/ui/Card.tsx
import React from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
};

const Card: React.FC<Props> = ({ children, className = "" }) => {
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
};

export default Card;
