import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import {
  clip,
  GenericCard,
  og,
  OG_SIZE,
  OgAvatar,
  renderOgImage,
  RuledNote,
  Wordmark,
} from "@/lib/og";
import { getPublicProfile } from "@/lib/profiles/public";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Jadinya";

/** Share card for a maker: name, handle, stats, and the bio as a chat bubble. */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale: requested, username } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const profile = await getPublicProfile(username);

  if (!profile) {
    const t = await getTranslations({ locale, namespace: "meta" });
    return renderOgImage(<GenericCard tagline={t("description")} />);
  }

  const t = await getTranslations({ locale, namespace: "profile" });
  const stats = [
    `@${profile.username}`,
    t("og.projects", { count: profile.stats.projectCount }),
    t("og.stories", { count: profile.stats.storyCount }),
  ].join(" · ");

  return renderOgImage(
    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
      <Wordmark />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          justifyContent: "center",
          gap: 34,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <OgAvatar name={profile.displayName} size={120} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>
              {clip(profile.displayName, 32)}
            </div>
            <div style={{ display: "flex", fontSize: 26, color: og.muted }}>{stats}</div>
          </div>
        </div>
        {profile.bio ? <RuledNote fontSize={30}>{clip(profile.bio, 150)}</RuledNote> : null}
      </div>
    </div>,
  );
}
