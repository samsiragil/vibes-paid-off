// Media rules shared by the uploader (browser) and the media routes (server). See §2.4.

/** Images per project. The project_media_before_insert trigger enforces the same limit. */
export const MAX_MEDIA_PER_PROJECT = 3;

/** File types a maker can pick. Everything is re-encoded to WebP on the server. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

/** Largest file accepted from the picker, before the browser compresses it. */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

/** Largest (already compressed) upload the presigned URL allows. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Longest side after resizing, in the browser and again on the server. */
export const MAX_IMAGE_SIDE = 1600;

/**
 * Largest side the server decodes. The browser already resized to MAX_IMAGE_SIDE; the slack is
 * for rounding, and keeps a crafted upload from forcing a huge decode.
 */
export const MAX_INPUT_SIDE = 2048;

/** Size budget for the stored WebP. */
export const MAX_STORED_BYTES = 300 * 1024;

export function isAcceptedImageType(type: string): type is AcceptedImageType {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type);
}

/** Error codes returned by /api/media/* and shown by the uploader (messages: media.errors.*). */
export type MediaErrorCode =
  | "unauthorized"
  | "forbidden"
  | "invalid"
  | "limit"
  | "too_large"
  | "unsupported_type"
  | "not_found"
  | "invalid_image"
  | "rate_limit"
  | "unavailable"
  | "failed";

/** An image stored in R2 and recorded in project_media. */
export type ProjectMedia = {
  id: string;
  key: string;
  width: number;
  height: number;
};
