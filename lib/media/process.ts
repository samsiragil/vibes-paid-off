import "server-only";
import sharp from "sharp";
import { MAX_IMAGE_SIDE, MAX_STORED_BYTES } from "./limits";

export class InvalidImageError extends Error {}

const qualities = [82, 74, 66, 58, 50];
const inputFormats = new Set(["jpeg", "png", "webp"]);

function pipeline(input: Uint8Array, maxSide: number) {
  // rotate() applies the EXIF orientation; output carries no metadata (EXIF, GPS, ICC) by default.
  return sharp(input, { limitInputPixels: 50_000_000, failOn: "error" })
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true });
}

/**
 * Re-encodes an uploaded image to WebP without metadata, lowering the quality (then the size)
 * until it fits in MAX_STORED_BYTES.
 */
export async function encodeWebp(input: Uint8Array) {
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw new InvalidImageError("Unreadable image.");
  }
  if (!format || !inputFormats.has(format)) throw new InvalidImageError(`Unsupported ${format}.`);

  try {
    for (let maxSide = MAX_IMAGE_SIDE; maxSide >= 400; maxSide = Math.round(maxSide * 0.8)) {
      for (const quality of qualities) {
        const { data, info } = await pipeline(input, maxSide)
          .webp({ quality, effort: 4 })
          .toBuffer({ resolveWithObject: true });
        if (data.byteLength <= MAX_STORED_BYTES) {
          return { data: new Uint8Array(data), width: info.width, height: info.height };
        }
      }
    }
  } catch (error) {
    throw new InvalidImageError("Could not decode the image.", { cause: error });
  }
  throw new InvalidImageError("Image does not fit the size budget.");
}
