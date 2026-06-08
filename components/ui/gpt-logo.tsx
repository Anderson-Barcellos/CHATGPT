interface GPTLogoProps {
  size?: number;
  className?: string;
}

export function GPTLogo({ size = 36, className }: GPTLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gpt-mark-shell" x1="10" y1="8" x2="54" y2="56">
          <stop offset="0" stopColor="#e8fbf8" />
          <stop offset="0.55" stopColor="#9edbd5" />
          <stop offset="1" stopColor="#2c8b91" />
        </linearGradient>
        <linearGradient id="gpt-mark-cuia" x1="23" y1="25" x2="42" y2="48">
          <stop offset="0" stopColor="#1b6f7b" />
          <stop offset="1" stopColor="#0b3a4d" />
        </linearGradient>
        <linearGradient id="gpt-mark-erva" x1="22" y1="25" x2="41" y2="30">
          <stop offset="0" stopColor="#8edac9" />
          <stop offset="1" stopColor="#2f8a62" />
        </linearGradient>
        <filter id="gpt-mark-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle
        className="gpt-organic"
        cx="32"
        cy="32"
        r="24"
        fill="url(#gpt-mark-shell)"
        opacity="0.22"
      />
      <path
        className="gpt-ring-slow"
        d="M14 31.5C14.5 20.5 22.8 12.8 33.7 12.4"
        stroke="#1d6473"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.34"
      />
      <path
        className="gpt-ring-med"
        d="M50 32.5C49.4 43.5 41.2 51.2 30.3 51.6"
        stroke="#78cfd0"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.52"
      />
      <ellipse
        className="gpt-ring-fast"
        cx="32"
        cy="32"
        rx="20"
        ry="7.8"
        stroke="#9de5df"
        strokeWidth="1"
        opacity="0.38"
        transform="rotate(-25 32 32)"
      />
      <circle
        className="gpt-core"
        cx="32"
        cy="31"
        r="13.5"
        fill="#e9fbf8"
        opacity="0.72"
        filter="url(#gpt-mark-glow)"
      />
      <path
        d="M20.5 29.6C21.4 41.5 25.8 48.5 32 48.5C38.2 48.5 42.6 41.5 43.5 29.6H20.5Z"
        fill="url(#gpt-mark-cuia)"
      />
      <ellipse cx="32" cy="29.4" rx="12" ry="4.2" fill="#154f5f" />
      <ellipse cx="32" cy="28.9" rx="9.6" ry="2.7" fill="url(#gpt-mark-erva)" />
      <path
        d="M35.6 27.6L45.4 16.9"
        stroke="#d5eef0"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M44.4 17.8L48.3 14.2"
        stroke="#6faeb7"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M25.6 35.5C27.4 40.8 29.7 43.2 32 43.2"
        stroke="#bfe8e4"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.72"
      />
      <circle cx="28" cy="27.8" r="1.2" fill="#f7fffd" opacity="0.74" />
    </svg>
  );
}
