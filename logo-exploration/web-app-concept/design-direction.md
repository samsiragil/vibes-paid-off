# Arah web app Jadinya — usulan untuk dipilih

Status: logo **Jejak Jadi** telah dipilih pengguna. Konsep UI dan palet di dokumen ini masih usulan, bukan keputusan final pengguna. Tidak ada perubahan source aplikasi, logo produksi, konfigurasi, atau dependency.

## Rekomendasi

**Galeri karya + bata dan kapur netral.** Prinsipnya: karya tampil lebih dulu, proses mudah dibuka. Tampilan pertama menjawab “ada karya apa?”; halaman proyek menjawab “bagaimana cara membuatnya?”. Maker Indonesia lintas pengalaman tetap menjadi pusat, dengan bahasa ramah yang tidak merendahkan pemula.

Jadinya diperlakukan sebagai katalog yang hidup, bukan halaman promosi software AI. Hero ringkas, tanpa layar penuh; proyek unggulan dan awal daftar karya terlihat cepat. Screenshots karya memegang porsi visual utama. Tidak diperlukan maskot, gradient, kilau, dekorasi sirkuit, atau metafora chat di setiap komponen.

## Dua arah yang ditampilkan

### Galeri karya — rekomendasi

Satu proyek unggulan dalam komposisi preview + konteks singkat. Karya terbaru memakai grid dua kolom yang menjadi satu kolom di mobile. Prompt dan sesi menjadi pintu masuk ke detail, bukan memenuhi setiap kartu. Ini membantu pengunjung memindai karya dan membandingkan tools dengan cepat.

Risiko: dapat terasa seperti direktori generik jika thumbnail, nama maker, dan bukti proses tidak dipertahankan. Penangkalnya adalah metadata sesi yang konsisten dan CTA “Lihat karya & proses”, bukan menambah dekorasi.

### Jurnal maker — alternatif

Daftar editorial berurutan: maker, hasil, kutipan prompt, lalu tautan ke sesi. Thumbnail lebih kecil dan ditempatkan sebagai bukti hasil. Cocok bila tujuan utama ingin lebih kuat pada berbagi pengalaman serta diskusi.

Risiko: lebih lambat dipindai sebagai katalog. Pengunjung melihat lebih sedikit hasil proyek pada layar pertama; kutipan yang panjang menuntut disiplin batas teks. Rekomendasi saya mengambil kekuatan arah ini untuk **detail proyek**, bukan seluruh beranda.

## Palet utama yang diusulkan

| Token | Terang | Gelap | Peran |
|---|---|---|---|
| brand | #A44732 | #E8A58E | Logo, aksi utama, tautan penting, keadaan terpilih |
| brand-hover | #873824 | #F1BCA9 | Hover pada aksi utama |
| brand-soft | #F5E8E3 | #3B2C26 | Latar kategori terpilih, nomor sesi |
| on-brand | #FFFFFF | #2D1D17 | Teks di atas tombol brand |
| background | #F7F7F5 | #1C1D1B | Kanvas aplikasi; netral, tidak kekuningan |
| surface | #FFFFFF | #252623 | Form, panel, bidang preview |
| foreground | #252523 | #F3F2EE | Teks utama |
| muted-foreground | #62635C | #B5B7AD | Metadata dan teks sekunder |
| border | #DDDED7 | #41433D | Pembatas struktur yang tidak menentukan kontrol |
| input-border | #8B8E82 | #777C6E | Batas kontrol yang perlu ditemukan |

Warna bata berasal dari opsi logo yang dipilih. Peach #E5B786 dari eksplorasi logo tidak dijadikan aksen UI kedua: kebutuhan hierarki sudah dipenuhi bata, tint-nya, dan netral. Ini mencegah tampilan bergeser menjadi tema kafe/kerajinan atau palet dekoratif yang terlalu hangat.

Target proporsi secara visual: sekitar 85–90% permukaan netral, sisanya warna brand dan konten karya. Angka ini pedoman desain, bukan hasil pengukuran piksel. Thumbnail proyek boleh memiliki warnanya sendiri; warna itu bukan token identitas Jadinya.

Bata tidak menandai semua status. Pada implementasi, keberhasilan, peringatan, dan kesalahan perlu warna semantik terpisah dengan teks/ikon. Usulan awal: success #356648, warning #805C12, danger #B42318; padanan gelap #A1CEAC, #E6C37B, #FFB4A9. Semua pasangan latar aktual perlu diperiksa saat komponen status dibuat. Jangan memakai bata brand sendirian untuk menyatakan error.

