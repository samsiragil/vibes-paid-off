import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";

// Shared pieces of the Open Graph images (next/og). Fonts are the site's own (Fraunces, Geist,
// Geist Mono; OFL), vendored as WOFF in assets/og because next/og cannot read WOFF2.

export const OG_SIZE = { width: 1200, height: 630 };

/** Light palette from app/globals.css (OG images are always light). */
export const og = {
  bg: "#F7F6F2",
  surface: "#FFFFFF",
  ink: "#191919",
  ink2: "#4A4A46",
  muted: "#6B6B66",
  border: "#E4E2DB",
  accent: "#1E5446",
  accentSoft: "#E3EEE9",
  onInk: "#F7F6F2",
};

const fontFile = (name: string) => readFile(join(process.cwd(), "assets/og", name));

const fontsPromise = Promise.all([
  fontFile("fraunces-latin-400-normal.woff"),
  fontFile("fraunces-latin-400-italic.woff"),
  fontFile("geist-sans-latin-400-normal.woff"),
  fontFile("geist-sans-latin-600-normal.woff"),
  fontFile("geist-mono-latin-400-normal.woff"),
]);

/** Cuts text to `max` characters at a word boundary, with an ellipsis. */
export function clip(text: string, max: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 12)).trimEnd()}…`;
}

export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: size, color: og.ink }}>
      Vibes Paid&nbsp;<span style={{ fontStyle: "italic", color: og.accent }}>Off.</span>
    </div>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0]?.slice(0, 2) ?? "");
  return letters.toUpperCase();
}

export async function renderOgImage(children: ReactNode) {
  const [fraunces, frauncesItalic, geist, geistSemibold, geistMono] = await fontsPromise;
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
        fontFamily: "Geist",
      }}
    >
      {children}
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "Fraunces", data: fraunces, style: "normal", weight: 400 },
        { name: "Fraunces", data: frauncesItalic, style: "italic", weight: 400 },
        { name: "Geist", data: geist, style: "normal", weight: 400 },
        { name: "Geist", data: geistSemibold, style: "normal", weight: 600 },
        { name: "Geist Mono", data: geistMono, style: "normal", weight: 400 },
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
        gap: 28,
      }}
    >
      <Wordmark size={84} />
      <div
        style={{ display: "flex", fontSize: 34, color: og.ink2, maxWidth: 900, lineHeight: 1.4 }}
      >
        {tagline}
      </div>
    </div>
  );
}
