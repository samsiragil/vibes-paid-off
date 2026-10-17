// @username mentions in replies. Plain text in the database; the reply list turns a mention
// into a profile link only when the username belongs to someone in that conversation (the maker
// or a replier), so a typo or an outsider's name never becomes a link to a wrong profile.
// Usernames follow the profiles rule: ^[a-z0-9_]{3,20}$ (stored case-insensitive).

export type Participant = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type BodySegment =
  { kind: "text"; text: string } | { kind: "mention"; username: string; text: string };

// "@" at the start or after something that is not part of a word or an email ("a@b" stays text).
const mentionPattern = /(^|[^a-z0-9_@.])@([a-z0-9_]{3,20})(?![a-z0-9_])/gi;

/** Splits a reply body into text and mentions of the given (lowercase) usernames. */
export function splitMentions(body: string, usernames: ReadonlySet<string>): BodySegment[] {
  const segments: BodySegment[] = [];
  let last = 0;
  for (const match of body.matchAll(mentionPattern)) {
    const username = match[2].toLowerCase();
    if (!usernames.has(username)) continue;
    const start = match.index + match[1].length;
    if (start > last) segments.push({ kind: "text", text: body.slice(last, start) });
    segments.push({ kind: "mention", username, text: `@${match[2]}` });
    last = start + match[2].length + 1;
  }
  if (last < body.length) segments.push({ kind: "text", text: body.slice(last) });
  return segments;
}

/**
 * The mention being typed right before the caret ("halo @wu|" → start of "@", query "wu"),
 * or null when the caret is not inside one.
 */
export function mentionAtCaret(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const match = /(^|[^a-z0-9_@.])@([a-z0-9_]{0,20})$/i.exec(before);
  if (!match) return null;
  return { start: match.index + match[1].length, query: match[2].toLowerCase() };
}

/** Participants whose username or a word of their name starts with the query, best first. */
export function suggestParticipants(participants: Participant[], query: string, limit = 6) {
  const q = query.toLowerCase();
  const nameMatch = (person: Participant) =>
    person.displayName
      .toLowerCase()
      .split(/\s+/)
      .some((word) => word.startsWith(q));
  return [
    ...participants.filter((person) => person.username.startsWith(q)),
    ...participants.filter((person) => !person.username.startsWith(q) && nameMatch(person)),
  ].slice(0, limit);
}

/** Text with `@username ` put in place of the mention being typed (or added at the end). */
export function insertMention(
  text: string,
  username: string,
  range: { start: number; end: number } | null,
): { text: string; caret: number } {
  const tag = `@${username} `;
  if (range) {
    const next = text.slice(0, range.start) + tag + text.slice(range.end).replace(/^ /, "");
    return { text: next, caret: range.start + tag.length };
  }
  const base = text.replace(/\s+$/, "");
  const next = base ? `${base} ${tag}` : tag;
  return { text: next, caret: next.length };
}
