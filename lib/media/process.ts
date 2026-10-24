import "server-only";
import sharp from "sharp";
import { MAX_IMAGE_SIDE, MAX_INPUT_SIDE, MAX_STORED_BYTES } from "./limits";

export class InvalidImageError extends Error {}

const qualities = [82, 74, 66, 58, 50];
const inputFormats = new Set(["jpeg", "png", "webp"]);

/**
 * Re-encodes an uploaded image to WebP without metadata, lowering the quality (then the size)
 * until it fits in MAX_STORED_BYTES.
 *
 * The upload is decoded once: its dimensions are checked from the header first (the browser
 * already resized it to MAX_IMAGE_SIDE, so anything far larger is refused before decoding), then
 * it is rotated and resized a single time into raw pixels that every quality/size attempt reuses.
 */
export async function encodeWebp(input: Uint8Array) {
  const { format, width, height } = await sharp(input)
    .metadata()
    .catch(() => {
      throw new InvalidImageError("Unreadable image.");
    });
  if (!format || !inputFormats.has(format)) throw new InvalidImageError(`Unsupported ${format}.`);
  if (!width || !height || width > MAX_INPUT_SIDE || height > MAX_INPUT_SIDE) {
    throw new InvalidImageError("Image dimensions out of range.");
  }

  try {
    // rotate() applies the EXIF orientation; output carries no metadata (EXIF, GPS, ICC) by default.
    const base = await sharp(input, {
      limitInputPixels: MAX_INPUT_SIDE * MAX_INPUT_SIDE,
      failOn: "error",
    })
      .rotate()
      .resize({
        width: MAX_IMAGE_SIDE,
        height: MAX_IMAGE_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const raw = { width: base.info.width, height: base.info.height, channels: base.info.channels };

    const encode = async (maxSide: number, quality: number) => {
      const { data, info } = await sharp(base.data, { raw })
        .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      return data.byteLength <= MAX_STORED_BYTES
        ? { data: new Uint8Array(data), width: info.width, height: info.height }
        : null;
    };

    // Per size: the best quality first, then the lowest. Only when the lowest fits are the ones
    // in between tried, so an image that does not fit at this size costs two encodes, not five.
    const best = qualities[0];
    const lowest = qualities[qualities.length - 1];
    for (let maxSide = MAX_IMAGE_SIDE; maxSide >= 400; maxSide = Math.round(maxSide * 0.8)) {
      const first = await encode(maxSide, best);
      if (first) return first;
      const floor = await encode(maxSide, lowest);
      if (!floor) continue;
      for (const quality of qualities.slice(1, -1)) {
        const fitted = await encode(maxSide, quality);
        if (fitted) return fitted;
      }
      return floor;
    }
  } catch (error) {
    throw new InvalidImageError("Could not decode the image.", { cause: error });
  }
  throw new InvalidImageError("Image does not fit the size budget.");
}
