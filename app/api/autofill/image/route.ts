import { z } from "zod";
import { fetchPublic } from "@/lib/autofill/fetch";
import { isAcceptedImageType, MAX_UPLOAD_BYTES } from "@/lib/media/limits";
import { consumeMediaQuota, currentUserClient, isSameOrigin, mediaError } from "@/lib/media/server";

const schema = z.object({ url: z.url({ protocol: /^https?$/ }).max(2000) });

/**
 * The live page's og:image for the submit form's autofill. The browser cannot fetch it itself
 * (other sites rarely allow CORS), so the server does, with the same public-address rules as the
 * page fetch. The image then goes through the normal uploader: compressed in the browser,
 * re-encoded on finalize.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return mediaError("forbidden", 403);
  const user = await currentUserClient();
  if (!user) return mediaError("unauthorized", 401);

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return mediaError("invalid", 400);

  try {
    if (!(await consumeMediaQuota(user.supabase, "autofill"))) return mediaError("rate_limit", 429);
  } catch (error) {
    console.error("consume_media_quota failed", error);
    return mediaError("failed", 500);
  }

  const image = await fetchPublic(body.data.url, {
    accept: "image/webp,image/png,image/jpeg;q=0.9",
    maxBytes: MAX_UPLOAD_BYTES,
  });
  if (!image) return mediaError("not_found", 404);
  if (!isAcceptedImageType(image.contentType)) return mediaError("unsupported_type", 415);

  return new Response(image.bytes, {
    headers: {
      "content-type": image.contentType,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
