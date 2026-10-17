import "server-only";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

/**
 * R2 credentials, read at request time so builds (CI, previews) do not need them.
 * Null when any value is missing; the media routes then answer 503.
 */
export function r2Config(): R2Config | null {
  const config = {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
  };
  if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucket) {
    return null;
  }
  return config as R2Config;
}
