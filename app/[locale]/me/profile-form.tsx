"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, PrefixInput, Textarea } from "@/components/ui/field";
import { updateProfile, type ProfileFormState } from "@/lib/profiles/actions";
import { SOCIAL_KEYS, socialPrefix, tidySocialInput } from "@/lib/profiles/social";
import {
  PROFILE_LIMITS,
  profileFieldErrors,
  profileSchema,
  readProfileForm,
  type ProfileFormValues,
  type ProfileInput,
} from "@/lib/validation/profile";

/** "Edit profil" on /me: the public profile fields. The photo has its own uploader above. */
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
        <PrefixInput
          prefix={profileHost}
          id="profile-username"
          name="username"
          defaultValue={values.username}
          maxLength={20}
          required
          aria-invalid={Boolean(errors.username)}
          aria-describedby={describedBy("username", true)}
        />
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

      <fieldset className="grid gap-x-6 gap-y-[18px] border-t border-border pt-6 sm:col-span-2 sm:grid-cols-2">
        <legend className="float-left mb-1 text-base font-semibold text-ink sm:col-span-2">
          {t("linksTitle")}
          <span className="mt-1 block text-sm font-normal text-muted">{t("linksHint")}</span>
        </legend>

        {SOCIAL_KEYS.map((key) => (
          <Field key={key} id={`profile-${key}`} label={t(`links.${key}`)} error={errorText(key)}>
            <PrefixInput
              prefix={socialPrefix(key)}
              id={`profile-${key}`}
              name={key}
              defaultValue={values[key]}
              maxLength={PROFILE_LIMITS.url}
              placeholder={t("usernamePlaceholder")}
              onBlur={(event) => {
                event.currentTarget.value = tidySocialInput(key, event.currentTarget.value);
              }}
              aria-invalid={Boolean(errors[key])}
              aria-describedby={describedBy(key)}
            />
          </Field>
        ))}

        <Field
          id="profile-website"
          label={t("links.website")}
          error={errorText("website")}
          className="sm:col-span-2"
        >
          <Input
            id="profile-website"
            name="website"
            type="url"
            inputMode="url"
            defaultValue={values.website}
            placeholder="https://…"
            aria-invalid={Boolean(errors.website)}
            aria-describedby={describedBy("website")}
          />
        </Field>
      </fieldset>

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
