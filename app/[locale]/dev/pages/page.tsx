import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { HomeHeroCard } from "@/components/discovery/home-hero";
import { ProjectRow } from "@/components/discovery/project-row";
import { RepliesSection } from "@/components/interactions/replies";
import { ReportButton } from "@/components/interactions/report-button";
import { WorthItButton } from "@/components/interactions/worth-it-button";
import { ProjectDetailView } from "@/components/project/project-detail";
import { ProjectGridCard } from "@/components/project/project-grid-card";
import { SystemMessage } from "@/components/ui/bubble";
import { pillStyles } from "@/components/ui/pill";
import type {
  AdminTool,
  QueueItem,
  ReportGroup,
  SuggestionGroup,
  WeeklyPickView,
} from "@/lib/admin/data";
import type { MyProject } from "@/lib/profiles/me";
import type { ProjectCardData } from "@/lib/projects/cards";
import type { ProjectDetail } from "@/lib/projects/detail";
import type { BuildEffort } from "@/lib/projects/types";
import { MeTabs } from "../../me/me-tabs";
import { MyProjects, OfflineNotice, ReviewNotice, StoryNudge } from "../../me/my-projects";
import { AvatarField } from "../../me/avatar-field";
import { ProfileForm } from "../../me/profile-form";
import { ActionLogProvider } from "../../admin/action-log";
import { ReportCard } from "../../admin/reports";
import { PanelHeading, QueueCard } from "../../admin/review-queue";
import { ToolsAdmin } from "../../admin/tools-admin";
import { PickCard } from "../../admin/weekly-picks";

export const metadata = { title: "Page states", robots: { index: false } };

// Non-production preview of page states that need special data or a session: an offline or
// archived project, the owner's view of a pending one, the /me dashboard, and the home lists
// (pick hero, popular cards, "Baru masuk" rows) with more projects than the dev database has,
// the signed-in interactions (Worth it toggle, replies with your own one, report dialogs), and
// the /admin cards (queue, reports, tools, weekly picks).
// Actions here run against made-up ids, so saving answers with an error by design.

const views = [
  "offline",
  "archived",
  "pending",
  "interactions",
  "me",
  "me-empty",
  "home",
  "admin",
] as const;
type View = (typeof views)[number];

const baseProject: ProjectDetail = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "kasir-warung-bu-tini",
  title: "Kasir Warung Bu Tini",
  tagline: "Catat jualan harian dari HP, langsung keluar rekap mingguan.",
  description: "",
  keyPrompt:
    "Bikin kasir buat warung kelontong, tombolnya gede, bisa dipakai ibu-ibu tanpa tutorial.",
  buildEffort: "weekend",
  momentWow:
    "“Tombolnya segede jempol, warnanya beda tiap kategori.” Sekali jalan, Bu Tini langsung bisa pakai.",
  momentHardest: null,
  hasStory: true,
  lessons:
    "Tulis prompt dari sudut pandang pemakainya, bukan dari daftar fiturnya. “Ibu-ibu tanpa tutorial” menghasilkan desain yang lebih baik daripada spesifikasi sepanjang apa pun.",
  liveUrl: "https://example.com",
  repoUrl: "https://github.com/example/kasir",
  repoPrivate: false,
  videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  category: "umkm",
  contentLang: "id",
  status: "published",
  rejectCode: null,
  rejectReason: null,
  linkStatus: "offline",
  lastCheckedAt: "2026-10-15T03:00:00Z",
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
    rejectCode: null,
    rejectReason: null,
    recentlyApproved: false,
    linkStatus: "live",
    hasLiveLink: true,
    lastCheckedAt: null,
    upvoteCount: 128,
    commentCount: 2,
    coverKey: null,
    storyNudge: true,
  },
  {
    id: "p2",
    slug: "bot-resep-kulkas",
    title: "Bot Resep Kulkas",
    keyPrompt: "Foto isi kulkas, kasih tiga resep yang bisa dimasak dalam 20 menit.",
    status: "published",
    rejectCode: null,
    rejectReason: null,
    recentlyApproved: false,
    linkStatus: "offline",
    hasLiveLink: true,
    lastCheckedAt: "2026-10-15T03:00:00Z",
    upvoteCount: 87,
    commentCount: 4,
    coverKey: null,
    storyNudge: false,
  },
  {
    id: "p3",
    slug: "undangan-nikahan",
    title: "Undangan Nikahan Kakak",
    keyPrompt: "Undangan digital satu halaman, ada peta, RSVP, dan amplop digital.",
    status: "rejected",
    rejectCode: "broken_link",
    rejectReason: "Link live mengarah ke halaman login.",
    recentlyApproved: false,
    linkStatus: "archived",
    hasLiveLink: true,
    lastCheckedAt: null,
    upvoteCount: 0,
    commentCount: 0,
    coverKey: null,
    storyNudge: false,
  },
  {
    id: "p4",
    slug: "jadwal-ronda",
    title: "Jadwal Ronda RT 05",
    keyPrompt: "Bikin jadwal ronda yang otomatis gilir dan kirim pengingat ke grup WA.",
    status: "pending",
    rejectCode: null,
    rejectReason: null,
    recentlyApproved: false,
    linkStatus: "live",
    hasLiveLink: false,
    lastCheckedAt: null,
    upvoteCount: 0,
    commentCount: 0,
    coverKey: null,
    storyNudge: false,
  },
];

