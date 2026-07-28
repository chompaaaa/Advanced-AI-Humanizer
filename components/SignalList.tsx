"use client";

import { useState } from "react";

import type { Signal } from "@/lib/analysis";

function severity(score: number) {
  if (score >= 62) return { bar: "bg-bad", text: "text-bad" };
  if (score >= 34) return { bar: "bg-warn", text: "text-warn" };
  return { bar: "bg-good", text: "text-good" };
}

function SignalRow({ signal }: { signal: Signal }) {
  const [open, setOpen] = useState(false);
  const tone = severity(signal.score);
  const inactive = signal.weight === 0;
  const expandable = signal.evidence.length > 0;

  return (
    <li className="border-b border-line-soft last:border-b-0">
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        aria-expanded={expandable ? open : undefined}
        disabled={!expandable}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
          expandable ? "hover:bg-surface-2 cursor-pointer" : "cursor-default"
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-sm font-medium text-ink">{signal.label}</span>
            {inactive ? (
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-faint">
                not enough text
              </span>
            ) : (
              <span className={`shrink-0 text-xs font-semibold tabular-nums ${tone.text}`}>
                {Math.round(signal.score)}
              </span>
            )}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
            {signal.detail}
          </span>
        </span>

        {!inactive && (
          <span className="mt-1.5 h-1.5 w-14 shrink-0 self-start overflow-hidden rounded-full bg-line">
            <span
              className={`block h-full rounded-full ${tone.bar}`}
              style={{ width: `${Math.max(2, signal.score)}%` }}
            />
          </span>
        )}

        {expandable && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className={`mt-1 shrink-0 self-start text-ink-faint transition-transform ${
              open ? "rotate-180" : ""
            }`}
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {open && expandable && (
        <div className="animate-rise px-4 pb-4">
          <ul className="flex flex-wrap gap-1.5">
            {signal.evidence.map((item) => (
              <li
                key={item.text}
                className="rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-ink-muted"
                title={item.suggestion ? `Try: ${item.suggestion}` : undefined}
              >
                <span className="text-ink">{item.text}</span>
                {item.count > 1 && (
                  <span className="ml-1.5 text-ink-faint tabular-nums">×{item.count}</span>
                )}
                {item.suggestion && (
                  <span className="ml-1.5 text-accent">→ {item.suggestion}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

export function SignalList({ signals }: { signals: Signal[] }) {
  return (
    <ul className="divide-y divide-line-soft">
      {signals.map((signal) => (
        <SignalRow key={signal.id} signal={signal} />
      ))}
    </ul>
  );
}
