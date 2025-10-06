import React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  fullWidth?: boolean;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", fullWidth = false, ...props }, ref) => {
    const baseClasses = "px-4 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
    const widthClass = fullWidth ? "w-full" : "";
    
    return (
      <input
        ref={ref}
        className={`${baseClasses} ${widthClass} ${className}`.trim()}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };