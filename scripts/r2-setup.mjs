// One-off bucket setup for media uploads (Fase 3, §2.4). Safe to run again; it replaces both
// configurations with the ones below.
//
//   pnpm r2:setup            # apply lifecycle + CORS, then print what the bucket has
//   pnpm r2:setup --check    # only print the current configuration
//
// Reads R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET from .env.local.
// The R2 API token needs "Admin Read & Write" for bucket settings (object-only tokens get 403).
// R2_CORS_ORIGINS (comma-separated) overrides the default list of sites allowed to upload.
import {
  GetBucketCorsCommand,
  GetBucketLifecycleConfigurationCommand,
  PutBucketCorsCommand,
  PutBucketLifecycleConfigurationCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error("Missing R2_* values. Fill them in .env.local first.");
  process.exit(1);
}

const origins = (
  process.env.R2_CORS_ORIGINS ??
  "http://localhost:3000,https://vibes-paid-off.vercel.app,https://dev-vibes-paid-off.vercel.app"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

if (!process.argv.includes("--check")) {
  // Replaces every lifecycle rule on the bucket, so R2's default multipart-abort rule is kept here.
  await client.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: R2_BUCKET,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: "expire-tmp-uploads",
            Status: "Enabled",
            Filter: { Prefix: "tmp/" },
            Expiration: { Days: 1 },
          },
          {
            ID: "abort-incomplete-multipart",
            Status: "Enabled",
            Filter: { Prefix: "" },
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
          },
        ],
      },
    }),
  );

  // Browsers PUT straight to R2 with a presigned URL; nothing else is allowed cross-origin.
  await client.send(
    new PutBucketCorsCommand({
      Bucket: R2_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ["PUT"],
            AllowedHeaders: ["content-type"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.log(`Applied lifecycle and CORS to ${R2_BUCKET}.`);
}

const lifecycle = await client.send(
  new GetBucketLifecycleConfigurationCommand({ Bucket: R2_BUCKET }),
);
const cors = await client.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET }));
console.log(JSON.stringify({ lifecycle: lifecycle.Rules, cors: cors.CORSRules }, null, 2));
