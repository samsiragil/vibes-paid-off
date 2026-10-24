# Evaluasi — Jadinya v02

Skala 1–5: 1 lemah, 3 memadai dengan kompromi, 5 sangat kuat dalam konteks brief. Skor adalah penilaian desain setelah melihat hasil render, bukan pengukuran objektif, hasil riset pengguna, atau jaminan masa depan. Keunikan dinilai dalam eksplorasi ini dan pola kategori yang dikenal; tidak memakai pencarian logo atau basis data merek.

## Ringkasan skor

| Konsep | Keunikan | Simbol 16 px | Relevansi produk | Ketahanan waktu | Sistem visual |
|---|---:|---:|---:|---:|---:|
| Jejak Jadi | 4 | 5 | 5 | 4 | 5 |
| Temu Hasil | 3 | 4 | 5 | 4 | 5 |
| Keping Jadi | 3 | 4 | 4 | 4 | 5 |
| Lembar Lanjut | 3 | 5 | 4 | 4 | 4 |
| Jadi Terbuka | 4 | 4 | 3 | 4 | 4 |

## Alasan per skor

### 01 — Jejak Jadi

- **Keunikan 4:** J dengan keping terpisah memberi ciri tambahan, meski monogram J merupakan wilayah yang padat.
- **16 px 5:** pita 40 unit dan celah 24 unit menjaga kait J serta masukan terpisah tetap terlihat pada render 1×.
- **Relevansi 5:** mengikat nama Jadinya dengan satu masukan yang menuju hasil. Makna spesifik tetap dibantu penjelasan dan penggunaan bersama wordmark.
- **Ketahanan 4:** bentuk sederhana dan tidak bergantung efek, tetapi harus konsisten memakai keping terpisah agar tidak menjadi J biasa.
- **Sistem 5:** kait, keping, dan gerak menetap dapat menjadi ikon, pola, serta transisi proses.

### 02 — Temu Hasil

- **Keunikan 3:** pasangan siku lazim; offset dan ruang terbuka memberi karakter, tanpa menghapus kemiripan kategori.
- **16 px 4:** bidang tebal tetap jelas; celah terkecil 16 unit menjadi sekitar satu piksel dan sensitif terhadap rasterisasi.
- **Relevansi 5:** pasangan prompt–hasil sesuai langsung dengan struktur sesi pembuatan.
- **Ketahanan 4:** bentuk dasar sederhana, tetapi berpotensi terasa seperti logo integrasi perangkat lunak.
- **Sistem 5:** kuat untuk hubungan dua keadaan, layout pasangan, ikon, dan motion singkat.

### 03 — Keping Jadi

- **Keunikan 3:** tiga keping asimetris membantu; bentuk berlian modular tetap umum pada kategori teknologi.
- **16 px 4:** celah 24 unit bertahan; keping bawah terlihat tetapi bobotnya paling ringan.
- **Relevansi 4:** perakitan beberapa sesi menjadi karya relevan, namun bentuknya sendiri belum menjelaskan katalog atau komunitas.
- **Ketahanan 4:** geometri sederhana; hindari efek kilau yang akan menggeser asosiasi menuju permata/aset digital.
- **Sistem 5:** modul mudah menjadi pola, ilustrasi proses, dan animasi penyusunan.

### 04 — Lembar Lanjut

- **Keunikan 3:** lembar kanan yang lebih tinggi menambah karakter, tetapi buku terbuka merupakan metafora yang sangat umum.
- **16 px 5:** dua bidang besar dan pemisah tengah tetap jelas tanpa detail tambahan.
- **Relevansi 4:** kuat untuk dokumentasi, pelajaran, dan berbagi; lebih lemah untuk pamer karya yang bisa dicoba.
- **Ketahanan 4:** mudah dipahami dan tidak bergantung tren AI; risiko utamanya salah kategori, bukan detail yang cepat usang.
- **Sistem 4:** cocok untuk konten editorial dan urutan proses, tetapi variasinya lebih terbatas daripada modul geometris.

### 05 — Jadi Terbuka

- **Keunikan 4:** dua a dengan kontur khusus dan takikan memberi ciri pada nama. Kerangka huruf tetap familier.
- **16 px 4:** varian kecil menutup takikan agar tidak menjadi noda piksel; mangkuk dan batang tetap terbaca, tetapi ciri takikan tidak hadir pada favicon.
- **Relevansi 3:** nama menjadi fokus, namun simbol a bukan inisial pertama dan hubungan dengan proses produk lebih interpretatif.
- **Ketahanan 4:** perubahan hanya pada satu bentuk huruf yang berulang, menjaga keterbacaan dan tidak menjadi font dekoratif penuh.
- **Sistem 4:** mangkuk dan takikan bisa menjadi pola serta ikon, tetapi perlu dibatasi agar tidak terasa dipaksakan.

## Keputusan dan revisi

**Rekomendasi utama: Jejak Jadi.** Hubungan dengan nama paling langsung, siluet kuat di favicon, dan sistem bentuknya cukup luas. Warna bata memberi karakter hangat tanpa mengorbankan kontras. Keping terpisah adalah bagian identitas yang wajib dipertahankan.