Pratinjau menyediakan alternatif **Pinus** (#365D4A, lebih tenang) dan **Tinta** (#345C82, lebih teknis) melalui kontrol desain. Keduanya membandingkan perubahan nuansa, bukan mengganti rekomendasi utama. Logo yang dipakai tetap Jejak Jadi.

## Tipografi dan bentuk

- **Source Sans 3** untuk judul dan UI, konsisten dengan wordmark. Regular 400 untuk isi; Semibold 600 untuk judul, label penting, dan aksi. Pratinjau menyertakan kedua font, bukan mengandalkan font perangkat. Font asli berlisensi SIL OFL 1.1; lisensi di `OFL.txt`.
- Judul beranda 42 px desktop, 34 px mobile; isi 16 px; metadata 12–14 px. Teks editorial sekitar 60–65 karakter per baris. Tidak memakai serif italic sebagai hiasan.
- Kontrol 6 px radius, bidang karya 10 px, avatar maker 7 px. Sudut tegas terasa dekat dengan keping logo; lengkung ringan membuat bidang konten tetap ramah. Pill hanya jika fungsi memerlukannya, bukan bentuk default semua komponen.
- Ikon utilitas satu keluarga saat implementasi; stroke konsisten. Logo hanya pada identitas, bukan digandakan sebagai ornamen atau ikon semua fitur.
- Spasi berbasis 4/8 px, jarak grup 24/32 px, container sekitar 1100–1200 px. Kepadatan sedang: cukup nyaman membaca, cukup banyak karya untuk dijelajah.
- Motion 140–180 ms untuk perubahan warna/keadaan; tidak ada parallax, animasi loop, atau penahanan scroll. Hormati reduced motion.

## Pembagian halaman dan perilaku

| Area | Peran dan arah |
|---|---|
| Beranda | Pengantar singkat, pilihan mingguan otomatis, karya baru, tautan jelajah. Judul “Pilihan minggu ini” tetap mengikuti data, bukan kurasi manual baru. |
| Jelajah | Pencarian dominan, filter kategori/tools, urutan hasil. Grid thumbnail yang konsisten. Filter lengkap dapat tetap di sidebar desktop / panel mobile saat implementasi. |
| Detail proyek | Hasil visual, maker, live link, tools, waktu; proses sebagai timeline terstruktur prompt → hasil → kendala/solusi. Apresiasi tidak mengalahkan aksi mencoba karya. |
| Pengiriman | Nama dan hasil dulu, lalu cerita sesi. Label manusiawi, validasi inline, contoh seperlunya; tidak menyamarkan form sebagai chat AI. |
| Profil maker | Identitas ringkas dan karya yang bisa diperiksa; angka sosial bukan hero. |
| Tools | Penemuan karya yang dibuat memakai alat tertentu; identitas tools tidak mendominasi brand Jadinya. |
| Dashboard pribadi | Status review, alasan revisi, tindakan per proyek jelas. Gunakan daftar terstruktur; jangan memaksa grid galeri untuk semua pekerjaan. |
| Moderasi/admin | Prioritaskan keterbacaan dan audit, bukan layout editorial; tetap memakai token dan komponen dasar yang sama. |
| Loading/kosong/error | Skeleton sesuai bentuk hasil; kosong memberi tindakan relevan; error menjaga input dan menawarkan pemulihan. Tidak cukup hanya memberi toast. |

## Pembacaan implementasi saat ini

Rujukan: `app/[locale]/page.tsx`, `app/[locale]/explore/page.tsx`, `package.json`, Product Essence, dan konsep Jejak Jadi. Peninjauan ini struktural, **bukan audit visual aplikasi yang sedang berjalan**.

- Beranda saat ini memakai split hero yang besar, heading italic, kartu obrolan, dan CTA berbentuk input percakapan. Arah baru memberi hasil karya lebih banyak ruang dan mengurangi ketergantungan visual pada bubble. Makna prompt–hasil tetap dipertahankan pada informasi.
- Pencarian/filter, fallback pilihan mingguan, profil maker, dokumentasi sesi, dan dukungan ID/EN merupakan fungsi yang perlu dipertahankan. Tidak ada usulan mengubah rumus peringkat atau model data.
- Stack lokal Next.js 16.4, React, Tailwind 4 dan next-intl tetap menjadi dasar jika desain diimplementasikan. Tidak ada alasan mengganti framework atau memasang library desain untuk tahap konsep.

## Batas pratinjau

Semua nama proyek/maker, isi prompt, vote, dan sesi adalah **data contoh**. Interaksi lokal mencakup navigasi, pencarian, filter, apresiasi, tab proses/pelajaran, pilihan mode warna, serta validasi draft contoh. Tidak ada login, penyimpanan server, publish, atau klaim bahwa proyek contoh benar-benar live. Dua sesi di detail hanya cuplikan untuk menilai susunan, bukan seluruh riwayat proyek contoh.

Struktur desktop dan mobile, warna terang/gelap, serta interaksi utama diperiksa melalui renderer. Laporan tersedia di `qa/check-results.json`. Ini belum merupakan audit aksesibilitas penuh atau pengujian aplikasi produksi.

Hasil pemeriksaan: 9 interaksi lulus (apresiasi, detail, tab pelajaran, pencarian, hasil kosong, reset, filter, draft contoh, dan pergantian arah). Tidak ada error JavaScript. Tidak ada overflow pada lebar konten 1068, 358, dan 288 px dalam pembungkus preview; font Regular dan Semibold berhasil dimuat. Screenshot terang/gelap desktop, mobile, dan detail diperiksa. Kontras bata/putih 5,96:1; pasangan tombol gelap 7,85:1; teks sekunder terang 6,07:1. Batas input terang 3,34:1 dan gelap 3,54:1. Pemeriksaan ini terbatas pada pasangan yang tercantum, bukan klaim kelulusan aksesibilitas seluruh aplikasi.

Sumber pratinjau inline: `jadinya-design.html` (fragmen untuk percakapan, bukan halaman aplikasi). `qa/preview.html` adalah pembungkus renderer untuk pemeriksaan. Semua font dan logo termuat di fragmen, tanpa permintaan jaringan; ukuran fragmen di bawah 1 MB. File OTF tambahan di folder ini adalah Source Sans 3 Regular dari rilis resmi Adobe; lisensi yang sama ada di `OFL.txt`.

## Keputusan berikutnya

Pilih arah susunan **Galeri karya** atau **Jurnal maker**, lalu pastikan palet **Bata** sesuai. Setelah arahnya dipilih, tahap berikutnya adalah spesifikasi halaman dan komponen lengkap, kemudian implementasi source aplikasi sesuai lingkup yang diminta pengguna.
