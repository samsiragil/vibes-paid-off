# Jadinya — eksplorasi logo

**Keputusan:** logo yang dipakai adalah **Jejak Jadi** (opsi 01 dari putaran v02). Belum diimplementasikan ke aplikasi.

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

## Belum dikerjakan

- Implementasi ke aplikasi (favicon, header, manifest, OG image).
- Paket platform: ICO, PNG berbagai ukuran, apple-touch-icon.
- Pemeriksaan merek dagang.
