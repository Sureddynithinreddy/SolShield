import { verdictFromScore, verdictMeta } from "@/lib/theme";

/**
 * Semicircular risk gauge, 0 (safe) to 100 (malicious),
 * echoing the integrity gauge in the reference design.
 */
export function RiskGauge({ score, size = 220 }: { score: number; size?: number }) {
  const verdict = verdictFromScore(score);
  const color = verdictMeta[verdict].color;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // semicircle from 180deg -> 360deg
  const circumference = Math.PI * r;
  const dash = (score / 100) * circumference;

  const arc = (fromDeg: number, toDeg: number) => {
    const p = (deg: number) => {
      const rad = (deg * Math.PI) / 180;
      return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
    };
    const [x1, y1] = p(fromDeg);
    const [x2, y2] = p(toDeg);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };

  return (
    <div className="relative" style={{ width: size, height: size / 2 + 24 }}>
      <svg width={size} height={size / 2 + 24} viewBox={`0 0 ${size} ${size / 2 + 24}`}>
        <defs>
          <linearGradient id="gaugeTrack" x1="0" y1="0" x2={size} y2="0">
            <stop stopColor="#34d399" />
            <stop offset="0.5" stopColor="#fbbf24" />
            <stop offset="1" stopColor="#f43f5e" />
          </linearGradient>
        </defs>
        {/* faint full track */}
        <path d={arc(180, 360)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} strokeLinecap="round" />
        {/* gradient reference track (dim) */}
        <path d={arc(180, 360)} fill="none" stroke="url(#gaugeTrack)" strokeWidth={2} strokeLinecap="round" opacity={0.5} />
        {/* progress */}
        <path
          d={arc(180, 360)}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.2,0.8,0.2,1), stroke 0.4s", filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="text-5xl font-extrabold tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="label-cap -mt-1">Risk Score</span>
      </div>
    </div>
  );
}
