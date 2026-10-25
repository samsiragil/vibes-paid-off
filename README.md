# Jadinya

Katalog dan portfolio proyek vibe coding Indonesia (ID + EN). Rencana lengkap: [docs/implementation-plan.md](docs/implementation-plan.md).

## Menjalankan

Butuh Node 22 (lihat `.nvmrc`) dan pnpm.

```bash
nvm use 22
pnpm install
cp .env.example .env.local
pnpm dev
```

Buka http://localhost:3000 (diarahkan ke `/id` atau `/en` sesuai bahasa browser). Galeri komponen ada di `/id/dev/ui` (disembunyikan di Vercel production).

## Skrip

| Skrip            | Fungsi                             |
| ---------------- | ---------------------------------- |
| `pnpm dev`       | Dev server                         |
| `pnpm build`     | Build produksi                     |
| `pnpm lint`      | ESLint                             |
| `pnpm typecheck` | Generate tipe rute lalu `tsc`      |
| `pnpm format`    | Prettier (+ urutan kelas Tailwind) |

## Struktur

- `app/[locale]/` semua halaman, root layout ada di sini (locale = root param).
- `i18n/` konfigurasi next-intl, `proxy.ts` mengarahkan URL tanpa prefix bahasa.
- `messages/id.json`, `messages/en.json` semua teks UI. Jangan menulis teks langsung di komponen.
- `components/ui/` komponen dasar, `components/layout/` header dan footer.
- `app/globals.css` design token (light dan dark), dipetakan ke kelas Tailwind seperti `bg-bg`, `text-ink`, `text-accent-text`.
- `docs/design-system/` design system "Buku Tulis" dan catatan untuk redesign berikutnya. Baca sebelum mengubah tampilan.
