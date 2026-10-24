import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { clip, GenericCard, initials, og, OG_SIZE, renderOgImage, Wordmark } from "@/lib/og";
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
  const [firstName, ...restNames] = profile.displayName.split(" ");
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
          gap: 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              display: "flex",
              width: 120,
              height: 120,
              borderRadius: 60,
              alignItems: "center",
              justifyContent: "center",
              background: og.accent,
              color: og.onInk,
              fontFamily: "Fraunces",
              fontSize: 46,
            }}
          >
            {initials(profile.displayName)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                display: "flex",
                fontFamily: "Fraunces",
                fontSize: 80,
                lineHeight: 1,
                letterSpacing: -2,
              }}
            >
              {clip(firstName, 20)}
              {restNames.length > 0 ? (
                <span style={{ fontStyle: "italic" }}>&nbsp;{clip(restNames.join(" "), 24)}</span>
              ) : null}
            </div>
            <div
              style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 22, color: og.muted }}
            >
              {stats}
            </div>
          </div>
        </div>
        {profile.bio ? (
          <div style={{ display: "flex" }}>
            <div
              style={{
                display: "flex",
                maxWidth: 980,
                padding: "22px 28px",
                background: og.surface,
                border: `1px solid ${og.border}`,
                borderRadius: "28px 28px 28px 8px",
                fontSize: 28,
                lineHeight: 1.45,
                color: og.ink,
              }}
            >
              {clip(profile.bio, 150)}
            </div>
          </div>
        ) : null}
      </div>
    </div>,
  );
}
