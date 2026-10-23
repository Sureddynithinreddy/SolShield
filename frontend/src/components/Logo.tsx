import { Link } from "react-router-dom";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path
        d="M16 2 5 6v8c0 7 4.6 12.3 11 16 6.4-3.7 11-9 11-16V6L16 2Z"
        fill="url(#lg)"
      />
      <path
        d="M11 16.5 14.5 20 21 12.5"
        stroke="#070b16"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ to = "/", compact = false }: { to?: string; compact?: boolean }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5 focus-ring rounded-lg">
      <span className="drop-shadow-[0_0_12px_rgba(34,211,238,0.4)]">
        <LogoMark size={28} />
      </span>
      {!compact && (
        <span className="text-[1.05rem] font-extrabold tracking-tight text-white">
          Sol<span className="text-gradient">Shield</span>
        </span>
      )}
    </Link>
  );
}
