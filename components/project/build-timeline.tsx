import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { ProjectDetail, ProjectSessionView } from "@/lib/projects/detail";

/*
 * "Cara membuatnya" as one ruled note with a single margin line. Each moment the maker chose to
 * tell gets a handwritten label on its own line, then the text on the lines below. Every line is
 * 32 px tall, so the text keeps sitting on the ruling.
 */

/** The ruled note block: margin line on the left, text from the margin column on. */
function Note({ children }: { children: ReactNode }) {
  return (
    <div className="relative ruled pr-4 pb-8 pl-6 text-[17px]/8 text-ink sm:pl-[72px] sm:text-lg/8">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-3 w-[1.5px] bg-margin sm:left-14"
      />
      <div className="flex flex-col gap-8">{children}</div>
    </div>
  );
}

/** A handwritten label sitting on one ruled line. */
function HandLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-hand text-xl/8 font-normal text-accent-text sm:text-[22px]/8">
      {children}
    </h3>
  );
}

/** A small UI label on one ruled line (Prompt, Hasil, Kendala, Solusi). */
function LineLabel({ children }: { children: ReactNode }) {
  return <p className="text-[13px]/8 font-semibold text-muted">{children}</p>;
}

function Body({ children }: { children: ReactNode }) {
  return <p className="max-w-[68ch] break-words whitespace-pre-line">{children}</p>;
}

/**
 * The story moments: the prompt that made them go "wah", the hardest part, build sessions from
 * the old form, and what they would do differently.
 */
export async function BuildStory({ project }: { project: ProjectDetail }) {
  const t = await getTranslations("project.moments");

  return (
    <Note>
      {project.momentWow ? (
        <section>
          <HandLabel>{t("wow")}</HandLabel>
          <Body>{project.momentWow}</Body>
        </section>
      ) : null}

      {project.momentHardest ? (
        <section>
          <HandLabel>{t("hardest")}</HandLabel>
          <Body>{project.momentHardest}</Body>
        </section>
      ) : null}

      {project.sessions.length > 0 ? (
        <section>
          <h3 className="sr-only">{t("sessions")}</h3>
          <BuildTimeline sessions={project.sessions} />
        </section>
      ) : null}

      {project.lessons ? (
        <section>
          <HandLabel>{t("redo")}</HandLabel>
          <Body>{project.lessons}</Body>
        </section>
      ) : null}
    </Note>
  );
}

/**
 * Build sessions from before build_effort, as dated entries: "Sesi 1" in handwriting with its
 * label and hours, then the prompt, what came out, and the obstacle with its fix when written.
 */
export async function BuildTimeline({ sessions }: { sessions: ProjectSessionView[] }) {
  const t = await getTranslations("project.timeline");

  return (
    <ol className="flex flex-col gap-8">
      {sessions.map((session, index) => (
        <li key={session.id}>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-hand text-xl/8 text-accent-text sm:text-[22px]/8">
              {t("session", { number: index + 1 })}
            </span>
            <span className="text-sm/8 text-muted">
              {[session.label, t("hours", { hours: session.durationHours })]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </p>
          <LineLabel>{t("prompt")}</LineLabel>
          <Body>{session.prompt}</Body>
          <LineLabel>{t("result")}</LineLabel>
          <Body>{session.result}</Body>
          {session.challenge ? (
            <>
              <LineLabel>{t("challenge")}</LineLabel>
              <Body>{session.challenge}</Body>
            </>
          ) : null}
          {session.challenge && session.solution ? (
            <>
              <LineLabel>{t("solution")}</LineLabel>
              <Body>{session.solution}</Body>
            </>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
