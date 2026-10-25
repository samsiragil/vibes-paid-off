# Design system Jadinya: Buku Tulis

Status: **disetujui sebagai arah** (2026-10-25). Belum diterapkan ke halaman; penerapannya dikerjakan di sesi redesign tersendiri. Catatan perubahan untuk sesi itu ada di [catatan-redesign.md](catatan-redesign.md).

Dokumen ini menggantikan token dan aturan visual di `docs/implementation-plan.md` §1.2 (Fraunces, Geist, aksen hijau, bubble chat). Struktur data, rute, peringkat, dan istilah produk tidak berubah.

## 1. Gagasan

Setiap obrolan adalah **satu halaman di buku tulis maker**: prompt kunci dicatat, waktu pengerjaan ditulis tangan di bawahnya, lalu hasilnya ditempel. Kertas bergaris dan garis margin adalah struktur, bukan hiasan. Logo **Jejak Jadi** (keping masukan, lalu kait yang mendarat) memberi warna bata dan bahasa bentuk "masukan kecil, hasil utuh".

Kenapa Buku Tulis:

- **Ramah pemula.** Semua orang Indonesia pernah menulis di buku tulis bergaris dengan margin merah. Tidak ada kesan "alat developer".
- **Cocok dengan produknya.** Cerita build (prompt yang bikin “wah”, kendala terbesar, kalau mulai ulang) memang catatan belajar.
- **Hierarki tegas.** Satu halaman, satu catatan. Elemen lain mengalah.

## 2. Prinsip

1. **Obrolan tetap kerangka.** Urutannya selalu prompt kunci, lalu "… kemudian", lalu hasil, disertai Worth it dan balasan. Yang berubah hanya cara menggambarnya: catatan di buku, bukan bubble chat.
2. **Satu fokus per layar.** Lihat tabel di §9. Kalau dua hal sama besar, salah satunya diturunkan.
3. **Bahasa sehari-hari.** Tanpa label mono, tanpa istilah teknis di label. Istilah teknis hanya muncul sebagai nama tools.
4. **Material punya fungsi.** Garis baris adalah grid vertikal 32 px. Stabilo berarti "ditandai/terpilih". Tulisan tangan hanya untuk catatan pinggir. Tempelan hanya untuk screenshot utama.
5. **Hanya fitur yang ada.** Jangan mendesain follow, views, pin, status freelance, hire/kontak, versi, koleksi, rekomendasi, atau Instagram/TikTok selama fiturnya belum dibuat.

## 3. Warna

Netral sekitar 85–90% permukaan. Satu aksen: **bata** dari logo. Stabilo (peach logo) adalah material penanda, bukan aksen kedua; jangan dipakai untuk teks.

### Token

Nama token mengikuti `app/globals.css` sekarang supaya migrasi kecil. Token baru ditandai ✚.

| Token | Terang | Gelap | Peran |
|---|---|---|---|
| `bg` | `#FBFCFE` | `#1A1B1E` | Kertas, latar halaman |
| `surface` | `#FFFFFF` | `#222428` | Tempelan, kartu, input, panel |
| `ink` | `#292523` | `#EEEAE6` | Teks utama (netral logo) |
| `ink-2` | `#4A4744` | `#CBC6C0` | Teks sekunder |
| `muted` | `#67635E` | `#A29D97` | Meta, keterangan |
| `border` | `#E3E4E8` | `#33363C` | Pembatas struktur |
| `border-strong` | `#8E9196` | `#6E727A` | Batas kontrol (input, tombol sekunder) |
| `accent` | `#A44732` | `#E8A58E` | Bata: aksi utama, link penting, fokus |
| `on-accent` | `#FFFFFF` | `#2D1D17` | Teks di atas `accent` |
| `accent-text` | `#A44732` | `#EBAF9A` | Teks/link bata di atas `bg` |
| `accent-soft` | `#F6E9E5` | `#3A2A25` | Bidang lembut bata (badge terpercaya) |
| `accent-ink` | `#6E2C1E` | `#F3C9BA` | Teks di atas `accent-soft` |
| ✚ `rule` | `#DCE4F0` | `#2A2F38` | Garis baris buku (dekoratif) |
| ✚ `margin` | `#E2A397` | `#7A3B2E` | Garis margin (dekoratif, satu per blok catatan) |
| ✚ `highlight` | `#E5B786` | `#6B5034` | Stabilo: penanda dan keadaan terpilih |
| ✚ `highlight-ink` | `#292523` | `#EEEAE6` | Teks di atas stabilo |
| `placeholder` | `#EEF0F4` | `#2A2C31` | Slot screenshot kosong, skeleton |
| `dashed` | `#A9AEB8` | `#5C6068` | Slot upload kosong |
| ✚ `success` | `#2F6B47` | `#A1CEAC` | Link Live |
| ✚ `warning` | `#805C12` | `#E6C37B` | Link Offline |
| ✚ `danger` | `#B42318` | `#FFB4A9` | Error form, laporan |
| `logo` | `#A44732` | `#FFFFFF` | Logo (sudah ada di `globals.css`) |

