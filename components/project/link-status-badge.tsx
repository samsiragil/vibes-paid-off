import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
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
        <span aria-hidden="true" className="size-2 rounded-full bg-current" />
      ) : status === "offline" ? (
        <span aria-hidden="true" className="size-2 rounded-full border-[1.5px] border-current" />
      ) : null}
      {t(status)}
    </Badge>
  );
}

/** The same status as compact text, for card corners (server or client). */
export function LinkStatusText({ status }: { status: LinkStatus }) {
  const t = useTranslations("linkStatus");
  return (
    <span
      className={cn(
        "shrink-0",
        status === "live" ? "text-success" : status === "offline" ? "text-warning" : "text-muted",
      )}
    >
      {status === "live" ? "● " : status === "offline" ? "○ " : ""}
      {t(status)}
    </span>
  );
}
