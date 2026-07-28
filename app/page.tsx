"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Controls, DEFAULT_SETTINGS, type Settings } from "@/components/Controls";
import { MetricGrid } from "@/components/MetricGrid";
import { ScoreDial, bandMeta } from "@/components/ScoreDial";
import { SignalList } from "@/components/SignalList";
import { type TextAnalysis, analyzeText } from "@/lib/analysis";
import { getGradeProfile } from "@/lib/grades";
import { SAMPLE_TEXT } from "@/lib/sample";
import { useHydrated, useStoredValue, writeStoredValue } from "@/lib/use-persistent";

interface HumanizeResponse {
  output: string;
  before: TextAnalysis;
  after: TextAnalysis;
  cleanup: string[];
  passes: number;
  correctionReason?: string;
}

const STORAGE_KEY = "humanizer.settings.v1";
const DRAFT_KEY = "humanizer.draft.v1";

/** Debounced value, so the live analyzer doesn't run on every keystroke. */
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
    <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export default function Page() {
  const hydrated = useHydrated();

  /*
   * Settings and the draft are seeded from localStorage on the first client
   * render, then owned by React state. `?? stored` rather than `|| stored` so
   * clearing the editor to an empty string is respected.
   */
  const storedSettings = useStoredValue<Settings>(STORAGE_KEY, DEFAULT_SETTINGS, (raw) => ({
    ...DEFAULT_SETTINGS,
    ...JSON.parse(raw),
  }));
  const storedDraft = useStoredValue(DRAFT_KEY, "", (raw) => raw);

  const [settingsState, setSettingsState] = useState<Settings | null>(null);
  const [inputState, setInputState] = useState<string | null>(null);
  const [result, setResult] = useState<HumanizeResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const settings = settingsState ?? storedSettings;
  const input = inputState ?? storedDraft;

  const setSettings = setSettingsState;
  const setInput = setInputState;

  useEffect(() => {
    if (!hydrated) return;
    writeStoredValue(STORAGE_KEY, JSON.stringify(settings));
  }, [settings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => writeStoredValue(DRAFT_KEY, input), 600);
    return () => clearTimeout(id);
  }, [input, hydrated]);

  const grade = getGradeProfile(settings.gradeId);
  const debouncedInput = useDebounced(input, 250);

  /* Live analysis of whatever is in the editor right now. */
  const liveAnalysis = useMemo(
    () => analyzeText(debouncedInput, grade.targetGrade),
    [debouncedInput, grade.targetGrade],
  );

  /* Once a rewrite exists, the rail describes the output instead of the draft. */
  const shown = result ? result.after : liveAnalysis;
  const isShowingResult = result !== null;

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
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Couldn't reach the server. Is the dev server still running?");
    } finally {
      setRunning(false);
    }
  }, [input, running, settings]);

  /* Drop any in-flight rewrite if the page goes away mid-request. */
  useEffect(() => () => abortRef.current?.abort(), []);

  /* Cmd/Ctrl+Enter runs the rewrite from anywhere on the page. */
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
    anchor.download = `humanized-${settings.gradeId}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  const wordCount = liveAnalysis.wordCount;
  const meta = bandMeta(shown.patterns.band);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-canvas/85 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-sm font-bold text-white">
            H
          </span>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold text-ink">Humanizer</h1>
            <p className="text-[11px] text-ink-faint">Reading-level rewriting studio</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-ink-muted sm:inline">
            claude-opus-5
          </span>
          <button
            type="button"
            onClick={() => {
              setInput(SAMPLE_TEXT);
              reset();
            }}
            className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
          >
            Load sample
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Editor + output */}
        <div className="flex min-w-0 flex-col border-line xl:border-r">
          <section className="border-b border-line bg-surface px-4 py-4 sm:px-6">
            <Controls settings={settings} onChange={setSettings} disabled={running} />

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void run()}
                disabled={running || wordCount === 0}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {running ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Rewriting…
                  </>
                ) : (
                  <>Rewrite to {grade.label}</>
                )}
              </button>

              {result && !running && (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-md border border-line px-3 py-2.5 text-sm text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
                >
                  Clear result
                </button>
              )}

              <span className="text-xs text-ink-faint">
                <kbd className="rounded border border-line bg-surface-2 px-1 py-0.5 font-mono">
                  ⌘
                </kbd>
                <span className="mx-0.5">+</span>
                <kbd className="rounded border border-line bg-surface-2 px-1 py-0.5 font-mono">
                  ↵
                </kbd>
              </span>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-md border border-bad/40 bg-bad-soft px-3 py-2 text-sm text-bad"
              >
                {error}
              </p>
            )}
          </section>

          <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
            <section className="flex min-h-[22rem] min-w-0 flex-col border-line lg:border-r">
              <PaneHeading title="Draft">
                <span className="text-xs tabular-nums text-ink-faint">
                  {wordCount.toLocaleString()} words
                </span>
                {input && (
                  <button
                    type="button"
                    onClick={() => {
                      setInput("");
                      reset();
                    }}
                    className="text-xs text-ink-faint transition-colors hover:text-ink"
                  >
                    Clear
                  </button>
                )}
              </PaneHeading>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                spellCheck={false}
                aria-label="Draft text"
                placeholder="Paste the draft here. Anything from Claude, GPT, Gemini, Grok, or your own writing."
                className="flex-1 resize-none bg-transparent px-4 py-4 text-[15px] leading-7 text-ink outline-none placeholder:text-ink-faint"
              />
            </section>

            <section className="flex min-h-[22rem] min-w-0 flex-col border-t border-line lg:border-t-0">
              <PaneHeading title="Rewritten">
                {result && (
                  <>
                    <span className="text-xs tabular-nums text-ink-faint">
                      {result.after.wordCount.toLocaleString()} words
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyOutput()}
                      className="rounded border border-line px-2 py-1 text-xs text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={downloadOutput}
                      className="rounded border border-line px-2 py-1 text-xs text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
                    >
                      .txt
                    </button>
                  </>
                )}
              </PaneHeading>

              <div className="flex-1 overflow-auto px-4 py-4">
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
                    The rewrite lands here. The panel on the right analyzes your draft as you
                    type, then switches to scoring the result.
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
                          Pipeline · {result.passes} model{" "}
                          {result.passes === 1 ? "pass" : "passes"}
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
          </div>
        </div>

        {/* Analysis rail */}
        <aside className="flex min-w-0 flex-col border-t border-line bg-surface xl:border-t-0">
          <PaneHeading title={isShowingResult ? "Result analysis" : "Live analysis"} />

          <div className="flex-1 overflow-auto">
            <div className="flex flex-col items-center gap-4 px-4 py-6">
              <ScoreDial score={shown.patterns.score} band={shown.patterns.band} />
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

            {!result && wordCount > 0 && (
              <div className="border-t border-line px-4 py-4">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-ink-faint">
                      Reading grade
                    </dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
                      {shown.readability.fleschKincaidGrade.toFixed(1)}
                      <span className="ml-1 text-xs font-normal text-ink-faint">
                        target {grade.targetGrade}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-ink-faint">
                      Avg sentence
                    </dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
                      {shown.readability.avgSentenceLength.toFixed(1)}
                      <span className="ml-1 text-xs font-normal text-ink-faint">words</span>
                    </dd>
                  </div>
                </dl>
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

            {shown.outliers.length > 0 && (
              <div className="border-t border-line px-4 py-4">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  Sentences above target
                </h3>
                <ul className="space-y-2">
                  {shown.outliers.map((o) => (
                    <li
                      key={o.index}
                      className="rounded-md border border-line bg-surface-2 p-2.5 text-xs leading-relaxed text-ink-muted"
                    >
                      <span className="mb-1 block font-mono text-[10px] text-warn">
                        grade {o.grade} · {o.words} words
                      </span>
                      {o.sentence.length > 160 ? `${o.sentence.slice(0, 160)}…` : o.sentence}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="border-t border-line px-4 py-4 text-[11px] leading-relaxed text-ink-faint">
              This score is a heuristic over writing patterns, not a detector verdict. AI
              detectors are unreliable in both directions and regularly misjudge human
              writing, so treat this as editorial feedback rather than a prediction about
              any third-party tool.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
