
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

export default function Button({ children, className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={
        "px-4 py-2 rounded-full bg-black text-white hover:bg-stone-800 transition " +
        className
      }
    >
      {children}
    </button>
  );
}

