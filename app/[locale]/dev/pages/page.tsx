import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProjectDetailView } from "@/components/project/project-detail";
import { SystemMessage } from "@/components/ui/bubble";
import { pillStyles } from "@/components/ui/pill";
import type { MyProject } from "@/lib/profiles/me";
import type { ProjectDetail } from "@/lib/projects/detail";
import { MeTabs } from "../../me/me-tabs";
import { MyProjects, OfflineNotice } from "../../me/my-projects";
import { ProfileForm } from "../../me/profile-form";

export const metadata = { title: "Page states", robots: { index: false } };

// Non-production preview of page states that need special data or a session: an offline or
// archived project, the owner's view of a pending one, and the /me dashboard.

const views = ["offline", "archived", "pending", "me", "me-empty"] as const;
type View = (typeof views)[number];

const baseProject: ProjectDetail = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "kasir-warung-bu-tini",
  title: "Kasir Warung Bu Tini",
  tagline: "Catat jualan harian dari HP, langsung keluar rekap mingguan.",
  description: "",
  keyPrompt:
    "Bikin kasir buat warung kelontong, tombolnya gede, bisa dipakai ibu-ibu tanpa tutorial.",
  lessons:
    "Tulis prompt dari sudut pandang pemakainya, bukan dari daftar fiturnya. “Ibu-ibu tanpa tutorial” menghasilkan desain yang lebih baik daripada spesifikasi sepanjang apa pun.",
  liveUrl: "https://example.com",
  repoUrl: "https://github.com/example/kasir",
  videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  category: "umkm",
  contentLang: "id",
  status: "published",
  rejectReason: null,
  linkStatus: "offline",
  lastCheckedAt: "2026-10-15T03:00:00Z",
  buildTimeHours: 6,
  sessionCount: 2,
  upvoteCount: 128,
  publishedAt: "2026-10-10T03:00:00Z",
  createdAt: "2026-10-10T03:00:00Z",
  maker: {
    id: "00000000-0000-4000-8000-0000000000aa",
    username: "ragil",
    displayName: "Ragil Samsi",
    avatarUrl: null,
    bio: "Bikin alat kecil untuk warung dan kampung, bersama AI.",
    tipUrl: "https://saweria.co/example",
    isTrusted: true,
  },
  sessions: [
    {
      id: "s1",
      label: "Sabtu malam",
      durationHours: 4,
      prompt:
        "Simpan transaksi ke Supabase, satu baris per penjualan, bisa jalan walau sinyal putus-putus.",
      result: "Transaksi ditampung dulu di HP, lalu dikirim saat sinyal kembali.",
      challenge:
        "Login Google tertutup sebelum selesai di HP Android lama, padahal itu HP yang dipakai Bu Tini.",
      solution: "Login sekarang lewat tautan di email. Diuji di HP lama pinjaman tetangga, aman.",
    },
    {
      id: "s2",
      label: "Minggu sore",
      durationHours: 2,
      prompt: "Tiap Minggu malam, rangkum penjualan seminggu jadi satu kartu yang gampang dibaca.",
      result: "Kartu rekap mingguan sudah jadi. Belakangan ini jadi fitur favorit Bu Tini.",
      challenge: null,
      solution: null,
    },
  ],
  media: [],
  tools: [
    { name: "Claude Code", slug: "claude-code", url: null, ai: true },
    { name: "Supabase", slug: "supabase", url: null, ai: false },
    { name: "Alat kasir lokal", slug: null, url: null, ai: false },
  ],
  others: [
    {
      slug: "bot-resep-kulkas",
      title: "Bot Resep Kulkas",
      keyPrompt: "Foto isi kulkas, kasih tiga resep yang bisa dimasak dalam 20 menit.",
    },
  ],
};

