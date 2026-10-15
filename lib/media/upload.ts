// Browser side of the image pipeline (§2.4): compress, presign, upload to R2, finalize.
import {
  isAcceptedImageType,
  MAX_IMAGE_SIDE,
  MAX_SOURCE_BYTES,
  MAX_UPLOAD_BYTES,
  type MediaErrorCode,
  type ProjectMedia,
} from "./limits";

export class MediaUploadError extends Error {
  constructor(readonly code: MediaErrorCode) {
    super(code);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Resizes to MAX_IMAGE_SIDE on the longest side and re-encodes (WebP, or JPEG where the browser
 * cannot encode WebP), which also drops EXIF. The server re-encodes again; this only keeps the
 * upload small.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (!isAcceptedImageType(file.type)) throw new MediaUploadError("unsupported_type");
  if (file.size > MAX_SOURCE_BYTES) throw new MediaUploadError("too_large");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new MediaUploadError("invalid_image");
  }

  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new MediaUploadError("failed");
  // Transparent areas become white instead of black in JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const webp = await toBlob(canvas, "image/webp", 0.9);
  const blob = webp?.type === "image/webp" ? webp : await toBlob(canvas, "image/jpeg", 0.9);
  if (!blob) throw new MediaUploadError("invalid_image");
  if (blob.size > MAX_UPLOAD_BYTES) throw new MediaUploadError("too_large");
  return blob;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new MediaUploadError("failed");
  }
  const json = (await response.json().catch(() => ({}))) as { error?: MediaErrorCode };
  if (!response.ok) throw new MediaUploadError(json.error ?? "failed");
  return json as T;
}

/** PUT with upload progress (fetch has no upload progress events). */
function putWithProgress(url: string, blob: Blob, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", blob.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new MediaUploadError("failed"));
    request.onerror = () => reject(new MediaUploadError("failed"));
    request.send(blob);
  });
}

export type UploadPhase = "uploading" | "processing";

/** Uploads one compressed image to a project and returns the stored image. */
export async function uploadProjectImage(
  projectId: string,
  blob: Blob,
  onProgress: (phase: UploadPhase, fraction: number) => void,
): Promise<ProjectMedia> {
  const { key, url } = await postJson<{ key: string; url: string }>("/api/media/presign", {
    projectId,
    contentType: blob.type,
    size: blob.size,
  });
  onProgress("uploading", 0);
  await putWithProgress(url, blob, (fraction) => onProgress("uploading", fraction));
  onProgress("processing", 1);
  return postJson<ProjectMedia>("/api/media/finalize", { projectId, key });
}
