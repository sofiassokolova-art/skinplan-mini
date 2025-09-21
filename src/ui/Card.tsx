
type CardProps = {
  title?: string;
  subtitle?: string;
  help?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  clickable?: boolean;
  active?: boolean;
  onClick?: () => void;
};

export default function Card({ 
  title, 
  subtitle, 
  help, 
  children, 
  className = "",
  clickable = false,
  active = false,
  onClick
}: CardProps) {
  const cardClasses = `
    card p-6
    ${active ? 'card-active' : ''}
    ${clickable ? 'cursor-pointer hover:shadow-glow' : ''}
    ${className}
  `.trim();

  return (
    <div className={cardClasses} onClick={clickable ? onClick : undefined}>
      {(title || subtitle || help) && (
        <div className="flex items-start justify-between gap-3 mb-text">
          <div>
            {title && (
              <h3 className="font-serif text-text-primary font-medium">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-text-secondary mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {help && (
            <div className="text-sm text-text-secondary">
              {help}
            </div>
          )}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

