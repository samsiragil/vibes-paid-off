# Catatan untuk sesi redesign Buku Tulis

Bacaan wajib sebelum mengubah tampilan. Spesifikasi lengkap ada di [README.md](README.md); dokumen ini berisi **apa yang berubah dari kode sekarang, urutan kerja, dan jebakan yang perlu diperhatikan**.

## 0. Yang sudah selesai (sesi 2026-10-25)

Logo Jejak Jadi sudah terpasang. Jangan dikerjakan ulang:

- `components/layout/logo.tsx`: `Logo` (lockup), `LogoSymbol`, `LOGO_PATHS`. Komponen `Wordmark` lama ("Jadi*nya.*" Fraunces) sudah dihapus.
- `app/globals.css`: token `--logo` (bata di terang, putih di gelap) dan `--color-logo`.
- Header dan footer memakai `Logo`; `SystemAvatar` memakai `LogoSymbol` (sebelumnya huruf "V" italic, sisa brand lama).
- `app/favicon.ico` (16/32/48), `app/icon.svg`, `app/apple-icon.png`, `app/manifest.ts`, `public/brand/icon-192.png`, `public/brand/icon-512.png`. PNG dan ICO dibuat dari `logo-exploration/jejak-jadi/*.svg` dengan sharp.
- `lib/og.tsx`: `Wordmark` di OG image kini menggambar lockup dari `LOGO_PATHS` dengan warna bata.

Sisanya (font, warna, komponen, halaman) masih desain lama.

## 1. Batas lingkup

**Boleh berubah:** token warna, font, komponen UI, tata letak halaman, teks UI (lewat `messages/*.json`), OG image.

**Tidak boleh berubah:** skema database, rumus peringkat, rute dan URL (profil tetap `/u/[username]`), alur moderasi, istilah produk (lihat README §10), dukungan ID/EN, mode gelap, skip link.

**Tidak boleh ditambahkan:** follow/pengikut, jumlah dilihat, pin obrolan, status freelance, tombol hubungi/hire, riwayat versi, koleksi, rekomendasi "serupa", link Instagram/TikTok, pilihan sorotan stabilo oleh maker. Kalau sebuah layout terasa butuh salah satu ini, ubah layout-nya, bukan menambah fitur.

## 2. Sekarang → Buku Tulis

| Aspek | Sekarang | Buku Tulis |
|---|---|---|
| Latar | Krem `#F7F6F2` | Kertas putih kebiruan `#FBFCFE` |
| Aksen | Hijau `#1E5446` | Bata `#A44732` (dari logo) |
| Huruf | Fraunces (italic), Geist, Geist Mono | Source Sans 3 + Gochi Hand |
| Label kecil | Mono kapital (`MonoLabel`) | Source Sans 3 Semibold 13 px, huruf biasa |
| Obrolan | Bubble chat gelap/terang | Blok catatan bergaris + jeda tulisan tangan + tempelan |
| Bentuk | Pill di mana-mana, kartu radius 22 | Kontrol radius 6, kartu 4, pill tidak dipakai |
| Terpilih | Isi gelap/aksen | Stabilo |
| Judul | Serif dengan potongan italic ("Obrolan *terpopuler*") | Source Sans 3 Bold tanpa italic |

## 3. Urutan kerja yang disarankan

Setiap langkah bisa di-commit sendiri dan aplikasi tetap jalan.

1. **Token.** Ganti nilai di `app/globals.css` sesuai README §3, tambah `rule`, `margin`, `highlight`, `highlight-ink`, `success`, `warning`, `danger` (petakan juga di `@theme inline`). Hapus `bubble` setelah semua pemakainya pindah (sekitar 27 file memakai `bg-bubble`; mayoritas skeleton dan bubble).
2. **Font.** Di `app/[locale]/layout.tsx` ganti Fraunces/Geist/Geist Mono dengan `Source_Sans_3` (400, 600, 700) dan `Gochi_Hand` (400, `preload: false`, `display: "swap"`) dari `next/font/google`. Perbarui `--font-display`, `--font-sans`, dan `--font-mono` di `@theme`; tambah `--font-hand`. Hapus `assets/fonts/fraunces-*` setelah tidak dipakai. Baca dulu panduan font di `node_modules/next/dist/docs/` (AGENTS.md).
3. **Komponen dasar** di `components/ui/`: `button.tsx`, `pill.tsx`, `badge.tsx` (termasuk `MonoLabel`, kira-kira 13 file), `field.tsx`, `segmented.tsx`, `copy-link.tsx`, `avatar.tsx` (inisial). Lihat galeri komponen di `/id/dev/ui` untuk memeriksa semuanya sekaligus.
4. **Komponen obrolan.** `components/ui/bubble.tsx` (`PromptBubble`, `ResultBubble`, `TimeGap`, `SystemMessage`) menjadi komponen catatan. Pertahankan API props sebisa mungkin agar halaman tidak perlu banyak diubah. Panah kait jeda waktu dibuat sebagai SVG inline.
5. **Kartu dan daftar:** `project-card.tsx`, `project-grid-card.tsx`, `project-row.tsx`, `home-hero.tsx`, `worth-it-button.tsx`, `replies.tsx`, `story-moments.tsx`, `build-timeline.tsx`, `media-gallery.tsx`, `link-status-badge.tsx`.
6. **Halaman**, sesuai urutan dampak: detail obrolan (`p/[slug]`), profil (`u/[username]`), beranda, jelajah, tools, Pamerin (`submit`, `project-form.tsx`), `/me`, `/support`, `/rules`, login/onboarding, 404/500, admin terakhir.
7. **OG image.** `lib/og.tsx` memakai font WOFF di `assets/og/` karena `next/og` tidak bisa membaca WOFF2. Siapkan Source Sans 3 (400, 600) dan Gochi Hand dalam WOFF, ganti palet `og`, perbarui `opengraph-image.tsx` di `p/[slug]` dan `u/[username]`. Hapus WOFF Fraunces/Geist lama.
8. **Sisa:** `background_color` di `app/manifest.ts` (sekarang `#f7f6f2`) diganti `#fbfcfe`; perbarui tabel token di `docs/implementation-plan.md` §1.2 agar menunjuk ke design system ini.

