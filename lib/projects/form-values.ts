import type { ProjectInput } from "@/lib/validation/project";
import type { ContentLang } from "./types";

// What the submit/edit form holds while the maker types: strings as typed, plus stable keys for
// list items. toProjectInput() turns it into the shape projectSchema validates.

export type SessionValues = {
  key: string;
  id?: string;
  label: string;
  durationHours: string;
  prompt: string;
  result: string;
  /** "Ada kendala?" toggle; the challenge text is kept while hidden but not sent. */
  hasChallenge: boolean;
  challenge: string;
  solution: string;
};

export type SuggestionValues = { key: string; name: string; url: string };

export type ProjectFormValues = {
  keyPrompt: string;
  title: string;
  tagline: string;
  description: string;
  liveUrl: string;
  repoUrl: string;
  videoUrl: string;
  category: string;
  contentLang: ContentLang;
  toolIds: number[];
  suggestions: SuggestionValues[];
  sessions: SessionValues[];
  lessons: string;
};

export function newKey() {
  return crypto.randomUUID();
}

export function emptySession(): SessionValues {
  return {
    key: newKey(),
    label: "",
    durationHours: "",
    prompt: "",
    result: "",
    hasChallenge: false,
    challenge: "",
    solution: "",
  };
}

export function emptyFormValues(contentLang: ContentLang): ProjectFormValues {
  return {
    keyPrompt: "",
    title: "",
    tagline: "",
    description: "",
    liveUrl: "",
    repoUrl: "",
    videoUrl: "",
    category: "",
    contentLang,
    toolIds: [],
    suggestions: [],
    sessions: [emptySession()],
    lessons: "",
  };
}

/** "2,5" or "2.5" → 2.5; anything else → NaN (shown as invalid_duration). */
export function parseHours(value: string) {
  const normalized = value.trim().replace(",", ".");
  return normalized === "" ? Number.NaN : Number(normalized);
}

export function toProjectInput(values: ProjectFormValues): ProjectInput {
  return {
    keyPrompt: values.keyPrompt,
    title: values.title,
    tagline: values.tagline,
    description: values.description,
    liveUrl: values.liveUrl,
    repoUrl: values.repoUrl,
    videoUrl: values.videoUrl,
    category: values.category,
    contentLang: values.contentLang,
    toolIds: values.toolIds,
    suggestions: values.suggestions.map(({ name, url }) => ({ name, url })),
    sessions: values.sessions.map((session) => ({
      ...(session.id ? { id: session.id } : {}),
      label: session.label,
      durationHours: parseHours(session.durationHours),
      prompt: session.prompt,
      result: session.result,
      challenge: session.hasChallenge ? session.challenge : "",
      solution: session.hasChallenge ? session.solution : "",
    })),
    lessons: values.lessons,
  };
}

export function fromProjectInput(project: ProjectInput): ProjectFormValues {
  return {
    ...project,
    suggestions: project.suggestions.map((suggestion) => ({ key: newKey(), ...suggestion })),
    sessions: project.sessions.map((session) => ({
      key: session.id ?? newKey(),
      id: session.id,
      label: session.label,
      durationHours: String(session.durationHours),
      prompt: session.prompt,
      result: session.result,
      hasChallenge: session.challenge !== "",
      challenge: session.challenge,
      solution: session.solution,
    })),
  };
}

// Draft of the submit form in localStorage (Q12), so a reload or an expired login does not lose
// the answers. Images are not kept (they are in-memory files until the project exists).

const draftKey = "vpo:submit-draft";
const draftVersion = 1;

type StoredDraft = { v: number; savedAt: number; values: ProjectFormValues };

export function readDraft(): { savedAt: number; values: ProjectFormValues } | null {
  try {
    const raw = window.localStorage.getItem(draftKey);
    if (!raw) return null;
    const draft = JSON.parse(raw) as StoredDraft;
    if (draft.v !== draftVersion || !draft.values || !Array.isArray(draft.values.sessions)) {
      return null;
    }
    return { savedAt: draft.savedAt, values: draft.values };
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
    values.toolIds.length ||
    values.suggestions.length ||
    values.lessons.trim() ||
    values.sessions.some((session) => session.prompt.trim() || session.result.trim()),
  );
}
