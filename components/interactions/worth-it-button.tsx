"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { setWorthIt, type WorthItResult } from "@/lib/interactions/actions";
import { worthItStyles } from "./worth-it-styles";

type VoteState = { voted: boolean; count: number };

/**
 * The Worth it toggle for a signed-in visitor. The click shows at once (optimistic) and the
 * stored state from the server replaces it; on failure it falls back and says why.
 */
export function WorthItButton({
  projectId,
  voted,
  count,
}: {
  projectId: string;
  voted: boolean;
  count: number;
}) {
  const t = useTranslations("interactions.worthIt");
  const format = useFormatter();
  const [state, setState] = useState<VoteState>({ voted, count });
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [error, setError] = useState<Exclude<WorthItResult, { ok: true }>["error"] | null>(null);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !optimistic.voted;
    setError(null);
    startTransition(async () => {
      setOptimistic({ voted: next, count: Math.max(optimistic.count + (next ? 1 : -1), 0) });
      const result = await setWorthIt(projectId, next);
      if (result.ok) setState({ voted: result.voted, count: result.count });
      else setError(result.error);
    });
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-pressed={optimistic.voted}
        onClick={toggle}
        className={worthItStyles(
          optimistic.voted,
          optimistic.voted ? "hover:bg-accent-soft/70" : "hover:border-ink",
        )}
      >
        {optimistic.voted ? t("voted") : t("label")}
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{format.number(optimistic.count)}</span>
      </button>
      <span
        role="alert"
        className="absolute top-full left-0 mt-1 w-60 text-xs text-red-700 dark:text-red-400"
      >
        {error ? t(`errors.${error}`) : ""}
      </span>
    </span>
  );
}
