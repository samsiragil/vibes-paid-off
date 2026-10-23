# Jadinya (dulu Vibes Paid Off): Spec & Implementation Plan

> **Ganti nama (2026-10-23):** brand berubah dari *Vibes Paid Off* menjadi **Jadinya**, domain `jadinya.dev`. Nama lama di bawah (artboard `VPO-*`, project Supabase `vibes-paid-off-*`, bucket `vpo-*`) adalah nama infrastruktur dan desain yang sengaja tidak diubah.

Sumber:
- Brief: "Brief Katalog Vibe Coding" (rev 23, 2026-10-13), https://claude.ai/artifact/GdKYEymPs4dLgXxafuvRgw
- Desain: canvas "Vibes Paid Off — Desain", halaman **Vibes Paid Off · Desktop (Percakapan)** (artboard `VPO-*`), https://claude.ai/artifact/QthNSkEWsozvZLuTP6qfLZ

Dokumen ini dipakai sebagai acuan implementasi bertahap. Setiap fase bisa di-merge dan di-deploy sendiri. Bagian yang masih bergantung pada jawaban pertanyaan diberi tanda **[Q#]**, lengkap dengan asumsi default supaya pekerjaan tetap bisa jalan.

---

## 1. Ringkasan analisis

### 1.1 Yang sudah jelas

- Produk: katalog + portfolio proyek vibe coding, bilingual ID/EN, gratis, didanai donasi, jalan di free tier.
- Stack: Next.js App Router + TypeScript + Tailwind, Supabase (Postgres, Auth GitHub/Google, RLS), Cloudflare R2 (gambar), Cloudflare (DNS, Turnstile, Web Analytics), Vercel Hobby, next-intl.
- Larangan portabilitas: tidak memakai Vercel Blob/KV/Postgres maupun optimasi gambar bawaan Vercel (`next/image` harus `unoptimized` atau memakai loader custom ke R2).
- Moderasi hybrid: proyek pertama di-review, setelah disetujui maker menjadi "terpercaya" dan proyek berikutnya langsung tayang. Proyek otomatis disembunyikan setelah dilaporkan 3 akun berbeda.
- 9 halaman MVP sudah punya desain desktop: `/`, `/explore`, `/p/[slug]`, `/u/[username]`, `/tools/[slug]`, `/submit`, `/me`, `/support`, `/admin`.

### 1.2 Arah desain final (halaman `VPO-*`)

Desain memakai konsep **"Percakapan"**: setiap proyek tampil sebagai obrolan. Bubble gelap/abu di kanan berisi *prompt kunci* dari maker, diikuti label "X jam kemudian", lalu bubble putih di kiri berisi screenshot + judul (hasil dari AI). Istilah di UI:

| Istilah brief | Istilah di desain |
|---|---|
| Proyek | Obrolan |
| Upvote | Worth it |
| Komentar | Balasan |
| Submit | Pamerin proyekmu |
| Donasi | Beliin kopi / Traktir kopi |

**Design tokens** (diambil dari artboard):

| Token | Nilai | Pemakaian |
|---|---|---|
| `bg` | `#F7F6F2` | Latar halaman |
| `surface` | `#FFFFFF` | Kartu, input |
| `ink` | `#191919` | Teks utama, tombol primer gelap, bubble prompt |
| `ink-2` | `#4A4A46` | Teks sekunder |
| `muted` | `#6B6B66` | Label mono, meta |
| `border` | `#E4E2DB` | Garis pemisah, border kartu |
| `border-strong` | `#D6D4CC` | Border tombol sekunder/pill |
| `accent` | `#1E5446` | Aksen tunggal (CTA, avatar, link) |
| `accent-ink` | `#123A30` | Teks di atas `accent-soft` |
| `accent-soft` | `#E3EEE9` | Badge, state voted |
| `bubble` | `#F1F0EA` | Bubble prompt (varian terang) |
| `placeholder` | `#EFEEE8` | Placeholder screenshot |
| `dashed` | `#B9B8B1` | Slot upload kosong |

- Font: **Fraunces** (display, sering italic untuk aksen), **Geist** (body/UI), **Geist Mono** (label kecil berhuruf kapital, meta).
- Bentuk: pill (radius penuh) untuk tombol/chip, kartu radius 22px, bubble dengan satu sudut 4–6px (ekor bubble).
- Kontainer: `max-width: 1200px`, gutter 24px. Tinggi target sentuh minimal 44px.
- Avatar AI/sistem: lingkaran outline berisi huruf "V" italic (Fraunces), dipakai untuk pesan sistem (empty state, sukses submit, banner link offline).

### 1.3 Inventaris komponen (dari desain)

`SiteHeader` (logo, nav Jelajah/Tools/Dukung kami, toggle ID/EN, avatar ke `/me`, CTA "Pamerin proyekmu"), `SiteFooter` (versi lengkap di beranda, versi ringkas di halaman lain), `PromptBubble`, `ResultBubble` (screenshot + judul), `SystemMessage` (avatar "V" + bubble), `ProjectCard` (kartu obrolan grid), `ProjectRow` (baris "Baru masuk"), `WorthItButton` (toggle, state voted), `Pill`/`Chip` (tools, filter, segmented sort), `Badge` (Live/Offline/Diarsipkan, ID/EN, Maker terpercaya, Pilihan minggu ini), `Avatar` (inisial atau foto), `StatBlock` (profil), `MediaGallery` (3 thumbnail + video), `CommentList` + `CommentForm`, `ReportButton`, `FilterSidebar`, `SearchBar`, `CopyLinkField`, `ProcessTimeline` ("Cara membuatnya"), `ProjectMetaSidebar` (tools, lama bikin, kategori, repo, status link, traktir), `ConversationalForm` (submit), `LiveCardPreview`, `CostTable` (support), `AdminTabs`, `ReviewQueueItem`, `ReportItem`, `ToolsTable`.

### 1.4 Gap dan konflik brief vs desain

| # | Temuan | Dampak |
|---|---|---|
| G1 | Brief: "Galeri dulu, gambar adalah bintangnya". Desain: prompt kunci jadi pembuka kartu, screenshot jadi "balasan". | ✔ **Diputuskan:** prompt kunci **wajib**. |
| G2 | Detail proyek menampilkan "Cara membuatnya" per **sesi** (Sesi 1 · Sabtu malam · 4 jam: prompt, hasil, kendala, solusi). Form submit dan skema brief hanya punya field datar: prompt kunci, kendala+solusi, pelajaran. | ✔ **Diputuskan:** model **per sesi** (tabel `project_sessions`), form submit ikut per sesi. Lihat §2.2 dan Fase 4. |
| G3 | Desain memasukkan Supabase dan Tailwind sebagai "tools", padahal tabel `tools` di brief berisi AI tools. | ✔ **Diputuskan:** katalog tools dibuat **selengkap mungkin** (AI dan stack), dikelompokkan per jenis. Lihat §2.8. |
| G4 | Beranda punya badge "Pilihan minggu ini" (hero). Kurasi masuk v2 di brief. | ✔ **Diputuskan:** **tanpa kurasi manual**; dipilih otomatis dengan rumus yang adil dan transparan. Lihat §2.7. |
| G5 | Brief: mode gelap sejak awal dan mobile-first. Desain VPO hanya light dan desktop (artboard HP hanya ada untuk konsep lama "Hold My Prompt"). | ✔ **Diputuskan:** diturunkan sendiri saat coding. |
| G6 | Tidak ada desain untuk login, onboarding username, edit proyek, logged-out header, halaman aturan komunitas, 404/500. | ✔ **Diputuskan:** dibuat mengikuti gaya desain yang ada. |
| G7 | Jelajah mencari dari "prompt, judul, atau tagline". Brief: tsvector dari judul, tagline, deskripsi. | Tambahkan prompt ke tsvector (sudah diasumsikan). |
| G8 | Lama pengerjaan bisa "jam" atau "hari". Kartu menampilkan "6 jam kemudian". | ✔ Terjawab lewat G2: lama pengerjaan = jumlah durasi semua sesi (dalam jam). Lihat Q23. |
| G9 | Status link "Diarsipkan" dan aturan kapan link dianggap offline belum jelas. | **[Q8]** |
| G10 | Kategori di desain tidak konsisten (Jelajah: 5, Submit: 6, kartu: "Gaya hidup", "Personal"). Brief juga menandai ini sebagai keputusan terbuka. | **[Q9]** |
| G11 | "Tonton demo · 1:42" butuh durasi video. YouTube oEmbed tidak memberi durasi, Data API butuh API key. | Default: durasi tidak ditampilkan. **[Q15]** |
| G12 | Profil edit di desain tidak punya field foto. | Default: foto dari avatar OAuth, fallback inisial. **[Q14]** |
| G13 | Email persetujuan/penolakan butuh layanan email transaksional, belum ada di stack. | **[Q10]** |

---

## 2. Spesifikasi teknis

### 2.1 Struktur repo (usulan)

```
vibes-paid-off/
├─ app/
│  ├─ [locale]/
│  │  ├─ layout.tsx               # header, footer, provider tema & i18n
│  │  ├─ page.tsx                 # Beranda
│  │  ├─ explore/page.tsx
│  │  ├─ p/[slug]/page.tsx
│  │  ├─ p/[slug]/edit/page.tsx
│  │  ├─ u/[username]/page.tsx
│  │  ├─ tools/[slug]/page.tsx
│  │  ├─ submit/page.tsx
│  │  ├─ me/page.tsx
│  │  ├─ support/page.tsx
│  │  ├─ rules/page.tsx           # aturan komunitas
│  │  ├─ login/page.tsx
│  │  ├─ onboarding/page.tsx      # pilih username
│  │  └─ admin/page.tsx
│  ├─ auth/callback/route.ts
│  ├─ api/media/presign/route.ts
│  ├─ api/media/finalize/route.ts
│  ├─ sitemap.ts, robots.ts
├─ components/ (ui/, project/, layout/, admin/)
├─ lib/ (supabase/, r2/, turnstile.ts, slug.ts, format.ts, validation/)
├─ messages/ (id.json, en.json)
├─ supabase/ (migrations/, seed.sql, config.toml)
├─ scripts/ (link-checker.ts, export-db.ts)
└─ .github/workflows/ (ci.yml, link-check.yml, backup.yml)
```

Library: `@supabase/ssr`, `next-intl`, `zod`, `react-hook-form`, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (R2 kompatibel S3), `sharp`, `next-themes`, `geist` (font). Package manager default: pnpm.

### 2.2 Model data (revisi dari brief)

Perubahan terhadap brief ditandai ✱.

**Enum**
- `project_status`: `pending`, `published`, `hidden`, `rejected`, ✱`removed` (soft delete oleh admin/maker)
- `link_status`: `live`, `offline`, `archived`
- `content_lang`: `id`, `en`
- ✱`tool_kind`: `ai_agent`, `ai_builder`, `ai_assistant`, `framework`, `backend`, `hosting`, `service` (lihat §2.8)
- ✱`report_reason`: `spam`, `scam`, `adult_illegal`, `harassment`, `personal_data`, `other`
- `comment_status`: `visible`, `hidden`

**profiles**: `id` (= auth.users.id), `username` (unik, citext, regex `^[a-z0-9_]{3,20}$`, plus daftar nama terlarang seperti `admin`, `me`, `api`), `display_name`, `avatar_url`, `bio` (maks 280), `location`, `links` jsonb `{github, linkedin, x, website}`, `tip_url`, `is_trusted`, `is_admin`, `created_at`.

**projects**: `id`, `owner_id`, `slug` (unik, stabil setelah dibuat), `title`, `tagline` (≤80), `description`, ✱`key_prompt` (**wajib**, ≤280, pembuka kartu), `lessons` (opsional, "Pelajaran dari {maker}"), `live_url`, `repo_url`, `video_url`, `category` (slug), ✱`build_time_hours` numeric (**turunan**: jumlah `duration_hours` semua sesi, diisi trigger, tidak diinput langsung), ✱`session_count` (turunan), `content_lang`, `status`, `link_status`, `last_checked_at`, ✱`link_fail_count`, `upvote_count`, ✱`comment_count`, ✱`report_count`, ✱`published_at`, ✱`reviewed_by`, ✱`reviewed_at`, ✱`reject_reason`, ✱`search` tsvector (dari title, tagline, key_prompt, description, plus prompt semua sesi; diperbarui trigger karena melibatkan tabel lain; config `simple` karena Postgres tidak punya kamus bahasa Indonesia), `created_at`, ✱`updated_at`.

Kolom `challenges` di brief dipindah ke level sesi (kendala + solusi per sesi).

✱**project_sessions** (wajib, minimal 1, maksimal 10 per proyek): `id`, `project_id`, `sort_order`, `label` (opsional, contoh "Sabtu malam"), `duration_hours` numeric (wajib, kelipatan 0,5, maks 24 per sesi), `prompt` (wajib, ≤1000), `result` (wajib, ≤500, "apa yang jadi"), `challenge` (opsional), `solution` (opsional, hanya bermakna bila `challenge` diisi), `created_at`.

- Detail proyek menampilkan "X jam dan N sesi kemudian" dari `build_time_hours` + `session_count`; kartu cukup "X jam kemudian".
- Metrik brief "60% proyek dengan bagian proses terisi" diukur sebagai: minimal satu sesi punya `challenge`, atau `lessons` terisi.

✱**weekly_picks**: `week_start` (date, PK, Senin WIB), `project_id`, `score`, `breakdown` jsonb (jumlah vote layak, jumlah pembalas layak, kandidat lain teratas), `computed_at`. Hasil perhitungan otomatis "Pilihan minggu ini" (§2.7), dibekukan selama seminggu dan bisa diaudit.

**project_media**: `id`, `project_id`, `r2_key`, `width`, `height`, `bytes`, `sort_order` (maks 3 per proyek, dijaga trigger).

**tools**: `id`, `slug`, `name`, `url`, `logo_url`, ✱`kind` (`tool_kind`), ✱`description_id`, ✱`description_en` (dipakai halaman `/tools/[slug]`), ✱`is_active`, ✱`project_count` (turunan, untuk urutan filter).

✱**tool_suggestions**: `id`, `name`, `url`, `suggested_by`, `project_id`, `status` (`pending`/`merged`/`rejected`), `created_at`. Dipakai saat maker tidak menemukan tools-nya di daftar (§2.8).

**project_tools**, **upvotes** (PK `user_id, project_id`, ada `created_at`), **comments** (`id`, `project_id`, `user_id`, `body` ≤1000, `status`, `created_at`).

**reports**: `id`, `reporter_id`, `target_type` (`project`|`comment`), `target_id`, `reason`, ✱`note`, `resolved`, ✱`resolved_by`, ✱`resolution`, `created_at`. ✱Unique `(reporter_id, target_type, target_id)` supaya satu akun hanya menghitung satu laporan.

**Kategori**: daftar slug tetap (enum atau tabel kecil `categories`) dengan label di `messages/*.json`. Tergantung [Q9].

**Trigger / function**
- `upvote_count` dan `comment_count` diperbarui via trigger.
- `report_count` + auto-hide: saat laporan unik ke-3 masuk, proyek `published` → `hidden` (komentar `visible` → `hidden`).
- Setelah admin menyetujui proyek pertama: `profiles.is_trusted = true`.
- Insert proyek: status `published` bila owner terpercaya, selain itu `pending` (diset di DB, bukan di klien).
- Batas harian: function `check_rate_limit()` di trigger insert, 3 proyek dan 30 komentar per akun per 24 jam.
- `build_time_hours`, `session_count`, dan `search` dihitung ulang via trigger setiap kali sesi berubah.
- RPC `popular_this_week(limit)` dan job `compute_weekly_pick()`: rumus di §2.7.
- RPC `search_projects(q, tools[], categories[], lang, sort, cursor)` untuk halaman jelajah.
- View `profile_stats`: jumlah obrolan tayang, total jam, total worth it, tools andalan.

**RLS (ringkas)**
- Publik: baca `projects` dengan status `published`, plus media/tools/komentar `visible` milik proyek tersebut; baca `profiles` (kolom publik).
- Owner: baca semua proyek miliknya (status apa pun), insert, update field konten (bukan `status`, `upvote_count`, dan sejenisnya; dikunci dengan trigger `BEFORE UPDATE` atau dengan memisahkan kolom yang boleh diubah).
- Upvote/komentar/laporan: hanya user login, hanya untuk dirinya sendiri.
- Admin (`is_admin`): semua operasi moderasi. Operasi admin lewat server action yang memakai service role hanya bila benar-benar perlu.

### 2.3 Alur status proyek

```
                 ┌── (owner terpercaya) ──────────────┐
submit ──► pending ──approve──► published ◄──pulihkan── hidden
             │                    │   ▲                   ▲
          reject                  │   └── edit oleh owner │
             ▼                    └── 3 laporan / admin ──┘
          rejected ──(edit & kirim ulang? [Q11])──► pending
admin/owner hapus ──► removed
```

### 2.4 Pipeline gambar

1. Browser mengompres dulu (resize ke sisi terpanjang 1600px) supaya upload ringan.
2. `POST /api/media/presign` (login, cek kuota 3 gambar) → presigned PUT ke `tmp/{userId}/{uuid}`.
3. Browser upload langsung ke R2.
4. `POST /api/media/finalize` → server mengambil objek tmp, `sharp` re-encode ke WebP (buang EXIF, turunkan quality sampai ≤300 KB), simpan ke `p/{projectId}/{uuid}.webp`, hapus tmp, insert `project_media`.
5. Lifecycle rule R2 menghapus `tmp/` yang berumur lebih dari 1 hari.
6. Gambar disajikan dari domain publik R2 (`img.jadinya.dev`). Catatan: subdomain `r2.dev` dibatasi rate-nya dan tidak untuk produksi, jadi domain sebaiknya dibeli sebelum peluncuran.

### 2.5 i18n

- `next-intl`, `localePrefix: 'always'` (`/id/...`, `/en/...`). Middleware mendeteksi bahasa browser dan menyimpan cookie saat user mengganti bahasa.
- Semua teks UI ada di `messages/id.json` dan `messages/en.json`, tidak ada teks hardcode di komponen (cek otomatis dengan lint/skrip di CI).
- Konten maker tidak diterjemahkan; ditampilkan dengan badge `ID`/`EN`.
- `hreflang` di metadata setiap halaman, sitemap per bahasa.
- Link donasi footer mengikuti bahasa aktif.

### 2.6 Keamanan

- Tidak ada iframe aplikasi maker.
- Semua link keluar: `rel="nofollow ugc noopener noreferrer"` + `target="_blank"`. Validasi URL wajib `https:`, video hanya domain YouTube/Loom.
- Turnstile diverifikasi di server pada submit proyek dan komentar.
- Validasi zod yang sama dipakai di klien dan server action.
- Header keamanan (CSP dasar, `X-Content-Type-Options`, `Referrer-Policy`).
- Secret (R2 key, service role, Turnstile secret) hanya ada di server.

### 2.7 Peringkat otomatis yang adil (tanpa kurasi manual)

Prinsip: tidak ada tombol "feature" untuk admin. Semua peringkat di situs dihitung dari rumus yang sama, deterministik, bisa diaudit, dan dijelaskan terbuka di halaman "Cara kami memilih" (bagian dari `/support` atau `/about`).

**Vote layak (eligible vote).** Hanya vote yang memenuhi semua syarat berikut yang dihitung untuk peringkat:
- Akun pemberi vote sudah berumur ≥ 72 jam **pada saat skor dihitung** (meredam akun dadakan).
- Pemberi vote bukan pemilik proyek (sudah dicegah di DB).
- Proyek berstatus `published`.

Vote dari akun yang belum layak tetap tersimpan dan tetap terlihat di angka "Worth it" (`upvote_count`); vote itu hanya belum ikut peringkat. Setelah akunnya berumur 72 jam, vote yang sama otomatis ikut terhitung dengan `created_at` aslinya, jadi tetap masuk jendela minggu saat vote itu diberikan. Lihat Q24.

**Pembalas layak.** Akun berbeda (bukan pemilik proyek, umur ≥ 72 jam) yang menulis balasan `visible` dalam jendela waktu yang sama. Satu akun dihitung satu kali per proyek, berapa pun jumlah balasannya.

**A. "Obrolan terpopuler minggu ini" (beranda, rolling 7 hari, real time)**

```
skor = vote_layak_7_hari + 0,5 × pembalas_layak_7_hari
```

Urutan tie-break: `vote_layak_7_hari` lebih banyak → `published_at` lebih awal → `id`. Satu maker maksimal tampil 1 kali di daftar ini, supaya satu orang tidak memenuhi semua slot.

**B. "Pilihan minggu ini" (hero beranda, dibekukan per minggu)**

- Jendela: Senin 00:00 sampai Minggu 23:59 WIB. Job `compute_weekly_pick()` berjalan setiap Senin 00:05 WIB (pg_cron di Supabase, cadangan lewat GitHub Actions) dan menyimpan pemenang di `weekly_picks`.
- Kandidat: proyek `published`, `link_status` bukan `archived`, punya ≥ 1 screenshot, belum pernah menjadi pilihan minggu ini, dan makernya tidak terpilih dalam 4 minggu terakhir (rotasi supaya adil).
- Skor memakai rumus yang sama seperti A, tetapi pada jendela minggu sebelumnya.
- Ambang minimum: skor ≥ 3. Bila tidak ada kandidat yang lolos, hero menampilkan proyek `published` terbaru dengan label "Baru masuk", bukan "Pilihan minggu ini".
- Bila pemenang kemudian disembunyikan (laporan) atau diarsipkan, peringkat kedua dari `breakdown` otomatis naik tanpa campur tangan admin.
- `breakdown` disimpan apa adanya, sehingga setiap pilihan bisa dijelaskan ("dipilih karena 23 vote layak dan 6 pembalas minggu lalu").

**C. Urutan "Paling worth it" di jelajah dan halaman tools**: `eligible_upvote_count` (total vote layak sepanjang waktu), tie-break `published_at` lebih baru.

Implikasi skema: kolom turunan `projects.eligible_upvote_count` (diperbarui trigger; job harian menambahkan vote yang baru menjadi layak), index `upvotes(project_id, created_at)` dan `comments(project_id, created_at)`.

### 2.8 Katalog tools selengkap mungkin

Tools adalah sumbu penemuan utama (filter jelajah, halaman `/tools/[slug]`, chip di kartu), jadi daftarnya dibuat lengkap sejak awal dan dikelompokkan per jenis.

| Jenis (`kind`) | Label UI | Seed awal |
|---|---|---|
| `ai_agent` | Agen & editor AI | Claude Code, Cursor, Windsurf, GitHub Copilot, Cline, Roo Code, Kilo Code, Aider, OpenAI Codex, Gemini CLI, Amp, Kiro, Trae, Zed, Warp, Devin, Jules, Continue, JetBrains Junie, Augment Code, Qodo |
| `ai_builder` | App builder AI | Lovable, Bolt, v0, Replit, Firebase Studio, Google AI Studio, Create/Anything, Tempo, Same, Rocket, Base44, Softgen, Dyad, Bubble AI, Webflow AI, Framer AI, Glide, FlutterFlow |
| `ai_assistant` | Asisten AI | Claude, ChatGPT, Gemini, DeepSeek, Grok, Perplexity, Qwen, Mistral Le Chat, Meta AI, Microsoft Copilot |
| `framework` | Framework & bahasa | Next.js, React, Vue, Nuxt, Svelte/SvelteKit, Astro, Remix, Angular, Solid, Tailwind CSS, shadcn/ui, Laravel, Django, FastAPI, Flask, Express, Hono, NestJS, Ruby on Rails, Flutter, React Native, Expo, Electron, Tauri, Python, TypeScript, Go, PHP |
| `backend` | Database & backend | Supabase, Firebase, Convex, PocketBase, Appwrite, Neon, PlanetScale, Turso, MongoDB, PostgreSQL, MySQL, SQLite, Redis, Prisma, Drizzle |
| `hosting` | Hosting & deploy | Vercel, Netlify, Cloudflare, Railway, Render, Fly.io, Heroku, GitHub Pages, AWS, Google Cloud, DigitalOcean, Coolify |
| `service` | Layanan & integrasi | Stripe, Midtrans, Xendit, Clerk, Auth0, Resend, Twilio, WhatsApp Cloud API, Telegram Bot API, OpenAI API, Anthropic API, Gemini API, OpenRouter, Hugging Face, ElevenLabs, Replicate, n8n, Make, Zapier, Google Sheets, Notion API |

Catatan: daftar seed di atas perlu dicek ulang (nama, URL, slug, duplikat) saat menulis `seed.sql`.

Perilaku:
- **Form submit**: pilih banyak dengan combobox yang bisa dicari, dikelompokkan per jenis; 8 tools paling populer tampil sebagai chip cepat (seperti desain). Minimal 1 tools jenis `ai_*` wajib dipilih, karena ini katalog vibe coding.
- **Tools belum ada**: maker bisa mengetik nama + URL; tersimpan di `tool_suggestions` dan langsung tampil sebagai teks biasa di proyek itu. Admin cukup menggabungkannya ke katalog (merge), lalu relasi `project_tools` dibuat otomatis untuk semua proyek yang menyarankan nama yang sama.
- **Filter jelajah**: dikelompokkan per jenis; setiap grup menampilkan 6 tools dengan proyek terbanyak + tombol "Lihat semua (N)" + kotak cari. Tools dengan 0 proyek disembunyikan dari filter tetapi tetap punya halaman.
- **Halaman `/tools/[slug]`**: tersedia untuk semua tools; switcher di atas menampilkan tools teratas per jenis.
- **Kartu proyek**: menampilkan tools `ai_*` dulu, sisanya "+N".

---

## 3. Rencana implementasi bertahap

Urutan mengikuti 4 minggu di brief, dipecah lebih kecil. Setiap fase memuat tujuan, tugas, dan *Definition of Done* (DoD).

### Fase 0 — Persiapan akun & keputusan (½ hari)

- [x] Jawab Q1–Q6 (lihat bagian 4).
- [x] Jawab Q23–Q28 (semua default disetujui).
- [ ] Beli `jadinya.dev` di Cloudflare Registrar (risiko domain diambil orang).
- [ ] Buat project Supabase (region Singapore) ✔ dev sudah dibuat (2026-10-15), R2 bucket `vpo-media` + domain publik, Turnstile site key, OAuth app GitHub dan Google.
- [ ] Repo GitHub + project Vercel terhubung.

**DoD:** semua kredensial tersimpan di Vercel env dan `.env.local`; `.env.example` dibuat tanpa nilai rahasia.

### Fase 1 — Fondasi aplikasi & design system (1–2 hari)

- [x] `create-next-app` (TS, App Router, Tailwind, ESLint), pnpm, Prettier.
- [x] Token warna sebagai CSS variables di `:root` + `[data-theme=dark]`, dipetakan ke Tailwind theme. Token dark diturunkan dari palet light ([Q5]).
- [x] Font Fraunces, Geist, Geist Mono via `next/font`.
- [x] `next-intl` dengan rute `[locale]`, middleware, `messages/id.json` + `en.json`.
- [x] `next-themes`: ikut sistem + toggle.
- [x] Komponen dasar: `Button` (primary ink, primary accent, outline), `Pill`, `Badge`, `Avatar`, `PromptBubble`, `ResultBubble`, `SystemMessage`, `Input`/`Textarea`/`Select` dengan label.
- [x] `SiteHeader` dan `SiteFooter` (state login dan logout), toggle bahasa.
- [x] Halaman `/[locale]/dev/ui` (non-produksi) untuk memeriksa komponen di light/dark dan lebar 375px.
- [x] CI: lint, typecheck, build.

**Status (2026-10-15):** selesai secara lokal: lint, typecheck, dan build lolos; dicek di 1440px dan 375px (tanpa scroll horizontal), light/dark, ganti bahasa, menu HP. Belum: deploy ke Vercel (butuh akun, Fase 0) dan audit Lighthouse.

**DoD:** deploy ke `vibespaidoff.vercel.app`, `/id` dan `/en` tampil dengan header/footer, dark mode jalan, Lighthouse a11y ≥ 95 di halaman kosong.

### Fase 2 — Database, RLS & Auth (2 hari)

- [x] Supabase CLI lokal, migrasi awal: enum, semua tabel, index (slug, owner, status+published_at, GIN `search`), trigger, RPC, RLS.
- [x] `seed.sql`: katalog tools lengkap per jenis (§2.8) dengan deskripsi ID/EN, kategori. Admin diset manual lewat SQL setelah login pertama (Q18).
- [x] Trigger turunan sesi (`build_time_hours`, `session_count`, `search`), `eligible_upvote_count`, RPC `popular_this_week`, function `compute_weekly_pick()` + jadwal pg_cron (§2.7).
- [x] Test SQL untuk rumus peringkat: vote dari akun < 72 jam tidak dihitung, tie-break benar, rotasi maker 4 minggu, ambang skor 3, fallback "Baru masuk".
- [x] Test RLS (SQL atau Vitest + supabase-js dengan 3 role: anon, user, admin).
- [x] Login GitHub + Google (`@supabase/ssr`), `/auth/callback`, trigger buat `profiles` saat user baru.
- [x] `/onboarding`: pilih username (cek ketersediaan live) sebelum bisa submit.
- [x] `/login` sesuai gaya desain ([Q6]).
- [x] Generate TypeScript types dari skema.

**Status (2026-10-15):** dikerjakan di branch `feat/phase-2-db-auth` terhadap project Supabase dev (`vibes-paid-off-dev`, Singapore). Migrasi dan seed sudah di-push (`pnpm db:push`), 82 test SQL lulus (`pnpm db:test`: 19 peringkat, 63 RLS/trigger). Test berjalan lewat `supabase db query --linked` dalam satu transaksi yang selalu dibatalkan, jadi tidak butuh Docker dan tidak meninggalkan data. Typecheck, lint, dan build lolos. Redirect OAuth GitHub dan Google sudah dicek sampai halaman login penyedia. Belum: login end-to-end dengan akun asli, lalu set `is_admin` untuk akun admin. Catatan: job harian `refresh-eligible-upvotes` (item Fase 9) sudah terjadwal di pg_cron; `/me` masih placeholder (nama, username, tombol Keluar) sampai Fase 5. Keputusan kecil: `live_url` wajib, kategori memakai default Q9 (tabel `categories`, label di `messages/*.json`), username boleh kosong sampai onboarding.

**DoD:** user bisa login/logout dengan kedua provider, profil terbentuk, test RLS lulus (anon tidak bisa membaca `pending`, user tidak bisa mengubah status sendiri, dan seterusnya).

### Fase 3 — Upload media ke R2 (1 hari)

- [x] Client R2 (S3 SDK), route `presign` dan `finalize` sesuai §2.4.
- [x] Lifecycle rule `tmp/` (skrip `pnpm r2:setup`, sekaligus CORS untuk upload dari browser).
- [x] Komponen `MediaUploader` (3 slot, urutkan, hapus, progress).
- [x] Helper URL gambar publik + `next/image` dengan `unoptimized`.

**DoD:** upload JPG 5 MB menghasilkan WebP ≤300 KB tanpa EXIF di R2, upload ke-4 ditolak, file tmp terhapus.

**Status (2026-10-15):** dikerjakan di branch `feat/phase-3-r2-media`. Kode R2 ada di `lib/r2/` (client S3 lazy dan `server-only`, layout key `tmp/{userId}/{uuid}` → `p/{projectId}/{uuid}.webp`), pipeline gambar di `lib/media/`, route di `app/api/media/{presign,finalize}`, komponen di `components/project/media-uploader.tsx`, dan `MediaImage` di `components/ui/`. `images.unoptimized` juga diset global di `next.config.ts`. Migrasi `20261015120000_media_order.sql` (RPC `reorder_project_media` dan trigger yang memadatkan `sort_order` setelah hapus) sudah di-push ke DB dev, dengan 9 test baru di `supabase/tests/03_media.sql`. Lint, typecheck, format, dan build lolos.

Sudah diuji tanpa R2: encoder dengan JPEG 9 MB 4000×3000 ber-EXIF menghasilkan WebP 174 KB 1200×1600, orientasi diterapkan, dan EXIF hilang. URL presign hanya menandatangani `content-length;content-type;host` dan tanpa checksum. Uploader di `/dev/ui` (HP dan desktop) menolak GIF, membatasi 3 gambar, serta bisa menggeser dan menghapus gambar. Route membalas 401 bila belum login.

Keputusan: di `/submit` proyek belum ada, jadi `MediaUploader` tanpa `projectId` menahan gambar terkompres di browser. Fase 4 memanggil `ref.uploadPending(projectId)` setelah `createProject` berhasil. Dengan `projectId` (halaman edit), setiap perubahan langsung disimpan. Baris `project_media` di-insert server memakai secret key setelah kepemilikan dicek.

Belum (menunggu env R2 diisi): upload nyata ke R2 dan lifecycle `tmp/`. Cara uji: isi `R2_*` dan `NEXT_PUBLIC_MEDIA_BASE_URL` di `.env.local` (token R2 dengan izin Admin Read & Write), jalankan `pnpm r2:setup`, lalu login dan upload ke proyek milik sendiri lewat uploader dengan `projectId`. Cek objek `p/{projectId}/*.webp` ≤300 KB tanpa EXIF, pastikan tidak ada sisa di `tmp/`, dan pastikan upload ke-4 dibalas 409. Env yang sama juga perlu diisi di Vercel.

### Fase 4 — Submit & edit proyek (2–3 hari)

- [x] `/submit` mengikuti gaya `VPO-Submit`, dengan alur yang disesuaikan ke model sesi: prompt kunci (wajib) → judul/tagline/deskripsi/link → screenshot/video → tools (combobox per jenis + chip cepat + "tools belum ada") /kategori/bahasa → **Sesi pembuatan** → pelajaran → aturan komunitas + Turnstile.
- [x] Blok **Sesi pembuatan**: kartu sesi berulang (label opsional, durasi jam, prompt, hasil, kendala + solusi opsional), tombol "Tambah sesi", hapus, ubah urutan; minimal 1, maksimal 10. Total jam dan jumlah sesi tampil live di pratinjau ("6 jam dan 2 sesi kemudian"). Field lama pengerjaan terpisah dihapus dari form.
- [x] `LiveCardPreview` sticky di kanan (stack di bawah pada HP).
- [x] Counter tagline 80, validasi zod, slug otomatis dari judul (unik, ditambah suffix bila bentrok).
- [x] Server action `createProject`: verifikasi Turnstile, rate limit, status ditentukan DB.
- [x] Pesan sukses (SystemMessage) dengan ajakan traktir kopi, muncul sekali.
- [x] `/p/[slug]/edit` memakai form yang sama, hanya untuk owner.
- [x] Simpan draf di `localStorage` agar isian tidak hilang ([Q12]); draf sesi ikut tersimpan.
- [x] Server action menyimpan proyek + sesi + tools dalam satu transaksi (RPC `upsert_project`).

**DoD:** maker baru mengirim proyek → status `pending`; maker terpercaya → langsung `published`; edit oleh owner tersimpan; owner lain ditolak.

**Status (2026-10-16):** dikerjakan di branch `feat/phase-4-submit` (lanjutan Fase 3). RPC `upsert_project(p_project, p_slug_base, p_project_id)` di migrasi `20261016090000_upsert_project.sql` berjalan sebagai pemanggil (security invoker), jadi RLS, grant kolom, dan trigger yang sudah ada tetap menentukan status, rate limit, dan kepemilikan. Slug dibuat dari judul (`lib/slug.ts`), bentrok jadi `-2` … `-9` lalu suffix acak, dan tidak berubah setelah dibuat. Sesi yang id-nya dikirim ulang diperbarui di tempat, sisanya diganti. Saran tools pending mengikuti daftar terbaru. 24 test baru di `supabase/tests/04_upsert_project.sql` (DoD di atas, validasi, rate limit lewat RPC, proyek ditolak yang diedit kembali ke `pending`) lulus terhadap DB dev dalam transaksi yang dibatalkan. Migrasi sudah di-push ke DB dev; tipe RPC di `database.types.ts` ditulis tangan sesuai keluaran `db:types`.

Kode: validasi bersama di `lib/validation/project.ts` (kode error → `projectForm.errors.*`), server action `saveProject` di `lib/projects/actions.ts` (Turnstile hanya untuk proyek baru, `lib/turnstile.ts`), katalog tools/kategori ber-`use cache` di `lib/projects/catalog.ts`, form di `components/project/` (`project-form`, `session-editor`, `tool-picker`, `project-card` untuk pratinjau dan dipakai lagi di Fase 5–6, `turnstile`). Form baru dirender setelah hidrasi supaya draf `localStorage` bisa langsung jadi state awal; gambar tidak ikut draf. `/p/[slug]/edit` memakai `instant = false` (header memakai `usePathname()`, jadi rute dinamis tanpa `generateStaticParams` tidak bisa punya static shell).

Keputusan kecil: minimal 1 tools jenis `ai_*` dari katalog dicek di klien dan di RPC (saran tools tidak dihitung); chip cepat = 8 tools dengan `project_count` terbanyak, seri dipecah urutan cadangan (Claude Code, Cursor, Lovable, Bolt, v0, Replit, ChatGPT, Supabase); edit tidak butuh Turnstile; deskripsi opsional. Proyek ditolak yang hanya diubah sesi/tools-nya (tanpa ubah field konten) tetap `rejected`, ditangani saat alur admin Fase 8.

Sudah dicek: lint, typecheck, format, build; demo form di `/dev/ui` (1440px dan 375px tanpa scroll horizontal, light/dark): validasi menandai field dan memfokuskan yang pertama, pratinjau live (jam + sesi, tools AI dulu + "+N"), combobox tools (cari, Enter, saran tools baru), tambah sesi, dan server action menjawab `unauthorized` tanpa login. `/id/submit` mengarahkan ke login bila belum masuk. Submit end-to-end dengan akun asli sudah dicoba: proyek pertama masuk `pending`, lalu disetujui lewat SQL (`/admin` baru ada di Fase 8) dan makernya otomatis jadi terpercaya. Belum: edit end-to-end, Turnstile dengan key asli, dan upload gambar setelah submit (butuh env R2). Tombol "Lihat proyek" di pesan sukses mengarah ke `/p/[slug]` yang baru dibuat di Fase 5.

### Fase 5 — Detail proyek, profil, dashboard (2–3 hari)

- [x] `/p/[slug]` sesuai `VPO-Proyek`: breadcrumb, judul + tagline, badge (status link, bahasa, kategori), Worth it (sementara read-only), "Coba live ↗", tombol Bagikan, blok prompt kunci → "X jam dan N sesi kemudian" → galeri/video, "Cara membuatnya" (timeline per sesi: label · durasi, prompt, hasil, kendala + solusi), "Pelajaran dari {maker}", sidebar meta, "Obrolan lain dari {maker}".
- [x] Owner bisa melihat proyeknya sendiri saat `pending`/`rejected` dengan banner status.
- [x] Link status Offline: tetap tampilkan screenshot/video + label jelas.
- [x] `/u/[username]` sesuai `VPO-Profil`: header, bio sebagai bubble, link sosial, salin link profil, traktir maker, 4 stat, grid obrolan (termasuk yang diarsipkan dengan label).
- [x] `/me` sesuai `VPO-Me`: tab "Proyek saya" (tabel status tayang, status link, worth it, balasan, Edit/Lihat), banner link offline, badge maker terpercaya; tab "Edit profil".
- [x] Metadata + OG image per proyek dan profil (`next/og`).

**DoD:** ketiga halaman tampil benar dengan data seed di desktop dan 375px, dalam light dan dark.

**Status (2026-10-17):** dikerjakan di branch `feat/phase-4-submit` (lanjutan Fase 4). Tanpa migrasi baru: semua data dibaca dari tabel yang ada (statistik profil dihitung di server dari proyek tayang, jadi view `profile_stats` tidak dibuat).

Kode: loader di `lib/projects/detail.ts` (detail + sesi + media + tools + obrolan lain), `lib/projects/cards.ts` (data kartu grid, dipakai lagi di Fase 6), `lib/profiles/public.ts` dan `lib/profiles/me.ts`. Data publik memakai `use cache` (`cacheLife("minutes")`) dengan tag di `lib/cache-tags.ts` (`project:`, `project-slug:`, `maker:`, `username:`); `saveProject`, aksi media, route `finalize`, dan `updateProfile` meng-invalidate tag terkait, jadi owner langsung melihat perubahannya. Perubahan yang terjadi di dalam DB (auto-hide 3 laporan) tampil paling lambat sesuai umur cache; aksi admin Fase 8 perlu memanggil tag yang sama. `/p/[slug]` mencoba versi publik dulu, lalu bila tidak ada membaca sesi dan menampilkan proyek `pending`/`rejected`/`hidden` hanya untuk owner dengan banner "Cuma kamu yang bisa melihat halaman ini"; owner proyek tayang mendapat tombol "Edit proyek" yang di-stream terpisah. Komponen baru: `ProjectDetailView`, `BuildTimeline`, `MediaGallery` (gambar besar + thumbnail, video sebagai link keluar karena tidak ada embed konten maker), `LinkStatusBadge`, `ProjectGridCard`, `ShareButton`/`CopyLinkField`, `ExternalLink` (`nofollow ugc`). `/me` punya tab "Proyek saya" (tabel status, baris bertumpuk di HP, banner link offline, catatan maker terpercaya) dan "Edit profil" (validasi zod bersama di `lib/validation/profile.ts`, server action `lib/profiles/actions.ts`; tab tersimpan di `?tab=`). OG image `next/og` di `opengraph-image.tsx` proyek dan profil memakai Fraunces/Geist/Geist Mono yang disalin ke `assets/og/` (WOFF dari Fontsource, OFL). Tambahan: `metadataBase` dari `NEXT_PUBLIC_SITE_URL` (`lib/site.ts`, fallback domain produksi Vercel), zona waktu next-intl `Asia/Jakarta`.

Arsip oleh maker (default Q8): tombol "Arsipkan" / "Aktifkan lagi" per baris di tab "Proyek saya" (konfirmasi dulu saat mengarsipkan; panel di bawah tombol di desktop, bottom sheet di HP). Karena `link_status` tidak bisa ditulis klien, perubahannya lewat RPC `set_project_archived(p_project_id, p_archived)` (security definer, hanya owner, bukan `removed`) di migrasi `20261017090000_archive_project.sql`; mengaktifkan lagi mengembalikan `live` dan me-reset `link_fail_count` supaya link checker Fase 9 menilai ulang. Server action `lib/projects/archive.ts` meng-invalidate tag proyek dan maker. Migrasi sudah di-push ke DB dev; `pnpm db:test` lulus semua (128 test, termasuk 13 baru di `supabase/tests/05_archive_project.sql`).

Keputusan kecil: tanggal ditampilkan absolut ("dicek 15 Okt 2026", "maker sejak Oktober 2026") supaya tidak bergantung pada waktu render; deskripsi proyek tampil di bawah galeri ("Tentang proyek ini") karena desain tidak memuatnya; Worth it masih teks read-only, balasan dan laporan menunggu Fase 7; link kategori breadcrumb ke `/explore?category=` dan tools ke `/tools/[slug]` (dibangun Fase 6); username di URL tidak peka huruf besar.

Sudah dicek: lint, typecheck, format, build. Di browser: `/id/p/tasklog` dan `/id/u/samsiragil` dengan data DB dev (1440px dan 375px tanpa scroll horizontal, light/dark), 404 untuk slug/username yang tidak ada, OG image proyek dan profil (ID/EN). Varian yang butuh data khusus atau sesi dicek lewat halaman non-produksi `/[locale]/dev/pages` (proyek offline, diarsipkan, tampilan owner saat pending, `/me` berisi dan kosong): validasi form profil menandai field dan memfokuskan yang pertama, server action menjawab `unauthorized` tanpa login. Belum: `/me` dan simpan profil dengan akun asli (pane belum login), gambar galeri banyak + video dengan data asli.

### Fase 6 — Penemuan: beranda, jelajah, tools (2–3 hari)

- [x] `/` sesuai `VPO-Beranda`: hero dari `weekly_picks` minggu berjalan (fallback "Baru masuk"), "Obrolan terpopuler minggu ini" (RPC rolling 7 hari, maks 1 per maker), chip tools, "Baru masuk", ajakan submit, footer lengkap.
- [x] `/explore` sesuai `VPO-Jelajah`: search, filter tools (dikelompokkan per jenis, "Lihat semua (N)" + cari, §2.8)/kategori/bahasa (state di URL query supaya bisa dibagikan), sort Paling worth it/Terbaru, cursor pagination "Muat obrolan lainnya", empty state SystemMessage. Di HP, filter pindah ke bottom sheet.
- [x] `/tools/[slug]` sesuai `VPO-Tools`: switcher tools, deskripsi, jumlah obrolan, link situs tools, grid, empty state.
- [x] Caching: ISR/`revalidateTag` saat proyek dipublikasikan atau di-vote (vote: Fase 7 tinggal memanggil tag yang sama).

**DoD:** filter dan search memberi hasil benar (diuji dengan 30 proyek seed), URL filter bisa dibagikan, halaman beranda TTFB cepat dari cache.

**Status (2026-10-17):** dikerjakan di branch `feat/phase-6-discovery` (lanjutan Fase 5). Migrasi `20261017120000_search_projects.sql` menambah RPC `search_projects(p_query, p_tools, p_categories, p_lang, p_sort, p_after, p_limit)` (security invoker, hanya `published`) dan helper `prefix_tsquery`. Pencarian memakai tsvector `search` yang sudah ada (judul, tagline, prompt kunci, deskripsi, prompt sesi) dengan pencocokan awalan per kata ("kas" menemukan "kasir"); semua kata harus cocok dan operator tsquery dari input dibuang. Urutan "Paling worth it" = `eligible_upvote_count`, lalu `published_at` lebih baru (§2.7 C); "Terbaru" = `published_at`. Pagination keyset lewat cursor `{e, p, i}`, `total_count` dihitung sebelum cursor. 27 test baru di `supabase/tests/06_search_projects.sql` memakai 30 proyek fixture (kategori dan tools khusus test supaya data asli DB dev tidak ikut): filter tools/kategori/bahasa, kombinasinya, search, urutan dan tie-break, halaman demi halaman tanpa duplikat atau terlewat, validasi. Migrasi sudah di-push ke DB dev; `pnpm db:test` lulus semua (155 test). Tipe digenerate ulang dengan `pnpm db:types`.

Kode: loader di `lib/projects/discovery.ts` (`getHomeData`, `searchProjects`, `getToolPage`, semuanya `use cache`), state filter di URL lewat `lib/projects/explore-params.ts` (`?q=&tools=a,b&category=&lang=&sort=new`, nilai tidak dikenal dibuang), server action "Muat obrolan lainnya" di `lib/projects/load-more.ts`. Komponen di `components/discovery/`: `HomeHeroCard`, `ProjectRow` (baris "Baru masuk"), dan `explore-client.tsx` (form cari yang tetap jalan sebagai GET biasa sebelum hidrasi, panel filter, bottom sheet HP memakai `<dialog>` native, `ResultsGrid` dengan load more). `ProjectGridCard` dan `LinkStatusText` kini tidak async (`useTranslations`) supaya bisa dirender di client untuk halaman berikutnya; kartu di jelajah menampilkan badge bahasa sebagai ganti kategori, sesuai desain. Halaman: `/` (hero dari RPC `get_home_hero`, populer dari `popular_this_week(6)`, chip 8 tools teratas, 5 "Baru masuk" tanpa proyek hero, ajakan submit), `/explore`, `/tools/[slug]` (switcher = tools teratas sejenis + "Semua tools", 8 tools populer di-prerender), dan `/tools` (indeks semua tools per jenis, termasuk yang 0 proyek).

Caching: tag baru `LISTINGS_TAG` ("listings") untuk semua daftar proyek dan `TOOLS_TAG` ("tools") untuk katalog. `saveProject` meng-invalidate keduanya bila proyek berstatus `published`; arsip, aksi media, route `finalize`, dan simpan profil meng-invalidate `listings`. Beranda ter-prerender lengkap dengan data (revalidate 1 menit, expire 1 jam), jadi disajikan dari static shell. Fase 7 (vote, balasan) dan Fase 8 (aksi admin) cukup memanggil `updateTag(LISTINGS_TAG)`.

Keputusan kecil: filter tools bersifat AND (proyek harus memakai semua tools yang dicentang, sesuai teks kosong "kombinasi ini"), kategori bersifat OR; jumlah di samping tools memakai `project_count` global; slug tools/kategori yang tidak dikenal di URL dibuang; tanggal "Baru masuk" absolut ("17 Okt") sesuai keputusan Fase 5; jumlah "obrolan tayang" di `/tools/[slug]` dihitung dari hasil pencarian, bukan dari cache katalog.

Sudah dicek: lint, typecheck, format, build. Di browser dengan data DB dev: `/id`, `/en`, `/id/explore` (centang tools mengubah URL, search "task log", kombinasi kosong + slug palsu di URL, sort Terbaru), `/id/tools/claude-code`, `/id/tools/bolt` (kosong), `/en/tools`, di 1440px dan 375px tanpa scroll horizontal, light/dark, bottom sheet filter di HP. Hero "Pilihan minggu ini", kartu populer, dan baris "Baru masuk" dengan banyak proyek dicek lewat `/[locale]/dev/pages?view=home` karena DB dev baru punya satu proyek tayang. Belum: "Muat obrolan lainnya" dengan data asli (butuh >24 proyek tayang; logika cursor sudah dites di SQL) dan hero "Pilihan minggu ini" dari `weekly_picks` asli.

### Fase 7 — Interaksi: Worth it, balasan, lapor (2 hari)

- [x] `WorthItButton` dengan optimistic update; logged-out diarahkan ke login lalu kembali ke halaman semula. Vote proyek sendiri sesuai [Q13].
- [x] Balasan satu tingkat: daftar, form (Turnstile + rate limit), hapus balasan sendiri.
- [x] `ReportButton` untuk proyek dan balasan: dialog pilih alasan + catatan opsional.
- [x] Auto-hide 3 laporan (trigger dari Fase 2) diverifikasi end-to-end.

**DoD:** satu akun satu vote, counter konsisten, laporan ganda dari akun yang sama ditolak, laporan ke-3 menyembunyikan proyek.

**Status (2026-10-17):** dikerjakan di branch `feat/phase-7-interactions` (lanjutan Fase 6). Migrasi `20261018090000_interactions.sql`: laporan hanya bisa ke konten yang memang terlihat oleh pelapor (proyek `published`, balasan `visible` di proyek `published`) dan tidak ke konten sendiri (`report_own_content`), jadi aturan "3 akun berbeda" tidak bisa dipicu lewat id proyek pending/hidden; catatan laporan di-trim (kosong jadi null). Balasan butuh username (`username_required`) dan isinya di-trim. RPC `report_content(p_target_type, p_target_id, p_reason, p_note)` (security definer, hanya `authenticated`) mengisi laporan lewat trigger yang sama dan mengembalikan `project_id`, `owner_id`, `target_hidden`, karena pelapor tidak bisa membaca proyek yang baru tersembunyi lewat RLS. 41 test baru di `supabase/tests/07_interactions.sql`: vote dobel, tarik vote, vote proyek sendiri/tersembunyi, balasan (trim, kosong, proyek pending, tanpa username, hapus milik orang lain, rate limit 30/hari), laporan (anon, konten sendiri, proyek pending, dobel, catatan) dan auto-hide end-to-end untuk proyek dan balasan (laporan ke-3 menyembunyikan, `comment_count` turun, target tersembunyi tidak bisa dilaporkan lagi). Migrasi sudah di-push ke DB dev; `pnpm db:test` lulus semua (196 test). Tipe digenerate ulang.

Kode: server action di `lib/interactions/actions.ts` (`setWorthIt(projectId, voted)` idempoten sehingga klik ganda atau retry tidak menambah vote dan mengembalikan counter dari DB; `postReply` dengan Turnstile; `deleteReply`; `reportContent`), loader balasan ber-`use cache` di `lib/interactions/replies.ts` (tag baru `repliesTag`, maks 200 balasan, urut terlama), validasi bersama di `lib/validation/interactions.ts`. Komponen di `components/interactions/`: `WorthItButton` (`useOptimistic`, `aria-pressed`, kembali ke state server dan menampilkan alasan bila gagal), `RepliesSection` (bubble balasan, label "maker", form pill yang tumbuh mengikuti isi, Ctrl/Cmd+Enter mengirim, widget Turnstile baru dimuat saat kotak balasan difokus, hapus dengan konfirmasi inline), `ReportButton` (`<dialog>` native, bottom sheet di HP, 6 alasan + catatan ≤500), dan `project-interactions.tsx` yang men-stream bagian per pengunjung: halaman proyek tetap dari cache, sedangkan status vote, form balasan, dan link lapor menyusul per request. Pengunjung belum login mendapat link ke `/login?next=` (balasan kembali ke `#balasan`), user tanpa username diarahkan ke onboarding, maker melihat counter read-only dan tidak melihat "Laporkan proyek ini". `ProjectDetailView` menerima slot `worthIt`, `replies`, `reportLink`; tampilan owner untuk proyek non-publik tetap read-only.

Caching: vote meng-invalidate `project:`, `maker:` (total worth it di profil), dan `listings`; balasan baru/hapus meng-invalidate `replies:` dan `listings` (pembalas ikut skor populer, §2.7). Laporan yang menyembunyikan target memakai `revalidateTag(..., { expire: 0 })`, bukan `updateTag`, supaya pelapor tetap melihat konfirmasi di dialog alih-alih halamannya langsung diganti 404; pengunjung lain langsung mendapat versi baru di request berikutnya.

Tag @username (tanpa balasan bersarang, supaya tetap terasa seperti obrolan dan ringan di HP): daftar balasan tetap datar dan kronologis. Mengetik `@` di kotak balasan membuka saran orang dari obrolan itu saja (maker + para pembalas, tanpa diri sendiri), disaring per awalan username atau kata di nama; pilih dengan panah + Enter/Tab atau klik, Escape menutup (pola combobox dengan `aria-activedescendant`). Tombol "Balas" di tiap balasan orang lain menambahkan `@username ` ke form (sekali saja) lalu memfokuskannya; pengunjung belum login atau tanpa username diarahkan ke login/onboarding. Saat ditampilkan, `@username` menjadi link profil hanya bila username itu peserta obrolan, jadi typo atau nama orang luar tetap teks biasa. Helper murni di `lib/interactions/mentions.ts`; tanpa perubahan DB. Mention belum memberi notifikasi; saat notifikasi dibuat (Q10 / `/me`), mention bisa disimpan di tabel kecil `comment_mentions`.

Keputusan kecil: maker boleh membalas dan melaporkan balasan di proyeknya sendiri; tanggal balasan absolut ("16 Okt 2026") sesuai keputusan Fase 5; laporan belum punya rate limit selain satu laporan per akun per target.

Sudah dicek: lint, typecheck, format, build. Di browser (build produksi, belum login): `/id/p/tasklog` dan `/en/p/tasklog` menampilkan "Balasan 0", ajakan masuk, serta link Worth it dan "Laporkan proyek ini" ke login dengan `next` yang benar. Tampilan login dicek lewat `/[locale]/dev/pages?view=interactions` (800px dark dan 375px light, tanpa scroll horizontal): Worth it langsung berubah lalu kembali dengan pesan "Sesi login habis" karena aksi menjawab `unauthorized`, dialog lapor (pilih alasan, kirim, pesan error), form balasan, dan konfirmasi hapus. Catatan: dev server lama di port 3000 sempat tidak menukar bagian yang di-stream di semua halaman (termasuk tombol "Masuk" di header `/explore`), jadi pengecekan streaming dilakukan di `next start`. Belum: vote, balasan, dan laporan end-to-end dengan akun asli (pane belum login) dan Turnstile dengan key asli.

### Fase 8 — Admin (1–2 hari)

- [x] `/admin` (hanya `is_admin`, dicek di server) sesuai `VPO-Admin`, dengan 3 tab:
  - Antrean review: pending urut paling lama, sisa waktu 48 jam, Setujui/Tolak (+ alasan, [Q11]).
  - Laporan: proyek/balasan yang dilaporkan, Pulihkan / Hapus / Cabut status terpercaya / Biarkan / Sembunyikan.
  - Kelola tools: tambah/edit (nama, slug, url, logo, jenis, deskripsi ID/EN), plus antrean `tool_suggestions` dengan aksi Gabungkan ke tools yang ada / Jadikan tools baru / Tolak.
- [x] Panel baca-saja "Pilihan minggu ini": riwayat `weekly_picks` dan `breakdown`-nya. Admin tidak bisa mengubah pemenang.
- [x] Email notifikasi setuju/tolak ([Q10]). Kode siap (Resend), aktif setelah `RESEND_API_KEY` + `EMAIL_FROM` diisi; sebelum itu hasil review tampil di `/me`.
- [x] Log aksi admin minimal (`reviewed_by`, `resolved_by`).

**DoD:** alur pending → approve → maker jadi terpercaya → proyek ke-2 langsung tayang berjalan end-to-end, email terkirim.

**Status (2026-10-17):** dikerjakan di branch `feat/phase-8-admin` (lanjutan Fase 7). Migrasi `20261019090000_admin.sql`: semua aksi moderasi lewat RPC security definer yang memanggil `assert_admin()` dulu (`not_allowed` / 42501 untuk non-admin), jadi grant kolom yang mengunci status, trust, dan kolom review tetap seperti semula. `admin_review_project(p_project_id, p_approve, p_reject_code, p_reject_note)` hanya untuk proyek `pending`; setuju memakai trigger lama yang menjadikan maker terpercaya, tolak wajib memilih kode alasan (kolom baru `reject_code`: `incomplete`, `broken_link`, `not_vibe_coded`, `duplicate`, `rules`, `other`) dan catatan opsional di `reject_reason` (wajib untuk `other`). Kolom baru `submitted_at` menjadi jam antrean 48 jam dan diulang saat proyek kembali ke `pending`. Celah Fase 4 ditutup: `upsert_project` memanggil `resubmit_rejected_project()` setelah edit, jadi proyek ditolak yang hanya diubah sesi/tools-nya juga kembali ke antrean. `admin_resolve_report(p_target_type, p_target_id, p_action)` menutup semua laporan terbuka satu target dengan satu putusan: `keep` (tampil lagi, `report_count` direset), `hide`, `remove` (proyek jadi `removed`, balasan dihapus); laporan untuk balasan yang sudah dihapus penulisnya tetap bisa ditutup. `admin_set_trusted()` mencabut atau mengembalikan status terpercaya. `admin_resolve_tool_suggestions(p_name, p_action, p_tool_id, p_new_tool)` menangani semua saran pending dengan nama sama (huruf besar/spasi diabaikan): gabung ke tools aktif, buat tools baru, atau tolak; gabung/buat langsung menautkan tools ke semua proyek yang menyarankannya. 45 test baru di `supabase/tests/08_admin.sql` (siapa yang boleh memanggil, DoD setuju → terpercaya → proyek berikutnya langsung tayang, tolak + kirim ulang lewat edit sesi saja dan lewat edit konten, putusan laporan proyek/balasan, cabut trust, gabung/buat/tolak saran tools) lulus bersama 196 test lama (total 241) dengan migrasi diterapkan di dalam transaksi yang dibatalkan. Migrasi sudah di-push ke DB dev; `pnpm db:test` lulus semua (241 test). Tipe digenerate ulang dengan `pnpm db:types`.

Kode: loader di `lib/admin/data.ts` (antrean, laporan dikelompokkan per target dengan target tersembunyi di atas, katalog tools + saran dikelompokkan per nama, riwayat `weekly_picks` 12 minggu, jumlah untuk menu), server action di `lib/admin/actions.ts` (cek admin di app dan lagi di DB, invalidasi tag yang sama dengan loader publik, `refresh()` halaman admin), validasi bersama di `lib/validation/admin.ts`, `isCurrentUserAdmin()` di `lib/auth/current-user.ts` (memanggil RPC `is_admin`, karena `profiles.is_admin` tidak bisa dibaca klien). Halaman `app/[locale]/admin/`: tab di `?tab=` sebagai link biasa (setiap tab hanya memuat datanya sendiri), menu samping 220px di desktop dan baris menu yang bisa digeser di HP, non-admin mendapat 404 dan pengunjung belum login diarahkan ke login. Kartu antrean (cover, maker, "dikirim 5 jam yang lalu", "SISA 43 JAM"/"LEWAT 29 JAM", prompt kunci, tools, kategori, lama bikin, link live) dengan Setujui/Tolak; Tolak membuka form alasan + catatan. Kartu laporan dengan alasan per jenis, catatan pelapor, dan putusan sesuai keadaan target (Pulihkan / Biarkan tersembunyi / Hapus untuk yang tersembunyi, Biarkan / Sembunyikan / Hapus untuk yang tampil; Hapus minta konfirmasi), plus "Cabut status terpercaya" untuk maker/penulis terpercaya. Kelola tools: cari + filter jenis, tabel, dialog tambah/edit (slug otomatis dari nama, nonaktifkan tools), dan antrean saran (Gabungkan / Jadikan tools baru / Tolak). Item yang sudah diputuskan hilang dari daftar setelah refresh, jadi hasilnya dikonfirmasi di log kecil di atas daftar (`action-log.tsx`). Admin juga bisa membuka `/p/[slug]` proyek yang belum tayang dengan banner "Pratinjau admin". `/me` mendapat tombol "Panel admin" untuk admin.

Notifikasi (Q10): email lewat Resend HTTP API (`lib/email/`), dikirim di `after()` supaya tidak menahan admin, dalam bahasa konten proyek; alamat maker dibaca dari `auth.users` dengan secret key. Tanpa env, tidak ada email dan log admin menulis "maker melihat alasannya di dashboard". `/me` kini menampilkan alasan penolakan (label kode dalam bahasa pengunjung + catatan admin) dengan link ke halaman edit, dan kabar persetujuan selama seminggu. Alasan tolak juga tampil dengan format yang sama di banner owner `/p/[slug]` dan halaman edit.

Cache: setuju/tolak dan putusan laporan proyek meng-invalidate `project:`, `project-slug:`, `maker:`, `listings`, dan `tools` (jumlah proyek per tools hanya menghitung yang tayang); putusan balasan meng-invalidate `replies:` dan `listings`; trust meng-invalidate `maker:`; perubahan tools dan saran meng-invalidate `tools`, `listings`, dan `project:` untuk proyek yang tertaut.

Keputusan kecil: "Biarkan" pada proyek yang tampil juga mereset hitungan laporan, jadi butuh 3 laporan baru untuk auto-hide lagi; "Cabut status terpercaya" terpisah dari putusan laporan dan tidak menutup laporannya; slug tools boleh diubah admin (halaman `/tools/[slug]` lama jadi 404); proyek yang dikirim ulang ditandai "dikirim ulang" di antrean.

Sudah dicek: lint, typecheck, format, build. Di browser (dev server, belum login): `/id/admin` mengarahkan ke `/id/login?next=/id/admin`; kartu admin dengan data contoh di `/[locale]/dev/pages?view=admin` (desktop dan 375px tanpa scroll horizontal): form tolak (fokus ke alasan pertama, catatan wajib untuk "Alasan lain", aksi menjawab "Sesi login habis" tanpa login), dialog tambah tools (slug otomatis "Kiro Café" → `kiro-cafe`, URL non-https ditandai dan difokuskan), konfirmasi Hapus pada laporan; `/me` dengan kabar ditolak/disetujui dalam ID dan EN. Belum: alur end-to-end dengan akun admin asli (set `is_admin` lewat SQL), dan email dengan key Resend asli (butuh domain, Fase 11).

### Fase 9 — Job terjadwal: link checker, backup, keep-alive (1 hari)

- [x] `scripts/link-checker.mjs` + GitHub Actions mingguan: HEAD/GET `live_url` (timeout, ikuti redirect), update `link_status`, `link_fail_count`, `last_checked_at` sesuai aturan [Q8].
- [x] Job harian: hitung ulang `eligible_upvote_count` untuk vote dari akun yang baru melewati 72 jam (§2.7). Sudah via pg_cron di Fase 2.
- [x] Workflow keep-alive harian (query ringan) supaya Supabase Free tidak pause.
- [x] Backup mingguan: dump database ke bucket R2 privat, simpan 8 versi terakhir.

**DoD:** workflow jalan manual (`workflow_dispatch`) dan terjadwal, proyek dengan URL mati berubah status sesuai aturan, file backup bisa di-restore ke Supabase lokal.

**Status (2026-10-17):** dikerjakan di branch `feat/phase-9-jobs` (lanjutan Fase 8). Panduan operasional (secret, jadwal, restore) di `docs/operations.md`.

Link checker: migrasi `20261020090000_link_checker.sql` menambah RPC `record_link_checks(p_results)` (security definer, hanya `service_role`) yang memegang aturan Q8: satu kali berhasil → `live` dan hitungan direset, gagal kedua kali berturut-turut → `offline`; proyek `archived` atau yang tidak (lagi) tayang dilewati; id ganda dihitung sekali. `projects_before_update` kini mereset status link (`live`, hitungan 0, `last_checked_at` kosong) saat `live_url` diganti, kecuali proyek diarsipkan. Skrip `scripts/link-checker.mjs` (`pnpm links:check`, `--dry-run`, atau daftar slug) membaca proyek dengan secret key, mengecek 8 sekaligus (`HEAD` lalu `GET` bila gagal, timeout 10 detik, ikuti redirect, body tidak diunduh), lalu mengirim hasil per 500. Ringkasan job GitHub menampilkan proyek yang gagal dan yang berubah status. Workflow `link-check.yml`: Senin 09:00 WIB + manual (opsi dry run). 20 test baru di `supabase/tests/09_link_checker.sql` (hak panggil, gagal berturut-turut, pulih, batch campuran, arsip/pending dilewati, validasi input, ganti `live_url`) lulus bersama 241 test lama (total 261) dengan migrasi diterapkan di dalam transaksi yang dibatalkan.

Keep-alive: `keep-alive.yml` setiap hari 07:30 WIB membaca satu baris `categories` lewat REST API dengan publishable key (variabel repo yang sudah dipakai CI), dengan retry, dan gagal bila Supabase tidak menjawab.

Backup: `backup.yml` setiap Senin 02:00 WIB memakai Supabase CLI (`supabase db dump`: roles, skema, data `--use-copy` tanpa `cron.job_run_details`) lewat Session pooler, mengecek dump tidak kosong, membungkusnya jadi `vpo-db-<waktu UTC>.tar.gz`, lalu `scripts/backup-r2.mjs upload` menyimpannya di bucket R2 privat terpisah dan menghapus yang lebih lama dari 8 versi. Skrip yang sama punya `list` dan `download` untuk restore. Artifact GitHub sengaja tidak dipakai: repo publik dan dump berisi email akun. Skrip menolak bila bucket backup sama dengan bucket media.

Keputusan kecil: skrip `.mjs` seperti skrip lain di `scripts/` (tanpa langkah build TypeScript); 429 dan 403 tantangan bot Cloudflare/Vercel dianggap hidup supaya situs di balik proteksi bot tidak ditandai offline; hanya proyek `published` yang dicek; pengecekan tidak mengubah `updated_at`.

Sudah dicek: lint, typecheck, format. Migrasi sudah di-push ke DB dev; `pnpm db:test` lulus semua (261 test). `pnpm links:check` (dry run dan sungguhan) terhadap DB dev: `tasklog` tercatat `live`, `last_checked_at` terisi; logika probe dengan URL contoh (200, 404, DNS tidak ada, sertifikat kedaluwarsa, timeout, tantangan Cloudflare). Ping keep-alive terhadap DB dev menjawab. Pola cek dump dicocokkan dengan skrip `pg_dump` CLI (`supabase db dump --dry-run`). Belum: mengisi secret/variabel GitHub dan membuat bucket backup; menjalankan ketiga workflow di GitHub; restore backup ke Supabase lokal (Docker Desktop di mesin ini gagal start).

### Fase 10 — Dukung kami, SEO, analitik, polish (2 hari)

- [x] `/support` sesuai `VPO-Support`: tanya-jawab bergaya chat, dua kartu donasi (lokal/global, [Q16]), tabel biaya transparan, target pertama.
- [x] `/rules` aturan komunitas, halaman 404/500 bergaya SystemMessage.
- [x] Bagian "Cara kami memilih": rumus §2.7 dijelaskan dengan bahasa santai + contoh perhitungan pilihan minggu lalu.
- [x] Sitemap per bahasa, `robots.txt`, `hreflang`, canonical, JSON-LD (`CreativeWork` untuk proyek, `Person` untuk profil).
- [x] Cloudflare Web Analytics.
- [x] Audit HP (375px, Android lama), a11y (keyboard, kontras dark mode, label form), performa (LCP gambar R2).
- [x] Lengkapi semua copy EN ([Q17]).

**DoD:** Lighthouse mobile ≥ 90 (performa) dan ≥ 95 (a11y, SEO) di beranda dan detail proyek.

**Status (2026-10-17):** dikerjakan di branch `feat/phase-10-polish` (lanjutan Fase 9). Tanpa migrasi baru.

Halaman: `/support` (`app/[locale]/support/page.tsx`) mengikuti `VPO-Support`: tanya-jawab sebagai bubble chat (jawaban memakai avatar "V" situs, bukan inisial pribadi), dua kartu donasi, tabel biaya (`<table>` dengan caption), kartu "Nanti, kalau makin ramai" dan "Target pertama", ajakan maker memasang link traktir (ke `/me?tab=profile`). Kartu donasi membaca `NEXT_PUBLIC_DONATE_URL_ID` (lokal) dan `NEXT_PUBLIC_DONATE_URL_EN` (global) lewat `donateLink()` di `lib/donate.ts`; nama platform di tombol diambil dari domain (Saweria, Trakteer, Buy Me a Coffee, Ko-fi, selain itu domainnya), dan selama env kosong kartu menampilkan "Link-nya segera hadir". Kartu global tetap berbahasa Inggris di `/id`, sesuai desain. "Cara kami memilih" ada di `/support#cara-kami-memilih` (link di footer dan di `/rules`): rumus, lima aturan (vote layak, pembalas layak, terpopuler, pilihan minggu ini, paling worth it), lalu contoh dari baris `weekly_picks` terbaru (`lib/projects/weekly-pick.ts`, cache `listings`): kandidat beserta "vote + 0,5 × pembalas = skor", label "Terpilih", proyek yang sudah tidak tayang tanpa nama; bila belum ada baris sama sekali tampil contoh hitungan berlabel "Contoh perhitungan". `/rules` (`app/[locale]/rules/page.tsx`) berisi empat kelompok aturan (yang dipamerin, yang dilarang, waktu membalas, cara moderasi) yang selaras dengan alasan laporan dan alur moderasi Fase 7–8. Halaman 500: `app/[locale]/error.tsx` (SystemMessage, tombol "Coba lagi" memanggil `retry()`, kode digest) dan `app/global-error.tsx` (dokumen sendiri dengan teks ID/EN inline, karena provider next-intl ikut gagal). Header menandai menu aktif (`NavLink`, `aria-current="page"`; `/tools` juga untuk `/tools/[slug]`).

SEO: `lib/seo.ts` (`localeAlternates`, `localeUrl`, `ogLocale`) dipakai semua halaman publik untuk canonical tanpa query + `hreflang` id/en/x-default. Layout menambah `og:site_name` dan `og:locale`. `app/sitemap.ts` berisi halaman statis, proyek tayang (`lastModified` = `updated_at`), profil yang punya proyek tayang, dan semua tools aktif, satu entri per bahasa dengan alternates (cache jam, tag `listings` + `tools`); satu sitemap dengan `xhtml:link` dipilih ketimbang file terpisah per bahasa. `app/robots.ts` menutup `/api/`, `/auth/`, halaman edit, serta `/{id,en}/{admin,me,submit,onboarding,login,dev}` (prefix per bahasa supaya profil seperti `/id/u/meli` tidak ikut). JSON-LD (`components/seo/json-ld.tsx`, `<` di-escape): `WebSite` + `SearchAction` di beranda, `CreativeWork` di proyek tayang (penulis `Person`, gambar R2, tools sebagai keywords, `timeRequired`, jumlah Worth it), `ProfilePage` dengan `mainEntity` `Person` di profil (`sameAs` dari link sosial).

Analitik dan header: Cloudflare Web Analytics lewat `next/script` `lazyOnload` bila `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` diisi (tanpa cookie, mode SPA). `next.config.ts` menambah header keamanan dasar (§2.6): `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`, `Permissions-Policy`. CSP `script-src` sengaja belum dipasang (Turnstile, beacon, dan script inline Next perlu izin masing-masing).

Copy EN (Q17): semua key baru punya versi EN. Skrip `pnpm messages:check` (`scripts/check-messages.mjs`, juga dijalankan CI) memastikan `id.json` dan `en.json` punya key yang sama, tidak ada string kosong, dan argumen ICU serta tag rich text sama di kedua bahasa (cabang `plural`/`select` diurai, bukan dihitung sebagai argumen).

Audit: font Fraunces kini di-self-host (`assets/fonts/`, `next/font/local`) dengan sumbu `wght` dikunci di 400 dan `opsz` tetap ada (keluaran Google Fonts css2 `ital,opsz,wght@0,9..144,400;1,9..144,400`, subset latin): 75 KB alih-alih 145 KB, tampilan sama karena situs hanya memakai berat 400. Geist Mono tidak di-preload (hanya label kecil). Avatar GitHub/Google diminta sesuai ukuran tampil ×2 lewat parameter URL (`sizedAvatarUrl`; avatar GitHub tadinya 687 KB, kini 14 KB). Gambar kartu pertama di `/explore` dan `/tools/[slug]` dimuat `eager` + `fetchPriority="high"` (LCP di halaman itu). Skip link "Lewati ke konten" ke `#konten`. Urutan heading `/explore` (jumlah hasil jadi `h2`) dan `/tools/[slug]` (`h2` sr-only) diperbaiki. Kontras token teks di light dan dark semua ≥ 4,5:1 (terendah `muted` di atas `bubble` dark 4,88; `on-accent` di atas `accent` dark 4,76).

Sudah dicek: lint, typecheck, format, `messages:check`, build. Di browser (build produksi, `next start`): `/id/support`, `/en/support`, `/id/rules` di 1440px dan 375px tanpa scroll horizontal, light/dark; canonical, `hreflang`, `og:*`, JSON-LD beranda/proyek/profil, `robots.txt`, `sitemap.xml` (264 URL dengan data DB dev), header keamanan, 404 untuk path ngasal, menu aktif, skip link memindahkan fokus. Lighthouse 13.5 mobile (lokal, Chrome headless, build dengan `NEXT_PUBLIC_SITE_URL` lokal supaya canonical valid): a11y, best practices, dan SEO 100 di beranda, detail proyek, `/explore`, `/tools/claude-code`, `/support`, `/rules`; performa beranda dan detail proyek 87–92 tergantung run (median tiga run terakhir 87–89), sisanya terutama byte JS framework dan dokumen di jaringan simulasi 4G lambat. Profil kadang mendapat SEO 92 karena Next mengalirkan metadata ke `<body>` bila belum siap saat shell dikirim, dan UA mobile Lighthouse tidak termasuk daftar bot yang mendapat metadata blocking; crawler sungguhan (Googlebot, Bingbot, dll.) ada di daftar itu. Belum: Lighthouse di deployment Vercel (Brotli, HTTP/2) untuk memastikan performa ≥ 90 konsisten, halaman 500 dengan error sungguhan, contoh "Cara kami memilih" dengan `weekly_picks` asli (DB dev belum punya), serta mengisi token analitik dan link donasi (Q16 belum diputuskan).

### Fase 11 — Isi konten & peluncuran

- [ ] Isi 30 proyek awal (milik sendiri + teman yang diundang langsung).
- [ ] Pindah ke `jadinya.dev`: tambah domain di Vercel, 301 dari `*.vercel.app` lama, update redirect URL OAuth dan Supabase Auth.
- [ ] Checklist peluncuran: env produksi, rate limit aktif, Turnstile mode produksi, backup terakhir OK, admin kedua (bila ada).
- [ ] Umumkan (komunitas, X/Threads, LinkedIn, grup kampus).

**DoD:** situs publik di domain final, 30 proyek tayang, metrik mulai tercatat.

### Pemetaan ke jadwal brief

| Minggu brief | Fase |
|---|---|
| Minggu 1 — Fondasi | 0, 1, 2, 3 |
| Minggu 2 — Inti | 4, 5, 6 |
| Minggu 3 — Interaksi & moderasi | 7, 8, 9 |
| Minggu 4 — Isi & poles | 10, 11 |

---

## 4. Pertanyaan terbuka

Setiap pertanyaan diberi **default**, yaitu asumsi yang dipakai bila belum dijawab.

### Sudah diputuskan (2026-10-14)

| # | Pertanyaan | Keputusan | Dampak di plan |
|---|---|---|---|
| Q1 | Prompt kunci wajib? | **Wajib** | `projects.key_prompt` NOT NULL, langkah pertama form submit |
| Q2 | "Cara membuatnya" per sesi atau datar? | **Per sesi** | Tabel `project_sessions`, blok sesi di form, timeline di detail (§2.2, Fase 4–5) |
| Q3 | Stack non-AI termasuk tools? | **Maksimalkan semua tools** | Katalog lengkap 7 jenis + saran tools dari maker (§2.8) |
| Q4 | Cara memilih "Pilihan minggu ini"? | **Tanpa proses manual, dihitung secara adil** | Rumus vote layak + rotasi + tabel `weekly_picks` yang dibekukan dan bisa diaudit (§2.7) |
| Q5 | Dark mode & versi HP? | **Diturunkan sendiri saat coding** | Fase 1 dan 10 |
| Q6 | Halaman tanpa desain? | **Mengikuti gaya desain yang ada** | Fase 2, 4, 10 |
| Q7 | Konversi "hari" pada lama pengerjaan | Gugur karena Q2: lama pengerjaan = jumlah durasi sesi (jam) | Lihat Q23 |

### Pertanyaan lanjutan dari keputusan di atas

**Q23. Aturan sesi.** ✔ Disetujui (default). Default yang dipakai: minimal 1 sesi wajib (prompt, hasil, durasi), maksimal 10 sesi, durasi per sesi dalam jam (kelipatan 0,5, maks 24), label sesi opsional. Apakah setuju? Pertanyaan terkait: untuk proyek yang dikerjakan berminggu-minggu, apakah 10 sesi cukup, atau maker boleh menggabungkan beberapa hari menjadi satu sesi (durasi > 24 jam)?

**Q24. Ambang akun untuk vote layak.** ✔ Disetujui (default). Default: akun ≥ 72 jam, dan vote lama ikut terhitung setelah akunnya cukup umur. Mau lebih ketat (misalnya akun harus punya username dan login lewat GitHub/Google yang berumur > 30 hari), atau lebih longgar (semua vote dihitung)? Lebih ketat berarti lebih tahan manipulasi, tetapi di masa awal yang sepi vote jadi lebih sedikit.

**Q25. Bobot balasan dalam skor.** ✔ Disetujui (default). Default: 1 pembalas layak = 0,5 vote. Atau peringkat murni dari vote saja (lebih sederhana dijelaskan, tetapi mengabaikan diskusi)?

**Q26. Rotasi maker.** ✔ Disetujui (default). Default: maker yang terpilih tidak bisa terpilih lagi selama 4 minggu, dan satu proyek hanya bisa terpilih sekali. Apakah sesuai?

**Q27. Ambang minimum skor 3** ✔ Disetujui (default). untuk "Pilihan minggu ini". Di minggu-minggu awal kemungkinan sering tidak ada yang lolos, sehingga hero menampilkan "Baru masuk". Apakah itu oke, atau ambangnya diturunkan ke 1?

**Q28. Saran tools dari maker** ✔ Disetujui (default). masih butuh admin untuk menggabungkan ke katalog. Ini moderasi data, bukan kurasi peringkat, jadi menurutku tidak bertentangan dengan Q4. Setuju, atau saran tools langsung masuk katalog tanpa review?

### Menengah (aturan bisnis)

**Q8. Aturan status link.**
- Kapan dianggap offline? *Default:* 2 kali cek gagal berturut-turut (HTTP ≥ 400 atau timeout 10 detik).
- "Diarsipkan" diset oleh siapa? *Default:* oleh maker secara manual dari `/me` (misalnya proyek yang sengaja dimatikan); tidak otomatis.
- Apakah checker mingguan cukup? *Default:* ya.

**Q9. Daftar kategori final.**
*Default:* UMKM, Edukasi, Komunitas, Game, Tools developer, Alat produktivitas, Gaya hidup, Personal, AI wrapper, Lainnya. Satu kategori per proyek.

**Q10. Layanan email untuk notifikasi review.** Supabase Auth hanya mengirim email auth (dengan batas ketat).
*Default:* Resend free tier (3.000 email/bulan) dengan domain pengirim `jadinya.dev`. Sebelum domain siap, notifikasi cukup tampil di `/me`.

**Q11. Proyek yang ditolak.** Apakah admin wajib menulis alasan? Apakah maker bisa mengedit lalu mengirim ulang?
*Default:* alasan wajib (dipilih dari daftar + catatan), maker bisa edit dan kirim ulang (kembali ke `pending`).

**Q12. Draf submit.** Perlu disimpan di server (bisa lanjut di perangkat lain) atau cukup di browser?
*Default:* cukup `localStorage`.

**Q13. Boleh vote proyek sendiri?**
*Default:* tidak boleh.

**Q14. Foto profil.** Cukup dari avatar GitHub/Google, atau maker bisa upload sendiri?
*Default:* dari OAuth, fallback inisial; upload sendiri masuk v2.

**Q15. Durasi video ("Tonton demo · 1:42").** Perlu ditampilkan? Butuh YouTube Data API key dan tidak tersedia untuk Loom.
*Default:* tidak ditampilkan, cukup "Tonton demo".

**Q16. Platform donasi.** Pilih satu lokal (Saweria/Trakteer) dan satu global (Buy Me a Coffee/Ko-fi), beserta URL akunnya.
*Default:* placeholder di config (`NEXT_PUBLIC_DONATE_URL_ID`, `NEXT_PUBLIC_DONATE_URL_EN`) sampai diputuskan.

### Kecil (bisa diputuskan belakangan)

**Q17. Copy bahasa Inggris** ditulis sendiri atau dibuatkan draf dulu lalu direview? Istilah "obrolan", "Worth it", dan "Pamerin proyekmu" perlu padanan EN yang konsisten. *Default:* dibuatkan draf.

**Q18. Admin selain kamu?** *Default:* hanya kamu dulu; `is_admin` diset manual lewat SQL.

**Q19. Komentar tetap masuk MVP?** Brief menandainya opsional, tetapi desain sudah memuatnya. *Default:* masuk (Fase 7), dan bisa dipotong bila waktu sempit tanpa memengaruhi fase lain.

**Q20. Badge "Maker terpercaya" ditampilkan publik?** Desain menampilkannya di profil dan detail proyek. Ini bisa terkesan sebagai badge hierarki, padahal badge maker masuk v2. *Default:* tampil.

**Q21. Halaman konsep lama ("Hold My Prompt", ronde 1–2, variasi beranda) di canvas** diabaikan sepenuhnya, dan hanya artboard `VPO-*` yang menjadi acuan? *Default:* ya.

**Q22. Testing.** Seberapa jauh? *Default:* Vitest untuk util + test RLS, satu suite Playwright smoke (login mock, submit, vote) di CI.
