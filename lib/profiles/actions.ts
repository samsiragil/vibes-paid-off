"use server";

import { updateTag } from "next/cache";
import { LISTINGS_TAG, makerTag, usernameTag } from "@/lib/cache-tags";
import { createClient } from "@/lib/supabase/server";
import {
  PROFILE_FIELDS,
  profileFieldErrors,
  profileSchema,
  readProfileForm,
  toProfileUpdate,
  type ProfileFieldErrors,
  type ProfileFormValues,
} from "@/lib/validation/profile";

export type ProfileFormState = {
  status: "idle" | "saved" | "error";
  error?: "unauthorized" | "invalid" | "failed";
  fieldErrors?: ProfileFieldErrors;
  /** What the form shows next (React resets uncontrolled fields after an action). */
  values: ProfileFormValues;
};

/** Saves the signed-in user's profile ("Edit profil" on /me). RLS limits it to their own row. */
export async function updateProfile(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const values = readProfileForm(formData);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { status: "error", error: "unauthorized", values };

  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      error: "invalid",
      fieldErrors: profileFieldErrors(parsed.error),
      values,
    };
  }

  const { data: before } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  const { error } = await supabase
    .from("profiles")
    .update(toProfileUpdate(parsed.data))
    .eq("id", userId)
    .select("id")
    .single();

  if (error) {
    // 23505: username taken; 23514: a check constraint (reserved username, length, https).
    if (error.code === "23505") {
      return { status: "error", error: "invalid", fieldErrors: { username: "taken" }, values };
    }
    if (error.code === "23514") {
      const field = error.message.includes("username") ? "username" : null;
      return {
        status: "error",
        error: "invalid",
        fieldErrors: field ? { username: "invalid_username" } : undefined,
        values,
      };
    }
    console.error("profile update failed", error);
    return { status: "error", error: "failed", values };
  }

  updateTag(makerTag(userId));
  // Maker name and avatar on cards everywhere.
  updateTag(LISTINGS_TAG);
  updateTag(usernameTag(parsed.data.username));
  if (before?.username && before.username !== parsed.data.username) {
    updateTag(usernameTag(before.username));
  }

  const saved = parsed.data;
  return {
    status: "saved",
    values: Object.fromEntries(
      PROFILE_FIELDS.map((field) => [field, saved[field]]),
    ) as ProfileFormValues,
  };
}
