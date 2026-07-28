/**
 * Modules are the top-level choice: what the engine is trying to achieve.
 *
 * Each one selects a set of transformation stages and the defaults for the
 * secondary controls. Rewrite depth stays available as a dial *within* a
 * module, so "Ghost on Light" and "Fast on Deep" are both reachable.
 */

/** A transformation stage the Rust engine can run. Order is fixed by the engine. */
export type Stage =
  | "normalize"
  | "phrases"
  | "openers"
  | "contractions"
  | "rhythm"
  | "vocabulary"
  | "tricolon";

export interface ModuleDef {
  id: string;
  label: string;
  /** Single glyph for the tab. */
  glyph: string;
  /** One line, shown under the tabs. */
  tagline: string;
  /** Stages this module runs at its default depth. */
  stages: Stage[];
  defaults: {
    intensityId: string;
    autoCorrect: boolean;
  };
  /** Whether the grade control is meaningful for this module. */
  usesGrade: boolean;
}

export const MODULES: ModuleDef[] = [
  {
    id: "fast",
    label: "Fast",
    glyph: "⚡",
    tagline: "One instant pass at the loudest tells. Never restructures sentences.",
    stages: ["normalize", "phrases", "openers"],
    defaults: { intensityId: "light", autoCorrect: false },
    usesGrade: false,
  },
  {
    id: "ghost",
    label: "Ghost",
    glyph: "◍",
    tagline: "Maximum humanization. Rebuilds rhythm and diction as far as it safely can.",
    stages: ["normalize", "phrases", "openers", "contractions", "rhythm", "tricolon", "vocabulary"],
    defaults: { intensityId: "deep", autoCorrect: true },
    usesGrade: true,
  },
  {
    id: "study",
    label: "Study",
    glyph: "◎",
    tagline: "Lands on a target reading level and holds the meaning steady.",
    stages: ["normalize", "phrases", "openers", "rhythm", "vocabulary"],
    defaults: { intensityId: "balanced", autoCorrect: true },
    usesGrade: true,
  },
];

export const DEFAULT_MODULE_ID = "ghost";

export function getModule(id: string): ModuleDef {
  return MODULES.find((m) => m.id === id) ?? MODULES[1];
}

/**
 * Depth narrows or widens a module's stage list. Light drops the structural
 * stages; deep keeps everything the module offers.
 */
const STRUCTURAL: Stage[] = ["rhythm", "tricolon", "vocabulary"];

export function stagesFor(module: ModuleDef, intensityId: string): Stage[] {
  if (intensityId === "light") {
    return module.stages.filter((s) => !STRUCTURAL.includes(s));
  }
  if (intensityId === "balanced") {
    return module.stages.filter((s) => s !== "tricolon");
  }
  return module.stages;
}
