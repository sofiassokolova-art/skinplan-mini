interface TaskIconProps {
  type: 'cleanser' | 'serum' | 'cream' | 'spf';
  className?: string;
}

export default function TaskIcon({ type, className = "" }: TaskIconProps) {
  const iconColors = {
    cleanser: "#9B8AA3", // лилово-серый
    serum: "#A8D8EA",    // светлый голубой
    cream: "#F4D4BA",    // бежево-розовый
    spf: "#F2C94C"       // золотистый
  };

  const color = iconColors[type];

  const icons = {
    cleanser: (
      <svg viewBox="0 0 24 24" fill="none" className={`w-6 h-6 ${className}`}>
        <path
          d="M8 2L8 4M16 2L16 4M7 4H17C18.1046 4 19 4.89543 19 6V20C19 21.1046 18.1046 22 17 22H7C5.89543 22 5 21.1046 5 20V6C5 4.89543 5.89543 4 7 4Z"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={`${color}20`}
        />
        <circle cx="12" cy="13" r="2" fill={color} />
      </svg>
    ),
    serum: (
      <svg viewBox="0 0 24 24" fill="none" className={`w-6 h-6 ${className}`}>
        <path
          d="M12 2L12 8M12 8C10 10 8 12 8 16C8 18.2091 9.79086 20 12 20C14.2091 20 16 18.2091 16 16C16 12 14 10 12 8Z"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={`${color}30`}
        />
        <circle cx="12" cy="16" r="1.5" fill={color} />
      </svg>
    ),
    cream: (
      <svg viewBox="0 0 24 24" fill="none" className={`w-6 h-6 ${className}`}>
        <rect
          x="6"
          y="8"
          width="12"
          height="12"
          rx="2"
          stroke={color}
          strokeWidth="2"
          fill={`${color}20`}
        />
        <rect
          x="8"
          y="4"
          width="8"
          height="4"
          rx="1"
          stroke={color}
          strokeWidth="2"
          fill={`${color}40`}
        />
        <circle cx="12" cy="14" r="2" fill={color} opacity="0.6" />
      </svg>
    ),
    spf: (
      <svg viewBox="0 0 24 24" fill="none" className={`w-6 h-6 ${className}`}>
        <circle
          cx="12"
          cy="12"
          r="4"
          stroke={color}
          strokeWidth="2"
          fill={`${color}30`}
        />
        <path
          d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  };

  return icons[type];
}