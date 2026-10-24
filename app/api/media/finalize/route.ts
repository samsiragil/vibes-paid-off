import { revalidateTag } from "next/cache";
import { z } from "zod";
import { LISTINGS_TAG, makerTag, projectTag } from "@/lib/cache-tags";
import { MAX_MEDIA_PER_PROJECT, MAX_UPLOAD_BYTES } from "@/lib/media/limits";
import { encodeWebp, InvalidImageError } from "@/lib/media/process";
import {
  consumeMediaQuota,
  currentUserClient,
  isSameOrigin,
  mediaError,
  projectMediaQuota,
} from "@/lib/media/server";
import { deleteObjects, getObjectBytes, putObject } from "@/lib/r2/client";
import { r2Config } from "@/lib/r2/env";
import { isTmpKeyOf, projectMediaKey } from "@/lib/r2/keys";
import { createAdminClient } from "@/lib/supabase/admin";

// Re-encoding with sharp can take a few seconds for a large photo.
export const maxDuration = 30;

const schema = z.object({
  projectId: z.uuid(),
  key: z.string(),
});

/**
 * Step 4 of §2.4: re-encodes the uploaded tmp object to WebP (no EXIF, ≤300 KB), stores it at
 * p/{projectId}/{uuid}.webp, deletes the tmp object and records the image in project_media.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return mediaError("forbidden", 403);
  const user = await currentUserClient();
  if (!user) return mediaError("unauthorized", 401);

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success || !isTmpKeyOf(user.userId, body.data.key)) return mediaError("invalid", 400);
  const { projectId, key: tmpKey } = body.data;
  if (!r2Config()) return mediaError("unavailable", 503);

  let storedKey: string | undefined;
  let saved = false;
  try {
    const { canEdit, count } = await projectMediaQuota(user.supabase, projectId);
    if (!canEdit) return mediaError("forbidden", 403);
    if (count >= MAX_MEDIA_PER_PROJECT) return mediaError("limit", 409);
    // Counted before the re-encode, so attempts that end in invalid_image use the budget too.
    if (!(await consumeMediaQuota(user.supabase, "finalize"))) return mediaError("rate_limit", 429);

    const original = await getObjectBytes(tmpKey, MAX_UPLOAD_BYTES);
    if (!original) return mediaError("not_found", 404);

    const image = await encodeWebp(original);
    storedKey = projectMediaKey(projectId);
    await putObject(storedKey, image.data, "image/webp");

    const inserted = await insertMedia(projectId, {
      r2_key: storedKey,
      width: image.width,
      height: image.height,
      bytes: image.data.byteLength,
    });
    if (inserted === "limit") return mediaError("limit", 409);

    saved = true;
    // Project page and profile cards show the images; expire now so the owner sees them.
    revalidateTag(projectTag(projectId), { expire: 0 });
    revalidateTag(makerTag(user.userId), { expire: 0 });
    revalidateTag(LISTINGS_TAG, { expire: 0 });
    return Response.json({
      id: inserted.id,
      key: storedKey,
      width: image.width,
      height: image.height,
      bytes: image.data.byteLength,
    });
  } catch (error) {
    if (error instanceof InvalidImageError) return mediaError("invalid_image", 422);
    console.error("media finalize failed", error);
    return mediaError("failed", 500);
  } finally {
    // The tmp object is never needed again; a stored copy is dropped unless its row exists.
    await deleteObjects(saved || !storedKey ? [tmpKey] : [tmpKey, storedKey]).catch((error) =>
      console.error("media cleanup failed", error),
    );
  }
}

type MediaRow = { r2_key: string; width: number; height: number; bytes: number };

/**
 * Inserts the row in the first free position. project_media is not writable by users, so this
 * runs with the secret key after the ownership check above. Two uploads finishing together can
 * race for the same position; the loser retries.
 */
async function insertMedia(projectId: string, row: MediaRow) {
  const admin = createAdminClient();

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: existing, error: readError } = await admin
      .from("project_media")
      .select("sort_order")
      .eq("project_id", projectId);
    if (readError) throw readError;

    const taken = new Set(existing.map((media) => media.sort_order));
    const slot = Array.from({ length: MAX_MEDIA_PER_PROJECT }, (_, index) => index).find(
      (index) => !taken.has(index),
    );
    if (slot === undefined) return "limit" as const;

    const { data, error } = await admin
      .from("project_media")
      .insert({ project_id: projectId, sort_order: slot, ...row })
      .select("id")
      .single();
    if (!error) return data;
    if (error.message.includes("project_media_limit")) return "limit" as const;
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not find a free media position.");
}
