interface GPTLogoProps {
  size?: number;
  className?: string;
}

export function GPTLogo({ size = 36, className }: GPTLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 650 650"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="gpt-deep-sea" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f6f86" />
          <stop offset="100%" stopColor="#13293d" />
        </linearGradient>
        <linearGradient id="gpt-indigo" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#83d3dd" />
          <stop offset="100%" stopColor="#1a3b52" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id="gpt-core-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#83d3dd" />
          <stop offset="100%" stopColor="#0f6f86" stopOpacity="0" />
        </radialGradient>
        <filter id="gpt-deep-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

      </defs>

      <g transform="translate(75, 75)">
        <circle cx="250" cy="250" r="180" fill="url(#gpt-deep-sea)" style={{ filter: "blur(60px)" }} opacity="0.25" className="gpt-organic" />

        <path d="M250,50 A200,200 0 0,1 450,250" stroke="#24435e" strokeWidth="2" strokeLinecap="round" className="gpt-ring-slow" opacity="0.7" />
        <path d="M250,450 A200,200 0 0,1 50,250" stroke="#24435e" strokeWidth="2" strokeLinecap="round" className="gpt-ring-slow" opacity="0.7" />

        <g className="gpt-ring-med">
          <path d="M250,80 C360,80 420,170 420,250" stroke="url(#gpt-deep-sea)" strokeWidth="5" fill="none" opacity="0.9" filter="url(#gpt-deep-glow)" />
          <path d="M250,420 C140,420 80,330 80,250" stroke="url(#gpt-deep-sea)" strokeWidth="5" fill="none" opacity="0.9" filter="url(#gpt-deep-glow)" />
        </g>

        <g className="gpt-ring-fast">
          <circle cx="250" cy="250" r="110" stroke="#83d3dd" strokeWidth="1.5" strokeDasharray="8 20" opacity="0.5" />
          <path d="M170,170 L330,330" stroke="url(#gpt-indigo)" strokeWidth="1.5" opacity="0.3" />
          <path d="M330,170 L170,330" stroke="url(#gpt-indigo)" strokeWidth="1.5" opacity="0.3" />
        </g>

        <ellipse cx="250" cy="250" rx="140" ry="40" stroke="#0f6f86" strokeWidth="1" opacity="0.5" transform="rotate(45 250 250)">
          <animateTransform attributeName="transform" type="rotate" from="0 250 250" to="360 250 250" dur="8s" repeatCount="indefinite" />
        </ellipse>

        <circle cx="250" cy="250" r="22" fill="url(#gpt-core-glow)" className="gpt-core" />
        {/* corpo da cuia */}
        <path d="M236,246 Q234,266 250,268 Q266,266 264,246 Z" fill="#4a2c0a" />
        {/* borda da cuia */}
        <ellipse cx="250" cy="246" rx="14" ry="3.5" fill="#6d4c1f" />
        {/* chimarrão (verde) */}
        <ellipse cx="250" cy="245" rx="11" ry="2.5" fill="#2e7d32" />
        {/* brilhinho da erva */}
        <ellipse cx="247" cy="244" rx="4" ry="1" fill="#ffffff" opacity="0.3" />
        {/* bombilla */}
        <line x1="254" y1="243" x2="265" y2="222" stroke="#b0bec5" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="265" cy="222" r="2.5" fill="#90a4ae" />
      </g>
    </svg>
  );
}
