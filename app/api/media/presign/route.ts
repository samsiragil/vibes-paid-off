import { z } from "zod";
import { isAcceptedImageType, MAX_MEDIA_PER_PROJECT, MAX_UPLOAD_BYTES } from "@/lib/media/limits";
import {
  consumeMediaQuota,
  currentUserClient,
  isSameOrigin,
  mediaError,
  projectMediaQuota,
} from "@/lib/media/server";
import { presignPut } from "@/lib/r2/client";
import { r2Config } from "@/lib/r2/env";
import { tmpKey } from "@/lib/r2/keys";

const schema = z.object({
  projectId: z.uuid(),
  contentType: z.string(),
  size: z.number().int().positive(),
});

/**
 * Step 2 of §2.4: checks login, ownership and the 3-image quota, then hands out a presigned PUT
 * to tmp/{userId}/{uuid} so the browser uploads straight to R2.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return mediaError("forbidden", 403);
  const user = await currentUserClient();
  if (!user) return mediaError("unauthorized", 401);

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return mediaError("invalid", 400);
  const { projectId, contentType, size } = body.data;

  if (!isAcceptedImageType(contentType)) return mediaError("unsupported_type", 415);
  if (size > MAX_UPLOAD_BYTES) return mediaError("too_large", 413);
  if (!r2Config()) return mediaError("unavailable", 503);

  const { canEdit, count } = await projectMediaQuota(user.supabase, projectId);
  if (!canEdit) return mediaError("forbidden", 403);
  if (count >= MAX_MEDIA_PER_PROJECT) return mediaError("limit", 409);

  try {
    if (!(await consumeMediaQuota(user.supabase, "presign"))) return mediaError("rate_limit", 429);
    const key = tmpKey(user.userId);
    const url = await presignPut(key, contentType, size);
    return Response.json({ key, url });
  } catch (error) {
    console.error("media presign failed", error);
    return mediaError("failed", 500);
  }
}
