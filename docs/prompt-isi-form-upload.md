# Prompt: isi form "Pamerin proyekmu" di Jadinya

Dokumen ini berisi dua bagian:

1. **Analisa form upload** (`/submit`): semua isian, mana yang wajib, dan batasannya. Sumber:
   `lib/validation/project.ts`, `components/project/project-form.tsx`, `lib/media/limits.ts`,
   `supabase/seed.sql`, `messages/id.json`.
2. **Prompt siap pakai** untuk agen AI (Claude Code, Cursor, Codex, dll.). Jalankan di folder proyek
   vibe coding yang mau dipamerkan; agen membaca proyeknya lalu menyiapkan jawaban untuk tiap isian.

---

## 1. Analisa form

Form `/submit` berbentuk obrolan bertahap (6 langkah: repo, kenalan, prompt, proses, cerita,
tayang): situs bertanya, maker menjawab di bawahnya. Butuh login dan
username. Proyek pertama di-review admin (maks. 2×24 jam); maker terpercaya langsung tayang. Batas
3 proyek per 24 jam. Ada Cloudflare Turnstile sebelum kirim.

### Wajib (tanpa ini tombol kirim gagal)

| Isian | Kunci | Aturan |
| --- | --- | --- |
| Link repo GitHub | `repoUrl` | Wajib, `https://github.com/owner/repo`, maks. 500 karakter. Repo privat boleh: kalau GitHub tidak menemukannya, form bertanya "Repo-nya privat?" dan proyek ditandai **Repo privat** (tanpa link) |
| Judul | `title` | Wajib, maks. 80 karakter |
| Tagline | `tagline` | Wajib, maks. 80 karakter |
| Prompt kunci | `keyPrompt` | Wajib, maks. 280 karakter. "Satu kalimat yang paling 'ini dia'", jadi pembuka kartu |
| Lama pembuatan | `buildEffort` | Wajib, pilih satu: `hours` (Beberapa jam), `overnight` (Semalam), `weekend` (Satu weekend), `week` (Seminggu), `longer` (Berminggu-minggu) |
| Tools | `toolIds` | Wajib minimal **satu tools AI** (jenis `ai_agent`, `ai_builder`, atau `ai_assistant`). Maks. 20 dari katalog |
| Kategori | `category` | Wajib, satu slug: `umkm`, `education`, `community`, `game`, `dev-tools`, `productivity`, `lifestyle`, `personal`, `ai-wrapper`, `other` |
| Bahasa konten | `contentLang` | `id` atau `en` (default: bahasa situs, ikut atribut `lang` halaman kalau ada link live) |

### Opsional

| Isian | Kunci | Aturan |
| --- | --- | --- |
| Link live | `liveUrl` | `https://` lengkap (`^https://[^\s/]+\.[^\s]+$`), maks. 500. Kalau ada, halamannya dibaca untuk judul, tagline, dan cover; tanpa link live, tombol "Coba" dan status link tidak tampil |
| Screenshot | media | Maks. 3 gambar, JPEG/PNG/WebP, maks. 20 MB per file (dikompres ke WebP). Gambar pertama jadi cover kartu |
| Tools belum ada di katalog | `suggestions` | Maks. 5. Nama maks. 60 karakter, situs `https://` opsional. Tampil sebagai teks, **tidak** dihitung sebagai tools AI |
| Deskripsi | `description` | Maks. 5000 karakter. Di bawah "Detail lain" |
| Video demo | `videoUrl` | Hanya YouTube (`youtube.com`, `youtu.be`) atau Loom (`loom.com`), `https://` |
| Prompt yang bikin "wah" | `momentWow` | Maks. 1000. "Prompt mana yang hasilnya paling bikin kaget? Tulis prompt-nya dan apa yang terjadi." |
| Kendala terbesar | `momentHardest` | Maks. 1000. "Bagian paling bikin frustrasi, dan gimana kamu lolos?" |
| Kalau mulai ulang | `lessons` | Maks. 2000. "Apa yang bakal kamu lakuin beda?" |

### Aturan komunitas (dicek admin saat review)

- Proyek buatan sendiri atau kamu terlibat langsung.
- Tanpa konten dewasa, judi, penipuan, phishing, atau yang melanggar hukum.
- Tanpa data pribadi orang lain atau API key di screenshot dan prompt.
- Kritik boleh, merendahkan tidak.

### Catatan

- Tombol "Lanjut" di langkah 1 mengecek repo, lalu mengisi judul (og:title / `<title>`, atau nama repo), tagline (meta description), cover
  (og:image), bahasa (atribut `lang`), deskripsi (README/deskripsi repo), dan menebak lama
  pembuatan dari commit. Hanya mengisi isian yang masih kosong.
- Katalog tools di bawah diambil dari `supabase/seed.sql`. Admin bisa menambah tools di produksi,
  jadi cari dulu di kolom "Cari tools lain" sebelum menambahkannya sebagai tools baru.

---

## 2. Prompt