**Wildcard: Jadi Terbuka.** Pilihan paling berani secara tipografi dan hierarki identitas. Gunakan wordmark sebagai pengenal utama pada masa awal; simbol a membutuhkan pengulangan agar diasosiasikan dengan Jadinya. Ini alternatif dengan kompromi yang nyata, bukan opsi yang sengaja dilemahkan.

Varian 16–24 px untuk Jadi Terbuka menghilangkan takikan. Pada 32 px ke atas, takikan tetap ada. Opsi lain tidak memerlukan geometri khusus ukuran kecil berdasarkan render yang diperiksa. Semua skor akhir minimal 3; tidak ada skor di bawah 3 yang ditutupi atau dinaikkan untuk meloloskan konsep. Lembar Lanjut tetap mendapat kritik salah kategori, Temu Hasil dan Keping Jadi tetap mendapat skor keunikan 3.

## Pemeriksaan nyata

- **Kelengkapan:** lima folder konsep; masing-masing sepuluh SVG dan concept.md; seluruh dokumen utama, stylesheet, font lokal, lisensi, serta generator tersedia.
- **XML:** 50 SVG diparse dengan Python ElementTree. Namespace SVG dan viewBox eksplisit; simbol memakai `0 0 256 256`.
- **Isi vektor:** tidak ada elemen text, raster/image, script, foreignObject, filter, clipping, atau referensi eksternal. Seluruh wordmark berupa path. App icon memakai dua warna; aset mono memakai satu warna.
- **Mono:** `mono.svg` menggunakan currentColor; varian hitam dan putih memakai warna eksplisit. Lihat README untuk batas pewarisan warna lewat img.
- **Referensi:** seluruh src/href lokal dan anchor di index.html serta sumber font dalam CSS diperiksa. Halaman tidak memuat CDN atau JavaScript.
- **Browser:** Chrome headless melalui Playwright, membuka index.html langsung lewat file lokal. Screenshot desktop 1440 × 1000 dan mobile 390 × 844 disimpan. Lima bagian desktop, ringkasan mobile, serta bagian 01 dan 05 mobile ditinjau secara visual. Semua bagian mobile juga tercakup screenshot halaman penuh; tidak diklaim seluruh piksel screenshot panjang diperiksa pada skala 1×.
- **Layout:** tidak ada overflow horizontal pada 1440, 390, dan 320 CSS px. Pemeriksaan 320 px bersifat pengukuran DOM, bukan inspeksi visual penuh.
- **Ukuran:** seluruh contoh simbol benar-benar berukuran 16, 32, 64, dan 256 CSS px. Lockup header tinggi 40 px; lebar sekitar 129–135 px. Ukuran kecil tidak menggunakan seluruh wordmark sebagai favicon.
- **Clipping:** getBBox untuk 50 SVG berada di dalam viewBox. Inspeksi gambar tidak menemukan huruf, simbol, atau app icon terpotong.
- **Font dan gambar:** font lokal berhasil dimuat, 56 gambar halaman dimuat tanpa kegagalan; tidak ada pageerror.
- **Alignment dan siluet:** wordmark tidak saling bertabrakan; rongga huruf dan celah antarkeping tetap terbuka. Bidang kiri Keping Jadi lebih berat secara sengaja; bukan bentuk simetris. Siluet tidak diklaim memiliki luas tinta identik.
- **Kontras:** primary pada putih dihitung dengan luminansi sRGB; angka terperinci ada di `qa/structure-results.json`. Logo versi gelap memakai putih pada #202020, sedangkan uji mono memakai hitam/putih murni. Accent tidak direkomendasikan untuk teks kecil di atas putih.
- **Perbaikan presentasi:** skip link aksesibilitas sebelumnya muncul dalam tangkapan elemen panjang; CSS diubah menjadi pola clipping saat tidak fokus, kemudian screenshot diregenerasi. Ini perbaikan presentasi, bukan perubahan identitas aplikasi.

Artefak pemeriksaan: [hasil struktur](qa/structure-results.json), [hasil render](qa/render-results.json), [desktop](qa/desktop-overview.png), [mobile](qa/mobile-overview.png), [mobile penuh](qa/mobile-full.png). Screenshot per konsep tersedia di folder qa.

## Batas penilaian

Belum ada riset pengenalan dengan pengguna, uji cetak, uji browser Safari/Firefox, pemeriksaan basis data merek, atau paket ikon platform. Favicon diuji sebagai SVG pada ukuran aktual di halaman, belum dipasang sebagai favicon produksi. Rasterisasi dapat berbeda menurut browser, zoom, dan kepadatan layar. Bukti repo lokal digunakan untuk relevansi produk; tidak ada klaim hasil riset pasar.

Tidak ada satu kemiripan merek tertentu yang dapat dipastikan dari inspeksi ini. Wilayah bentuk J, siku berpasangan, berlian modular, buku terbuka, dan a satu tingkat memiliki banyak preseden. Penilaian visual ini bukan pemeriksaan merek dagang atau jaminan keunikan.
