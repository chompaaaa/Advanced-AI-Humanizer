import { DEFAULT_GRADE_ID } from "@/lib/grades";
import { DEFAULT_MODULE_ID, getModule } from "@/lib/modules";

/**
 * Everything the user can configure. Persisted to localStorage, so the shape
 * is versioned by the storage key rather than migrated in place.
 */
export interface Settings {
  moduleId: string;
  gradeId: string;
  intensityId: string;
  preserveFormatting: boolean;
  autoCorrect: boolean;
  customInstructions: string;
}

export const DEFAULT_SETTINGS: Settings = {
  moduleId: DEFAULT_MODULE_ID,
  gradeId: DEFAULT_GRADE_ID,
  intensityId: getModule(DEFAULT_MODULE_ID).defaults.intensityId,
  preserveFormatting: true,
  autoCorrect: getModule(DEFAULT_MODULE_ID).defaults.autoCorrect,
  customInstructions: "",
};

/**
 * Switching module adopts that module's defaults for depth and auto-correct.
 * The grade and any typed direction are the user's, so they carry over.
 */
export function applyModule(settings: Settings, moduleId: string): Settings {
  const target = getModule(moduleId);
  return {
    ...settings,
    moduleId,
    intensityId: target.defaults.intensityId,
    autoCorrect: target.defaults.autoCorrect,
  };
}

/** Count of settings differing from the active module's defaults, for the gear badge. */
export function changedFromDefaults(settings: Settings): number {
  const active = getModule(settings.moduleId);
  let n = 0;
  if (settings.intensityId !== active.defaults.intensityId) n += 1;
  if (settings.autoCorrect !== active.defaults.autoCorrect) n += 1;
  if (!settings.preserveFormatting) n += 1;
  if (settings.customInstructions.trim()) n += 1;
  return n;
}
