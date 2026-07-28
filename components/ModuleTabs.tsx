"use client";

import { MODULES, getModule } from "@/lib/modules";

/**
 * The primary control. Everything else in the app is a refinement of this
 * choice, so it sits directly under the header at every viewport width.
 */
export function ModuleTabs({
  moduleId,
  onChange,
  disabled,
}: {
  moduleId: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  const active = getModule(moduleId);

  return (
    <div className="shrink-0 border-b border-line bg-surface">
      <div
        role="tablist"
        aria-label="Rewrite module"
        className="mx-auto flex w-full max-w-lg items-stretch gap-1 px-2 pt-2 lg:mx-0"
      >
        {MODULES.map((module) => {
          const selected = module.id === active.id;
          return (
            <button
              key={module.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onChange(module.id)}
              className={`group relative flex flex-1 items-center justify-center gap-2 rounded-t-lg px-3 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                selected
                  ? "bg-canvas text-ink"
                  : "text-ink-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <span aria-hidden className={selected ? "text-accent" : ""}>
                {module.glyph}
              </span>
              {module.label}
              {selected && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      <p className="mx-auto w-full max-w-lg px-4 pb-2.5 pt-2 text-xs leading-relaxed text-ink-muted lg:mx-0">
        {active.tagline}
      </p>
    </div>
  );
}
