import { useOnboarding } from './Onboarding';

interface OnboardingTriggerProps {
  className?: string;
  children?: React.ReactNode;
  variant?: 'button' | 'link' | 'icon';
}

export default function OnboardingTrigger({ 
  className = '', 
  children = 'Показать инструкцию',
  variant = 'button'
}: OnboardingTriggerProps) {
  const { resetOnboarding } = useOnboarding();

  const baseClasses = 'transition cursor-pointer';
  
  const variantClasses = {
    button: 'px-3 py-1.5 rounded-full border text-sm hover:bg-white/70',
    link: 'text-indigo-600 hover:text-indigo-800 underline text-sm',
    icon: 'text-gray-500 hover:text-gray-700 p-1 rounded'
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`;

  return (
    <button 
      onClick={resetOnboarding}
      className={classes}
      title="Показать инструкцию по использованию"
    >
      {children}
    </button>
  );
}