function sampleCard(
  n: number,
  title: string,
  keyPrompt: string,
  maker: string,
  tools: { name: string; ai: boolean }[],
  effort: BuildEffort,
  votes: number,
): ProjectCardData {
  return {
    id: `00000000-0000-4000-8000-00000000010${n}`,
    slug: title.toLowerCase().replaceAll(" ", "-"),
    title,
    tagline: "",
    keyPrompt,
    category: ["umkm", "community", "lifestyle", "game"][n % 4],
    contentLang: n === 3 ? "en" : "id",
    buildEffort: effort,
    hasStory: n % 2 === 1,
    upvoteCount: votes,
    commentCount: n % 3,
    linkStatus: "live",
    hasLiveLink: true,
    publishedAt: `2026-10-1${n}T03:00:00Z`,
    coverKey: null,
    tools,
    maker: { username: maker.toLowerCase(), displayName: maker, avatarUrl: null },
  };
}

const sampleCards: ProjectCardData[] = [
  sampleCard(
    1,
    "Jadwal Ronda",
    "Pengingat jadwal ronda RT, kirim lewat WhatsApp tiap sore.",
    "Dimas Pratama",
    [
      { name: "Lovable", ai: true },
      { name: "WhatsApp Cloud API", ai: false },
    ],
    "hours",
    94,
  ),
  sampleCard(
    2,
    "Bot Resep Kulkas",
    "Foto isi kulkas, kasih tiga resep yang bisa dimasak dalam 20 menit.",
    "Ragil Samsi",
    [{ name: "Claude Code", ai: true }],
    "overnight",
    87,
  ),
  sampleCard(
    3,
    "Rupiah Rates",
    "A rupiah exchange dashboard for online sellers who import goods.",
    "Sari Lestari",
    [
      { name: "v0", ai: true },
      { name: "Vercel", ai: false },
      { name: "Supabase", ai: false },
    ],
    "weekend",
    61,
  ),
];

const sampleReplies = [
  {
    id: "00000000-0000-4000-8000-0000000000c1",
    body: "Bagian magic link-nya menolong banget, aku kena masalah yang sama di proyek ronda.",
    createdAt: "2026-10-15T09:00:00Z",
    author: {
      id: "00000000-0000-4000-8000-0000000000b1",
      username: "dimas",
      displayName: "Dimas Pratama",
      avatarUrl: null,
    },
  },
  {
    id: "00000000-0000-4000-8000-0000000000c2",
    body: "Prompt pertamanya bagus. Mau coba pola “tanpa tutorial” buat aplikasi les.",
    createdAt: "2026-10-16T09:00:00Z",
    author: {
      id: "00000000-0000-4000-8000-0000000000b2",
      username: "wulan",
      displayName: "Wulan Sari",
      avatarUrl: null,
    },
  },
  {
    id: "00000000-0000-4000-8000-0000000000c3",
    body: "@wulan makasih! Kuncinya memang di prompt pertama. Cc @dimas",
    createdAt: "2026-10-16T12:00:00Z",
    author: {
      id: baseProject.maker.id,
      username: baseProject.maker.username,
      displayName: baseProject.maker.displayName,
      avatarUrl: null,
    },
  },
];

const sampleMaker = {
  id: "00000000-0000-4000-8000-0000000000d1",
  username: "fajar",
  displayName: "Fajar Nugroho",
  avatarUrl: null,
  isTrusted: false,
};

