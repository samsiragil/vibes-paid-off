# Jadinya — eksplorasi logo

**Keputusan:** logo yang dipakai adalah **Jejak Jadi** (opsi 01 dari putaran v02). Sudah diimplementasikan ke aplikasi (2026-10-25); aturan pakainya ada di [docs/design-system](../docs/design-system/README.md#8-logo-jejak-jadi).

## Struktur

| Folder | Isi |
|---|---|
| [jejak-jadi/](jejak-jadi/concept.md) | Aset logo terpilih, siap dipakai saat implementasi |
| [web-app-concept/](web-app-concept/design-direction.md) | Arah desain web app berbasis Jejak Jadi; belum final |
| [arsip/v02/](arsip/v02/README.md) | Putaran v02 lengkap: brief, product essence, lima opsi, evaluasi, halaman perbandingan, QA |
| [arsip/v01/](arsip/v01/index.html) | Putaran pertama (enam opsi, sebelum brief) |

Arsip disimpan utuh agar halaman perbandingan dan skrip build tetap bisa dijalankan. Salinan sumber Jejak Jadi tetap ada di `arsip/v02/01-jejak-jadi/`; `jejak-jadi/` adalah salinan yang menjadi acuan.

## Aset Jejak Jadi

| Berkas | Pemakaian |
|---|---|
| `symbol.svg` | Simbol warna primary; juga favicon (tetap terbaca di 16 px) |
| `horizontal.svg` | Simbol + wordmark, untuk header |
| `horizontal-black.svg`, `horizontal-white.svg` | Lockup satu warna untuk latar terang / gelap |
| `mono.svg` | Simbol `currentColor`, untuk SVG inline |
| `mono-black.svg`, `mono-white.svg` | Simbol satu warna untuk `<img>` |
| `wordmark.svg` | Nama saja, huruf sudah berupa path |
| `app-icon.svg` | Simbol putih di rounded square primary; dasar app icon / avatar |

Palet: primary `#A44732`, neutral `#292523`, accent `#E5B786`. Wordmark: Source Sans 3 Semibold (SIL OFL 1.1). Detail konstruksi dan aturan pakai ada di [concept.md](jejak-jadi/concept.md).

## Implementasi

Header dan footer (`components/layout/logo.tsx`), avatar sistem, favicon (`app/favicon.ico` 16/32/48, `app/icon.svg`), `app/apple-icon.png`, `app/manifest.ts` dengan `public/brand/icon-192.png` dan `icon-512.png`, serta OG image (`lib/og.tsx`).

## Belum dikerjakan

- Ikon maskable khusus Android (sekarang ikon manifest bertujuan `any`).
- Pemeriksaan merek dagang.
