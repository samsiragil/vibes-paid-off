import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Label } from "@/components/ui/badge";
import { PromptBubble, ResultBubble, SystemMessage, TimeGap } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { CopyLinkField } from "@/components/ui/copy-link";
import { LinkStatusBadge } from "@/components/project/link-status-badge";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { pillStyles } from "@/components/ui/pill";
import { MediaUploader } from "@/components/project/media-uploader";
import { ProjectForm } from "@/components/project/project-form";
import type { CatalogTool } from "@/lib/projects/types";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SegmentedDemo } from "./segmented-demo";

// Internal component gallery (not translated on purpose). Hidden on Vercel production.
export const metadata = { title: "UI kit", robots: { index: false } };

const colorTokens = [
  "bg",
  "surface",
  "ink",
  "ink-2",
  "muted",
  "border",
  "border-strong",
  "accent",
  "accent-text",
  "accent-soft",
  "accent-ink",
  "rule",
  "margin",
  "highlight",
  "highlight-ink",
  "placeholder",
  "dashed",
  "success",
  "warning",
  "danger",
];

// A slice of the seed catalog, so the form renders without a database.
const sampleTools: CatalogTool[] = (
  [
    ["claude-code", "Claude Code", "ai_agent"],
    ["cursor", "Cursor", "ai_agent"],
    ["lovable", "Lovable", "ai_builder"],
    ["bolt", "Bolt", "ai_builder"],
    ["v0", "v0", "ai_builder"],
    ["replit", "Replit", "ai_builder"],
    ["chatgpt", "ChatGPT", "ai_assistant"],
    ["supabase", "Supabase", "backend"],
    ["windsurf", "Windsurf", "ai_agent"],
    ["claude", "Claude", "ai_assistant"],
    ["nextjs", "Next.js", "framework"],
    ["tailwind-css", "Tailwind CSS", "framework"],
    ["vercel", "Vercel", "hosting"],
    ["stripe", "Stripe", "service"],
  ] as const
).map(([slug, name, kind], index) => ({ id: index + 1, slug, name, kind, projectCount: 0 }));

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border py-8">
      <Label>{title}</Label>
      {children}
    </section>
  );
}

