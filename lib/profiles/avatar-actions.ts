"use server";

import { updateTag } from "next/cache";
import { LISTINGS_TAG, makerTag, usernameTag } from "@/lib/cache-tags";
import { MAX_AVATAR_UPLOAD_BYTES, type MediaErrorCode } from "@/lib/media/limits";
import { encodeAvatar, InvalidImageError } from "@/lib/media/process";
import { consumeMediaQuota, currentUserClient } from "@/lib/media/server";
import { mediaKeyOf, mediaUrl } from "@/lib/media/url";
import { deleteObjects, putObject } from "@/lib/r2/client";
import { r2Config } from "@/lib/r2/env";
import { avatarKey, isAvatarKeyOf } from "@/lib/r2/keys";
import { createAdminClient } from "@/lib/supabase/admin";

export type AvatarError = Extract<
  MediaErrorCode,
  "unauthorized" | "too_large" | "invalid_image" | "rate_limit" | "unavailable" | "failed"
>;

export type AvatarResult =
  { ok: true; avatarUrl: string | null; uploaded: boolean } | { ok: false; error: AvatarError };

type User = NonNullable<Awaited<ReturnType<typeof currentUserClient>>>;

/**
 * Points profiles.avatar_url at `avatarUrl` and drops the previous uploaded photo, if any.
 * avatar_url is not writable by users (an arbitrary URL would show on every card), so this uses
 * the secret key, for the signed-in user's own row only.
 */
async function setAvatar({ supabase, userId }: User, avatarUrl: string | null) {
  const { data: before } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", userId)
    .single();

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId);
  if (error) throw error;

  // Maker avatar on the profile, project pages and every card.
  updateTag(makerTag(userId));
  updateTag(LISTINGS_TAG);
  if (before?.username) updateTag(usernameTag(before.username));

  const previousKey = before?.avatar_url ? mediaKeyOf(before.avatar_url) : null;
  if (previousKey && isAvatarKeyOf(userId, previousKey)) {
    await deleteObjects([previousKey]).catch((cause) =>
      console.error("avatar object delete failed", previousKey, cause),
    );
  }
}

/** Saves a new profile photo ("Foto profil" on /me). The browser sends it cropped and small. */
export async function uploadAvatar(formData: FormData): Promise<AvatarResult> {
  const user = await currentUserClient();
  if (!user) return { ok: false, error: "unauthorized" };

  const photo = formData.get("photo");
  if (!(photo instanceof Blob) || photo.size === 0) return { ok: false, error: "invalid_image" };
  if (photo.size > MAX_AVATAR_UPLOAD_BYTES) return { ok: false, error: "too_large" };
  if (!r2Config()) return { ok: false, error: "unavailable" };

  let storedKey: string | undefined;
  try {
    // Shares the hourly re-encode budget with project images.
    if (!(await consumeMediaQuota(user.supabase, "finalize"))) {
      return { ok: false, error: "rate_limit" };
    }
    const image = await encodeAvatar(new Uint8Array(await photo.arrayBuffer()));
    storedKey = avatarKey(user.userId);
    await putObject(storedKey, image, "image/webp");

    const avatarUrl = mediaUrl(storedKey);
    await setAvatar(user, avatarUrl);
    storedKey = undefined;
    return { ok: true, avatarUrl, uploaded: true };
  } catch (error) {
    if (error instanceof InvalidImageError) return { ok: false, error: "invalid_image" };
    console.error("avatar upload failed", error);
    return { ok: false, error: "failed" };
  } finally {
    // Stored but never recorded: remove the orphan.
    if (storedKey) {
      await deleteObjects([storedKey]).catch((cause) =>
        console.error("avatar cleanup failed", cause),
      );
    }
  }
}

/** Goes back to the photo of the GitHub or Google account (or initials when it has none). */
export async function removeAvatar(): Promise<AvatarResult> {
  const user = await currentUserClient();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data } = await user.supabase.auth.getClaims();
  const metadata = (data?.claims?.user_metadata ?? {}) as Record<string, unknown>;
  const accountPhoto = [metadata.avatar_url, metadata.picture].find(
    (value): value is string => typeof value === "string" && value.startsWith("https://"),
  );

  try {
    await setAvatar(user, accountPhoto ?? null);
    return { ok: true, avatarUrl: accountPhoto ?? null, uploaded: false };
  } catch (error) {
    console.error("avatar reset failed", error);
    return { ok: false, error: "failed" };
  }
}
