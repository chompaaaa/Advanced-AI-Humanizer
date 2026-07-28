"use client";

import { GradeStepper } from "@/components/GradeStepper";
import { getModule } from "@/lib/modules";
import { type Settings, changedFromDefaults } from "@/lib/settings";

function Gear() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 3.6V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One row, at every viewport width. This is what replaces the ten-pill block
 * that wrapped to three rows on a phone.
 */
export function SettingsBar({
  settings,
  onGradeChange,
  onOpenGrades,
  onOpenSettings,
  disabled,
}: {
  settings: Settings;
  onGradeChange: (id: string) => void;
  onOpenGrades: () => void;
  onOpenSettings: () => void;
  disabled: boolean;
}) {
  const activeModule = getModule(settings.moduleId);
  const changed = changedFromDefaults(settings);

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-canvas px-3 sm:px-4">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        Level
      </span>

      <GradeStepper
        gradeId={settings.gradeId}
        onChange={onGradeChange}
        onOpenList={onOpenGrades}
        disabled={disabled}
        inert={!activeModule.usesGrade}
      />

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSettings}
          disabled={disabled}
          aria-label={`Settings${changed > 0 ? `, ${changed} changed` : ""}`}
          className="relative flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-ink-muted transition-colors hover:border-ink-faint hover:text-ink disabled:opacity-40"
        >
          <Gear />
          <span className="hidden text-xs sm:inline">Settings</span>
          {changed > 0 && (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold tabular-nums text-white">
              {changed}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
