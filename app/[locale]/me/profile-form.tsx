"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { updateProfile, type ProfileFormState } from "@/lib/profiles/actions";
import { cn } from "@/lib/cn";
import {
  PROFILE_LIMITS,
  profileFieldErrors,
  profileSchema,
  readProfileForm,
  type ProfileFormValues,
  type ProfileInput,
} from "@/lib/validation/profile";

const LINK_FIELDS = ["github", "linkedin", "x", "website"] as const;

/** "Edit profil" on /me: the public profile fields (photo comes from the OAuth account, Q14). */
export function ProfileForm({
  initialValues,
  profileHost,
}: {
  initialValues: ProfileFormValues;
  /** "jadinya.dev/u/" shown in front of the username. */
  profileHost: string;
}) {
  const t = useTranslations("me.profileForm");
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState(
    async (previous: ProfileFormState, formData: FormData): Promise<ProfileFormState> => {
      // Same rules in the browser first, so obvious mistakes skip the round trip.
      const values = readProfileForm(formData);
      const parsed = profileSchema.safeParse(values);
      if (!parsed.success) {
        return {
          status: "error",
          error: "invalid",
          fieldErrors: profileFieldErrors(parsed.error),
          values,
        };
      }
      return updateProfile(previous, formData);
    },
    { status: "idle", values: initialValues },
  );

  const errors = state.fieldErrors ?? {};
  const values = state.values;

  // Move focus to the first invalid field after a failed save.
  useEffect(() => {
    if (state.status !== "error" || !state.fieldErrors) return;
    const first = Object.keys(state.fieldErrors)[0];
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }, [state]);

  const errorText = (field: keyof ProfileInput) => {
    const code = errors[field];
    if (!code) return undefined;
    return code === "too_long" ? t("errors.too_long", { max: maxFor(field) }) : t(`errors.${code}`);
  };
  const describedBy = (field: keyof ProfileInput, hint = false) =>
    errors[field] ? `profile-${field}-error` : hint ? `profile-${field}-hint` : undefined;

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="grid max-w-[900px] gap-x-6 gap-y-[18px] pt-7 sm:grid-cols-2"
    >
      <Field id="profile-displayName" label={t("displayName")} error={errorText("displayName")}>
        <Input
          id="profile-displayName"
          name="displayName"
          defaultValue={values.displayName}
          maxLength={PROFILE_LIMITS.displayName}
          autoComplete="name"
          required
          aria-invalid={Boolean(errors.displayName)}
          aria-describedby={describedBy("displayName")}
        />
      </Field>

      <Field
        id="profile-username"
        label={t("username")}
        hint={t("usernameHint")}
        error={errorText("username")}
      >
        <div
          className={cn(
            "flex h-12 items-center rounded-2xl border border-border-strong bg-surface pl-4 font-mono text-[13px] text-muted transition-colors focus-within:border-accent-text hover:border-ink",
            errors.username && "border-red-700 dark:border-red-400",
          )}
        >
          <span aria-hidden="true" className="max-w-[55%] shrink-0 truncate">
            {profileHost}
          </span>
          <input
            id="profile-username"
            name="username"
            defaultValue={values.username}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            aria-invalid={Boolean(errors.username)}
            aria-describedby={describedBy("username", true)}
            className="h-full min-w-0 grow bg-transparent pr-4 text-ink focus:outline-none"
          />
        </div>
      </Field>

      <Field
        id="profile-bio"
        label={t("bio")}
        hint={t("bioHint", { max: PROFILE_LIMITS.bio })}
        error={errorText("bio")}
        className="sm:col-span-2"
      >
        <Textarea
          id="profile-bio"
          name="bio"
          rows={3}
          defaultValue={values.bio}
          maxLength={PROFILE_LIMITS.bio}
          placeholder={t("bioPlaceholder")}
          aria-invalid={Boolean(errors.bio)}
          aria-describedby={describedBy("bio", true)}
          className="min-h-24 resize-y"
        />
      </Field>

      <Field id="profile-location" label={t("location")} error={errorText("location")}>
        <Input
          id="profile-location"
          name="location"
          defaultValue={values.location}
          maxLength={PROFILE_LIMITS.location}
          placeholder={t("locationPlaceholder")}
          autoComplete="address-level1"
          aria-invalid={Boolean(errors.location)}
          aria-describedby={describedBy("location")}
        />
      </Field>

      <Field
        id="profile-tipUrl"
        label={t("tipUrl")}
        hint={t("tipUrlHint")}
        error={errorText("tipUrl")}
      >
        <Input
          id="profile-tipUrl"
          name="tipUrl"
          type="url"
          inputMode="url"
          defaultValue={values.tipUrl}
          placeholder="https://saweria.co/…"
          aria-invalid={Boolean(errors.tipUrl)}
          aria-describedby={describedBy("tipUrl", true)}
        />
      </Field>

      {LINK_FIELDS.map((field) => (
        <Field
          key={field}
          id={`profile-${field}`}
          label={t(`links.${field}`)}
          error={errorText(field)}
        >
          <Input
            id={`profile-${field}`}
            name={field}
            type="url"
            inputMode="url"
            defaultValue={values[field]}
            placeholder={t(`linkPlaceholders.${field}`)}
            aria-invalid={Boolean(errors[field])}
            aria-describedby={describedBy(field)}
          />
        </Field>
      ))}

      <p className="text-[13px] text-muted sm:col-span-2">{t("avatarNote")}</p>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:col-span-2 sm:flex-row sm:items-center sm:justify-end">
        <p role="status" className="text-sm text-ink-2 sm:mr-auto">
          {state.status === "saved"
            ? t("saved")
            : state.status === "error" && state.error !== "invalid"
              ? t(`errors.${state.error ?? "failed"}`)
              : ""}
        </p>
        <Button type="reset" variant="outline" size="lg" disabled={pending}>
          {t("cancel")}
        </Button>
        <Button type="submit" variant="accent" size="lg" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

function maxFor(field: keyof ProfileInput) {
  if (field === "displayName") return PROFILE_LIMITS.displayName;
  if (field === "bio") return PROFILE_LIMITS.bio;
  if (field === "location") return PROFILE_LIMITS.location;
  return PROFILE_LIMITS.url;
}
