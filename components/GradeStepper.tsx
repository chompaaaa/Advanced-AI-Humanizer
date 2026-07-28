"use client";

import { useEffect, useRef } from "react";

import { GRADE_PROFILES, getGradeProfile } from "@/lib/grades";

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Replaces the ten wrapped pills.
 *
 * The ten profiles are discrete and unevenly spaced (5…12, then 14, 17), so a
 * slider would imply a continuity that isn't there and give ~33px per stop on a
 * phone. A stepper is one row at any width, states its value in words, and
 * makes the common ±1 adjustment a single tap. The label opens a sheet for the
 * rare jump to College or Graduate, so nothing is hidden.
 */
export function GradeStepper({
  gradeId,
  onChange,
  onOpenList,
  disabled,
  inert,
}: {
  gradeId: string;
  onChange: (id: string) => void;
  onOpenList: () => void;
  disabled?: boolean;
  /** True when the active module ignores grade — shown, but visibly inactive. */
  inert?: boolean;
}) {
  const index = GRADE_PROFILES.findIndex((g) => g.id === gradeId);
  const safeIndex = index === -1 ? 3 : index;
  const profile = getGradeProfile(gradeId);

  const step = (delta: number) => {
    const next = GRADE_PROFILES[safeIndex + delta];
    if (next) onChange(next.id);
  };

  const off = disabled || inert;

  const buttonClass =
    "grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line text-ink-muted transition-colors hover:border-ink-faint hover:text-ink disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ink-muted";

  return (
    <div
      className={`flex items-center gap-1.5 ${inert ? "opacity-45" : ""}`}
      title={inert ? "Fast doesn't change the reading level — it never restructures sentences." : undefined}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={off || safeIndex === 0}
        aria-label="Lower reading level"
        className={buttonClass}
      >
        <Chevron dir="left" />
      </button>

      <button
        type="button"
        onClick={onOpenList}
        disabled={off}
        aria-label={`Reading level: ${profile.label}. Choose from all levels`}
        className="min-w-[6.5rem] rounded-md border border-line bg-surface-2 px-2 py-1.5 text-center text-sm font-medium text-ink transition-colors hover:border-ink-faint disabled:opacity-50"
      >
        {profile.label}
      </button>

      <button
        type="button"
        onClick={() => step(1)}
        disabled={off || safeIndex === GRADE_PROFILES.length - 1}
        aria-label="Raise reading level"
        className={buttonClass}
      >
        <Chevron dir="right" />
      </button>
    </div>
  );
}

/** Bottom sheet listing every profile with its description. */
export function GradeSheet({
  gradeId,
  onChange,
  onClose,
}: {
  gradeId: string;
  onChange: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a reading level"
        className="animate-rise relative max-h-[80vh] w-full overflow-auto rounded-t-2xl border border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:max-w-md sm:rounded-2xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Reading level</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-ink-muted hover:text-ink"
          >
            Done
          </button>
        </div>

        <ul className="p-2">
          {GRADE_PROFILES.map((g) => {
            const active = g.id === gradeId;
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(g.id);
                    onClose();
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                    active ? "bg-accent-soft" : "hover:bg-surface-2"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className={`text-sm font-medium ${active ? "text-ink" : "text-ink"}`}>
                      {g.label}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-ink-faint">
                      grade {g.targetGrade}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                    {g.description}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