const sampleQueue: QueueItem[] = [
  {
    id: "00000000-0000-4000-8000-0000000000e1",
    slug: "absen-lab-kampus",
    title: "Absen Lab Kampus",
    tagline: "Absensi praktikum pakai QR, rekap mingguan otomatis.",
    keyPrompt: "Absensi praktikum pakai QR, asisten lab bisa rekap per minggu.",
    liveUrl: "https://absenlab.example.com",
    repoUrl: "https://github.com/fajar/absen-lab",
    repoPrivate: false,
    category: "education",
    buildEffort: "weekend",
    submittedAt: "2026-10-17T00:00:00Z",
    resubmitted: false,
    coverKey: null,
    tools: ["Lovable", "Supabase", "QR Kilat"],
    maker: sampleMaker,
  },
  {
    id: "00000000-0000-4000-8000-0000000000e2",
    slug: "kalkulator-ongkir-umkm",
    title: "Kalkulator Ongkir UMKM",
    tagline: "Hitung ongkir beberapa kurir sekaligus.",
    keyPrompt: "Hitung ongkir beberapa kurir sekaligus, tinggal tempel alamat dari chat pembeli.",
    liveUrl: null,
    repoUrl: "https://github.com/rina/ongkir-umkm",
    repoPrivate: true,
    category: "umkm",
    buildEffort: "overnight",
    submittedAt: "2026-10-14T00:00:00Z",
    resubmitted: true,
    coverKey: null,
    tools: ["Bolt"],
    maker: {
      ...sampleMaker,
      id: "00000000-0000-4000-8000-0000000000d2",
      username: "rina",
      displayName: "Rina Wijaya",
    },
  },
];

const sampleReports: ReportGroup[] = [
  {
    targetType: "project",
    targetId: "00000000-0000-4000-8000-0000000000f1",
    count: 3,
    reasons: [
      { reason: "scam", count: 2 },
      { reason: "spam", count: 1 },
    ],
    notes: [{ reporter: "wulan", note: "Minta transfer dulu sebelum bisa dipakai." }],
    firstAt: "2026-10-16T03:00:00Z",
    project: {
      id: "00000000-0000-4000-8000-0000000000f1",
      slug: "generator-follower-instan",
      title: "Generator Follower Instan",
      tagline: "Tambah 10.000 follower dalam semalam.",
      status: "hidden",
      owner: { ...sampleMaker, username: "akunbaru92", displayName: "Akun Baru", isTrusted: true },
    },
    comment: null,
    hidden: true,
  },
  {
    targetType: "comment",
    targetId: "00000000-0000-4000-8000-0000000000f2",
    count: 1,
    reasons: [{ reason: "harassment", count: 1 }],
    notes: [],
    firstAt: "2026-10-16T05:00:00Z",
    project: {
      id: "00000000-0000-4000-8000-0000000000f3",
      slug: "jadwal-ronda",
      title: "Jadwal Ronda",
      tagline: "Pengingat ronda RT.",
      status: "published",
      owner: sampleMaker,
    },
    comment: {
      body: "Aplikasi kayak gini mah anak SD juga bisa bikin.",
      hidden: false,
      author: { ...sampleMaker, username: "julid", displayName: "Julid" },
    },
    hidden: false,
  },
  {
    targetType: "comment",
    targetId: "00000000-0000-4000-8000-0000000000f4",
    count: 1,
    reasons: [{ reason: "spam", count: 1 }],
    notes: [],
    firstAt: "2026-10-16T06:00:00Z",
    project: null,
    comment: null,
    hidden: false,
  },
];

const sampleTools: AdminTool[] = [
  ["Claude Code", "claude-code", "ai_agent", 3],
  ["Cursor", "cursor", "ai_agent", 1],
  ["Lovable", "lovable", "ai_builder", 1],
  ["Bolt", "bolt", "ai_builder", 2],
  ["v0", "v0", "ai_builder", 1],
  ["Replit", "replit", "ai_builder", 0],
  ["Supabase", "supabase", "backend", 4],
].map(([name, slug, kind, count], index) => ({
  id: index + 1,
  slug: slug as string,
  name: name as string,
  url: `https://${slug}.example.com`,
  logoUrl: null,
  kind: kind as AdminTool["kind"],
  descriptionId: "",
  descriptionEn: "",
  isActive: slug !== "replit",
  projectCount: count as number,
}));

const sampleSuggestions: SuggestionGroup[] = [
  {
    name: "QR Kilat",
    urls: ["https://qrkilat.example.com"],
    projects: [
      { slug: "absen-lab-kampus", title: "Absen Lab Kampus", status: "pending" },
      { slug: "parkir-masjid", title: "Parkir Masjid", status: "published" },
    ],
    firstAt: "2026-10-15T00:00:00Z",
  },
];

