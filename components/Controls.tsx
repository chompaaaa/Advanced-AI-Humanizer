"use client";

import {
  GRADE_PROFILES,
  INTENSITY_PRESETS,
  TONE_PRESETS,
  getGradeProfile,
} from "@/lib/grades";

export interface Settings {
  gradeId: string;
  toneId: string;
  intensityId: string;
  preserveFormatting: boolean;
  autoCorrect: boolean;
  customInstructions: string;
}

export const DEFAULT_SETTINGS: Settings = {
  gradeId: "grade-8",
  toneId: "neutral",
  intensityId: "balanced",
  preserveFormatting: true,
  autoCorrect: true,
  customInstructions: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

const selectClass =
  "w-full appearance-none rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink transition-colors hover:border-ink-faint focus:border-accent";

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
      className="flex w-full items-start gap-3 rounded-md border border-line bg-surface-2 px-3 py-2.5 text-left transition-colors hover:border-ink-faint"
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
        <span className="block text-xs text-ink-muted">{hint}</span>
      </span>
    </button>
  );
}

export function Controls({
  settings,
  onChange,
  disabled,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
  disabled: boolean;
}) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });

  const grade = getGradeProfile(settings.gradeId);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
          Reading level
        </span>
        <div
          role="radiogroup"
          aria-label="Reading level"
          className="mt-1.5 flex flex-wrap gap-1.5"
        >
          {GRADE_PROFILES.map((profile) => {
            const active = profile.id === settings.gradeId;
            return (
              <button
                key={profile.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => set("gradeId", profile.id)}
                title={`${profile.label} — ${profile.description}`}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  active
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line bg-surface-2 text-ink-muted hover:border-ink-faint hover:text-ink"
                }`}
              >
                {profile.short}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          <span className="text-ink">{grade.label}</span> · {grade.description} Targets grade{" "}
          {grade.targetGrade}, {grade.sentenceWords[0]}–{grade.sentenceWords[1]} words per
          sentence.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Voice">
          <select
            className={selectClass}
            value={settings.toneId}
            disabled={disabled}
            onChange={(e) => set("toneId", e.target.value)}
          >
            {TONE_PRESETS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Rewrite depth">
          <select
            className={selectClass}
            value={settings.intensityId}
            disabled={disabled}
            onChange={(e) => set("intensityId", e.target.value)}
          >
            {INTENSITY_PRESETS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label} — {i.description}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle
          checked={settings.preserveFormatting}
          onChange={(v) => set("preserveFormatting", v)}
          label="Keep formatting"
          hint="Headings, lists and emphasis survive."
        />
        <Toggle
          checked={settings.autoCorrect}
          onChange={(v) => set("autoCorrect", v)}
          label="Auto-correct grade"
          hint="Second pass if the level misses."
        />
      </div>

      <Field label="Extra direction (optional)">
        <textarea
          rows={2}
          disabled={disabled}
          value={settings.customInstructions}
          onChange={(e) => set("customInstructions", e.target.value)}
          placeholder="e.g. keep the second paragraph's quotation word for word"
          className="w-full resize-y rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-ink-faint focus:border-accent"
        />
      </Field>
    </div>
  );
}
