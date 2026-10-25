// Object key layout in the media bucket (§2.4). tmp/ is emptied by a lifecycle rule after 1 day.

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Where the browser uploads the compressed original. */
export function tmpKey(userId: string) {
  return `tmp/${userId}/${crypto.randomUUID()}`;
}

/** True only for an upload key handed out to this user by `tmpKey`. */
export function isTmpKeyOf(userId: string, key: string) {
  return new RegExp(`^tmp/${userId}/${uuid}$`).test(key);
}

/** Final, public location of a re-encoded image. */
export function projectMediaKey(projectId: string) {
  return `p/${projectId}/${crypto.randomUUID()}.webp`;
}

/** Final, public location of a profile photo. A new key per upload, so caches never go stale. */
export function avatarKey(userId: string) {
  return `a/${userId}/${crypto.randomUUID()}.webp`;
}

/** True only for a profile photo key of this user. */
export function isAvatarKeyOf(userId: string, key: string) {
  return new RegExp(`^a/${userId}/${uuid}\\.webp$`).test(key);
}
