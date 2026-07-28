"use client";

import { useEffect } from "react";

import { INTENSITY_PRESETS } from "@/lib/grades";
import type { Settings } from "@/lib/settings";

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-lg border border-line bg-surface-2 px-3 py-3 text-left transition-colors hover:border-ink-faint"
    >
      <span
        className={`mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          checked ? "bg-accent" : "bg-line"
        }`}
      >
        <span
          className={`h-3 w-3 rounded-full bg-white transition-transform ${
            checked ? "translate-x-3" : ""
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        <span className="block text-xs leading-relaxed text-ink-muted">{hint}</span>
      </span>
    </button>
  );
}

/**
 * Everything that isn't the module or the grade lives here, one tap away.
 *
 * Keeping these out of the main flow is what lets the draft editor start near
 * the top of the viewport instead of ~660px down.
 */
export function SettingsSheet({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rewrite settings"
        className="animate-rise relative max-h-[85vh] w-full overflow-auto rounded-t-2xl border border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:max-w-md sm:rounded-2xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-ink-muted hover:text-ink"
          >
            Done
          </button>
        </div>

        <div className="flex flex-col gap-5 p-4">
          <section>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              Rewrite depth
            </h3>
            <div className="flex flex-col gap-2">
              {INTENSITY_PRESETS.map((preset) => {
                const active = preset.id === settings.intensityId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => set("intensityId", preset.id)}
                    aria-pressed={active}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "border-accent bg-accent-soft"
                        : "border-line bg-surface-2 hover:border-ink-faint"
                    }`}
                  >
                    <span className="block text-sm font-medium text-ink">{preset.label}</span>
                    <span className="block text-xs leading-relaxed text-ink-muted">
                      {preset.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              Constraints
            </h3>
            <Toggle
              checked={settings.preserveFormatting}
              onChange={(v) => set("preserveFormatting", v)}
              label="Keep formatting"
              hint="Headings, lists and emphasis survive the rewrite."
            />
            <Toggle
              checked={settings.autoCorrect}
              onChange={(v) => set("autoCorrect", v)}
              label="Auto-correct grade"
              hint="Keep adjusting until the reading level lands in its band."
            />
          </section>

          <section>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              Extra direction
            </h3>
            <textarea
              rows={3}
              value={settings.customInstructions}
              maxLength={1000}
              onChange={(e) => set("customInstructions", e.target.value)}
              placeholder="e.g. keep the second paragraph's quotation word for word"
              className="w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-ink-faint focus:border-accent"
            />
            <p className="mt-1.5 text-right text-[11px] tabular-nums text-ink-faint">
              {settings.customInstructions.length} / 1000
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
