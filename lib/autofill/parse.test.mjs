import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activeDays,
  clip,
  estimateEffort,
  guessContentLang,
  parseGithubRepo,
  parsePageMeta,
  readmeSummary,
  repoTitle,
} from "./parse.ts";

test("turns a repo name into a title", () => {
  assert.equal(repoTitle("kasir-warung_v2"), "Kasir Warung V2");
  assert.equal(repoTitle("absenLab"), "AbsenLab");
  assert.equal(repoTitle("--"), null);
});

test("reads og tags, falls back to <title>, resolves the image", () => {
  const html = `<!doctype html><html lang="id"><head>
    <title>Kasir &amp; Rekap</title>
    <meta name="description" content="Catat jualan harian">
    <meta property='og:image' content='/og.png'>
  </head><body><meta property="og:title" content="ignored in body"></body></html>`;
  assert.deepEqual(parsePageMeta(html, "https://kasir.example.com/app"), {
    title: "Kasir & Rekap",
    description: "Catat jualan harian",
    image: "https://kasir.example.com/og.png",
    lang: "id",
  });
});

test("prefers og:title and og:description, ignores non-http images", () => {
  const html = `<html><head>
    <meta property="og:title" content="  Kasir   Warung ">
    <meta name="description" content="plain">
    <meta property="og:description" content="Rekap mingguan &#8212; otomatis">
    <meta property="og:image" content="javascript:alert(1)">
    <title>Other</title></head></html>`;
  const meta = parsePageMeta(html, "https://x.example.com");
  assert.equal(meta.title, "Kasir Warung");
  assert.equal(meta.description, "Rekap mingguan — otomatis");
  assert.equal(meta.image, null);
  assert.equal(meta.lang, null);
});

test("clips at a word boundary", () => {
  assert.equal(clip("short", 80), "short");
  assert.equal(
    clip("Catat jualan harian dari HP, langsung keluar rekap", 30),
    "Catat jualan harian dari HP…",
  );
});

test("parses GitHub repo links only", () => {
  assert.deepEqual(parseGithubRepo("https://github.com/tini/kasir-warung.git"), {
    owner: "tini",
    repo: "kasir-warung",
  });
  assert.deepEqual(parseGithubRepo("https://github.com/tini/kasir/tree/main/src"), {
    owner: "tini",
    repo: "kasir",
  });
  assert.equal(parseGithubRepo("https://gitlab.com/tini/kasir"), null);
  assert.equal(parseGithubRepo("https://github.com/tini"), null);
  assert.equal(parseGithubRepo("http://github.com/tini/kasir"), null);
  assert.equal(parseGithubRepo("not a url"), null);
});

test("README summary skips headings, badges and code", () => {
  const readme = [
    "# Kasir Warung",
    "",
    "[![build](https://img.shields.io/x.svg)](https://ci)",
    "",
    "```bash",
    "pnpm dev",
    "```",
    "",
    "Aplikasi **kasir** buat warung kelontong,",
    "dibikin pakai [Claude Code](https://claude.com).",
    "",
    "## Fitur",
    "- Rekap mingguan",
  ].join("\n");
  assert.equal(
    readmeSummary(readme),
    "Aplikasi kasir buat warung kelontong, dibikin pakai Claude Code.",
  );
  assert.equal(readmeSummary("# Only a title\n"), null);
});

test("active days count WIB calendar days", () => {
  // 23:30 UTC on the 1st is 06:30 WIB on the 2nd.
  assert.equal(
    activeDays(["2026-10-01T10:00:00Z", "2026-10-01T23:30:00Z", "2026-10-02T01:00:00Z", "bad"]),
    1 + 1,
  );
});

test("estimates effort from the commit history", () => {
  assert.equal(estimateEffort({ commits: 1, activeDays: 1, spanHours: 0 }), null);
  assert.equal(estimateEffort({ commits: 12, activeDays: 1, spanHours: 3 }), "hours");
  assert.equal(estimateEffort({ commits: 12, activeDays: 2, spanHours: 9 }), "overnight");
  assert.equal(estimateEffort({ commits: 23, activeDays: 2, spanHours: 30 }), "weekend");
  assert.equal(estimateEffort({ commits: 40, activeDays: 5, spanHours: 200 }), "week");
  assert.equal(estimateEffort({ commits: 90, activeDays: 14, spanHours: 900 }), "longer");
});

test("guesses the content language", () => {
  assert.equal(guessContentLang("id-ID", "anything"), "id");
  assert.equal(guessContentLang("en", "Catat jualan harian dari HP untuk warung yang ramai"), "id");
  assert.equal(guessContentLang(null, "Track your daily sales and get a weekly report"), "en");
  assert.equal(guessContentLang("en", "Kasir"), "en");
  assert.equal(guessContentLang(null, "Kasir"), null);
});
