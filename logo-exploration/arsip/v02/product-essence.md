# Product Essence — Jadinya

Tanggal: 23 Oktober 2026. Analisis Fase 1 dipertahankan sebagai dasar. Jawaban brief sudah diterima; keputusan final ada di `brief.md`. Konsep dan aset Fase 3–5 disusun berdasarkan jawaban tersebut.

## Dasar analisis

Repository produk tersedia di `C:/Work/Personal/vibes-paid-off`. Instruksi `AGENTS.md` telah dibaca. Status awal: `.claude/launch.json` dimodifikasi dan `logo-exploration/` belum dilacak Git. Keduanya dipertahankan. Hasil sesi ini memakai subfolder baru `logo-exploration/v02/`.

Analisis mengambil fungsi, data, alur, copy, dan riwayat lokal. Warna, tipografi, CSS, theme, serta logo lama tidak menjadi sumber arah visual. Eksplorasi lama hanya diinventarisasi namanya, tidak dijadikan acuan. Dokumen rencana memuat uraian UI lama; uraian visual tersebut dikesampingkan. Tidak membaca berkas lingkungan rahasia, mengakses database produksi, atau memeriksa issue eksternal. Temuan menggambarkan implementasi lokal, bukan verifikasi perilaku deployment atau riset pengguna.

## 1. Produk dalam satu kalimat

**Fakta:** Jadinya adalah katalog dan portfolio proyek vibe coding Indonesia untuk memamerkan karya yang dapat dicoba serta membagikan cara pembuatannya.

Sumber: `README.md`; `messages/id.json` → `meta.description`, `home`, `communityRules.share`.

## 2. Pengguna utama dan konteks

- **Fakta:** maker yang membuat proyek dengan bantuan AI; pengunjung yang menjelajah karya, alat yang dipakai, dan proses pembuatannya. Dukungan bahasa Indonesia dan Inggris tersedia.
- **Alur terimplementasi:** jelajah → detail proyek → coba hasil / pelajari proses / lihat profil; untuk mengirim proyek: login → pilih username bila belum ada → isi proyek dan sesi → review pertama → publikasi. Proyek berikutnya dari maker terpercaya dapat langsung tayang.
- **Interpretasi:** pengunjung sekunder mencakup pembelajar yang mencari contoh nyata sebelum mencoba membuat sendiri.
- **Belum diketahui:** proporsi pemula/profesional, usia, profesi, ukuran komunitas, dan prioritas ekspansi global.

Sumber: `app/[locale]/submit/page.tsx`; `app/[locale]/p/[slug]/page.tsx`; `app/[locale]/u/[username]/page.tsx`; `lib/projects/discovery.ts`; `messages/id.json` → `onboarding`, `communityRules.moderation`; `README.md`.

## 3. Masalah yang diselesaikan

**Interpretasi dari fitur:** hasil akhir saja tidak menjelaskan bagaimana sebuah proyek dibuat. Jadinya menyandingkan karya dengan prompt, alat, durasi, hasil per sesi, dan pelajaran sehingga orang dapat menemukan karya sekaligus memahami prosesnya. Ini hipotesis nilai produk yang didukung implementasi, bukan hasil wawancara pengguna.

Sumber: `supabase/migrations/20261015080000_schema.sql` → `projects`, `project_sessions`, `project_tools`; `lib/validation/project.ts`.

## 4. Aksi inti

**Fakta:** memamerkan, menjelajah, mencoba, menceritakan, mendokumentasikan, menanggapi, mengapresiasi. **Interpretasi:** belajar dari proses orang lain dan memperoleh kepercayaan melalui bukti karya.

Sumber: `messages/id.json` → `home`, `communityRules`; `lib/projects/discovery.ts`; schema `upvotes`, `comments`.

## 5. Entitas inti

- `profiles`: identitas maker dan portfolio.
- `projects`: karya, prompt kunci, tautan live, kategori, bahasa, dan pelajaran.
- `project_sessions`: prompt → hasil, durasi, kendala, solusi, urutan sesi.
- `tools` dan `project_tools`: alat serta hubungan dengan karya.
- `project_media`: bukti visual hasil.
- `upvotes`, `comments`: apresiasi dan diskusi.
- `weekly_picks`: pilihan mingguan beserta skor yang dapat diaudit.
- Pendukung: `categories`, `tool_suggestions`, `reports`.

Sumber: `supabase/migrations/20261015080000_schema.sql`.

