import { getTranslations } from "next-intl/server";
import type { ProjectDetail, ProjectSessionView } from "@/lib/projects/detail";

/**
 * "Cara membuatnya": the story moments the maker chose to tell — the prompt that made them go
 * "wah" (as their chat bubble), the hardest part, build sessions from the old form, and what
 * they would do differently.
 */
export async function BuildStory({ project }: { project: ProjectDetail }) {
  const t = await getTranslations("project.moments");

  return (
    <div className="flex flex-col gap-[18px]">
      {project.momentWow ? (
        <div className="flex flex-col items-end gap-2">
          <p className="font-mono text-[11px] tracking-[0.4px] text-accent-text uppercase">
            {t("wow")}
          </p>
          <p className="max-w-[88%] rounded-[20px] rounded-br-md bg-ink px-[18px] py-3.5 text-base leading-normal break-words whitespace-pre-line text-bg sm:max-w-[72%]">
            {project.momentWow}
          </p>
        </div>
      ) : null}

      {project.momentHardest ? (
        <div className="flex max-w-full gap-3 self-center rounded-2xl border border-ink bg-surface px-[18px] py-3.5 sm:max-w-[80%]">
          <WarningIcon />
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-muted uppercase">{t("hardest")}</p>
            <p className="mt-1 text-[15px] leading-normal break-words whitespace-pre-line">
              {project.momentHardest}
            </p>
          </div>
        </div>
      ) : null}

      {project.sessions.length > 0 ? (
        <section className="flex flex-col gap-[18px]">
          <h3 className="sr-only">{t("sessions")}</h3>
          <BuildTimeline sessions={project.sessions} />
        </section>
      ) : null}

      {project.lessons ? (
        <section className="mt-4 border-y border-border py-7">
          <h3 className="font-mono text-[11px] tracking-[0.4px] text-accent-text uppercase">
            {t("redo")}
          </h3>
          <p className="mt-2.5 font-display text-[22px] leading-[1.35] break-words whitespace-pre-line italic sm:text-[26px]">
            {project.lessons}
          </p>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Build sessions from before build_effort: each one as a short chat — the prompt (right), what
 * came out (left), and the obstacle with its fix when the maker wrote one.
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