export default function UiKitPage() {
  // Local development only: hidden on every Vercel deployment, previews included.
  if (process.env.VERCEL_ENV) notFound();

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pt-10 sm:px-6">
      <h1 className="pb-6 font-display text-5xl font-normal tracking-[-1px]">
        UI <span className="italic">kit</span>
      </h1>

      <Section title="Warna (ganti tema di header untuk cek mode gelap)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {colorTokens.map((token) => (
            <div key={token} className="flex flex-col gap-1.5">
              <div
                className="h-14 rounded-xl border border-border"
                style={{ background: `var(--${token})` }}
              />
              <span className="font-mono text-xs text-muted">{token}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografi">
        {/* Type scale from docs/design-system/README.md §4 (mobile / desktop). */}
        <p className="text-[32px] leading-9 font-bold sm:text-[44px] sm:leading-12">
          Display: Kamu bilang apa, AI bikin apa.
        </p>
        <p className="text-[30px] leading-9 font-bold sm:text-[40px] sm:leading-11">
          H1: Kasir Warung Bu Tini
        </p>
        <p className="text-[22px] leading-7 font-semibold sm:text-[26px] sm:leading-8">
          H2: Obrolan terpopuler minggu ini
        </p>
        <p className="text-lg leading-6 font-semibold">H3: Jadwal Ronda</p>
        <p className="max-w-[68ch] text-[17px] leading-8 sm:text-lg">
          Catatan: Bikin kasir buat warung kelontong, tombolnya gede, bisa dipakai ibu-ibu tanpa
          tutorial.
        </p>
        <p className="max-w-[68ch] text-base leading-6 text-ink-2 sm:text-[17px] sm:leading-7">
          Isi: Setiap proyek di sini dimulai dari satu pesan. Source Sans 3, berat 400.
        </p>
        <p className="text-sm leading-5 text-muted tabular-nums">
          Kecil: Claude Code · Supabase · 12 balasan
        </p>
        <p className="text-[13px] leading-4 font-semibold text-muted">Label: Prompt kunci</p>
        <p className="font-hand text-xl leading-8 sm:text-[22px]">Tangan: satu weekend kemudian</p>
      </Section>

      <Section title="Tombol">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">Pamerin proyekmu</Button>
          <Button>Pamerin proyekmu</Button>
          <Button variant="outline">Jelajahi proyek</Button>
          <Button variant="outline-accent">Traktir Ragil kopi</Button>
          <Button variant="ghost">Masuk</Button>
          <Button size="sm" variant="outline">
            Worth it · 128
          </Button>
          <Button disabled>Nonaktif</Button>
          <Button variant="outline" disabled>
            Nonaktif
          </Button>
        </div>
        <div className="max-w-md">
          <CopyLinkField
            url="https://jadinya.id/u/ragil"
            display="jadinya.id/u/ragil"
            label="Bagikan profil ini"
          />
        </div>
      </Section>

      <Section title="Chip, urutan, badge">
        <SegmentedDemo />
        <div className="flex flex-wrap gap-2">
          <span className={pillStyles({ tone: "accent" })}>Claude Code</span>
          <span className={pillStyles({ tone: "accent" })}>Cursor</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Maker terpercaya</Badge>
          <Badge variant="highlight">Pilihan minggu ini</Badge>
          <LinkStatusBadge status="live" />
          <LinkStatusBadge status="offline" />
          <LinkStatusBadge status="archived" />
          <Badge variant="lang">ID</Badge>
          <Badge variant="lang">EN</Badge>
          <Badge variant="outline">UMKM</Badge>
        </div>
        <p className="max-w-[68ch] text-base leading-6">
          Stabilo menandai kata yang cocok: kasir buat <span className="stabilo">warung</span>{" "}
          kelontong.
        </p>
      </Section>

      <Section title="Avatar">
        <div className="flex items-center gap-3">
          <Avatar name="Ragil Samsi" size="xs" />
          <Avatar name="Dimas Pratama" size="sm" />
          <Avatar name="Nina Kurnia" />
          <Avatar name="Ragil Samsi" size="lg" />
        </div>
      </Section>

      <Section title="Obrolan">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <PromptBubble size="lg" label="Prompt kunci">
              Bikin kasir buat warung kelontong, tombolnya gede, bisa dipakai ibu-ibu tanpa
              tutorial.
            </PromptBubble>
            <TimeGap note="ada cerita build" className="pl-6 sm:pl-[72px]">
              satu weekend kemudian
            </TimeGap>
            <ResultBubble size="lg" taped className="sm:ml-[72px]">
              <div className="h-48 rounded-sm bg-placeholder" />
              <div>
                <div className="text-lg leading-6 font-semibold">Kasir Warung Bu Tini</div>
                <div className="text-base leading-6 text-ink-2">
                  Kasir sederhana untuk warung, tombol besar.
                </div>
              </div>
            </ResultBubble>
          </div>
          <div className="flex flex-col gap-3 rounded border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Avatar name="Nina Kurnia" size="xs" />
              Nina Kurnia
              <span className="ml-auto">Komunitas</span>
            </div>
            <PromptBubble>Pengingat jadwal ronda RT, kirim lewat WhatsApp tiap sore.</PromptBubble>
            <TimeGap>3 jam kemudian</TimeGap>
            <ResultBubble>
              <div className="h-32 rounded-sm bg-placeholder" />
              <div className="text-lg leading-6 font-semibold">Jadwal Ronda</div>
            </ResultBubble>
          </div>
        </div>
        <SystemMessage className="max-w-xl">
          Belum ada yang pakai kombinasi ini. Jadilah yang pertama?
        </SystemMessage>
        <SystemMessage tone="soft" className="max-w-xl">
          Proyekmu sudah masuk! Kami review paling lama 2×24 jam.
        </SystemMessage>
      </Section>

      <Section title="Form">
        <div className="grid max-w-3xl gap-5 md:grid-cols-2">
          <Field id="demo-title" label="Judul">
            <Input id="demo-title" placeholder="Kasir Warung Bu Tini" />
          </Field>
          <Field id="demo-tagline" label="Tagline" counter="58/80" hint="Maksimal 80 karakter.">
            <Input id="demo-tagline" aria-describedby="demo-tagline-hint" maxLength={80} />
          </Field>
          <Field id="demo-cat" label="Kategori">
            <Select id="demo-cat" defaultValue="umkm">
              <option value="umkm">UMKM</option>
              <option value="edukasi">Edukasi</option>
            </Select>
          </Field>
          <Field id="demo-url" label="Link live" error="Link harus diawali https://">
            <Input
              id="demo-url"
              aria-invalid
              aria-describedby="demo-url-error"
              defaultValue="http://kasir.app"
            />
          </Field>
          <Field id="demo-prompt" label="Prompt kunci" className="md:col-span-2">
            <Textarea id="demo-prompt" />
          </Field>
        </div>
      </Section>

      <Section title="Media uploader (tanpa projectId: gambar ditahan di browser sampai submit)">
        <div className="max-w-xl">
          <MediaUploader />
        </div>
      </Section>

      <Section title="Form proyek (katalog contoh, tanpa draf; kirim butuh login)">
        <ProjectForm
          mode={{ kind: "create", isTrusted: false }}
          maker={{ name: "Ragil Samsi", avatarUrl: null }}
          tools={sampleTools}
          quickPickIds={sampleTools.slice(0, 8).map((tool) => tool.id)}
          categories={["umkm", "education", "community", "game", "dev-tools", "other"]}
          persistDraft={false}
        />
      </Section>

      <Section title="Header saat login">
        <div className="overflow-hidden rounded-2xl border border-border">
          <SiteHeader user={{ name: "Ragil Samsi" }} />
        </div>
      </Section>

      <Section title="Footer ringkas">
        <div className="overflow-hidden rounded-2xl border border-border [&>footer]:mt-0">
          <SiteFooter />
        </div>
      </Section>
    </main>
  );
}
