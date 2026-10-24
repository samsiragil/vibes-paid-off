# Jadinya — eksplorasi identitas v02

Lima opsi logo berdasarkan esensi produk dan brief yang telah disetujui. Semua hasil berada dalam folder ini; source aplikasi, logo produksi, konfigurasi, manifest, dan lockfile tidak diubah. Tidak ada commit, push, atau deploy.

**Keputusan pengguna:** opsi 01, Jejak Jadi, dipilih. Tahap berikutnya membandingkan arah web app; usulan dan token warna tercatat di [arah desain web app](../../web-app-concept/design-direction.md). Konsep UI dan palet belum dianggap final sebelum pengguna memilihnya.

## Buka hasil

Buka **[index.html](index.html)** langsung di browser, misalnya lewat klik ganda pada berkas. Tidak membutuhkan build, server, internet, CDN, maupun instalasi font. Jangan memindahkan index.html sendirian; pertahankan struktur folder.

- [Product Essence](product-essence.md): fakta repo, interpretasi, metafora, dan rujukan.
- [Brief final](brief.md): jawaban pengguna dan asumsi minor.
- [Seleksi konsep](concepts.md): 15 gagasan awal dan alasan memilih lima.
- [Penilaian](evaluation.md): skor, kritik, rekomendasi, dan hasil verifikasi.

## Lima opsi

| Folder | Arah | Peran |
|---|---|---|
| [01-jejak-jadi](01-jejak-jadi/concept.md) | J dengan keping masukan | Rekomendasi utama |
| [02-temu-hasil](02-temu-hasil/concept.md) | Dua siku berhadapan | Pasangan prompt–hasil |
| [03-keping-jadi](03-keping-jadi/concept.md) | Tiga keping asimetris | Percobaan menjadi karya |
| [04-lembar-lanjut](04-lembar-lanjut/concept.md) | Dua lembar terbuka | Proses yang dibagikan |
| [05-jadi-terbuka](05-jadi-terbuka/concept.md) | Wordmark dengan a khusus | Wildcard tipografis |

## Aset dalam setiap folder

- `symbol.svg`: simbol primary; viewBox `0 0 256 256`.
- `horizontal.svg`: simbol + wordmark primary; rasio mengikuti isi.
- `mono.svg`: simbol satu warna berbasis `currentColor`.
- `mono-black.svg`, `mono-white.svg`: simbol dengan warna eksplisit untuk pemakaian lewat `<img>`.
- `horizontal-black.svg`, `horizontal-white.svg`: lockup hitam dan putih.
- `wordmark.svg`: nama saja, seluruh huruf sudah menjadi path.
- `symbol-small.svg`: favicon SVG; gunakan pada 16–24 px untuk opsi kelima. Untuk opsi 1–4, sama dengan simbol utama.
- `app-icon.svg`: simbol putih di bidang primary rounded square, untuk preview app icon/avatar.
- `concept.md`: makna, konstruksi, palet, typeface, kelebihan, kelemahan, risiko, dan turunan UI.

Total: **50 SVG**. App icon adalah aset vektor eksplorasi; belum berupa paket platform iOS/Android atau berkas ICO. Halaman menyediakan tautan unduh/buka. Browser dapat memilih membuka SVG terlebih dahulu; simpan lewat menu browser bila perlu.

`mono.svg` mengikuti CSS `color` bila ditanam inline. Jika dimuat lewat `<img>`, warna tidak diwariskan dari halaman induk; gunakan varian `mono-black.svg` / `mono-white.svg`. Jangan menggunakan filter CSS untuk membalik warna logo.

Ukuran 16, 32, 64, dan 256 px di halaman merupakan ukuran kanvas CSS. Tinta di dalamnya mempunyai margin optis. Lihat pada zoom 100%; pembesaran layar dapat mengubah ukuran fisik. Mockup header adalah contoh statis, ditandai jelas, tanpa kontrol palsu.

## Font dan lisensi

Wordmark dasar: **Source Sans 3 Semibold**, Adobe; SIL Open Font License 1.1. Font lokal ada di `fonts/SourceSans3-Semibold.otf`, lisensi di [fonts/OFL.txt](fonts/OFL.txt). Wordmark telah di-outline menggunakan opentype.js; SVG tidak memuat elemen `<text>`. Pada Jadi Terbuka, kedua a adalah gambar vektor khusus; font asli tidak dimodifikasi.

- Sumber font: https://github.com/adobe-fonts/source-sans (berkas `release/OTF/SourceSans3-Semibold.otf`).
- Salinan lisensi: https://github.com/google/fonts/blob/main/ofl/sourcesans3/OFL.txt .
- Alat outline: opentype.js 1.3.4, lisensi MIT di [tools/opentype-LICENSE.txt](tools/opentype-LICENSE.txt). Salinan alat hanya untuk reproduksi; halaman tidak memuat JavaScript.

## Reproduksi dan QA

Membuka hasil tidak membutuhkan Node/Python. Untuk meregenerasi aset, jalankan dari root repo:

```powershell
node logo-exploration/arsip/v02/build.cjs
python logo-exploration/arsip/v02/qa/validate.py
```

`build.cjs` menulis ulang aset, catatan konsep, halaman, CSS, dan data skor di v02; perubahan manual pada keluaran itu perlu dibawa kembali ke generator. Dokumen brief, essence, README, dan evaluation tidak ditulis ulang.

Pemeriksaan browser memakai `qa/render.cjs` dengan Playwright dan Chrome yang telah tersedia di mesin. Set `PLAYWRIGHT_MODULE` ke modul Playwright dan `CHROME_PATH` bila lokasi Chrome berbeda. Tidak ada dependency yang ditambahkan ke proyek. Hasil mesin: [struktur](qa/structure-results.json), [render](qa/render-results.json). Screenshot tersimpan di `qa/`, termasuk [desktop](qa/desktop-overview.png) dan [mobile](qa/mobile-overview.png).

Logo belum diperiksa terhadap basis data merek dagang. Skor adalah penilaian desain, bukan jaminan keunikan atau performa bisnis.
