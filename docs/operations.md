# Operasional: job terjadwal & backup

Tiga workflow GitHub Actions (Fase 9). Semuanya bisa dijalankan manual dari tab **Actions → pilih workflow → Run workflow** (`workflow_dispatch`), selain jalan sesuai jadwal.

| Workflow | Jadwal | Fungsi |
|---|---|---|
| `link-check.yml` | Senin 09:00 WIB | Cek `live_url` semua proyek tayang yang tidak diarsipkan, perbarui status link |
| `keep-alive.yml` | Setiap hari 07:30 WIB | Satu baca ringan lewat REST API supaya Supabase Free tidak di-pause |
| `backup.yml` | Senin 02:00 WIB | Dump database ke bucket R2 privat, simpan 8 versi terbaru |

Job harian `refresh-eligible-upvotes` (vote layak §2.7) dan `compute-weekly-pick` berjalan di pg_cron Supabase, bukan di GitHub Actions.

Catatan: GitHub menonaktifkan workflow terjadwal di repo publik setelah 60 hari tanpa aktivitas di repo (ada email pemberitahuan). Bila itu terjadi, aktifkan lagi dari tab Actions.

## Konfigurasi di GitHub

**Settings → Secrets and variables → Actions.**

Variables (sudah dipakai CI):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: keep-alive dan link checker.
- `R2_BACKUP_BUCKET`: nama bucket backup.

Secrets:
- `SUPABASE_SECRET_KEY`: link checker (menulis hasil lewat RPC `record_link_checks`, hanya bisa dipanggil `service_role`).
- `SUPABASE_DB_URL`: backup. Pakai connection string **Session pooler** (Supabase → Connect → Session pooler, port 5432), karena host langsung `db.<ref>.supabase.co` hanya IPv6 dan runner GitHub tidak punya IPv6. Password harus di-percent-encode.
- `R2_ACCOUNT_ID`, `R2_BACKUP_ACCESS_KEY_ID`, `R2_BACKUP_SECRET_ACCESS_KEY`: token R2 dengan izin **Object Read & Write** khusus bucket backup.

Bucket backup dibuat terpisah di Cloudflare R2 (misalnya `vpo-backups`), **tanpa** domain publik dan tanpa akses `r2.dev`. Jangan memakai bucket media: isinya disajikan publik, sedangkan dump berisi email akun.

## Link checker

Aturan (Q8), dijalankan di DB oleh `record_link_checks()`:
- Link gagal bila HTTP ≥ 400, error jaringan/TLS, atau tidak menjawab dalam 10 detik. Skrip mencoba `HEAD` dulu, lalu `GET` bila `HEAD` tidak berhasil.
- 429, atau 403 dari tantangan bot Cloudflare/Vercel (`cf-mitigated` / `x-vercel-mitigated`), dianggap hidup: situsnya menjawab, hanya menolak IP datacenter.
- Satu kali berhasil: `live`, `link_fail_count` = 0. Gagal kedua kali berturut-turut: `offline`.
- `archived` (pilihan maker) dan proyek yang tidak tayang tidak disentuh.
- Maker mengganti `live_url`: status kembali `live` dan hitungan direset sampai cek berikutnya.

Lokal (butuh `SUPABASE_SECRET_KEY` di `.env.local`):

```bash
pnpm links:check --dry-run
```

`pnpm links:check slug-a slug-b` hanya mengecek proyek tertentu. Hasil run di GitHub ada di ringkasan job (proyek yang gagal dan yang berubah status). Halaman publik memakai cache beberapa menit, jadi perubahan status tampil paling lambat sesuai umur cache.

## Backup

Isi setiap backup (`vpo-db-<waktu UTC>.tar.gz`), mengikuti cara Supabase CLI:
- `roles.sql`: role buatan sendiri (`supabase db dump --role-only`).
- `schema.sql`: skema semua schema non-internal.
- `data.sql`: data (`--data-only --use-copy`), termasuk `auth.users` dan job pg_cron, tanpa `cron.job_run_details`.

Workflow gagal bila dump kosong atau tidak memuat tabel `projects`, jadi backup rusak tidak menggeser backup yang baik. Setelah upload, skrip menghapus backup lama sehingga tersisa 8 (`BACKUP_KEEP`).

Melihat dan mengunduh dari lokal (isi `R2_BACKUP_*` di `.env.local`):

```bash
pnpm backup:r2 list
```

```bash
pnpm backup:r2 download
```

Tanpa argumen, `download` mengambil yang terbaru ke `./backups/` (sudah di-ignore git). Bisa juga `pnpm backup:r2 download db/vpo-db-2026-10-26T190012Z.tar.gz`.

### Restore

Target restore harus database Supabase yang **belum** berisi skema aplikasi: project Supabase baru, atau stack lokal dari folder kosong (bukan folder repo ini, karena `supabase start` di sini langsung menjalankan semua migrasi).

1. Ekstrak: `tar -xzf vpo-db-<waktu>.tar.gz`.
2. Stack lokal kosong (butuh Docker):
   ```bash
   mkdir vpo-restore && cd vpo-restore && supabase init && supabase start
   ```
3. Restore (urutan penting; trigger dimatikan saat memuat data):
   ```bash
   psql --single-transaction --variable ON_ERROR_STOP=1 --file roles.sql --file schema.sql --command "SET session_replication_role = replica" --file data.sql --dbname "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
   ```
   Tanpa `psql` di mesin, pakai `psql` di container database (nama container = `supabase_db_<project_id>`, di sini nama folder):
   ```bash
   { cat roles.sql schema.sql; echo "SET session_replication_role = replica;"; cat data.sql; } | docker exec -i supabase_db_vpo-restore psql -U postgres --single-transaction --variable ON_ERROR_STOP=1
   ```
4. Cek: `select count(*) from public.projects;` dan buka Studio lokal di `http://127.0.0.1:54323`.

Untuk project Supabase baru, ganti `--dbname` dengan connection string Session pooler project itu.
