import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { clip, GenericCard, initials, og, OG_SIZE, renderOgImage, Wordmark } from "@/lib/og";
import { getPublishedProject } from "@/lib/projects/detail";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Jadinya";

/** Share card for a project: key prompt → "satu weekend kemudian" → title, like the site's cards. */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: requested, slug } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const project = await getPublishedProject(slug);

  if (!project) {
    const t = await getTranslations({ locale, namespace: "meta" });
    return renderOgImage(<GenericCard tagline={t("description")} />);
  }

  const tCard = await getTranslations({ locale, namespace: "projectCard" });
  const tCategories = await getTranslations({ locale, namespace: "categories" });
  const timeLabel = tCard("effortAfter", { effort: project.buildEffort });

  return renderOgImage(
    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Wordmark />
        <div
          style={{
            display: "flex",
            fontFamily: "Geist Mono",
            fontSize: 20,
            color: og.muted,
            textTransform: "uppercase",
          }}
        >
          {tCategories(project.category)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          justifyContent: "center",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{
              display: "flex",
              maxWidth: 900,
              padding: "24px 30px",
              background: og.ink,
              color: og.onInk,
              borderRadius: "30px 30px 8px 30px",
              fontFamily: "Fraunces",
              fontSize: 36,
              lineHeight: 1.25,
            }}
          >
            {clip(project.keyPrompt, 120)}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            fontFamily: "Geist Mono",
            fontSize: 18,
            color: og.muted,
          }}
        >
          {timeLabel}
        </div>
        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 900,
              gap: 6,
              padding: "22px 30px",
              background: og.surface,
              border: `1px solid ${og.border}`,
              borderRadius: "30px 30px 30px 8px",
            }}
          >
            <div style={{ display: "flex", fontSize: 44, fontWeight: 600, lineHeight: 1.1 }}>
              {clip(project.title, 48)}
            </div>
            <div style={{ display: "flex", fontSize: 24, color: og.ink2 }}>
              {clip(project.tagline, 80)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 22, color: og.ink2 }}>
        <div
          style={{
            display: "flex",
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            background: og.accent,
            color: og.onInk,
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          {initials(project.maker.displayName)}
        </div>
        <div style={{ display: "flex" }}>
          {project.maker.displayName} · @{project.maker.username}
        </div>
        <div style={{ display: "flex", marginLeft: "auto", fontWeight: 600, color: og.ink }}>
          {tCard("worthIt", { count: project.upvoteCount })}
        </div>
      </div>
    </div>,
  );
}
