import type { ProjectInput } from "@/lib/validation/project";
import type { BuildEffort, ContentLang } from "./types";

// What the submit/edit form holds while the maker types: strings as typed, plus stable keys for
// list items. toProjectInput() turns it into the shape projectSchema validates.

export type SuggestionValues = { key: string; name: string; url: string };

export type ProjectFormValues = {
  keyPrompt: string;
  title: string;
  tagline: string;
  description: string;
  liveUrl: string;
  repoUrl: string;
  /** The maker confirmed a repo GitHub could not find is private; cleared when the link changes. */
  repoPrivate: boolean;
  videoUrl: string;
  category: string;
  contentLang: ContentLang;
  /** Empty until the maker taps a chip. */
  buildEffort: BuildEffort | "";
  toolIds: number[];
  suggestions: SuggestionValues[];
  momentWow: string;
  momentHardest: string;
  lessons: string;
};

export function newKey() {
  return crypto.randomUUID();
}

export function emptyFormValues(contentLang: ContentLang): ProjectFormValues {
  return {
    keyPrompt: "",
    title: "",
    tagline: "",
    description: "",
    liveUrl: "",
    repoUrl: "",
    repoPrivate: false,
    videoUrl: "",
    category: "",
    contentLang,
    buildEffort: "",
    toolIds: [],
    suggestions: [],
    momentWow: "",
    momentHardest: "",
    lessons: "",
  };
}

/** The form's answers in the shape projectSchema checks (an unpicked effort fails as required). */
export function toProjectInput(
  values: ProjectFormValues,
): Omit<ProjectInput, "buildEffort"> & { buildEffort: BuildEffort | "" } {
  return {
    keyPrompt: values.keyPrompt,
    title: values.title,
    tagline: values.tagline,
    description: values.description,
    liveUrl: values.liveUrl,
    repoUrl: values.repoUrl,
    repoPrivate: values.repoPrivate,
    videoUrl: values.videoUrl,
    category: values.category,
    contentLang: values.contentLang,
    buildEffort: values.buildEffort,
    toolIds: values.toolIds,
    suggestions: values.suggestions.map(({ name, url }) => ({ name, url })),
    momentWow: values.momentWow,
    momentHardest: values.momentHardest,
    lessons: values.lessons,
  };
}

export function fromProjectInput(project: ProjectInput): ProjectFormValues {
  return {
    ...project,
    suggestions: project.suggestions.map((suggestion) => ({ key: newKey(), ...suggestion })),
  };
}

// Draft of the submit form in localStorage (Q12), so a reload or an expired login does not lose
// the answers. Images are not kept (they are in-memory files until the project exists).

const draftKey = "vpo:submit-draft";
// 2: build_effort and story moments replaced build sessions; older drafts are dropped.
// 3: repoPrivate. A version 2 draft is kept, with the repo taken as not private.
const draftVersion = 3;

type StoredDraft = { v: number; savedAt: number; values: ProjectFormValues };

export function readDraft(): { savedAt: number; values: ProjectFormValues } | null {
  try {
    const raw = window.localStorage.getItem(draftKey);
    if (!raw) return null;
    const draft = JSON.parse(raw) as StoredDraft;
    if (
      (draft.v !== draftVersion && draft.v !== 2) ||
      !draft.values ||
      !Array.isArray(draft.values.toolIds)
    ) {
      return null;
    }
    const values = { ...draft.values, repoPrivate: draft.values.repoPrivate === true };
    return { savedAt: draft.savedAt, values };
  } catch {
    return null;
  }
}

export function writeDraft(values: ProjectFormValues) {
  try {
    const draft: StoredDraft = { v: draftVersion, savedAt: Date.now(), values };
    window.localStorage.setItem(draftKey, JSON.stringify(draft));
  } catch {
    // Storage full or blocked (private mode): the form still works, only without a draft.
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(draftKey);
  } catch {
    // See writeDraft.
  }
}

/** True when the form holds anything worth keeping as a draft. */
export function hasContent(values: ProjectFormValues) {
  return Boolean(
    values.keyPrompt.trim() ||
    values.title.trim() ||
    values.tagline.trim() ||
    values.description.trim() ||
    values.liveUrl.trim() ||
    values.repoUrl.trim() ||
    values.buildEffort ||
    values.toolIds.length ||
    values.suggestions.length ||
    values.momentWow.trim() ||
    values.momentHardest.trim() ||
    values.lessons.trim(),
  );
}
