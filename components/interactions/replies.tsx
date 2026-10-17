"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { Turnstile, type TurnstileHandle } from "@/components/project/turnstile";
import { Avatar } from "@/components/ui/avatar";
import { buttonStyles } from "@/components/ui/button";
import {
  deleteReply,
  postReply,
  type DeleteReplyResult,
  type PostReplyResult,
} from "@/lib/interactions/actions";
import type { ReplyView } from "@/lib/interactions/replies";
import { REPLY_MAX } from "@/lib/validation/interactions";
import { ReportButton } from "./report-button";

/** Who is looking: decides between the reply form, a login link, and per-reply actions. */
export type ReplyViewer =
  | { kind: "loading" }
  | { kind: "anon"; loginHref: string }
  | { kind: "needs_username"; id: string; onboardingHref: string }
  | { kind: "user"; id: string };

const actionClass =
  "inline-flex min-h-11 items-center px-1 text-xs text-muted sm:min-h-8 underline-offset-2 hover:text-ink hover:underline";

/**
 * "Balasan" under a project (VPO-Proyek): one level of replies as chat bubbles, the reply form,
 * and per reply "Laporkan" (or "Hapus" on your own). The list comes from the shared cache;
 * replies posted or deleted here show at once and the server refresh confirms them.
 */
export function RepliesSection({
  projectId,
  ownerId,
  replies,
  viewer,
  turnstileSiteKey,
}: {
  projectId: string;
  ownerId: string;
  replies: ReplyView[];
  viewer: ReplyViewer;
  turnstileSiteKey: string | null;
}) {
  const t = useTranslations("interactions.replies");
  const [added, setAdded] = useState<ReplyView[]>([]);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const headingId = useId();

  const known = new Set(replies.map((reply) => reply.id));
  const list = [...replies, ...added.filter((reply) => !known.has(reply.id))].filter(
    (reply) => !removed.has(reply.id),
  );
  const viewerId = viewer.kind === "user" || viewer.kind === "needs_username" ? viewer.id : null;

  return (
    <section
      id="balasan"
      aria-labelledby={headingId}
      className="flex scroll-mt-24 flex-col gap-4 pt-6"
    >
      <h2 id={headingId} className="text-xl font-semibold">
        {t("title")}{" "}
        <span className="font-mono text-sm font-normal text-muted tabular-nums">{list.length}</span>
      </h2>

      {list.length === 0 ? (
        <p className="text-[15px] text-muted">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {list.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              isMaker={reply.author.id === ownerId}
              isOwn={reply.author.id === viewerId}
              viewer={viewer}
              onDeleted={() => setRemoved((current) => new Set(current).add(reply.id))}
            />
          ))}
        </ol>
      )}

      {viewer.kind === "user" ? (
        <ReplyForm
          projectId={projectId}
          turnstileSiteKey={turnstileSiteKey}
          onPosted={(reply) => setAdded((current) => [...current, reply])}
        />
      ) : viewer.kind === "loading" ? (
        <div
          aria-hidden="true"
          className="mt-2 h-[58px] rounded-[29px] border border-border bg-surface"
        />
      ) : (
        <p className="mt-2 flex min-h-[58px] flex-wrap items-center justify-between gap-3 rounded-[29px] border border-border-strong bg-surface py-2 pr-2 pl-5 text-[15px] text-ink-2">
          <span>{viewer.kind === "anon" ? t("loginPrompt") : t("usernamePrompt")}</span>
          <a
            href={viewer.kind === "anon" ? viewer.loginHref : viewer.onboardingHref}
            className={buttonStyles({ variant: "primary", className: "h-[42px]" })}
          >
            {viewer.kind === "anon" ? t("login") : t("pickUsername")}
          </a>
        </p>
      )}
    </section>
  );
}

function ReplyItem({
  reply,
  isMaker,
  isOwn,
  viewer,
  onDeleted,
}: {
  reply: ReplyView;
  isMaker: boolean;
  isOwn: boolean;
  viewer: ReplyViewer;
  onDeleted: () => void;
}) {
  const t = useTranslations("interactions.replies");
  const format = useFormatter();
  const date = new Date(reply.createdAt);

  return (
    <li className="flex items-end gap-3">
      <Avatar
        name={reply.author.displayName}
        src={reply.author.avatarUrl}
        size="sm"
        className="mb-6 hidden sm:inline-flex"
      />
      <div className="max-w-full min-w-0 sm:max-w-[76%]">
        <p className="mb-1 ml-1 flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
          <Link
            href={`/u/${reply.author.username}`}
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            {reply.author.displayName}
          </Link>
          {isMaker ? <span className="font-mono text-accent-text">{t("maker")}</span> : null}
          <time dateTime={reply.createdAt}>{format.dateTime(date, { dateStyle: "medium" })}</time>
        </p>
        <div className="rounded-[18px] rounded-bl-md border border-border bg-surface px-4 py-3 text-[15px] leading-normal break-words whitespace-pre-line">
          {reply.body}
        </div>
        <div className="ml-1">
          {isOwn ? (
            <DeleteReplyButton replyId={reply.id} onDeleted={onDeleted} />
          ) : viewer.kind === "anon" ? (
            <a href={viewer.loginHref} className={actionClass}>
              {t("report")}
            </a>
          ) : viewer.kind === "loading" ? null : (
            <ReportButton targetType="comment" targetId={reply.id} className={actionClass} />
          )}
        </div>
      </div>
    </li>
  );
}

