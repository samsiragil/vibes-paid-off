# Audit keamanan run-1: perbaikan, deploy, dan sisa risiko

Audit `quick` (2026-10-24, commit `0a5ab5b`) menghasilkan 5 lead `needs_validation` dan ±17 catatan hardening. Semua perbaikan ada di branch `fix/security-audit` (dibuat dari `chore/rename-jadinya`), satu commit per tahap. Belum ada yang di-push atau di-deploy.

## Status per temuan

| # | Temuan | Status | Commit |
|---|---|---|---|
| 1 | Open redirect `next=/%09/host` lolos `safeNextPath` | Ditutup: tolak karakter kontrol/backslash, resolve dengan `URL`, wajib origin sama. Unit test. | `a68de65` |
| 2 | Tiga akun baru bisa menyembunyikan proyek/balasan | Ditutup: auto-hide hanya dari laporan terbuka akun lama (punya username, > 72 jam); kuota 10 laporan/24 jam. | `d6f41ba` |
| 3 | Turnstile dilewati lewat PostgREST | Balasan ditutup (`post_reply_as`, hanya `service_role`). Proyek baru **belum** (sisa risiko, lihat bawah). Opsi B di dashboard: tugas owner. | `0a2b925` |
| 4 | Kuota 3 proyek / 30 balasan dilampaui lewat insert paralel | Ditutup: lock baris profil (`for no key update`) sebelum hitung. Race dua sesi tidak bisa dites dengan runner satu transaksi. | `d6f41ba` |
| 5 | `/api/media/finalize` bisa memicu banyak decode sharp | Ditutup: tolak sisi > 2048 px sebelum decode, decode/resize sekali, encode lebih sedikit; rate limit 30 presign / 20 finalize per jam. | `53aee1b` |

Hardening yang ikut dikerjakan:

- `signInWithProvider` fallback ke `siteUrl`, bukan `localhost`; cookie Supabase `secure` eksplisit; `verifyTurnstile` mengambil IP dari header Vercel dan mengecek `hostname`/`action` (`a68de65`).
- `reviewed_by`, `report_count`, `link_fail_count` tidak terbaca lewat Data API; kuota balasan tidak reset saat balasan dihapus; `profiles.links` hanya `https://` (`d6f41ba`).
- `/api/media/*` menolak Origin asing atau kosong (`53aee1b`).
- Action GitHub di-pin ke SHA, Supabase CLI ke `2.109.0`, `ci.yml` punya `permissions`; password DB backup lewat `PGPASSWORD`, bukan argumen; link checker tidak mengikuti redirect ke alamat privat dan meng-escape summary; `/dev/*` tertutup di preview (`c1d302f`).
- `scripts/db-test.mjs` membaca output Supabase CLI versi baru (`d6f41ba`).

Hasil validasi akhir: lint, typecheck, format, `messages:check` bersih (di luar `logo-exploration/` yang untracked); unit test 8/8; pgTAP 290/290 di project dev dengan keempat migrasi baru dipasang dalam transaksi yang dibatalkan (DB dev dicek bersih sesudahnya). `next build` berhasil compile dan prerender, lalu dihentikan oleh pemeriksaan keamanan Next.js karena `next@16.4.0` (lihat langkah 0).

## Checklist deploy

Urutan penting: migrasi tahap 3 dan 4 mengubah izin yang dipakai kode lama, jadi migrasi dan kode harus naik bersamaan.

0. **Upgrade `next` ke `>=16.4.1`.** `16.4.0` terkena GHSA-2464-fhr4-w9xw dan GHSA-673q-mjm6-r5xr (RCE tanpa login, critical) dan GHSA-p3m5-59mp-jv5r (DoS, high). `next build` menolak jalan di versi ini, jadi deploy juga butuh upgrade.
1. Gabungkan `chore/rename-jadinya` lalu `fix/security-audit` ke `main` lewat PR; tunggu CI hijau (CI sekarang juga menjalankan `pnpm test`).
2. **Dev:** `pnpm db:push` (linked = `vibes-paid-off-dev`), lalu `pnpm db:types` dan pastikan diff tipe hanya menambah `post_reply_as`, `consume_media_quota`, `links_are_https`, dan tabel log.
3. **Preview Vercel** (memakai DB dev) dengan key Turnstile asli, login akun sungguhan:
   - kirim balasan (Turnstile lolos, balasan tampil); hapus balasan sendiri;
   - submit proyek baru (Turnstile lolos, masuk antrean);
   - upload gambar proyek (presign, finalize, gambar tampil);
   - laporkan proyek orang lain (pesan sukses);
   - `/en/login?next=/%09/example.com` saat sudah login berakhir di `/en`, bukan example.com.
4. **Prod:** `supabase link --project-ref pkdfhjjnxestctcsuhnp`, `pnpm db:push`, lalu segera promote/deploy app ke produksi. Link CLI kembali ke dev sesudahnya.
5. Ulangi pengecekan langkah 3 singkat di `jadinya.vercel.app`.
6. GitHub Actions: jalankan **Backup** dan **Link check** (dry run) sekali lewat `workflow_dispatch` untuk memastikan cara baru (password lewat `PGPASSWORD`, redirect manual) jalan.

## Checklist dashboard (owner)

Supabase (prod, lalu dev bila ingin sama):

- [ ] Authentication > Providers > Email: matikan **Allow new users to sign up** (app hanya memakai GitHub/Google). Opsi B tahap 3.
- [ ] Authentication > URL Configuration: Site URL `https://jadinya.vercel.app`; Redirect URLs hanya `https://jadinya.vercel.app/auth/callback` (plus pola preview bila dipakai), tanpa wildcard domain lain.
- [ ] Authentication > Attack Protection: CAPTCHA hanya perlu bila signup email tetap aktif.

Vercel:

- [ ] `SUPABASE_SECRET_KEY` ada di Production **dan** Preview (balasan dan media sekarang memakainya).
- [ ] `TURNSTILE_SECRET_KEY` dan `NEXT_PUBLIC_TURNSTILE_SITE_KEY` asli di Production; di Preview pakai key asli atau test key (test key melewati cek hostname/action).
- [ ] Opsional: Firewall rate limit untuk `/api/media/*` dan Spend Management, sebagai lapisan kedua di atas rate limit DB.

Cloudflare Turnstile:

- [ ] Hostname widget memuat `jadinya.vercel.app` (dan domain preview bila key asli dipakai di sana). `verifyTurnstile` sekarang menolak token yang hostname-nya beda dari host request.

## Sisa risiko yang diterima

- **Proyek baru masih bisa dibuat lewat API tanpa Turnstile** (`insert` pada `projects` dan `upsert_project`). Dibatasi 3 per akun per 24 jam dan masuk antrean review, kecuali maker terpercaya. Menutupnya butuh memisahkan jalur buat dan edit di `upsert_project`.
- Insert langsung ke `project_tools`/`tool_suggestions` masih melewati aturan `upsert_project` (hanya proyek sendiri).
- Link checker: DNS rebinding antara cek alamat dan request masih mungkin; runner tidak membawa secret ke URL yang dicek.
- Belum dikerjakan dari daftar hardening: CSP `script-src`; objek `tmp/` (masih ber-EXIF) dan gambar proyek yang dihapus/tersembunyi tetap di bucket R2 publik; `handle_new_user` menyalin `avatar_url` dari metadata signup (aman bila signup email dimatikan).
- Unit yang ditunda audit: *account linking / pre-hijacking* (akun email belum terkonfirmasi atas alamat korban, lalu di-link dengan OAuth). Risikonya hilang bila signup email dimatikan; tetap layak ditinjau di run audit berikutnya.