const myProjects: MyProject[] = [
  {
    id: "p1",
    slug: "kasir-warung-bu-tini",
    title: "Kasir Warung Bu Tini",
    keyPrompt: baseProject.keyPrompt,
    status: "published",
    rejectReason: null,
    linkStatus: "live",
    lastCheckedAt: null,
    upvoteCount: 128,
    commentCount: 2,
    coverKey: null,
  },
  {
    id: "p2",
    slug: "bot-resep-kulkas",
    title: "Bot Resep Kulkas",
    keyPrompt: "Foto isi kulkas, kasih tiga resep yang bisa dimasak dalam 20 menit.",
    status: "published",
    rejectReason: null,
    linkStatus: "offline",
    lastCheckedAt: "2026-10-15T03:00:00Z",
    upvoteCount: 87,
    commentCount: 4,
    coverKey: null,
  },
  {
    id: "p3",
    slug: "undangan-nikahan",
    title: "Undangan Nikahan Kakak",
    keyPrompt: "Undangan digital satu halaman, ada peta, RSVP, dan amplop digital.",
    status: "rejected",
    rejectReason: "Link live mengarah ke halaman login, tidak bisa dicoba.",
    linkStatus: "archived",
    lastCheckedAt: null,
    upvoteCount: 0,
    commentCount: 0,
    coverKey: null,
  },
  {
    id: "p4",
    slug: "jadwal-ronda",
    title: "Jadwal Ronda RT 05",
    keyPrompt: "Bikin jadwal ronda yang otomatis gilir dan kirim pengingat ke grup WA.",
    status: "pending",
    rejectReason: null,
    linkStatus: "live",
    lastCheckedAt: null,
    upvoteCount: 0,
    commentCount: 0,
    coverKey: null,
  },
];

export default function DevPagesPage({ searchParams }: PageProps<"/[locale]/dev/pages">) {
  if (process.env.VERCEL_ENV === "production") notFound();

  return (
    <>
      <Suspense>
        <Preview searchParams={searchParams} />
      </Suspense>
      <SiteFooter />
    </>
  );
}

async function Preview({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/dev/pages">["searchParams"];
}) {
  const { view: requested } = await searchParams;
  const view: View = views.find((candidate) => candidate === requested) ?? "offline";

  return (
    <>
      <nav className="mx-auto flex w-full max-w-[1200px] flex-wrap gap-2 px-4 pt-6 sm:px-6">
        {views.map((candidate) => (
          <Link
            key={candidate}
            href={{ pathname: "/dev/pages", query: { view: candidate } }}
            className={pillStyles({ selected: candidate === view })}
          >
            {candidate}
          </Link>
        ))}
      </nav>
      {view === "offline" ? <ProjectDetailView project={baseProject} /> : null}
      {view === "archived" ? (
        <ProjectDetailView
          project={{ ...baseProject, linkStatus: "archived", videoUrl: null, others: [] }}
        />
      ) : null}
      {view === "pending" ? (
        <ProjectDetailView
          project={{ ...baseProject, status: "pending", linkStatus: "live", upvoteCount: 0 }}
          ownerNotice={
            <SystemMessage tone="soft">
              <span className="font-medium">Cuma kamu yang bisa melihat halaman ini.</span> Proyek
              ini masih menunggu review admin (paling lama 2×24 jam).
            </SystemMessage>
          }
        />
      ) : null}
      {view === "me" || view === "me-empty" ? (
        <main className="mx-auto w-full max-w-[1200px] px-4 pt-12 sm:px-6">
          {view === "me" ? (
            <div className="flex max-w-[760px] flex-col gap-3">
              <OfflineNotice project={myProjects[1]} />
            </div>
          ) : null}
          <MeTabs
            initialTab="projects"
            label="Bagian dashboard"
            tabLabels={{
              projects: `Proyek saya · ${view === "me" ? myProjects.length : 0}`,
              profile: "Edit profil",
            }}
            panels={{
              projects: (
                <MyProjects projects={view === "me" ? myProjects : []} isTrusted={view === "me"} />
              ),
              profile: (
                <ProfileForm
                  profileHost="vibespaidoff.dev/u/"
                  initialValues={{
                    displayName: "Ragil Samsi",
                    username: "ragil",
                    bio: "Halo! Aku bikin alat kecil untuk warung dan kampung, bersama AI.",
                    location: "Indonesia",
                    tipUrl: "",
                    github: "https://github.com/example",
                    linkedin: "",
                    x: "",
                    website: "",
                  }}
                />
              ),
            }}
          />
        </main>
      ) : null}
    </>
  );
}