function DeleteReplyButton({ replyId, onDeleted }: { replyId: string; onDeleted: () => void }) {
  const t = useTranslations("interactions.replies");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<Exclude<DeleteReplyResult, { ok: true }>["error"] | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteReply(replyId);
      // Already gone (deleted in another tab) counts as done.
      if (result.ok || result.error === "not_found") onDeleted();
      else {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setConfirming(true)}
          className={actionClass}
        >
          {t("delete")}
        </button>
        {error ? (
          <span role="alert" className="ml-2 text-xs text-red-700 dark:text-red-400">
            {t(`errors.${error}`)}
          </span>
        ) : null}
      </>
    );
  }

  return (
    <span
      role="group"
      aria-label={t("deleteConfirm")}
      onKeyDown={(event) => {
        if (event.key === "Escape") setConfirming(false);
      }}
      className="inline-flex flex-wrap items-center gap-2 text-xs text-ink-2"
    >
      {t("deleteConfirm")}
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className={buttonStyles({ variant: "ghost", size: "sm", className: "h-9 px-2.5 text-xs" })}
      >
        {t("cancel")}
      </button>
      <button
        ref={confirmRef}
        type="button"
        disabled={pending}
        onClick={remove}
        className={buttonStyles({ variant: "primary", size: "sm", className: "h-9 px-3 text-xs" })}
      >
        {pending ? t("deleting") : t("deleteYes")}
      </button>
    </span>
  );
}

function ReplyForm({
  projectId,
  turnstileSiteKey,
  onPosted,
}: {
  projectId: string;
  turnstileSiteKey: string | null;
  onPosted: (reply: ReplyView) => void;
}) {
  const t = useTranslations("interactions.replies");
  const locale = useLocale();
  const inputId = useId();
  const [body, setBody] = useState("");
  const [error, setError] = useState<
    | Exclude<PostReplyResult, { ok: true }>["error"]
    | "too_long"
    | "required"
    | "captcha_needed"
    | null
  >(null);
  // The widget loads only once someone starts writing, not for every visitor of the page.
  const [wantsCaptcha, setWantsCaptcha] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const [pending, startTransition] = useTransition();

  const trimmed = body.trim();
  const tooLong = trimmed.length > REPLY_MAX;

  function submit() {
    if (pending) return;
    if (!trimmed) return setError("required");
    if (tooLong) return setError("too_long");
    if (turnstileSiteKey && !turnstileToken) return setError("captcha_needed");
    setError(null);

    startTransition(async () => {
      const result = await postReply({
        projectId,
        body: trimmed,
        turnstileToken: turnstileToken ?? undefined,
      });
      // Tokens are single use.
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      if (result.ok) {
        onPosted(result.reply);
        setBody("");
      } else {
        setError(result.fieldError ?? result.error);
      }
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="mt-2 flex flex-col gap-2"
    >
      <div className="flex items-end gap-3 rounded-[29px] border border-border-strong bg-surface py-2 pr-2 pl-5 transition-colors focus-within:border-accent-text">
        <label htmlFor={inputId} className="sr-only">
          {t("label")}
        </label>
        <textarea
          id={inputId}
          rows={1}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onFocus={() => setWantsCaptcha(true)}
          onKeyDown={(event) => {
            // Enter adds a line; Ctrl/Cmd+Enter sends.
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              submit();
            }
          }}
          aria-invalid={error === "too_long" || error === "required" ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          placeholder={t("placeholder")}
          className="field-sizing-content max-h-60 min-h-[42px] min-w-0 grow resize-none bg-transparent py-[9px] text-[15px] leading-normal text-ink placeholder:text-muted focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className={buttonStyles({ variant: "primary", className: "h-[42px] px-[18px]" })}
        >
          {pending ? t("sending") : t("send")}
        </button>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-2">
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-[13px] text-red-700 dark:text-red-400"
        >
          {error ? t(`errors.${error}`) : ""}
        </p>
        {trimmed.length > REPLY_MAX - 100 ? (
          <span
            className={`font-mono text-xs ${tooLong ? "text-red-700 dark:text-red-400" : "text-muted"}`}
          >
            {trimmed.length}/{REPLY_MAX}
          </span>
        ) : null}
      </div>
      {turnstileSiteKey && wantsCaptcha ? (
        <div className="px-2">
          <Turnstile
            ref={turnstileRef}
            siteKey={turnstileSiteKey}
            language={locale}
            onToken={setTurnstileToken}
          />
        </div>
      ) : null}
    </form>
  );
}
