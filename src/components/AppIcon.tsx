interface Props {
  size?: number;
  className?: string;
}

export default function AppIcon({ size = 40, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="nasaq-icon-gradient" x1="32" y1="4" x2="32" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#nasaq-icon-gradient)" />
      <path
        d="M20 44V20h6.5l9.5 15.5V20H42v24h-6.5L26 28.5V44H20z"
        fill="#ffffff"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