## 6. Nama dan potensi huruf

**Fakta terverifikasi:** nama brand adalah **Jadinya**. Commit lokal `f0ddcd6` (`chore: rename brand to Jadinya`) mencatat alasan nama sebelumnya terlalu panjang untuk diucapkan dan memaknai nama baru sebagai “how it turned out”. Pergantian nama juga dicatat pada bagian awal `docs/implementation-plan.md`. `vibes-paid-off` pada manifest adalah nama teknis yang tertinggal, bukan nama logo yang diusulkan.

**Interpretasi semantik:** hasil yang muncul setelah seseorang mencoba membuat sesuatu; nuansa bahasa Indonesia yang percakapan dan membumi. Tidak ditemukan cerita pendiri yang lebih jauh.

**Observasi tipografis, belum konsep:** tujuh huruf; `j` dan `i` memiliki titik pada huruf kecil, `a` berulang, `d` memberi batang naik, `j` dan `y` memberi kemungkinan ritme turun. Potensi bergantung pada typeface. Kapitalisasi dan penggunaan `.dev` masih perlu ditentukan.

## 7. Perasaan yang disarankan

**Interpretasi/desiderata desain:** “ternyata bisa”, bangga menunjukkan hasil, nyaman berbagi proses yang belum sempurna, ingin mencoba, dan percaya pada karya yang dapat diperiksa. Usulan tiga sifat: **ramah, ingin tahu, percaya diri**. Belum menjadi keputusan pengguna.

## 8. Pembeda yang didukung repo

- Karya disertai dokumentasi proses terstruktur; prompt, hasil, dan durasi sesi wajib, kendala/solusi serta pelajaran opsional. Validasi menetapkan 1–10 sesi.
- Tautan live wajib saat pengiriman dan aturan meminta karya bisa dibuka; tersedia status live/offline/archived. Jadi tidak diasumsikan seluruh karya selamanya aktif.
- Penemuan proyek berdasarkan alat, kategori, dan pencarian, dengan profil maker sebagai portfolio.
- Peringkat otomatis memakai vote layak + 0,5 × pembalas layak; pemilihan mingguan mempunyai aturan rotasi. Moderasi konten berbeda dari pemilihan peringkat.
- Fokus Indonesia dengan akses bilingual; rencana produk menyebut gratis dan dukungan donasi.

Sumber: `lib/validation/project.ts`; `lib/projects/discovery.ts`; `supabase/migrations/20261015080200_ranking.sql`; `messages/id.json` → `communityRules`, `support`; `docs/implementation-plan.md` §1.1.

Ini pembeda dalam rancangan produk, bukan klaim eksklusif terhadap kompetitor. Produk mengatalogkan karya berbantuan AI; tidak ditemukan dasar untuk memosisikannya sebagai generator AI atau layanan yang menjanjikan pendapatan.

## 9. Kosakata metafora awal

Berikut ranah makna, bukan konsep logo atau pilihan siluet:

1. Etalase — karya yang dipamerkan.
2. Buku proses — langkah pembuatan yang dapat dibaca.
3. Jejak — urutan percobaan yang tertinggal.
4. Jendela — melihat hasil yang dapat dibuka.
5. Sambungan — hubungan prompt dengan hasil.
6. Rak — kumpulan karya dan alat yang dapat dijelajah.
7. Anyaman — kontribusi maker, alat, dan percakapan.
8. Perakitan — bagian-bagian yang menjadi satu hasil.
9. Ambang — perpindahan dari niat ke sesuatu yang ada.
10. Perubahan keadaan — proses menjadi hasil yang nyata.

## 10. Klise yang perlu dihindari

Otak/sirkuit/sparkle AI generik; roket peluncuran; centang produktivitas; kurung kode sebagai satu-satunya gagasan; bubble chat generik yang menyiratkan aplikasi messenger; piala/medali yang terlalu menekankan kompetisi; uang/grafik profit dari nama lama; huruf di lingkaran polos; globe, bohlam, dan swoosh. Tidak mewarisi palet, font, atau bentuk UI lama secara otomatis.

## Hal yang menunggu keputusan

Kapitalisasi/domain pada logo; prioritas audiens dan pasar; kepribadian serta kesan terlarang; referensi dan kompetitor; preferensi warna serta elemen yang wajib dipertahankan; jenis logo dan pemakaian utama. Lihat `brief.md`.
