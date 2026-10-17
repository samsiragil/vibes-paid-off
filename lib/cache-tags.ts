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

/** The public replies under one project (posted, deleted or hidden after reports). */
export const repliesTag = (projectId: string) => `replies:${projectId}`;

/** A username lookup, including "not found" (a username can be claimed or changed later). */
export const usernameTag = (username: string) => `username:${username.toLowerCase()}`;

/**
 * Every public list of projects: home (pick, popular, latest), /explore and /tools pages.
 * Invalidated when a published project, its cover, link status or its maker's name changes.
 * Changes made inside the database (votes becoming eligible, auto-hide after reports) show up
 * when the "minutes" cache life runs out.
 */
export const LISTINGS_TAG = "listings";

/** The tools catalog and its per-tool project counts (catalog.ts, /tools pages). */
export const TOOLS_TAG = "tools";
