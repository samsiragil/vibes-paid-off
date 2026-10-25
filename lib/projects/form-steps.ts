// The steps of the submit/edit form and which answers each one asks for. No imports, so the unit
// test can load this file with plain Node (see form-steps.test.mjs).

export const FORM_STEPS = ["repo", "intro", "prompt", "build", "story", "review"] as const;

export type FormStep = (typeof FORM_STEPS)[number];

/** Form values (and error paths, which start with them) asked for on each step. */
const stepFields: Record<FormStep, readonly string[]> = {
  repo: ["repoUrl", "liveUrl", "repoPrivate"],
  intro: ["title", "tagline"],
  prompt: ["keyPrompt"],
  build: [
    "buildEffort",
    "toolIds",
    "suggestions",
    "category",
    "contentLang",
    "description",
    "videoUrl",
  ],
  story: ["momentWow", "momentHardest", "lessons"],
  review: [],
};

/** The step that asks for an error path ("suggestions.0.name" belongs to "build"). */
export function stepOf(path: string): FormStep | null {
  for (const step of FORM_STEPS) {
    if (stepFields[step].some((field) => path === field || path.startsWith(`${field}.`))) {
      return step;
    }
  }
  return null;
}

/** Only the errors of one step, so "Lanjut" does not complain about questions still ahead. */
export function errorsOnStep<T>(errors: Record<string, T>, step: FormStep): Record<string, T> {
  return Object.fromEntries(Object.entries(errors).filter(([path]) => stepOf(path) === step));
}

/** The earliest step with an error, or null when there is none. */
export function firstStepWithError(errors: Record<string, unknown>): FormStep | null {
  const steps = new Set(Object.keys(errors).map(stepOf));
  return FORM_STEPS.find((step) => steps.has(step)) ?? null;
}

export function stepIndex(step: FormStep) {
  return FORM_STEPS.indexOf(step);
}
