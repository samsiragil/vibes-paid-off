"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { completeOnboarding, type OnboardingState } from "./actions";
import { usernamePattern } from "./username";

type Availability = "idle" | "invalid" | "checking" | "available" | "unavailable";

export function OnboardingForm({
  next,
  initialUsername,
  initialDisplayName,
}: {
  next: string;
  initialUsername: string;
  initialDisplayName: string;
}) {
  const t = useTranslations("onboarding");
  const [state, formAction, saving] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {},
  );
  const [username, setUsername] = useState(state.username ?? initialUsername);
  const [checked, setChecked] = useState<{ name: string; available: boolean } | null>(null);

  const normalized = username.trim().toLowerCase();
  const isValid = usernamePattern.test(normalized);

  // Live availability (format, reserved names, taken), debounced while typing.
  useEffect(() => {
    if (!isValid) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await createClient().rpc("username_available", { name: normalized });
      if (!cancelled && !error) setChecked({ name: normalized, available: Boolean(data) });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalized, isValid]);

  const availability: Availability =
    normalized === ""
      ? "idle"
      : !isValid
        ? "invalid"
        : checked?.name !== normalized
          ? "checking"
          : checked.available
            ? "available"
            : "unavailable";

  const serverError =
    state.error && state.username?.trim().toLowerCase() === normalized
      ? state.error === "taken"
        ? t("unavailable", { username: normalized })
        : state.error === "invalid"
          ? t("invalid")
          : t("error")
      : undefined;

  const usernameError =
    serverError ??
    (availability === "invalid"
      ? t("invalid")
      : availability === "unavailable"
        ? t("unavailable", { username: normalized })
        : undefined);

  const usernameHint =
    availability === "checking"
      ? t("checking")
      : availability === "available"
        ? t("available", { username: normalized })
        : t("usernameHint");

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-[22px] border border-border bg-surface p-5 sm:p-6"
    >
      <input type="hidden" name="next" value={next} />

      <Field id="username" label={t("username")} hint={usernameHint} error={usernameError}>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[15px] text-muted">
            @
          </span>
          <Input
            id="username"
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            required
            aria-invalid={usernameError ? true : undefined}
            aria-describedby={usernameError ? "username-error" : "username-hint"}
            className="pl-8"
          />
        </div>
      </Field>

      <Field id="displayName" label={t("displayName")} hint={t("displayNameHint")}>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={state.displayName ?? initialDisplayName}
          autoComplete="name"
          maxLength={60}
          aria-describedby="displayName-hint"
        />
      </Field>

      {state.error === "unknown" ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {t("error")}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="accent"
        size="lg"
        disabled={saving || availability === "invalid" || availability === "unavailable"}
        className="self-start"
      >
        {saving ? t("saving") : t("submit")}
      </Button>
    </form>
  );
}
