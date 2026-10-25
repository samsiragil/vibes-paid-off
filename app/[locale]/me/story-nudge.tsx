"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, ViewTransition, type ReactNode } from "react";
import { SystemMessage } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { dismissStoryNudge } from "@/lib/projects/actions";

/**
 * The "ceritain dong" nudge on /me with its "Nanti aja" button. Dismissing hides it right away
 * and records it, so the nudge does not come back for that project.
 */
export function DismissibleNudge({
  projectId,
  action,
  children,
}: {
  projectId: string;
  /** The "Ceritain" link, next to the dismiss button. */
  action: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("me.nudge");
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();

  if (hidden) return null;

  // Fades out when dismissed instead of vanishing (README §11).
  return (
    <ViewTransition exit="fade" default="none">
      <SystemMessage>
        <span role="status">{children}</span>
        <span className="mt-3 flex flex-wrap items-center gap-2">
          {action}
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await dismissStoryNudge(projectId);
                // After an await the update needs its own transition to run the exit fade.
                if (result.ok) startTransition(() => setHidden(true));
              })
            }
          >
            {t("dismiss")}
          </Button>
        </span>
      </SystemMessage>
    </ViewTransition>
  );
}
