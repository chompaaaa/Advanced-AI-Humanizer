# Advanced AI Humanizer

A rewriting studio for prose. Paste a draft from Claude, GPT, Gemini, Grok — or your own
writing — and it does two things:

1. **Analyzes** the text for the structural and lexical patterns that show up in unedited
   model output, with a per-signal breakdown and the exact phrases that triggered each one.
2. **Rewrites** it to a target reading level (5th grade through graduate) in a chosen voice,
   then re-measures the result and runs a corrective pass if it missed the target.

The analyzer is deterministic and runs in the browser as you type. The rewrite runs
server-side through Claude Opus 5.

## What it actually measures

Nine signals, each scored 0–100 and combined with a weighted quadratic mean (so a passage
that's loudly machine-like on three axes isn't diluted to "fine" by being clean on the
other six):

| Signal | What it measures |
| --- | --- |
| Sentence rhythm | Coefficient of variation of sentence length. Human prose swings 55–85%; unedited model output clusters near 25–40%. |
| Flagged vocabulary | Weighted density of ~100 phrases that are rare in human writing and common in model output (`delve into`, `a testament to`, `navigate the complexities`, …). |
| Punctuation profile | Em-dash, semicolon and typographic-quote density. |
| Sentence openers | Share of sentences starting with a stock transition (`Moreover`, `Furthermore`, `Ultimately`, …). |
| Parallel constructions | Rule-of-three lists and `not just X but Y` framings. |
| Contractions | Contractions per 100 words. Formal model output has almost none. |
| Paragraph shape | Variation in paragraph length. Near-identical paragraphs are a template tell. |
| Passive voice | Share of sentences using a passive construction. |
| Vocabulary variety | Moving-average type-token ratio, and how *evenly* it holds across the piece. |

Alongside those it computes Flesch-Kincaid grade, Flesch reading ease, Gunning Fog, SMOG
and ARI, and flags individual sentences sitting well above the requested grade.

### On "AI detection"

The pattern score is a heuristic over writing style. It is **not** a detector, and it does
not predict what any third-party detector will say. Commercial AI detectors are unreliable
in both directions and misclassify human writing often enough that several studies have
found systematic bias against non-native English writers. Treat the score as editorial
feedback about rhythm and diction, which is what it actually is.

## Reading levels

Ten profiles, each carrying its own grade target, sentence-length band, vocabulary
guidance and syntax guidance:

`5th` · `6th` · `7th` · `8th` · `9th` · `10th` · `11th` · `12th` · `College` · `Graduate`

Combined with six voices (Neutral, Conversational, Academic, Persuasive, Narrative,
Professional) and three rewrite depths (Light, Balanced, Deep).

## The rewrite pipeline

```
draft
  ↓  analyze          deterministic, local — nine signals + five readability formulas
  ↓  brief            the findings become specific instructions ("replace 'delve into'",
  │                   "8 of 11 sentences open with a stock transition")
  ↓  rewrite          Claude Opus 5, adaptive thinking, streamed
  ↓  clean up         mechanical pass: em dashes → plain punctuation, straight quotes,
  │                   strip any preamble the model added, tidy whitespace
  ↓  re-analyze       score the result the same way
  ↓  correct          if the grade missed its band, one corrective pass — kept only if it
                      actually lands closer to the target
output
```

Naming the measured problems in the prompt is what makes this work. Generic instructions
("write more naturally") don't move the metrics; "8 of 11 sentences open with a stock
transition" does.

## Running it

```bash
npm install
cp .env.example .env.local     # add your ANTHROPIC_API_KEY
npm run dev                    # http://localhost:3000
```

If you've already run `ant auth login`, the SDK picks up that profile and `.env.local`
can stay empty.

```bash
npm test          # 63 tests over the analyzer, cleanup pass and pipeline orchestration
npm run typecheck
npm run lint
npm run build
```

## Layout

```
app/
  page.tsx                 the studio UI (client)
  api/humanize/route.ts    POST endpoint
lib/
  analysis/
    tokenize.ts            sentence/word/syllable splitting
    readability.ts         FK, Flesch, Fog, SMOG, ARI + grade outliers
    lexicon.ts             flagged phrase inventory
    signals.ts             the nine detectors + composite score
  grades.ts                reading-level, voice and depth profiles
  humanize/
    prompt.ts              system prompt + findings brief + correction prompt
    postprocess.ts         deterministic cleanup
    engine.ts              orchestration, model call, correction loop
components/                ScoreDial, SignalList, MetricGrid, Controls
tests/                     node:test suites
```

The model call is injectable (`humanize(req, callModel?)`), which is how the pipeline
tests exercise the whole flow — analysis, prompting, cleanup, re-scoring and the
correction decision — without touching the network.

## Limits

- 4,000 words (or 120,000 characters) per run. Split longer pieces into sections.
- Rewrites preserve facts, paragraph count and approximate length, but **check the output**.
  The metric grid flags word-count drift over 15% precisely because that usually means
  something got dropped.
- **English only, for the metrics.** Word and sentence counts are correct for any script,
  but every readability formula here counts English syllables and the phrase lexicon is
  English. Text that is mostly outside the Latin alphabet gets an explicit warning in the
  UI rather than a confident-looking grade that means nothing.
- The syllable counter is heuristic. It's consistent, which is what the readability
  formulas need, but it isn't a pronunciation dictionary.
- Signal thresholds are calibrated by hand against sample prose, not fit to a labelled
  corpus. They separate the built-in samples cleanly, but they're judgement calls.