Token `bubble` dihapus. Pemakainya pindah ke `surface` atau `placeholder` (lihat catatan redesign).

### Kontras yang sudah dihitung

| Pasangan | Rasio |
|---|---|
| `ink` di `bg` (terang) | 14,9:1 |
| `muted` di `bg` (terang) | 5,8:1 |
| `accent-text` di `bg` (terang) | 5,9:1 |
| `on-accent` di `accent` (terang) | 6,0:1 |
| `border-strong` di `bg` (terang, batas kontrol) | 3,1:1 |
| `highlight-ink` di `highlight` (terang) | 8,3:1 |
| `ink` di `bg` (gelap) | 14,7:1 |
| `muted` di `bg` (gelap) | 6,4:1 |
| `accent-text` di `bg` (gelap) | 9,2:1 |
| `on-accent` di `accent` (gelap) | 7,9:1 |
| `highlight-ink` di `highlight` (gelap) | 6,3:1 |

Pasangan lain (teks di `surface`, `accent-soft`, warna semantik) wajib dihitung ulang saat komponennya dibuat. `rule` dan `margin` tidak pernah membawa informasi, jadi tidak perlu kontras teks. Bata **tidak boleh** dipakai sendirian untuk menyatakan error; error memakai `danger` plus ikon atau teks.

## 4. Tipografi

Dua keluarga, keduanya SIL OFL:

- **Source Sans 3** untuk semua UI, judul, dan isi. Sama dengan wordmark logo. Berat 400, 600, 700. Angka sejajar dengan `font-variant-numeric: tabular-nums`.
- **Gochi Hand** untuk tulisan tangan saja: tanggal di margin, label "… kemudian", dan satu catatan pinggir per layar. Minimal 18 px, maksimal satu baris kecuali catatan pinggir, tidak pernah untuk tombol, data, atau label form.

Fraunces, Geist, Geist Mono, dan serif italic sebagai aksen tidak dipakai lagi.

| Peran | Mobile | Desktop | Berat |
|---|---|---|---|
| Display (judul beranda, nama di profil) | 32/36 | 44/48 | 700 |
| H1 (judul obrolan) | 30/36 | 40/44 | 700 |
| H2 (judul bagian) | 22/28 | 26/32 | 600 |
| H3 (judul kartu) | 18/24 | 18/24 | 600 |
| Catatan (prompt, cerita build) | 17/32 | 18/32 | 400 |
| Isi | 16/24 | 17/28 | 400 |
| Kecil (meta, tools) | 14/20 | 14/20 | 400 |
| Label | 13/16 | 13/16 | 600, huruf biasa (bukan kapital semua) |
| Tangan | 20/32 | 22/32 | Gochi Hand 400 |

Line-height 32 pada "Catatan" adalah syarat agar teks duduk tepat di garis buku.

## 5. Ruang, grid, bentuk

- **Satuan dasar 8 px.** Jarak antarelemen dalam grup 8/16, antargrup 24/32, antarbagian 48/64.
- **Garis baris 32 px.** Blok catatan memakai `background: repeating-linear-gradient(to bottom, transparent 0 31px, var(--rule) 31px 32px)` dengan `line-height: 32px` dan padding atas kelipatan 8, supaya teks selalu duduk di garis.
- **Kolom margin.** Desktop 56 px di kiri blok catatan (tempat tanggal dan catatan tangan), garis `margin` 1,5 px di tepi kanannya. Mobile: kolom margin 0, garis margin di 12 px dari tepi blok, tanggal pindah ke atas judul.
- **Kontainer** 1120 px, lebar baca teks 68 karakter, gutter 16 px (mobile) dan 24 px (desktop).
- **Radius:** kontrol 6 px, kartu dan tempelan 4 px, foto maker bulat. Pill (radius penuh) tidak dipakai sebagai bentuk umum.
- **Kedalaman:** tanpa bayangan berlapis. Tempelan memakai border 1 px `border` dan satu bayangan tipis `0 1px 0 var(--border)`. Hanya screenshot utama di detail obrolan yang boleh miring (maks −0,6°) dan diberi selotip.

## 6. Material Buku Tulis dan aturannya

