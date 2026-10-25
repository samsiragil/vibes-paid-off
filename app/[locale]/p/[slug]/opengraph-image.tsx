import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import {
  clip,
  GenericCard,
  HandNote,
  og,
  OG_SIZE,
  OgAvatar,
  renderOgImage,
  RuledNote,
  Wordmark,
} from "@/lib/og";
import { getPublishedProject } from "@/lib/projects/detail";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Jadinya";

/**
 * Share card for a project, as a notebook page: the key prompt on ruled lines → "satu weekend
 * kemudian" in handwriting → the title pasted in, then the maker and Worth it.
 */
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
        <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: og.muted }}>
          {tCategories(project.category)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          justifyContent: "center",
          gap: 14,
        }}
      >
        <RuledNote fontSize={38}>{clip(project.keyPrompt, 110)}</RuledNote>
        <HandNote>{timeLabel}</HandNote>
        <div style={{ display: "flex", paddingLeft: 40 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 960,
              gap: 4,
              padding: "18px 26px",
              background: og.surface,
              border: `1px solid ${og.border}`,
              borderRadius: 6,
              boxShadow: `0 2px 0 ${og.border}`,
              transform: "rotate(-0.6deg)",
            }}
          >
            <div style={{ display: "flex", fontSize: 46, fontWeight: 700, lineHeight: 1.15 }}>
              {clip(project.title, 48)}
            </div>
            <div style={{ display: "flex", fontSize: 26, color: og.ink2 }}>
              {clip(project.tagline, 80)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, color: og.ink2 }}>
        <OgAvatar name={project.maker.displayName} size={44} />
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
