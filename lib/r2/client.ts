import "server-only";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Config } from "./env";

export class R2NotConfiguredError extends Error {
  constructor() {
    super("R2 is not configured. Fill in the R2_* values in .env.local.");
  }
}

let cached: { client: S3Client; bucket: string } | undefined;

function r2() {
  if (cached) return cached;
  const config = r2Config();
  if (!config) throw new R2NotConfiguredError();

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // Default CRC checksums would be signed into presigned URLs, which browsers cannot satisfy.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  cached = { client, bucket: config.bucket };
  return cached;
}

/**
 * Presigned PUT for one upload. Content type and exact length are signed, so the browser
 * cannot send a different or larger file with the same URL.
 */
export async function presignPut(key: string, contentType: string, contentLength: number) {
  const { client, bucket } = r2();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn: 300, signableHeaders: new Set(["content-type", "content-length"]) },
  );
}

/** The object's bytes, or null when it does not exist or is larger than `maxBytes`. */
export async function getObjectBytes(key: string, maxBytes: number) {
  const { client, bucket } = r2();
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!object.Body || (object.ContentLength ?? 0) > maxBytes) {
      object.Body?.transformToWebStream().cancel();
      return null;
    }
    return await object.Body.transformToByteArray();
  } catch (error) {
    if (error instanceof NoSuchKey) return null;
    throw error;
  }
}

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  const { client, bucket } = r2();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Keys are never reused (a new uuid per image), so the file can be cached forever.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

export async function deleteObjects(keys: string[]) {
  if (keys.length === 0) return;
  const { client, bucket } = r2();
  await client.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
    }),
  );
}
