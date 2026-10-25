import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { LOGO_PATHS } from "@/components/layout/logo";

// Shared pieces of the Open Graph images (next/og), drawn as a page of the "Buku Tulis" notebook.
// Fonts are the site's own (Source Sans 3 and Gochi Hand; OFL), vendored as WOFF in assets/og
// because next/og cannot read WOFF2.

export const OG_SIZE = { width: 1200, height: 630 };

/** Light palette from app/globals.css (OG images are always light). */
export const og = {
  bg: "#FBFCFE",
  surface: "#FFFFFF",
  ink: "#292523",
  ink2: "#4A4744",
  muted: "#67635E",
  border: "#E3E4E8",
  accentText: "#A44732",
  accentSoft: "#F6E9E5",
  accentInk: "#6E2C1E",
  rule: "#DCE4F0",
  margin: "#E2A397",
  highlight: "#E5B786",
  logo: "#A44732",
};

/** Ruled line pitch of the OG notebook (the site uses 32 px; scaled for a 1200 px card). */
export const OG_LINE = 48;

const fontFile = (name: string) => readFile(join(process.cwd(), "assets/og", name));

const fontsPromise = Promise.all([
  fontFile("source-sans-3-latin-400-normal.woff"),
  fontFile("source-sans-3-latin-600-normal.woff"),
  fontFile("source-sans-3-latin-700-normal.woff"),
  fontFile("gochi-hand-latin-400-normal.woff"),
]);

/** Cuts text to `max` characters at a word boundary, with an ellipsis. */
export function clip(text: string, max: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 12)).trimEnd()}…`;
}

/** The Jejak Jadi lockup in brick red; `size` is roughly the old text size, as before. */
export function Wordmark({ size = 30 }: { size?: number }) {
  const height = Math.round(size * 1.6);
  return (
    <svg
      width={Math.round((height * 823) / 256)}
      height={height}
      viewBox="0 0 823 256"
      fill={og.logo}
    >
      <path d={LOGO_PATHS.symbolHook} />
      <rect x="48" y="40" width="56" height="40" />
      <path transform="translate(288.152 165.444)" d={LOGO_PATHS.wordmark} />
    </svg>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0]?.slice(0, 2) ?? "");
  return letters.toUpperCase();
}

/**
 * A ruled note with the margin line on its left, like PromptBubble on the site. Satori does not
 * pass line-height down, so the text element gets `OG_LINE` itself to sit on the ruling.
 */
export function RuledNote({
  fontSize,
  color = og.ink,
  children,
}: {
  fontSize: number;
  color?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        position: "relative",
        paddingLeft: 40,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent ${OG_LINE - 2}px, ${og.rule} ${OG_LINE - 2}px, ${og.rule} ${OG_LINE}px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 12,
          width: 2,
          background: og.margin,
        }}
      />
      <div style={{ display: "flex", maxWidth: 1000, fontSize, color, lineHeight: `${OG_LINE}px` }}>
        {children}
      </div>
    </div>
  );
}

/** "satu weekend kemudian" in handwriting next to the hook arrow from the logo. */
export function HandNote({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, paddingLeft: 40 }}>
      <svg width="30" height="36" viewBox="0 0 20 24" fill="none" stroke={og.muted}>
        <path d="M2 4H13V21M8.5 16.5L13 21L17.5 16.5" strokeWidth="1.75" />
      </svg>
      <div style={{ display: "flex", fontFamily: "Gochi Hand", fontSize: 38, color: og.ink2 }}>
        {children}
      </div>
    </div>
  );
}

/** A round initials avatar in the site's colors. */
export function OgAvatar({ name, size }: { name: string; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        background: og.accentSoft,
        color: og.accentInk,
        fontSize: Math.round(size * 0.38),
        fontWeight: 600,
      }}
    >
      {initials(name)}
    </div>
  );
}

export async function renderOgImage(children: ReactNode) {
  const [regular, semibold, bold, hand] = await fontsPromise;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "52px 64px",
        background: og.bg,
        color: og.ink,
        fontFamily: "Source Sans 3",
      }}
    >
      {children}
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "Source Sans 3", data: regular, style: "normal", weight: 400 },
        { name: "Source Sans 3", data: semibold, style: "normal", weight: 600 },
        { name: "Source Sans 3", data: bold, style: "normal", weight: 700 },
        { name: "Gochi Hand", data: hand, style: "normal", weight: 400 },
      ],
    },
  );
}

/** The fallback card when a project or profile is not public. */
export function GenericCard({ tagline }: { tagline: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        flexGrow: 1,
        gap: 36,
      }}
    >
      <Wordmark size={84} />
      <RuledNote fontSize={34} color={og.ink2}>
        {tagline}
      </RuledNote>
    </div>
  );
}
