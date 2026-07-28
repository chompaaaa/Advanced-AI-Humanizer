"use client";

export type PaneId = "draft" | "result" | "analysis";

const PANES: Array<{ id: PaneId; label: string }> = [
  { id: "draft", label: "Draft" },
  { id: "result", label: "Result" },
  { id: "analysis", label: "Analysis" },
];

/**
 * Below the large breakpoint the three panes become tabs rather than stacking.
 * Stacked, they made the page ~2,400px tall on a phone and pushed the editor
 * off-screen; as tabs, whichever pane you're using owns the whole viewport.
 */
export function PaneTabs({
  active,
  onChange,
  resultReady,
  score,
}: {
  active: PaneId;
  onChange: (id: PaneId) => void;
  resultReady: boolean;
  score: number | null;
}) {
  return (
    <div
      role="tablist"
      aria-label="Panes"
      className="flex shrink-0 items-stretch gap-1 border-b border-line bg-canvas px-2 lg:hidden"
    >
      {PANES.map((pane) => {
        const selected = pane.id === active;
        return (
          <button
            key={pane.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(pane.id)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
              selected ? "text-ink" : "text-ink-faint hover:text-ink-muted"
            }`}
          >
            {pane.label}
            {pane.id === "result" && resultReady && (
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="ready" />
            )}
            {pane.id === "analysis" && score !== null && (
              <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                {Math.round(score)}
              </span>
            )}
            {selected && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}
