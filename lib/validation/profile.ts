import { z } from "zod";
import { usernamePattern } from "@/app/[locale]/onboarding/username";
import {
  parseSocial,
  PROFILE_LINK_KEYS,
  SOCIAL_KEYS,
  socialInputValue,
  type SocialKey,
} from "@/lib/profiles/social";
import { httpsUrlPattern } from "./project";

// Profile rules shared by the "Edit profil" form (browser) and the updateProfile action
// (server). They mirror the profiles check constraints, which stay the final word.
// Error messages are codes; the form shows them as me.profileForm.errors.<code>.

export const PROFILE_LIMITS = {
  displayName: 60,
  bio: 280,
  location: 60,
  url: 500,
} as const;

export type ProfileErrorCode =
  "required" | "too_long" | "invalid_url" | "invalid_username" | "invalid_handle" | "invalid";

const error = (code: ProfileErrorCode) => ({ error: code });

const text = (max: number) => z.string().trim().max(max, error("too_long"));

const optionalHttpsUrl = z
  .string()
  .trim()
  .max(PROFILE_LIMITS.url, error("too_long"))
  .refine((value) => value === "" || httpsUrlPattern.test(value), error("invalid_url"));

/** A username (or pasted profile link) for one platform, stored as the full https link. */
const social = (key: SocialKey) =>
  z
    .string()
    .trim()
    .max(PROFILE_LIMITS.url, error("too_long"))
    .transform((value, context) => {
      const parsed = parseSocial(key, value);
      if (parsed.ok) return parsed.url;
      context.addIssue({ code: "custom", message: "invalid_handle" });
      return z.NEVER;
    });

export const profileSchema = z.object({
  displayName: text(PROFILE_LIMITS.displayName).min(1, error("required")),
  username: z.string().trim().toLowerCase().regex(usernamePattern, error("invalid_username")),
  bio: text(PROFILE_LIMITS.bio),
  location: text(PROFILE_LIMITS.location),
  tipUrl: optionalHttpsUrl,
  github: social("github"),
  linkedin: social("linkedin"),
  x: social("x"),
  threads: social("threads"),
  instagram: social("instagram"),
  tiktok: social("tiktok"),
  website: optionalHttpsUrl,
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const PROFILE_FIELDS = [
  "displayName",
  "username",
  "bio",
  "location",
  "tipUrl",
  "github",
  "linkedin",
  "x",
  "threads",
  "instagram",
  "tiktok",
  "website",
] as const satisfies readonly (keyof ProfileInput)[];

/** Raw form values (strings, untrimmed), as the form shows them. */
export type ProfileFormValues = Record<keyof ProfileInput, string>;

export function readProfileForm(formData: FormData): ProfileFormValues {
  return Object.fromEntries(
    PROFILE_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as ProfileFormValues;
}

/** Field → first error code. */
export type ProfileFieldErrors = Partial<Record<keyof ProfileInput, ProfileErrorCode | "taken">>;

const knownCodes = new Set<string>([
  "required",
  "too_long",
  "invalid_url",
  "invalid_username",
  "invalid_handle",
]);

export function profileFieldErrors(zodError: z.ZodError): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};
  for (const issue of zodError.issues) {
    const field = issue.path[0] as keyof ProfileInput;
    if (errors[field]) continue;
    errors[field] = knownCodes.has(issue.message) ? (issue.message as ProfileErrorCode) : "invalid";
  }
  return errors;
}

/** The row update for public.profiles (empty optional fields become null). */
export function toProfileUpdate(profile: ProfileInput) {
  const links = Object.fromEntries(
    PROFILE_LINK_KEYS.flatMap((key) => (profile[key] ? [[key, profile[key]]] : [])),
  );
  return {
    display_name: profile.displayName,
    username: profile.username,
    bio: profile.bio || null,
    location: profile.location || null,
    tip_url: profile.tipUrl || null,
    links,
  };
}

/** Saved values back in the form's shape (links shown as usernames again). */
export function toProfileFormValues(profile: ProfileInput): ProfileFormValues {
  const values = Object.fromEntries(
    PROFILE_FIELDS.map((field) => [field, profile[field]]),
  ) as ProfileFormValues;
  for (const key of SOCIAL_KEYS) values[key] = socialInputValue(key, profile[key]);
  return values;
}
