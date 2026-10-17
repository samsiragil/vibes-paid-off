import Image, { type ImageProps } from "next/image";
import { mediaUrl } from "@/lib/media/url";

/**
 * A stored project image, served straight from the public R2 domain. Always `unoptimized`:
 * the files are already resized WebP, and Vercel's image optimizer is off-limits (§1).
 */
export function MediaImage({
  mediaKey,
  alt,
  ...props
}: Omit<ImageProps, "src" | "unoptimized" | "loader"> & { mediaKey: string }) {
  return <Image src={mediaUrl(mediaKey)} alt={alt} unoptimized {...props} />;
}
