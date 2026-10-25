"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type Ref,
} from "react";
import { Link } from "@/i18n/navigation";
import { Turnstile, type TurnstileHandle } from "@/components/project/turnstile";
import { Avatar } from "@/components/ui/avatar";
import { SystemMessage } from "@/components/ui/bubble";
import { buttonStyles } from "@/components/ui/button";
import {
  deleteReply,
  postReply,
  type DeleteReplyResult,
  type PostReplyResult,
} from "@/lib/interactions/actions";
import {
  insertMention,
  mentionAtCaret,
  splitMentions,
  suggestParticipants,
  type Participant,
} from "@/lib/interactions/mentions";
import type { ReplyView } from "@/lib/interactions/replies";
import { scrollBehavior } from "@/lib/motion";
import { REPLY_MAX } from "@/lib/validation/interactions";
import { ReportButton } from "./report-button";

/** Who is looking: decides between the reply form, a login link, and per-reply actions. */
export type ReplyViewer =
  | { kind: "loading" }
  | { kind: "anon"; loginHref: string }
  | { kind: "needs_username"; id: string; onboardingHref: string }
  | { kind: "user"; id: string };

const actionClass =
  "inline-flex min-h-11 items-center px-1 text-sm text-muted sm:min-h-8 underline-offset-3 hover:text-ink hover:underline";

/**
 * "Balasan" under a project (VPO-Proyek): one flat list of notes at the foot of the page, the reply form,
 * and per reply "Balas" (tags the author), "Laporkan", or "Hapus" on your own. Typing "@" in the
 * form suggests people from this conversation; their @username becomes a profile link. The list
 * comes from the shared cache; replies posted or deleted here show at once.
 */
