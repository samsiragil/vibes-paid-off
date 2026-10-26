import { PROJECT_LIMITS } from "@/lib/validation/project";
import type { ProjectFormValues } from "./form-values";
import type { ContentLang } from "./types";

// Prompts a maker copies into their AI agent to draft answers for the form, following
// docs/prompt-isi-form-upload.md "Langkah 2": no. 4 (key prompt, step 3) and no. 13 (build story,
// step 5). They are written in the site's display language, so the drafts come back in that
// language too.

type Facts = Pick<ProjectFormValues, "title" | "tagline" | "repoUrl" | "liveUrl" | "keyPrompt">;

type Copy = {
  project: string;
  repo: string;
  live: string;
  keyPrompt: string;
  readFolder: string;
  noSecrets: string;
  keyPromptIntro: string;
  keyPromptBody: (max: number) => string;
  storyIntro: string;
  storyBody: (moment: number, lessons: number) => string;
};

const COPY: Record<ContentLang, Copy> = {
  id: {
    project: "Proyek",
    repo: "Repo",
    live: "Link live",
    keyPrompt: "Prompt kunci",
    readFolder:
      "Baca proyek di folder ini (README, halaman utama, file jejak agen seperti CLAUDE.md, AGENTS.md, .cursorrules, dan `git log`). Jangan mengubah file apa pun.",
    noSecrets: "Jangan masukkan API key, token, email, nomor HP, atau data pribadi.",
    keyPromptIntro:
      'Bantu saya menulis "prompt kunci" untuk memamerkan proyek ini di Jadinya (jadinya.dev).',
    keyPromptBody: (max) =>
      [
        `Tulis satu kalimat permintaan ke AI yang paling "ini dia", gaya orang ngobrol ke AI, seperti prompt pertama yang melahirkan proyek ini. Maks. ${max} karakter, bahasa Indonesia sehari-hari.`,
        'Contoh gaya: "Bikin kasir buat warung kelontong, tombolnya gede, bisa dipakai ibu-ibu tanpa tutorial."',
        "",
        "Kalau prompt aslinya ada di riwayat obrolan atau file jejak agen, pakai itu (boleh dipadatkan). Kalau tidak ada, susun dari tujuan proyek. Kalau kamu tidak bisa membaca folder proyek, tanyakan dulu ke saya proyek ini buat siapa dan masalah apa yang diselesaikan.",
      ].join("\n"),
    storyIntro:
      "Bantu saya menulis cerita pembuatan proyek ini untuk dipamerkan di Jadinya (jadinya.dev).",
    storyBody: (moment, lessons) =>
      [
        "Tulis tiga momen di bawah. Isi hanya dari bukti di `git log`, file jejak agen, atau riwayat obrolan kita. Kalau tidak ada buktinya, kosongkan dan tanyakan ke saya; jangan mengarang. Tandai [DRAF, CEK] kalau kamu menyusun ulang.",
        "",
        `1. Prompt yang bikin "wah" (maks. ${moment} karakter): prompt mana yang hasilnya paling bikin kaget? Tulis prompt-nya dan apa yang terjadi.`,
        `2. Kendala terbesar (maks. ${moment} karakter): bagian paling bikin frustrasi, dan gimana lolosnya?`,
        `3. Kalau mulai ulang (maks. ${lessons} karakter): apa yang bakal dilakukan beda?`,
        "",
        "Tulis sebagai saya (orang pertama), santai dan jujur, bahasa Indonesia sehari-hari. 2–4 kalimat per momen sudah cukup.",
      ].join("\n"),
  },
  en: {
    project: "Project",
    repo: "Repo",
    live: "Live link",
    keyPrompt: "Key prompt",
    readFolder:
      "Read the project in this folder (README, main page, AI agent files like CLAUDE.md, AGENTS.md, .cursorrules, and `git log`). Don't change any files.",
    noSecrets: "Leave out API keys, tokens, emails, phone numbers, and personal data.",
    keyPromptIntro:
      'Help me write a "key prompt" to show off this project on Jadinya (jadinya.dev).',
    keyPromptBody: (max) =>
      [
        `Write the one request to an AI that sums it up best, phrased the way someone talks to an AI, like the first prompt that gave birth to this project. Max ${max} characters, in plain everyday English.`,
        'Example of the style: "Build a point-of-sale app for a corner shop, with big buttons, that anyone can use without a tutorial."',
        "",
        "If the original prompt is in our chat history or the agent files, use it (condensing is fine). If not, write it from the project's purpose. If you can't read the project folder, first ask me who it's for and what problem it solves.",
      ].join("\n"),
    storyIntro:
      "Help me write the build story of this project to show off on Jadinya (jadinya.dev).",
    storyBody: (moment, lessons) =>
      [
        "Write the three moments below. Use only evidence from `git log`, the agent files, or our chat history. If there's no evidence, leave it empty and ask me; don't make things up. Mark [DRAFT, CHECK] where you reworded things.",
        "",
        `1. The prompt that made me go "whoa" (max ${moment} characters): which prompt surprised me most? Write the prompt and what happened.`,
        `2. The hardest part (max ${moment} characters): the most frustrating part, and how I got past it.`,
        `3. If I started over (max ${lessons} characters): what I'd do differently.`,
        "",
        "Write as me (first person), casual and honest, in plain everyday English. 2–4 sentences per moment is enough.",
      ].join("\n"),
  },
};

/** What the form already knows about the project, one line each. */
function knownFacts(copy: Copy, facts: Facts, withKeyPrompt: boolean) {
  const title = facts.title.trim();
  const tagline = facts.tagline.trim();
  return [
    title || tagline ? `${copy.project}: ${[title, tagline].filter(Boolean).join(" — ")}` : "",
    facts.repoUrl.trim() ? `${copy.repo}: ${facts.repoUrl.trim()}` : "",
    facts.liveUrl.trim() ? `${copy.live}: ${facts.liveUrl.trim()}` : "",
    withKeyPrompt && facts.keyPrompt.trim() ? `${copy.keyPrompt}: ${facts.keyPrompt.trim()}` : "",
  ].filter(Boolean);
}

/** Step 3: drafts the key prompt. */
export function keyPromptHelper(facts: Facts, lang: ContentLang) {
  const copy = COPY[lang];
  return [
    copy.keyPromptIntro,
    ...knownFacts(copy, facts, false),
    "",
    copy.readFolder,
    "",
    copy.keyPromptBody(PROJECT_LIMITS.keyPrompt),
    copy.noSecrets,
    "",
    lang === "id"
      ? "Jawab dengan kalimatnya saja di satu blok kode, lalu jumlah karakternya."
      : "Reply with just the sentence in one code block, followed by its character count.",
  ].join("\n");
}

/** Step 5: drafts the three story moments. */
export function storyHelper(facts: Facts, lang: ContentLang) {
  const copy = COPY[lang];
  return [
    copy.storyIntro,
    ...knownFacts(copy, facts, true),
    "",
    copy.readFolder,
    "",
    copy.storyBody(PROJECT_LIMITS.moment, PROJECT_LIMITS.lessons),
    copy.noSecrets,
    "",
    lang === "id"
      ? "Tulis setiap momen di blok kode sendiri supaya mudah disalin, beserta jumlah karakternya."
      : "Put each moment in its own code block so it's easy to copy, with its character count.",
  ].join("\n");
}
