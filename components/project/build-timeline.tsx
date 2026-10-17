import { getTranslations } from "next-intl/server";
import type { ProjectSessionView } from "@/lib/projects/detail";

/**
 * "Cara membuatnya": each build session as a short chat — the prompt (right), what came out
 * (left), and the obstacle with its fix when the maker wrote one.
 */
export async function BuildTimeline({ sessions }: { sessions: ProjectSessionView[] }) {
  const t = await getTranslations("project.timeline");

  return (
    <ol className="flex flex-col gap-[18px]">
      {sessions.map((session, index) => (
        <li key={session.id} className="flex flex-col gap-[18px]">
          <p className="self-center rounded-full bg-bubble px-3.5 py-2 text-center font-mono text-[11px] leading-snug text-ink-2 uppercase">
            {[
              t("session", { number: index + 1 }),
              session.label,
              t("hours", { hours: session.durationHours }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <div className="flex justify-end">
            <p className="max-w-[88%] rounded-[20px] rounded-br-md bg-ink px-[18px] py-3.5 text-base leading-normal break-words whitespace-pre-line text-bg sm:max-w-[72%]">
              <span className="sr-only">{t("prompt")}: </span>
              {session.prompt}
            </p>
          </div>
          <div className="flex">
            <p className="max-w-[88%] rounded-[20px] rounded-bl-md border border-border bg-surface px-[18px] py-3.5 text-base leading-normal break-words whitespace-pre-line text-ink-2 sm:max-w-[72%]">
              <span className="sr-only">{t("result")}: </span>
              {session.result}
            </p>
          </div>

          {session.challenge ? (
            <div className="flex max-w-full gap-3 self-center rounded-2xl border border-ink bg-surface px-[18px] py-3.5 sm:max-w-[80%]">
              <WarningIcon />
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-muted uppercase">{t("challenge")}</p>
                <p className="mt-1 text-[15px] leading-normal break-words whitespace-pre-line">
                  {session.challenge}
                </p>
              </div>
            </div>
          ) : null}
          {session.challenge && session.solution ? (
            <div className="flex">
              <div className="max-w-[88%] rounded-[20px] rounded-bl-md bg-accent-soft px-[18px] py-3.5 text-base leading-normal text-accent-ink sm:max-w-[72%]">
                <p className="mb-1 font-mono text-[11px] uppercase">{t("solution")}</p>
                <p className="break-words whitespace-pre-line">{session.solution}</p>
              </div>
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function WarningIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 shrink-0"
    >
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  );
}
