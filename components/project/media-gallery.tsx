"use client";

import { useTranslations } from "next-intl";
import { startTransition, useState, ViewTransition } from "react";
import { ResultBubble } from "@/components/ui/bubble";
import { ExternalLink } from "@/components/ui/external-link";
import { MediaImage } from "@/components/ui/media-image";
import { cn } from "@/lib/cn";
import type { ProjectMedia } from "@/lib/media/limits";

/**
 * Screenshots of a project, pasted into the notebook: the main one taped in, thumbnails to switch
 * it, and the demo video as an external text link (no embeds of maker content, §2.6). Shown
 * whatever the link status is.
 */
export function MediaGallery({
  media,
  title,
  videoUrl,
}: {
  media: ProjectMedia[];
  title: string;
  videoUrl: string | null;
}) {
  const t = useTranslations("project.gallery");
  const [selected, setSelected] = useState(0);
  const current = media[selected] ?? media[0];

  return (
    <div className="flex flex-col gap-4">
      <ResultBubble taped className="p-2">
        <div className="relative aspect-[16/10] overflow-hidden rounded-sm bg-placeholder">
          {current ? (
            // A new key swaps the image, and the swap crossfades (README §11).
            <ViewTransition key={current.id} enter="fade" exit="fade" default="none">
              <MediaImage
                mediaKey={current.key}
                alt={t("imageAlt", { position: selected + 1, title })}
                width={current.width}
                height={current.height}
                sizes="(min-width: 1024px) 760px, 100vw"
                priority={selected === 0}
                className="size-full object-contain"
              />
            </ViewTransition>
          ) : (
            <p className="flex size-full items-center justify-center px-6 text-center text-base text-muted">
              {t("empty")}
            </p>
          )}
        </div>
      </ResultBubble>

      {media.length > 1 || videoUrl ? (
        <div className="flex flex-wrap items-center gap-3">
          {media.length > 1
            ? media.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  aria-label={t("show", { position: index + 1 })}
                  aria-pressed={index === selected}
                  onClick={() => startTransition(() => setSelected(index))}
                  className={cn(
                    "rounded border p-1 transition-colors",
                    index === selected
                      ? "border-highlight bg-highlight"
                      : "border-border bg-surface hover:border-border-strong",
                  )}
                >
                  <span className="relative block h-[60px] w-24 overflow-hidden rounded-sm bg-placeholder sm:h-[72px] sm:w-[116px]">
                    <MediaImage
                      mediaKey={image.key}
                      alt=""
                      fill
                      sizes="116px"
                      className="object-cover"
                    />
                  </span>
                </button>
              ))
            : null}
          {videoUrl ? (
            <ExternalLink
              href={videoUrl}
              className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-accent-text underline underline-offset-3"
            >
              <PlayIcon />
              {t("watchDemo")}
              <span className="sr-only">{t("newTab")}</span>
            </ExternalLink>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="miter"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M10 8.5l5 3.5-5 3.5z" />
    </svg>
  );
}
