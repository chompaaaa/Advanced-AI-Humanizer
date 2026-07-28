"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GradeSheet } from "@/components/GradeStepper";
import { MetricGrid } from "@/components/MetricGrid";
import { ModuleTabs } from "@/components/ModuleTabs";
import { type PaneId, PaneTabs } from "@/components/PaneTabs";
import { ScoreDial, bandMeta } from "@/components/ScoreDial";
import { SettingsBar } from "@/components/SettingsBar";
import { SettingsSheet } from "@/components/SettingsSheet";
import { SignalList } from "@/components/SignalList";
import { type TextAnalysis, analyzeText } from "@/lib/analysis";
import { getGradeProfile } from "@/lib/grades";
import { getModule } from "@/lib/modules";
import { SAMPLE_TEXT } from "@/lib/sample";
import { DEFAULT_SETTINGS, type Settings, applyModule } from "@/lib/settings";
import { useHydrated, useStoredValue, writeStoredValue } from "@/lib/use-persistent";

interface HumanizeResponse {
  output: string;
  before: TextAnalysis;
  after: TextAnalysis;
  cleanup: string[];
  passes: number;
  correctionReason?: string;
}

const STORAGE_KEY = "humanizer.settings.v2";
const DRAFT_KEY = "humanizer.draft.v1";

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function PaneHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        {title}
      </h2>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export default function Page() {
  const hydrated = useHydrated();

  const storedSettings = useStoredValue<Settings>(STORAGE_KEY, DEFAULT_SETTINGS, (raw) => ({
    ...DEFAULT_SETTINGS,
    ...JSON.parse(raw),
  }));
  const storedDraft = useStoredValue(DRAFT_KEY, "", (raw) => raw);

  const [settingsState, setSettings] = useState<Settings | null>(null);
  const [inputState, setInput] = useState<string | null>(null);
  const [result, setResult] = useState<HumanizeResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pane, setPane] = useState<PaneId>("draft");
  const [gradeSheet, setGradeSheet] = useState(false);
  const [settingsSheet, setSettingsSheet] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const settings = settingsState ?? storedSettings;
  const input = inputState ?? storedDraft;

  useEffect(() => {
    if (!hydrated) return;
    writeStoredValue(STORAGE_KEY, JSON.stringify(settings));
  }, [settings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => writeStoredValue(DRAFT_KEY, input), 600);
    return () => clearTimeout(id);
  }, [input, hydrated]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const grade = getGradeProfile(settings.gradeId);
  const activeModule = getModule(settings.moduleId);
  const debouncedInput = useDebounced(input, 250);

  const liveAnalysis = useMemo(
    () => analyzeText(debouncedInput, grade.targetGrade),
    [debouncedInput, grade.targetGrade],
  );

  const shown = result ? result.after : liveAnalysis;
  const wordCount = liveAnalysis.wordCount;
  const meta = bandMeta(shown.patterns.band);

  const run = useCallback(async () => {
    if (!input.trim() || running) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setError(null);

    try {
      const response = await fetch("/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, ...settings }),
        signal: controller.signal,
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error ?? "The rewrite failed.");
        return;
      }

      setResult(payload as HumanizeResponse);
      setPane("result");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Couldn't reach the server. Is the dev server still running?");
    } finally {
      setRunning(false);
    }
  }, [input, running, settings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  const copyOutput = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Clipboard access was blocked by the browser.");
    }
  };

  const downloadOutput = () => {
    if (!result) return;
    const blob = new Blob([result.output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `humanized-${settings.moduleId}-${settings.gradeId}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  /* Panes are tabs below lg and columns at lg+; `show` drives the mobile case. */
  const show = (id: PaneId) => (pane === id ? "flex" : "hidden lg:flex");

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line bg-canvas px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-accent text-xs font-bold text-white">
            H
          </span>
          <h1 className="truncate text-sm font-semibold text-ink">Humanizer</h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setInput(SAMPLE_TEXT);
              reset();
              setPane("draft");
            }}
            className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
          >
            Load sample
          </button>
          {input && (
            <button
              type="button"
              onClick={() => {
                setInput("");
                reset();
              }}
              className="rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>
      </header>

      <ModuleTabs
        moduleId={settings.moduleId}
        onChange={(id) => setSettings(applyModule(settings, id))}
        disabled={running}
      />

      <SettingsBar
        settings={settings}
        onGradeChange={(id) => setSettings({ ...settings, gradeId: id })}
        onOpenGrades={() => setGradeSheet(true)}
        onOpenSettings={() => setSettingsSheet(true)}
        disabled={running}
      />

      <PaneTabs
        active={pane}
        onChange={setPane}
        resultReady={result !== null}
        score={wordCount > 0 ? shown.patterns.score : null}
      />

      {/* Panes. flex-1 + min-h-0 is what lets the editor absorb all spare height. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px]">
        <section className={`${show("draft")} min-h-0 min-w-0 flex-col lg:border-r lg:border-line`}>
          <PaneHeading title="Draft">
            <span className="text-xs tabular-nums text-ink-faint">
              {wordCount.toLocaleString()} words
            </span>
          </PaneHeading>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            aria-label="Draft text"
            placeholder="Paste the draft here. Anything from Claude, GPT, Gemini, Grok, or your own writing."
            className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 text-[15px] leading-7 text-ink outline-none placeholder:text-ink-faint"
          />
        </section>

        <section
          className={`${show("result")} min-h-0 min-w-0 flex-col lg:border-r lg:border-line`}
        >
          <PaneHeading title="Rewritten">
            {result && (
              <>
                <span className="text-xs tabular-nums text-ink-faint">
                  {result.after.wordCount.toLocaleString()} words
                </span>
                <button
                  type="button"
                  onClick={() => void copyOutput()}
                  className="rounded border border-line px-2 py-0.5 text-xs text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={downloadOutput}
                  className="rounded border border-line px-2 py-0.5 text-xs text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
                >
                  .txt
                </button>
              </>
            )}
          </PaneHeading>

          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            {running && !result && (
              <div className="space-y-2.5" aria-label="Rewriting in progress">
                {[92, 78, 96, 64, 88, 54].map((w, i) => (
                  <div
                    key={w}
                    className="h-3.5 animate-pulse-soft rounded bg-line"
                    style={{ width: `${w}%`, animationDelay: `${i * 90}ms` }}
                  />
                ))}
              </div>
            )}

            {!running && !result && (
              <p className="text-sm leading-relaxed text-ink-faint">
                Pick a module, then run it. The rewrite lands here.
              </p>
            )}

            {result && (
              <div className="animate-rise">
                <p className="whitespace-pre-wrap text-[15px] leading-7 text-ink">
                  {result.output}
                </p>

                {(result.correctionReason || result.cleanup.length > 0) && (
                  <div className="mt-6 space-y-1.5 border-t border-line-soft pt-4 text-xs text-ink-faint">
                    <p className="font-medium uppercase tracking-wide">
                      {result.passes} {result.passes === 1 ? "pass" : "passes"}
                    </p>
                    {result.correctionReason && <p>{result.correctionReason}</p>}
                    {result.cleanup.map((change) => (
                      <p key={change}>· {change}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <aside className={`${show("analysis")} min-h-0 min-w-0 flex-col bg-surface`}>
          <PaneHeading title={result ? "Result analysis" : "Live analysis"} />

          <div className="min-h-0 flex-1 overflow-auto">
            <div className="flex flex-col items-center gap-3 px-4 py-5">
              <ScoreDial score={shown.patterns.score} band={shown.patterns.band} size={112} />
              <p className="max-w-[16rem] text-center text-xs leading-relaxed text-ink-muted">
                {wordCount === 0
                  ? "Paste a draft to see how strongly it matches common machine-writing patterns."
                  : `Reads ${meta.label.toLowerCase()} across nine structural and lexical measures.`}
              </p>
            </div>

            {shown.languageNote && (
              <p className="mx-4 mb-4 rounded-md border border-warn/40 bg-warn-soft px-3 py-2 text-xs leading-relaxed text-warn">
                {shown.languageNote}
              </p>
            )}

            {result && (
              <div className="border-t border-line px-4 py-4">
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  Before → after
                </h3>
                <MetricGrid
                  before={result.before}
                  after={result.after}
                  targetGrade={grade.targetGrade}
                />
              </div>
            )}

            <div className="border-t border-line">
              <h3 className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Signals
              </h3>
              {wordCount === 0 ? (
                <p className="px-4 pb-4 text-xs text-ink-faint">Nothing to measure yet.</p>
              ) : (
                <SignalList signals={shown.patterns.signals} />
              )}
            </div>

            <p className="border-t border-line px-4 py-4 text-[11px] leading-relaxed text-ink-faint">
              This score is a heuristic over writing patterns, not a detector verdict. AI
              detectors are unreliable in both directions and regularly misjudge human
              writing.
            </p>
          </div>
        </aside>
      </div>

      {/* Pinned action bar. Keeping the primary action out of normal flow is what
          frees the space above it for the editor. */}
      <div className="shrink-0 border-t border-line bg-surface px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-4">
        {error && (
          <p
            role="alert"
            className="mb-2 rounded-md border border-bad/40 bg-bad-soft px-3 py-2 text-sm text-bad"
          >
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void run()}
            disabled={running || wordCount === 0}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-6"
          >
            {running ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Running {activeModule.label}…
              </>
            ) : (
              <>
                {activeModule.glyph} Run {activeModule.label}
              </>
            )}
          </button>

          {result && !running && (
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-line px-3 py-3 text-sm text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
            >
              Reset
            </button>
          )}

          <span className="ml-auto hidden text-xs text-ink-faint sm:inline">
            <kbd className="rounded border border-line bg-surface-2 px-1 py-0.5 font-mono">⌘</kbd>
            <span className="mx-0.5">+</span>
            <kbd className="rounded border border-line bg-surface-2 px-1 py-0.5 font-mono">↵</kbd>
          </span>
        </div>
      </div>

      {gradeSheet && (
        <GradeSheet
          gradeId={settings.gradeId}
          onChange={(id) => setSettings({ ...settings, gradeId: id })}
          onClose={() => setGradeSheet(false)}
        />
      )}

      {settingsSheet && (
        <SettingsSheet
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsSheet(false)}
        />
      )}
    </div>
  );
}
