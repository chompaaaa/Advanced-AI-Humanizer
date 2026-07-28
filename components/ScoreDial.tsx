import type { PatternReport } from "@/lib/analysis";

const BAND_META: Record<
  PatternReport["band"],
  { label: string; stroke: string; text: string; chip: string }
> = {
  "human-like": {
    label: "Human-like",
    stroke: "var(--color-good)",
    text: "text-good",
    chip: "bg-good-soft text-good",
  },
  mixed: {
    label: "Mixed signals",
    stroke: "var(--color-warn)",
    text: "text-warn",
    chip: "bg-warn-soft text-warn",
  },
  "machine-like": {
    label: "Machine-like",
    stroke: "var(--color-bad)",
    text: "text-bad",
    chip: "bg-bad-soft text-bad",
  },
};

export function bandMeta(band: PatternReport["band"]) {
  return BAND_META[band];
}

interface ScoreDialProps {
  score: number;
  band: PatternReport["band"];
  size?: number;
  label?: string;
}

/**
 * Radial gauge for the composite pattern score. Pure SVG so it renders
 * identically on the server and doesn't pull in a chart library.
 */
export function ScoreDial({ score, band, size = 132, label }: ScoreDialProps) {
  const meta = BAND_META[band];
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Leave a 25% gap at the bottom so the arc reads as a gauge, not a ring.
  const arc = circumference * 0.75;
  const filled = (score / 100) * arc;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-[225deg]"
          role="img"
          aria-label={`Pattern score ${score} out of 100: ${meta.label}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${circumference}`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={meta.stroke}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            style={{ transition: "stroke-dasharray 480ms cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-semibold tabular-nums ${meta.text}`}>
            {Math.round(score)}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-ink-faint">/ 100</span>
        </div>
      </div>
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${meta.chip}`}
      >
        {label ?? meta.label}
      </span>
    </div>
  );
}
