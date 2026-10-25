// Profile links as the "Edit profil" form shows them: a username for each social platform and a
// full URL for the website. profiles.links keeps full https URLs either way, so public pages and
// older rows need no conversion. Shared by the browser and the server.

export const SOCIAL_KEYS = ["github", "linkedin", "x", "threads", "instagram", "tiktok"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export const PROFILE_LINK_KEYS = [...SOCIAL_KEYS, "website"] as const;
export type ProfileLinkKey = (typeof PROFILE_LINK_KEYS)[number];

type Platform = {
  /** Hosts a pasted profile link may use (www. is always accepted too). */
  hosts: string[];
  /** Path before the username, as shown in front of the input and used to build the link. */
  path: string;
  /** Canonical host for links built from a username. */
  host: string;
  pattern: RegExp;
};

const PLATFORMS: Record<SocialKey, Platform> = {
  github: {
    host: "github.com",
    hosts: ["github.com"],
    path: "/",
    pattern: /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i,
  },
  linkedin: {
    host: "www.linkedin.com",
    hosts: ["linkedin.com"],
    path: "/in/",
    pattern: /^[\p{L}\p{N}_-]{3,100}$/u,
  },
  x: {
    host: "x.com",
    hosts: ["x.com", "twitter.com"],
    path: "/",
    pattern: /^\w{1,15}$/,
  },
  threads: {
    host: "www.threads.com",
    hosts: ["threads.com", "threads.net"],
    path: "/@",
    pattern: /^[a-z0-9._]{1,30}$/i,
  },
  instagram: {
    host: "www.instagram.com",
    hosts: ["instagram.com"],
    path: "/",
    pattern: /^[a-z0-9._]{1,30}$/i,
  },
  tiktok: {
    host: "www.tiktok.com",
    hosts: ["tiktok.com"],
    path: "/@",
    pattern: /^[a-z0-9._]{2,24}$/i,
  },
};

/** "github.com/", "linkedin.com/in/", "tiktok.com/@": shown in front of the username input. */
export function socialPrefix(key: SocialKey) {
  const platform = PLATFORMS[key];
  return `${platform.hosts[0]}${platform.path}`;
}

export function socialUrl(key: SocialKey, username: string) {
  const platform = PLATFORMS[key];
  return `https://${platform.host}${platform.path}${username}`;
}

function platformUrl(key: SocialKey, value: string) {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  let host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
  // LinkedIn shares country links such as id.linkedin.com/in/….
  if (key === "linkedin") host = host.replace(/^[a-z]{2}\./, "");
  return PLATFORMS[key].hosts.includes(host) ? url : null;
}

/** The username in a profile link of this platform, or null when it is not one. */
function usernameFromUrl(key: SocialKey, url: URL) {
  const { path, pattern } = PLATFORMS[key];
  const rest = url.pathname.startsWith(path) ? url.pathname.slice(path.length) : "";
  const username = decodeURIComponent(rest.replace(/\/+$/, ""));
  return pattern.test(username) ? username : null;
}

export type SocialParse = { ok: true; url: string } | { ok: false };

/**
 * What a maker typed (a username, "@username" or a pasted profile link) → the link to store.
 * Empty stays empty. An https link on the platform that is not a plain profile link (an older
 * value such as a company page) is kept as typed.
 */
export function parseSocial(key: SocialKey, raw: string): SocialParse {
  const value = raw.trim();
  if (value === "") return { ok: true, url: "" };

  if (value.includes("/") || value.includes(".com") || value.includes(".net")) {
    const url = platformUrl(key, value);
    if (!url) return { ok: false };
    const username = usernameFromUrl(key, url);
    if (username) return { ok: true, url: socialUrl(key, username) };
    return url.protocol === "https:" && value.startsWith("https://")
      ? { ok: true, url: value }
      : { ok: false };
  }

  const username = value.replace(/^@/, "");
  return PLATFORMS[key].pattern.test(username)
    ? { ok: true, url: socialUrl(key, username) }
    : { ok: false };
}

/** A stored link → what the input shows: the username, or the whole link when it has none. */
export function socialInputValue(key: SocialKey, stored: string) {
  if (stored === "") return "";
  const url = platformUrl(key, stored);
  return (url && usernameFromUrl(key, url)) ?? stored;
}

/** On blur: a pasted profile link becomes its username, so the maker sees what gets saved. */
export function tidySocialInput(key: SocialKey, raw: string) {
  const parsed = parseSocial(key, raw);
  return parsed.ok ? socialInputValue(key, parsed.url) : raw.trim();
}
