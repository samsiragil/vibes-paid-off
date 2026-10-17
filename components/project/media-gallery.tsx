"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ExternalLink } from "@/components/ui/external-link";
import { MediaImage } from "@/components/ui/media-image";
import { cn } from "@/lib/cn";
import type { ProjectMedia } from "@/lib/media/limits";

/**
 * Screenshots of a project: one large image, thumbnails to switch it, and the demo video as an
 * external link (no embeds of maker content, §2.6). Shown whatever the link status is.
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
  // Thumbnails only help with more than one image; the video tile always shows.
  const showTiles = media.length > 1 || Boolean(videoUrl);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-placeholder">
        {current ? (
          <MediaImage
            key={current.id}
            mediaKey={current.key}
            alt={t("imageAlt", { position: selected + 1, title })}
            width={current.width}
            height={current.height}
            sizes="(min-width: 1024px) 760px, 100vw"
            priority={selected === 0}
            className="size-full object-contain"
          />
        ) : (
          <p className="flex size-full items-center justify-center px-6 text-center text-sm text-muted">
            {t("empty")}
          </p>
        )}
      </div>

      {showTiles ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {media.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={t("show", { position: index + 1 })}
              aria-pressed={index === selected}
              onClick={() => setSelected(index)}
              className={cn(
                "relative h-[84px] overflow-hidden rounded-xl bg-placeholder transition-shadow sm:h-[100px]",
                index === selected
                  ? "ring-2 ring-ink ring-offset-2 ring-offset-surface"
                  : "hover:opacity-90",
              )}
            >
              <MediaImage mediaKey={image.key} alt="" fill sizes="180px" className="object-cover" />
            </button>
          ))}
          {videoUrl ? (
            <ExternalLink
              href={videoUrl}
              className="flex h-[84px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-(--dashed) text-[13px] text-ink transition-colors hover:border-ink sm:h-[100px]"
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
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-accent-text"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M10 8.5l5 3.5-5 3.5z" />
    </svg>
  );
}
