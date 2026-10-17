import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import type { LinkStatus } from "@/lib/projects/types";

/** "● Live", "○ Offline" or "Diarsipkan": whether the maker's app still opens. */
export async function LinkStatusBadge({
  status,
  className,
}: {
  status: LinkStatus;
  className?: string;
}) {
  const t = await getTranslations("linkStatus");
  return (
    <Badge variant={status} className={className}>
      {status === "live" ? (
        <span aria-hidden="true" className="size-[7px] rounded-full bg-accent-text" />
      ) : status === "offline" ? (
        <span aria-hidden="true" className="size-[7px] rounded-full border border-ink" />
      ) : null}
      {t(status)}
    </Badge>
  );
}

/** The same status as compact mono text, for card corners (server or client). */
export function LinkStatusText({ status }: { status: LinkStatus }) {
  const t = useTranslations("linkStatus");
  return (
    <span className={status === "live" ? "shrink-0 text-accent-text" : "shrink-0 text-muted"}>
      {status === "live" ? "● " : status === "offline" ? "○ " : ""}
      {t(status)}
    </span>
  );
}
