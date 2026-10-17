// Database backups in a private R2 bucket (Fase 9). The weekly workflow (.github/workflows/
// backup.yml) dumps the database with the Supabase CLI and calls `upload`; the other commands are
// for restoring by hand (docs/operations.md).
//
//   pnpm backup:r2 upload <file.tar.gz>     # store under db/, then keep only the newest 8
//   pnpm backup:r2 list                     # newest first
//   pnpm backup:r2 download [key] [dir]     # newest when no key; saved to ./backups by default
//
// Reads R2_ACCOUNT_ID, R2_BACKUP_BUCKET and R2_BACKUP_ACCESS_KEY_ID / R2_BACKUP_SECRET_ACCESS_KEY
// (falling back to R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY). Dumps hold account emails, so the
// bucket must be private: never the media bucket, which is served on a public domain.
import { createWriteStream, mkdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pipeline } from "node:stream/promises";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const PREFIX = "db/";
const KEEP = Number(process.env.BACKUP_KEEP ?? 8);

const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BACKUP_BUCKET;
const accessKeyId = process.env.R2_BACKUP_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_BACKUP_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
  fail("Missing R2_ACCOUNT_ID, R2_BACKUP_BUCKET or R2 backup credentials.");
}
if (bucket === process.env.R2_BUCKET) {
  fail("R2_BACKUP_BUCKET is the public media bucket. Use a separate private bucket for backups.");
}
if (!Number.isInteger(KEEP) || KEEP < 1) fail("BACKUP_KEEP must be a positive integer.");

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const [command, ...rest] = process.argv.slice(2);
switch (command) {
  case "upload":
    await upload(rest[0]);
    break;
  case "list":
    for (const object of await listBackups()) {
      console.log(
        `${object.Key}  ${formatBytes(object.Size)}  ${object.LastModified?.toISOString()}`,
      );
    }
    break;
  case "download":
    await download(rest[0], rest[1] ?? "backups");
    break;
  default:
    fail("Usage: backup-r2.mjs upload <file> | list | download [key] [dir]");
}

async function upload(file) {
  if (!file) fail("upload needs a file.");
  const body = readFileSync(file);
  const key = `${PREFIX}${basename(file)}`;
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "application/gzip" }),
  );
  console.log(`Uploaded ${key} (${formatBytes(body.length)}).`);

  // Names carry a UTC timestamp, so newest first is reverse key order.
  const stale = (await listBackups()).slice(KEEP);
  if (stale.length > 0) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: stale.map(({ Key }) => ({ Key })), Quiet: true },
      }),
    );
    for (const { Key } of stale) console.log(`Deleted old backup ${Key}.`);
  }
  console.log(`Keeping the newest ${KEEP}.`);
}

async function download(key, dir) {
  const target = key ?? (await listBackups())[0]?.Key;
  if (!target) fail("No backups yet.");
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: target }));
  mkdirSync(dir, { recursive: true });
  const path = join(dir, basename(target));
  await pipeline(object.Body, createWriteStream(path));
  console.log(`Saved ${path}.`);
}

async function listBackups() {
  const objects = [];
  let token;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIX, ContinuationToken: token }),
    );
    objects.push(...(page.Contents ?? []));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return objects.sort((a, b) => (a.Key < b.Key ? 1 : -1));
}

function formatBytes(bytes = 0) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