| Material | Dipakai untuk | Batas |
|---|---|---|
| Garis baris (`rule`) | Blok catatan: prompt di detail, cerita build, kolom prompt di form Pamerin, hero beranda, bio profil | Tidak di grid kartu, tabel, admin |
| Garis margin (`margin`) | Satu per blok catatan; juga satu garis tipis di sisi kiri prompt pada kartu obrolan (tanda khas) | Tidak pernah ganda dalam satu blok |
| Stabilo (`highlight`) | Kata yang cocok dengan pencarian, filter/tab terpilih, label Pilihan minggu ini, Worth it yang sudah diberikan | Maksimal satu sorotan teks per kartu; bukan untuk hiasan |
| Tulisan tangan | Tanggal tayang di margin, "… kemudian", satu catatan pinggir (misalnya kendala terbesar) | Satu catatan pinggir per layar |
| Tempelan | Screenshot hasil | Selotip dan kemiringan hanya pada screenshot utama detail obrolan |

## 7. Komponen

Kolom "Sekarang" adalah file yang ada; spesifikasi di kanan adalah bentuk barunya.

| Komponen | Sekarang | Spesifikasi Buku Tulis |
|---|---|---|
| Tombol utama | `components/ui/button.tsx` (`accent`) | Isi bata, teks `on-accent`, radius 6, tinggi 44 (48 di mobile untuk CTA utama), Semibold 16 |
| Tombol sekunder | `button.tsx` (`outline`) | Border 1,5 px `border-strong`, latar `surface`; hover border `ink` |
| Tombol teks | link | Teks `accent-text`, garis bawah offset 3 px |
| Chip tools/filter | `pill.tsx` | Radius 6, border `border`, tinggi 36 (44 di mobile). Terpilih = latar stabilo + teks `highlight-ink`, bukan isi bata |
| Segmented (urutan) | `segmented.tsx` | Teks biasa; yang aktif diberi stabilo di bawah teks (setengah tinggi huruf) |
| Badge status link | `link-status-badge.tsx` | Titik + teks: Live `success`, Offline `warning`, Diarsipkan `muted`. Tanpa bidang warna |
| Badge lain | `badge.tsx` | Maker terpercaya: `accent-soft` + `accent-ink`. Pilihan minggu ini: stabilo. ID/EN: teks kecil `muted` |
| Avatar | `avatar.tsx` | Foto atau inisial bulat. Inisial memakai `accent-soft` + `accent-ink` |
| Avatar sistem | `SystemAvatar` | Lingkaran border dengan simbol Jejak Jadi (**sudah diterapkan**) |
| Prompt kunci | `PromptBubble` (`bubble.tsx`) | Blok catatan bergaris dengan garis margin; label "Prompt kunci" 13/16 Semibold `muted`; teks Catatan |
| Jeda waktu | `TimeGap` | Tulisan tangan "satu weekend kemudian" dengan panah turun berbentuk kait (mengikuti logo). Jika ada cerita build, tambah "· ada cerita build" di Source Sans 14 `accent-text` |
| Hasil | `ResultBubble` | Tempelan: screenshot di `surface` 4 px, lalu judul H3 dan tagline Isi |
| Pesan sistem | `SystemMessage` | Avatar sistem + catatan bergaris pendek; dipakai untuk kosong, sukses, link offline |
| Kartu obrolan | `project-card.tsx`, `project-grid-card.tsx` | Urutan: maker dan kategori → prompt (maks 3 baris, garis margin kiri) → jeda tangan → screenshot → judul → tools (AI dulu, "+N") dan Worth it. Tanpa garis baris |
| Baris "Baru masuk" | `project-row.tsx` | Entri buku: tanggal tangan di margin, judul, cuplikan prompt satu baris |
| Hero beranda | `home-hero.tsx` | Satu halaman catatan besar: prompt, jeda, tempelan miring, Worth it dan balasan |
| Worth it | `worth-it-button.tsx` | "Worth it · 64"; sudah diberi = latar stabilo + centang. Tidak boleh lebih besar dari Coba live |
| Balasan | `replies.tsx` | Catatan di bawah halaman, dipisah garis `border`; @mention `accent-text` |
| Cerita build | `story-moments.tsx`, `build-timeline.tsx` | Tiga catatan dengan label tangan di margin: Prompt yang bikin “wah”, Kendala terbesar, Kalau mulai ulang. Sesi lama (project_sessions) tampil sebagai entri bertanggal |
| Galeri media | `media-gallery.tsx` | Tempelan utama + 2 thumbnail + tautan "Tonton demo" |
| Field | `field.tsx` | Border 1,5 px `border-strong`, radius 6, tinggi 44. Kolom prompt kunci memakai garis baris |
| Salin link | `copy-link.tsx` | Field + tombol sekunder; sukses = teks "Tersalin" dengan ikon centang, 2 detik |
| Header | `site-header.tsx` | Logo (**sudah diterapkan**), nav Jelajah/Tools/Dukung kami, CTA Pamerin proyekmu. Tanpa garis baris |
| Footer | `site-footer.tsx` | Logo (**sudah diterapkan**), tautan, "Gratis, jalan dari donasi." |