Salin semua di dalam blok ini ke agen AI yang dibuka di folder proyekmu.

````text
Kamu membantu saya memamerkan proyek vibe coding ini di Jadinya (https://jadinya.dev/submit).
Baca proyek di folder ini, lalu siapkan jawaban untuk setiap isian form upload Jadinya.
Jangan mengubah file apa pun di proyek ini. Tugasmu hanya membaca dan menulis jawaban.

## Langkah 1: kumpulkan fakta (baca, jangan menebak)

Baca yang ada, lewati yang tidak ada:
- README, package.json / pubspec.yaml / requirements.txt / composer.json / go.mod dan sejenisnya
- Halaman utama, layout, dan metadata (judul, meta description, og:title, og:image, atribut lang)
- File konfigurasi deploy: vercel.json, netlify.toml, wrangler.toml, fly.toml, railway.json,
  Dockerfile, .github/workflows, serta variabel di .env.example (nama variabelnya saja, jangan
  pernah membaca atau mengutip nilai rahasia dari .env)
- Jejak agen AI: CLAUDE.md, AGENTS.md, .cursor/, .cursorrules, .windsurfrules, .clinerules,
  .github/copilot-instructions.md, .aider*, .kiro/, .bolt/, .lovable/, prompt.md, catatan/PLAN
- Riwayat git: `git log --reverse --format="%ad %s" --date=iso` dan `git remote -v`
- Riwayat obrolan dengan saya di sesi ini, kalau ada

## Langkah 2: isi setiap isian sesuai aturan form

WAJIB
1. Link repo GitHub: https://github.com/owner/repo dari `git remote -v`. Repo privat boleh;
   sebutkan kalau privat (form akan bertanya). Kalau remote-nya bukan GitHub, tulis [TANYA SAYA].
2. Judul: nama proyek, maks. 80 karakter. Utamakan nama yang tampil di aplikasi.
3. Tagline: satu kalimat manfaat untuk pemakai, maks. 80 karakter. Bahasa sehari-hari, bukan
   daftar fitur atau jargon teknis. Contoh gaya: "Catat jualan harian dari HP, langsung keluar
   rekap mingguan."
4. Prompt kunci: maks. 280 karakter. Satu kalimat permintaan ke AI yang paling "ini dia", gaya
   orang ngobrol ke AI, seperti prompt pertama yang melahirkan proyek ini. Contoh gaya: "Bikin
   kasir buat warung kelontong, tombolnya gede, bisa dipakai ibu-ibu tanpa tutorial."
   Kalau prompt aslinya ada di riwayat obrolan atau file jejak agen, pakai itu (boleh dipadatkan).
   Kalau tidak ada, susun dari tujuan proyek dan beri tanda [DRAF, CEK].
5. Lama pembuatan: pilih tepat satu.
   - hours = Beberapa jam
   - overnight = Semalam
   - weekend = Satu weekend
   - week = Seminggu
   - longer = Berminggu-minggu
   Hitung dari git log seperti Jadinya: jika kurang dari 3 commit, jangan menebak, tanya saya.
   Jika rentang commit pertama ke terakhir <= 5 jam: hours. <= 18 jam atau hanya 1 hari aktif:
   overnight. <= 3 hari aktif: weekend. <= 7 hari aktif: week. Lebih: longer.
   Sebutkan jumlah commit, hari aktif, dan rentang jamnya sebagai alasan.
6. Tools: semua yang benar-benar dipakai, maks. 20. Minimal satu harus tools AI.
   Pakai nama persis dari katalog berikut:
   - Agen AI: Claude Code, Cursor, Windsurf, GitHub Copilot, Cline, Roo Code, Kilo Code, Aider,
     OpenAI Codex, Gemini CLI, Amp, Kiro, Trae, Zed, Warp, Devin, Jules, Continue,
     JetBrains Junie, Augment Code, Qodo
   - App builder AI: Lovable, Bolt, v0, Replit, Firebase Studio, Google AI Studio,
     Anything (Create), Tempo, Same, Rocket, Base44, Softgen, Dyad, Bubble AI, Webflow AI,
     Framer AI, Glide, FlutterFlow
   - Asisten AI: Claude, ChatGPT, Gemini, DeepSeek, Grok, Perplexity, Qwen, Mistral Le Chat,
     Meta AI, Microsoft Copilot
   - Framework/bahasa: Next.js, React, Vue, Nuxt, Svelte / SvelteKit, Astro, Remix, Angular,
     Solid, Tailwind CSS, shadcn/ui, Laravel, Django, FastAPI, Flask, Express, Hono, NestJS,
     Ruby on Rails, Flutter, React Native, Expo, Electron, Tauri, Python, TypeScript, Go, PHP
   - Backend/database: Supabase, Firebase, Convex, PocketBase, Appwrite, Neon, PlanetScale,
     Turso, MongoDB, PostgreSQL, MySQL, SQLite, Redis, Prisma, Drizzle
   - Hosting: Vercel, Netlify, Cloudflare, Railway, Render, Fly.io, Heroku, GitHub Pages, AWS,
     Google Cloud, DigitalOcean, Coolify
   - Layanan: Stripe, Midtrans, Xendit, Clerk, Auth0, Resend, Twilio, WhatsApp Cloud API,
     Telegram Bot API, OpenAI API, Anthropic API, Gemini API, OpenRouter, Hugging Face,
     ElevenLabs, Replicate, n8n, Make, Zapier, Google Sheets, Notion API
   Ambil framework, backend, hosting, dan layanan dari dependency dan konfigurasi. Ambil tools AI
   dari file jejak agen dan dari kamu sendiri (agen yang sedang membaca ini). Jika tools AI yang
   dipakai tidak terlihat jelas, tanya saya; jangan mengarang.
   Tools yang tidak ada di daftar: masukkan ke "Tools baru" (maks. 5, nama maks. 60 karakter,
   situs resmi https:// kalau tahu). Tools baru tidak dihitung sebagai tools AI.
7. Kategori: pilih satu: UMKM, Edukasi, Komunitas, Game, Tools developer, Alat produktivitas,
   Gaya hidup, Personal, AI wrapper, Lainnya. Beri alasan satu kalimat.
8. Bahasa konten: ID atau EN, ikuti bahasa yang tampil di aplikasinya.

OPSIONAL (isi kalau ada bahannya, kosongkan kalau tidak)
9. Link live: URL publik aplikasi, harus diawali https:// (bukan localhost). Cari di README,
   konfigurasi deploy, homepage di package.json, atau deskripsi repo. Kosongkan kalau tidak ada.
10. Deskripsi: maks. 5000 karakter, idealnya 2–4 kalimat: buat siapa, masalah apa yang
    diselesaikan, cara pakainya. Bahasa sesuai bahasa konten.
11. Video demo: hanya link YouTube atau Loom yang sudah ada di README. Jangan membuat link.
12. Screenshot: maks. 3 gambar JPEG/PNG/WebP. Sebutkan file gambar yang sudah ada di proyek
    (public/, assets/, docs/, og-image) dan urutan yang disarankan; gambar pertama jadi cover.
    Kalau tidak ada, sarankan 3 layar yang perlu saya screenshot.
13. Cerita build (masing-masing boleh kosong, isi hanya dari bukti di git log, file jejak agen,
    atau obrolan kita; tandai [DRAF, CEK] kalau kamu menyusun ulang):
    - Prompt yang bikin "wah" (maks. 1000): prompt-nya dan apa yang terjadi.
    - Kendala terbesar (maks. 1000): bagian paling bikin frustrasi, dan gimana lolosnya.
    - Kalau mulai ulang (maks. 2000): apa yang bakal dilakukan beda.
    Tulis sebagai saya (orang pertama), santai dan jujur.

## Langkah 3: cek aturan sebelum menyerahkan

- Hitung karakter setiap isian dan pastikan di bawah batas.
- Semua link diawali https://. Video hanya YouTube/Loom.
- Minimal satu tools dari kelompok Agen AI, App builder AI, atau Asisten AI.
- Tidak ada API key, token, password, email, nomor HP, atau data pribadi orang lain di prompt,
  cerita, deskripsi, atau screenshot yang disarankan. Kalau ada, sensor dan beri peringatan.
- Proyek tidak memuat konten dewasa, judi, penipuan, phishing, atau yang melanggar hukum. Kalau
  ragu, beri tahu saya.

## Format jawaban

Tulis dalam urutan form, setiap jawaban di blok kode sendiri supaya mudah disalin:

### 1. Repo
Link repo GitHub: ... (publik / privat)
Link live: ... (opsional)

### Judul (x/80)
### Tagline (x/80)
### Screenshot (urutan)
### 2. Prompt kunci (x/280)
### 3. Lama pembuatan
pilihan + alasan dari git log
### 4. Tools
Pilih dari katalog: ...
Tools baru: nama | situs
Kategori: ... (alasan)
Bahasa konten: ID / EN
Deskripsi (x/5000): ...
Video demo: ...
### 5. Cerita build
Prompt yang bikin "wah" (x/1000): ...
Kendala terbesar (x/1000): ...
Kalau mulai ulang (x/2000): ...

### Perlu kamu cek
Daftar semua [TANYA SAYA] dan [DRAF, CEK], plus peringatan aturan kalau ada.

Kalau ada isian wajib yang tidak bisa diisi dari bukti, tanyakan dulu ke saya dalam satu pesan
berisi semua pertanyaan, lalu tulis jawaban lengkapnya.

Kalau kamu bisa mengendalikan browser dan saya memintanya: buka https://jadinya.dev/submit,
isi form sesuai jawaban di atas, lalu berhenti. Jangan menekan "Kirim untuk review" atau
"Tayangkan", dan jangan mengerjakan verifikasi keamanan (Turnstile); itu saya yang lakukan.
````