export function RepliesSection({
  projectId,
  maker,
  replies,
  viewer,
  turnstileSiteKey,
}: {
  projectId: string;
  maker: Participant;
  replies: ReplyView[];
  viewer: ReplyViewer;
  turnstileSiteKey: string | null;
}) {
  const t = useTranslations("interactions.replies");
  const [added, setAdded] = useState<ReplyView[]>([]);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const formRef = useRef<ReplyFormHandle>(null);
  const headingId = useId();

  const known = new Set(replies.map((reply) => reply.id));
  const list = [...replies, ...added.filter((reply) => !known.has(reply.id))].filter(
    (reply) => !removed.has(reply.id),
  );
  const viewerId = viewer.kind === "user" || viewer.kind === "needs_username" ? viewer.id : null;

  // Everyone in this conversation: the maker, then repliers from the latest one back.
  const participants = [maker];
  for (const reply of [...list].reverse()) {
    if (!participants.some((person) => person.id === reply.author.id)) {
      participants.push(reply.author);
    }
  }
  const linkable = new Set(participants.map((person) => person.username.toLowerCase()));

  return (
    <section
      id="balasan"
      aria-labelledby={headingId}
      className="flex scroll-mt-24 flex-col gap-4 pt-6"
    >
      <h2
        id={headingId}
        className="text-[22px] leading-7 font-semibold sm:text-[26px] sm:leading-8"
      >
        {t("title")}{" "}
        <span className="text-base font-normal text-muted tabular-nums">{list.length}</span>
      </h2>

      {list.length === 0 ? (
        <SystemMessage tone="soft" className="max-w-xl">
          {t("empty")}
        </SystemMessage>
      ) : (
        <ol className="flex flex-col border-t border-border">
          {list.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              isMaker={reply.author.id === maker.id}
              isOwn={reply.author.id === viewerId}
              linkable={linkable}
              viewer={viewer}
              onReply={() => formRef.current?.mention(reply.author.username)}
              onDeleted={() => setRemoved((current) => new Set(current).add(reply.id))}
            />
          ))}
        </ol>
      )}

      {viewer.kind === "user" ? (
        <ReplyForm
          ref={formRef}
          projectId={projectId}
          participants={participants.filter((person) => person.id !== viewerId)}
          turnstileSiteKey={turnstileSiteKey}
          onPosted={(reply) => setAdded((current) => [...current, reply])}
        />
      ) : viewer.kind === "loading" ? (
        <div
          aria-hidden="true"
          className="mt-2 h-[60px] rounded-md border-[1.5px] border-border bg-surface"
        />
      ) : (
        <p className="mt-2 flex min-h-[60px] flex-wrap items-center justify-between gap-3 rounded border border-border bg-surface py-2 pr-2 pl-4 text-base text-ink-2">
          <span>{viewer.kind === "anon" ? t("loginPrompt") : t("usernamePrompt")}</span>
          <a
            href={viewer.kind === "anon" ? viewer.loginHref : viewer.onboardingHref}
            className={buttonStyles({ variant: "primary" })}
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
  linkable,
  viewer,
  onReply,
  onDeleted,
}: {
  reply: ReplyView;
  isMaker: boolean;
  isOwn: boolean;
  linkable: ReadonlySet<string>;
  viewer: ReplyViewer;
  onReply: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("interactions.replies");
  const format = useFormatter();
  const date = new Date(reply.createdAt);

  return (
    <li className="flex items-start gap-3 border-b border-border py-4">
      <Avatar
        name={reply.author.displayName}
        src={reply.author.avatarUrl}
        size="sm"
        className="hidden sm:inline-flex"
      />
      <div className="max-w-[68ch] min-w-0 grow">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm leading-5 text-muted">
          <Link
            href={`/u/${reply.author.username}`}
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            {reply.author.displayName}
          </Link>
          {isMaker ? (
            <span className="text-[13px] leading-4 font-semibold text-accent-text">
              {t("maker")}
            </span>
          ) : null}
          <time dateTime={reply.createdAt}>{format.dateTime(date, { dateStyle: "medium" })}</time>
        </p>
        <div className="mt-1 text-base leading-6 break-words whitespace-pre-line text-ink">
          {splitMentions(reply.body, linkable).map((segment, index) =>
            segment.kind === "mention" ? (
              <Link
                key={index}
                href={`/u/${segment.username}`}
                className="font-semibold text-accent-text underline-offset-3 hover:underline"
              >
                {segment.text}
              </Link>
            ) : (
              segment.text
            ),
          )}
        </div>
        <div className="-ml-1 flex flex-wrap items-center gap-x-2">
          {isOwn ? (
            <DeleteReplyButton replyId={reply.id} onDeleted={onDeleted} />
          ) : viewer.kind === "loading" ? null : (
            <>
              {viewer.kind === "user" ? (
                <button type="button" onClick={onReply} className={actionClass}>
                  {t("reply")}
                  <span className="sr-only"> {reply.author.displayName}</span>
                </button>
              ) : (
                <a
                  href={viewer.kind === "anon" ? viewer.loginHref : viewer.onboardingHref}
                  className={actionClass}
                >
                  {t("reply")}
                  <span className="sr-only"> {reply.author.displayName}</span>
                </a>
              )}
              {viewer.kind === "anon" ? (
                <a href={viewer.loginHref} className={actionClass}>
                  {t("report")}
                </a>
              ) : (
                <ReportButton targetType="comment" targetId={reply.id} className={actionClass} />
              )}
            </>
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
          <span role="alert" className="ml-2 text-sm text-danger">
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
      className="inline-flex flex-wrap items-center gap-2 text-sm text-ink-2"
    >
      {t("deleteConfirm")}
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className={buttonStyles({ variant: "ghost", size: "sm", className: "px-2.5" })}
      >
        {t("cancel")}
      </button>
      <button
        ref={confirmRef}
        type="button"
        disabled={pending}
        onClick={remove}
        className={buttonStyles({ variant: "primary", size: "sm", className: "px-3" })}
      >
        {pending ? t("deleting") : t("deleteYes")}
      </button>
    </span>
  );
}

type ReplyFormHandle = {
  /** "Balas": tags someone in the form (once) and moves focus there. */
  mention(username: string): void;
};

type Mention = { start: number; query: string };

function ReplyForm({
  projectId,
  participants,
  turnstileSiteKey,
  onPosted,
  ref,
}: {
  projectId: string;
  participants: Participant[];
  turnstileSiteKey: string | null;
  onPosted: (reply: ReplyView) => void;
  ref?: Ref<ReplyFormHandle>;
}) {
  const t = useTranslations("interactions.replies");
  const locale = useLocale();
  const inputId = useId();
  const listboxId = useId();
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pending, startTransition] = useTransition();

  // "@" suggestions: the mention under the caret, the highlighted option, and an "@" the user
  // closed with Escape (it stays closed until they move to another mention).
  const [mention, setMention] = useState<Mention | null>(null);
  const [active, setActive] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const caretRef = useRef<number | null>(null);

  const suggestions =
    mention && mention.start !== dismissedAt
      ? suggestParticipants(participants, mention.query)
      : [];
  const open = suggestions.length > 0;
  const activeIndex = Math.min(active, Math.max(suggestions.length - 1, 0));

  const trimmed = body.trim();
  const tooLong = trimmed.length > REPLY_MAX;

  // Put the caret after an inserted mention once React has written the new text.
  useLayoutEffect(() => {
    const caret = caretRef.current;
    const textarea = textareaRef.current;
    if (caret === null || !textarea) return;
    caretRef.current = null;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
  }, [body]);

  useImperativeHandle(ref, () => ({
    mention(username) {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.scrollIntoView({ block: "center", behavior: scrollBehavior() });
      const already = new RegExp(`(^|[^a-z0-9_@.])@${username}(?![a-z0-9_])`, "i").test(body);
      if (already) {
        textarea.focus();
        return;
      }
      const next = insertMention(body, username, null);
      caretRef.current = next.caret;
      setBody(next.text);
      setMention(null);
    },
  }));

  function trackCaret(textarea: HTMLTextAreaElement) {
    const found = mentionAtCaret(textarea.value, textarea.selectionStart);
    // A different "@" (or none): start fresh. The same one keeps its highlight and an Escape.
    if (found?.start !== mention?.start) {
      setActive(0);
      setDismissedAt(null);
    }
    setMention(found);
  }

  function choose(person: Participant) {
    const textarea = textareaRef.current;
    if (!mention || !textarea) return;
    const next = insertMention(body, person.username, {
      start: mention.start,
      end: textarea.selectionStart,
    });
    caretRef.current = next.caret;
    setBody(next.text);
    setMention(null);
  }

  function submit() {
    if (pending) return;
    if (!trimmed) return setError("required");
    if (tooLong) return setError("too_long");
    if (turnstileSiteKey && !turnstileToken) return setError("captcha_needed");
    setError(null);
    setMention(null);

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
      <div className="relative">
        {open ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={t("suggestions")}
            className="absolute bottom-full left-0 z-10 mb-2 flex w-full max-w-sm flex-col overflow-hidden rounded border border-border-strong bg-surface p-1 motion-fade-in shadow-[0_2px_0_var(--border)]"
          >
            {suggestions.map((person, index) => (
              <li
                key={person.id}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                // Keep focus (and the caret) in the textarea.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(person)}
                className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-sm aria-selected:bg-placeholder"
              >
                <Avatar name={person.displayName} src={person.avatarUrl} size="xs" />
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{person.displayName}</span>{" "}
                  <span className="text-muted">@{person.username}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex items-end gap-3 rounded-md border-[1.5px] border-border-strong bg-surface py-1.5 pr-1.5 pl-3 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent hover:border-ink">
          <label htmlFor={inputId} className="sr-only">
            {t("label")}
          </label>
          <textarea
            ref={textareaRef}
            id={inputId}
            rows={1}
            value={body}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-activedescendant={open ? `${listboxId}-${activeIndex}` : undefined}
            onChange={(event) => {
              setBody(event.target.value);
              trackCaret(event.target);
            }}
            onSelect={(event) => trackCaret(event.currentTarget)}
            onFocus={() => setWantsCaptcha(true)}
            onBlur={() => setMention(null)}
            onKeyDown={(event) => {
              // Enter adds a line; Ctrl/Cmd+Enter sends.
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                submit();
                return;
              }
              if (!open) return;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const step = event.key === "ArrowDown" ? 1 : -1;
                setActive((activeIndex + step + suggestions.length) % suggestions.length);
              } else if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                choose(suggestions[activeIndex]);
              } else if (event.key === "Escape") {
                event.preventDefault();
                setDismissedAt(mention?.start ?? null);
              }
            }}
            aria-invalid={error === "too_long" || error === "required" ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
            placeholder={t("placeholder")}
            className="field-sizing-content max-h-60 min-h-11 min-w-0 grow resize-none bg-transparent py-2.5 text-base leading-6 text-ink placeholder:text-muted focus:outline-none"
          />
          <button type="submit" disabled={pending} className={buttonStyles({ variant: "primary" })}>
            {pending ? t("sending") : t("send")}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        {error ? (
          <p id={`${inputId}-error`} role="alert" className="text-sm text-danger">
            {t(`errors.${error}`)}
          </p>
        ) : (
          <p id={`${inputId}-hint`} className="text-sm text-muted">
            {participants.length > 0 ? t("mentionHint") : ""}
          </p>
        )}
        {trimmed.length > REPLY_MAX - 100 ? (
          <span className={`text-[13px] tabular-nums ${tooLong ? "text-danger" : "text-muted"}`}>
            {trimmed.length}/{REPLY_MAX}
          </span>
        ) : null}
      </div>
      {turnstileSiteKey && wantsCaptcha ? (
        <div>
          <Turnstile
            ref={turnstileRef}
            action="reply"
            siteKey={turnstileSiteKey}
            language={locale}
            onToken={setTurnstileToken}
          />
        </div>
      ) : null}
    </form>
  );
}
