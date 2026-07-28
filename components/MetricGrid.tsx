import type { TextAnalysis } from "@/lib/analysis";
import { gradeLabel } from "@/lib/analysis";

interface Metric {
  key: string;
  label: string;
  before: number;
  after: number;
  format: (n: number) => string;
  /** "down" means a lower number is the improvement. */
  better: "down" | "up" | "target" | "hold";
  target?: number;
  /** For "hold" metrics: fractional drift that counts as a problem. */
  tolerance?: number;
}

function buildMetrics(
  before: TextAnalysis,
  after: TextAnalysis,
  targetGrade: number,
): Metric[] {
  const one = (n: number) => n.toFixed(1);
  const whole = (n: number) => Math.round(n).toLocaleString();

  return [
    {
      key: "pattern",
      label: "Pattern score",
      before: before.patterns.score,
      after: after.patterns.score,
      format: one,
      better: "down",
    },
    {
      key: "grade",
      label: "Reading grade",
      before: before.readability.fleschKincaidGrade,
      after: after.readability.fleschKincaidGrade,
      format: one,
      better: "target",
      target: targetGrade,
    },
    {
      key: "ease",
      label: "Reading ease",
      before: before.readability.fleschReadingEase,
      after: after.readability.fleschReadingEase,
      format: whole,
      better: "up",
    },
    {
      key: "sentence",
      label: "Avg sentence",
      before: before.readability.avgSentenceLength,
      after: after.readability.avgSentenceLength,
      format: one,
      better: "target",
    },
    {
      // Length is meant to hold: a big drop usually means content was dropped.
      key: "words",
      label: "Word count",
      before: before.wordCount,
      after: after.wordCount,
      format: whole,
      better: "hold",
      tolerance: 0.15,
    },
    {
      key: "sentences",
      label: "Sentences",
      before: before.sentenceCount,
      after: after.sentenceCount,
      format: whole,
      better: "target",
    },
  ];
}

function driftRatio(metric: Metric): number {
  if (metric.before === 0) return 0;
  return Math.abs(metric.after - metric.before) / metric.before;
}

function verdictClass(metric: Metric): string {
  const delta = metric.after - metric.before;

  if (metric.better === "hold") {
    return driftRatio(metric) > (metric.tolerance ?? 0.15) ? "text-warn" : "text-ink";
  }

  if (metric.better === "target") {
    if (metric.target === undefined) return "text-ink-muted";
    const closer =
      Math.abs(metric.after - metric.target) < Math.abs(metric.before - metric.target);
    return closer ? "text-good" : "text-ink-muted";
  }

  if (Math.abs(delta) < 0.05) return "text-ink-muted";
  const improved = metric.better === "down" ? delta < 0 : delta > 0;
  return improved ? "text-good" : "text-bad";
}

function Arrow({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.05) return <span aria-hidden>·</span>;
  return <span aria-hidden>{delta < 0 ? "↓" : "↑"}</span>;
}

export function MetricGrid({
  before,
  after,
  targetGrade,
}: {
  before: TextAnalysis;
  after: TextAnalysis;
  targetGrade: number;
}) {
  const metrics = buildMetrics(before, after, targetGrade);

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
      {metrics.map((metric) => {
        const delta = metric.after - metric.before;
        return (
          <div key={metric.key} className="bg-surface px-3 py-3">
            <dt className="text-[11px] uppercase tracking-wide text-ink-faint">
              {metric.label}
            </dt>
            <dd className="mt-1.5 flex items-baseline gap-2">
              <span className="text-sm text-ink-faint line-through tabular-nums">
                {metric.format(metric.before)}
              </span>
              <span className={`text-lg font-semibold tabular-nums ${verdictClass(metric)}`}>
                {metric.format(metric.after)}
              </span>
              <span className={`text-xs tabular-nums ${verdictClass(metric)}`}>
                <Arrow delta={delta} />
              </span>
            </dd>
            {metric.key === "grade" && (
              <p className="mt-0.5 text-[11px] text-ink-faint">
                {gradeLabel(metric.after)} · target {targetGrade}
              </p>
            )}
            {metric.better === "hold" &&
              driftRatio(metric) > (metric.tolerance ?? 0.15) && (
                <p className="mt-0.5 text-[11px] text-warn">
                  {Math.round(driftRatio(metric) * 100)}% drift — check nothing was cut
                </p>
              )}
          </div>
        );
      })}
    </dl>
  );
}
