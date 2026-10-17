import type { ComponentProps } from "react";

/**
 * A link to a site a maker entered (live app, repo, video, social, tip page): new tab, and
 * `nofollow ugc` so search engines do not treat it as an endorsement (§2.6).
 */
export function ExternalLink({ rel, ...props }: ComponentProps<"a">) {
  return (
    <a
      target="_blank"
      rel={["nofollow ugc noopener noreferrer", rel].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