## 4. Pencarian cepat untuk menemukan sisa gaya lama

```bash
grep -rn "font-display\|italic" app components
```

```bash
grep -rn "font-mono\|MonoLabel" app components
```

```bash
grep -rn "bg-bubble\|rounded-full\|rounded-\[22px\]" app components
```

Angka kasar saat ini: `font-display` sekitar 43 tempat, `italic` 39, `font-mono` 73, `MonoLabel` 55, `bg-bubble` 54, `rounded-full` 55 (sebagian untuk avatar, itu tetap).

## 5. Jebakan

- **Garis baris meleset.** Teks hanya duduk di garis kalau `line-height` tepat 32 px dan padding atas kelipatan 8. Jangan pakai garis baris di elemen dengan ukuran huruf campuran.
- **Tulisan tangan dan performa.** Gochi Hand hanya untuk teks pendek; jangan di-preload, dan jangan jadi elemen LCP. Target Lighthouse mobile tetap ≥ 90 performa, ≥ 95 a11y dan SEO.
- **Tulisan tangan dan aksesibilitas.** Tanggal tulisan tangan tetap memakai `<time dateTime>`; jangan jadikan satu-satunya pembawa informasi penting.
- **Screenshot berwarna di atas kertas bergaris.** Screenshot selalu di atas `surface` putih (tempelan), tidak langsung di atas garis.
- **Mode gelap.** Garis baris dan margin harus sangat redup (`rule` `#2A2F38`); cek bahwa stabilo gelap tetap terbaca dengan teks terang.
- **Bata bukan warna error.** Error memakai `danger`; jangan andalkan bata.
- **Stabilo berlebihan.** Maksimal satu sorotan teks per kartu. Untuk keadaan terpilih, stabilo boleh jadi latar chip.
- **Isi otomatis form.** `project-form.tsx` punya pratinjau kartu langsung (`LiveCardPreview`); pratinjau harus memakai komponen kartu yang sama dengan jelajah.
- **Teks.** Mengubah teks berarti mengubah `id.json` dan `en.json` bersamaan; `pnpm messages:check` gagal kalau key atau argumen ICU tidak sama.
- **Line ending.** Di checkout Windows ini `prettier --check` sudah memberi peringatan pada beberapa file karena CRLF sebelum perubahan apa pun. Nilai format yang menentukan adalah CI.

## 6. Pemeriksaan sebelum selesai

- `pnpm lint`, `pnpm typecheck`, `pnpm messages:check`, `pnpm test`, `pnpm build`.
- Lebar 375 px dan 1440 px, terang dan gelap, tanpa scroll horizontal.
- Navigasi keyboard: fokus terlihat di semua kontrol, urutan logis, skip link berfungsi.
- Halaman `/id/dev/ui` menampilkan semua komponen baru.
- OG image `/id/p/[slug]/opengraph-image` dan `/id/u/[username]/opengraph-image` memakai font dan warna baru.
- Tidak ada lagi `font-display` italic, `MonoLabel` kapital, atau token `bubble` yang tersisa tanpa alasan.

## 7. Referensi

- Arah yang dipilih: "C. Buku Tulis" di halaman eksplorasi https://claude.ai/artifact/2jfEoLU4ryAGTX1wbmVTuq. Contoh di sana memakai Lexend dan aksen biru pulpen; **design system ini menggantinya** dengan Source Sans 3 dan bata agar sejalan dengan logo.
- Logo: `logo-exploration/jejak-jadi/concept.md`.
- Usulan UI lama berbasis logo: `logo-exploration/web-app-concept/design-direction.md` (palet bata dan aturan warna semantik diambil dari sana; susunan "Galeri karya" tidak dipakai).