const samplePicks: WeeklyPickView[] = [
  {
    weekStart: "2026-10-12",
    computedAt: "2026-10-11T17:05:00Z",
    windowFrom: "2026-10-04T17:00:00Z",
    windowTo: "2026-10-11T17:00:00Z",
    minScore: 3,
    winner: {
      projectId: "w1",
      title: "Kasir Warung Bu Tini",
      slug: "kasir-warung-bu-tini",
      score: 26,
      eligibleVotes: 23,
      eligibleRepliers: 6,
    },
    candidates: [
      {
        projectId: "w1",
        title: "Kasir Warung Bu Tini",
        slug: "kasir-warung-bu-tini",
        score: 26,
        eligibleVotes: 23,
        eligibleRepliers: 6,
      },
      {
        projectId: "w2",
        title: "Jadwal Ronda",
        slug: "jadwal-ronda",
        score: 12.5,
        eligibleVotes: 11,
        eligibleRepliers: 3,
      },
      { projectId: "w3", title: null, slug: null, score: 4, eligibleVotes: 4, eligibleRepliers: 0 },
    ],
  },
  {
    weekStart: "2026-10-05",
    computedAt: "2026-10-04T17:05:00Z",
    windowFrom: "2026-09-27T17:00:00Z",
    windowTo: "2026-10-04T17:00:00Z",
    minScore: 3,
    winner: null,
    candidates: [],
  },
];

export default function DevPagesPage({ searchParams }: PageProps<"/[locale]/dev/pages">) {
  // Local development only: hidden on every Vercel deployment, previews included.
  if (process.env.VERCEL_ENV) notFound();

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
      {view === "interactions" ? (
        <ProjectDetailView
          project={{ ...baseProject, linkStatus: "live" }}
          worthIt={<WorthItButton projectId={baseProject.id} voted={false} count={128} />}
          replies={
            <RepliesSection
              projectId={baseProject.id}
              maker={{ ...baseProject.maker, avatarUrl: null }}
              replies={sampleReplies}
              viewer={{ kind: "user", id: sampleReplies[1].author.id }}
              turnstileSiteKey={null}
            />
          }
          reportLink={
            <ReportButton
              targetType="project"
              targetId={baseProject.id}
              className="inline-flex min-h-11 items-center self-center text-[13px] text-muted"
            />
          }
        />
      ) : null}
      {view === "home" ? (
        <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-14 px-4 pt-12 sm:px-6">
          <div className="max-w-[560px]">
            <HomeHeroCard
              hero={{
                kind: "weekly_pick",
                project: {
                  ...sampleCards[1],
                  title: "Kasir Warung Bu Tini",
                  keyPrompt: baseProject.keyPrompt,
                  upvoteCount: 128,
                  commentCount: 2,
                  tools: [
                    { name: "Claude Code", ai: true },
                    { name: "Supabase", ai: false },
                  ],
                },
              }}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sampleCards.map((project) => (
              <ProjectGridCard key={project.id} project={project} />
            ))}
          </div>
          <div>
            {sampleCards.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </div>
        </main>
      ) : null}
      {view === "admin" ? (
        <main className="mx-auto flex w-full max-w-[1000px] flex-col gap-[18px] px-4 pt-10 pb-16 sm:px-6">
          <PanelHeading
            title="Antrean review"
            lede="Kartu antrean (sisa waktu dihitung dari 17 Okt 2026 12:00 WIB)."
          />
          <ActionLogProvider>
            {sampleQueue.map((item) => (
              <QueueCard key={item.id} item={item} now={Date.parse("2026-10-17T05:00:00Z")} />
            ))}
          </ActionLogProvider>
          <PanelHeading title="Laporan" />
          <ActionLogProvider>
            {sampleReports.map((group) => (
              <ReportCard key={group.targetId} group={group} />
            ))}
          </ActionLogProvider>
          <PanelHeading title="Kelola tools" />
          <ActionLogProvider>
            <ToolsAdmin tools={sampleTools} suggestions={sampleSuggestions} />
          </ActionLogProvider>
          <PanelHeading title="Pilihan minggu ini" />
          {samplePicks.map((pick) => (
            <PickCard key={pick.weekStart} pick={pick} />
          ))}
        </main>
      ) : null}
      {view === "me" || view === "me-empty" ? (
        <main className="mx-auto w-full max-w-[1200px] px-4 pt-12 sm:px-6">
          {view === "me" ? (
            <div className="flex max-w-[760px] flex-col gap-3">
              <ReviewNotice project={myProjects[2]} />
              <ReviewNotice project={myProjects[0]} />
              <OfflineNotice project={myProjects[1]} />
              <StoryNudge project={myProjects[0]} />
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
                <>
                  <AvatarField name="Ragil Samsi" initialUrl={null} initialUploaded={false} />
                  <ProfileForm
                    profileHost="jadinya.dev/u/"
                    initialValues={{
                      displayName: "Ragil Samsi",
                      username: "ragil",
                      bio: "Halo! Aku bikin alat kecil untuk warung dan kampung, bersama AI.",
                      location: "Indonesia",
                      tipUrl: "",
                      github: "example",
                      linkedin: "",
                      x: "",
                      threads: "",
                      instagram: "example.dev",
                      tiktok: "",
                      website: "",
                    }}
                  />
                </>
              ),
            }}
          />
        </main>
      ) : null}
    </>
  );
}
