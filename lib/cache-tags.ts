// Cache tags for public pages ("use cache" scopes). Writers call updateTag/revalidateTag with the
// same helpers, so a tag name is spelled in one place. Ids and usernames only: tags are stored as
// plain text (no secrets or personal data).

/** One project's public detail (content, sessions, media, tools). */
export const projectTag = (projectId: string) => `project:${projectId}`;

/**
 * A project slug lookup, including the "not found" result. Invalidated when a project is saved,
 * so a slug that just got published stops returning the cached 404.
 */
export const projectSlugTag = (slug: string) => `project-slug:${slug}`;

/** Everything shown about a maker: profile, their project list and stats, maker blocks on projects. */
export const makerTag = (profileId: string) => `maker:${profileId}`;

/** A username lookup, including "not found" (a username can be claimed or changed later). */
export const usernameTag = (username: string) => `username:${username.toLowerCase()}`;