**Ikon:** satu keluarga inline SVG, stroke 1,75, ujung rata (mengikuti terminal logo), ukuran 16/20/24. Logo tidak dipakai sebagai ikon fitur.

**State wajib** untuk setiap komponen interaktif: hover, focus (cincin 2 px `accent`, offset 2 px), aktif/terpilih, nonaktif, memuat. Skeleton berupa garis baris kosong seukuran konten.

## 8. Logo Jejak Jadi

Sumber dan konstruksi: [`logo-exploration/jejak-jadi/`](../../logo-exploration/jejak-jadi/concept.md). Implementasi di aplikasi:

| Pemakaian | Implementasi |
|---|---|
| Header | `<Logo />` di `components/layout/logo.tsx`, tinggi 32 px |
| Footer | `<Logo className="h-7" />` |
| Avatar sistem | `<LogoSymbol />` di `SystemAvatar` |
| Favicon | `app/favicon.ico` (16/32/48) dan `app/icon.svg` |
| Apple touch icon | `app/apple-icon.png` 180 px, bata penuh tanpa sudut membulat |
| Manifest | `app/manifest.ts`, ikon `public/brand/icon-192.png` dan `icon-512.png` |
| OG image | `Wordmark` di `lib/og.tsx` menggambar lockup dari path yang sama |

Aturan:

- Warna hanya lewat token `logo`: bata di latar terang, putih di latar gelap. Tidak diwarnai ulang, tidak diberi gradien, bayangan, atau outline.
- Ruang kosong di sekeliling minimal setinggi keping masukan (40/256 tinggi lockup).
- Lebar minimum lockup 96 px; di bawah itu pakai simbol saja.
- Keping terpisah di kiri atas tidak boleh digabung ke huruf J.
- Logo hanya untuk identitas, bukan ornamen atau pola latar.

## 9. Hierarki per halaman

| Halaman | Fokus utama | Kedua | Diturunkan |
|---|---|---|---|
| Beranda | Satu catatan hero (Pilihan minggu ini atau Baru masuk) | Pamerin proyekmu, Jelajahi | Terpopuler minggu ini, tools, baru masuk, ajakan donasi |
| Jelajah | Hasil (kartu obrolan) | Kotak cari dan filter tools | Kategori, bahasa, urutan |
| Detail obrolan | Prompt kunci → jeda → hasil → Coba live | Worth it, cerita build | Balasan, tools, repo, status link, lapor |
| Profil maker | Nama dan daftar obrolannya | Bio, Traktir kopi, salin link | Statistik, link sosial, badge |
| Tools (`/tools/[slug]`) | Obrolan yang dibuat dengan tool itu | Switcher tools | Deskripsi tool |
| Pamerin | Kolom prompt kunci | Pratinjau kartu | Cerita build (boleh nanti) |
| Dashboard `/me` | Daftar obrolan saya dan statusnya | Edit profil | Pengingat cerita build |
| Dukung kami | Alasan dan dua tombol donasi | Tabel biaya | Cara kami memilih |
| Admin | Antrean review dan laporan | Tools | Log; tanpa material buku, hanya token dan komponen dasar |

## 10. Suara dan teks

- Istilah tetap: **obrolan**, **prompt kunci**, **Worth it**, **balasan**, **Pamerin proyekmu**, **Traktir {nama} kopi**, **cerita build**, **maker**, **Maker terpercaya**, **Pilihan minggu ini**, **Baru masuk**.
- Nada santai dan menyemangati ("nggak harus semua", "boleh nanti"). Tanpa emoji.
- Semua teks lewat `messages/id.json` dan `messages/en.json`, dicek dengan `pnpm messages:check`.

## 11. Gerak

- 150 ms untuk perubahan warna dan state, `ease-out`.
- Satu momen khas: panah kait pada jeda waktu boleh tergambar sekali saat pertama terlihat (400 ms). Tanpa animasi lain.
- `prefers-reduced-motion`: semua transisi mati, panah langsung utuh.

## 12. Jangan

- Bubble chat, serif italic sebagai hiasan, label mono berhuruf kapital.
- Gradien, glow, glassmorphism, bayangan di semua kartu.
- Garis baris di semua tempat; lebih dari satu sorotan stabilo per kartu; tulisan tangan untuk kalimat panjang.
- Pill sebagai bentuk default, semua elemen di tengah, hero setinggi layar, kotak statistik sebagai hero profil.
- Fitur yang belum ada (lihat §2 poin 5).
