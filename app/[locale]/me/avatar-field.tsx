"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { removeAvatar, uploadAvatar, type AvatarError } from "@/lib/profiles/avatar-actions";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/media/limits";
import { compressAvatar, MediaUploadError } from "@/lib/media/upload";

type Status =
  | { kind: "idle" }
  | { kind: "saved" | "removed" }
  | { kind: "error"; error: AvatarError | "unsupported_type" };

/** "Foto profil" on /me: saved on its own, right after a photo is picked. */
export function AvatarField({
  name,
  initialUrl,
  initialUploaded,
}: {
  name: string;
  initialUrl: string | null;
  /** The current photo was uploaded here (not the sign-in account's photo). */
  initialUploaded: boolean;
}) {
  const t = useTranslations("me.profileForm.avatar");
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState({ url: initialUrl, uploaded: initialUploaded });
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [action, setAction] = useState<"upload" | "remove" | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (
    kind: "upload" | "remove",
    task: () => Promise<Awaited<ReturnType<typeof removeAvatar>>>,
  ) => {
    setAction(kind);
    startTransition(async () => {
      try {
        const result = await task();
        if (result.ok) {
          setAvatar({ url: result.avatarUrl, uploaded: result.uploaded });
          setStatus({ kind: kind === "upload" ? "saved" : "removed" });
        } else {
          setStatus({ kind: "error", error: result.error });
        }
      } catch (error) {
        const code = error instanceof MediaUploadError ? error.code : "failed";
        setStatus({
          kind: "error",
          error:
            code === "unsupported_type" || code === "too_large" || code === "invalid_image"
              ? code
              : "failed",
        });
      }
    });
  };

  const onPick = (file: File | undefined) => {
    if (!file) return;
    run("upload", async () => {
      const formData = new FormData();
      formData.set("photo", await compressAvatar(file));
      return uploadAvatar(formData);
    });
    // Picking the same file again should upload again.
    if (inputRef.current) inputRef.current.value = "";
  };

  const message =
    status.kind === "error"
      ? t(`errors.${status.error}`)
      : status.kind === "idle"
        ? ""
        : t(status.kind);

  return (
    <section
      aria-labelledby="profile-avatar-label"
      className="flex max-w-[900px] items-start gap-5 pt-7 sm:items-center"
    >
      <Avatar name={name} src={avatar.url} size="lg" />
      <div className="flex min-w-0 flex-col gap-2">
        <h2 id="profile-avatar-label" className="text-[13px] leading-4 font-semibold text-ink">
          {t("label")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            id="profile-avatar"
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => onPick(event.currentTarget.files?.[0])}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            aria-describedby="profile-avatar-hint"
            onClick={() => inputRef.current?.click()}
          >
            {pending && action === "upload"
              ? t("uploading")
              : avatar.url
                ? t("change")
                : t("upload")}
          </Button>
          {avatar.uploaded ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => run("remove", removeAvatar)}
            >
              {pending && action === "remove" ? t("removing") : t("remove")}
            </Button>
          ) : null}
        </div>
        <p id="profile-avatar-hint" className="text-sm leading-5 text-muted">
          {avatar.uploaded || !avatar.url ? t("hint") : `${t("hintOauth")} ${t("hint")}`}
        </p>
        <p
          role="status"
          className={status.kind === "error" ? "text-sm text-danger" : "text-sm text-ink-2"}
        >
          {message}
        </p>
      </div>
    </section>
  );
}
