// Generates every SVG in logo-exploration/ plus index.html from one geometry source.
// Run: node logo-exploration/arsip/v01/build.mjs
//
// Units: symbols live on a 24u grid (viewBox 0 0 24 24). The wordmark is drawn on its own
// grid: baseline y=0, x-height 12u, ascender 18u, descender 6u, stroke 3u. Strokes keep
// round caps and joins; outline them (Figma "Outline stroke") before handing off to print.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const f = (v) => +v.toFixed(3);

// ---------- primitives ----------

const line = (d, w, role = "p") => ({ kind: "stroke", d, w, role });
const shape = (d, role = "p") => ({ kind: "fill", d, role });
const circlePath = (cx, cy, r) =>
  `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const dot = (cx, cy, r, role) => shape(circlePath(cx, cy, r), role);
const rrectPath = (x, y, w, h, r) =>
  `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}` +
  `V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}` +
  `A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`;

// colors: { p, a } for standalone files; inline mode writes CSS vars through style.
function paint(els, colors, inline = false) {
  return els
    .map((e) => {
      const c = colors[e.role];
      if (e.kind === "stroke") {
        return inline
          ? `<path d="${e.d}" style="fill:none;stroke:${c};stroke-width:${e.w};stroke-linecap:round;stroke-linejoin:round"/>`
          : `<path d="${e.d}" fill="none" stroke="${c}" stroke-width="${e.w}" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      return inline ? `<path d="${e.d}" style="fill:${c}"/>` : `<path d="${e.d}" fill="${c}"/>`;
    })
    .join("");
}

// ---------- wordmark "jadinya" ----------

const W = 3; // stroke
const H = W / 2;
const R = 4.5; // bowl radius (centerline)
const XH = 12;

const glyphs = {
  j(x, o) {
    const sx = x + H + R;
    const els = [line(`M${sx} ${-XH + H}V0A${R} ${R} 0 0 1 ${sx - R} ${R}`, W, o.jRole ?? "p")];
    els.push(dot(sx, -16, 2, o.jRole ?? "p"));
    if (o.ball) els.push(dot(sx - R, R, 2.4, "a"));
    return { els, right: sx + H };
  },
  a(x, o, role = "p") {
    const cx = x + H + R;
    return {
      els: [line(circlePath(cx, -6, R), W, role), line(`M${cx + R} ${-XH + H}V${-H}`, W, role)],
      right: cx + R + H,
    };
  },
  d(x) {
    const cx = x + H + R;
    return {
      els: [line(circlePath(cx, -6, R), W), line(`M${cx + R} ${-18 + H}V${-H}`, W)],
      right: cx + R + H,
    };
  },
  i(x, o) {
    const sx = x + H;
    const els = [line(`M${sx} ${-XH + H}V${-H}`, W)];
    els.push(o.squareTittle ? shape(rrectPath(sx - 2.1, -18, 4.2, 4.2, 0.6), "a") : dot(sx, -16, 2));
    return { els, right: sx + H };
  },
  n(x) {
    const l = x + H;
    return {
      els: [line(`M${l} ${-XH + H}V${-H}M${l} -6A${R} ${R} 0 0 1 ${l + 2 * R} -6V${-H}`, W)],
      right: l + 2 * R + H,
    };
  },
  y(x) {
    const l = x + H;
    const r = l + 2 * R;
    return {
      els: [line(`M${l} ${-XH + H}V-6A${R} ${R} 0 0 0 ${r} -6M${r} ${-XH + H}V0A${R} ${R} 0 0 1 ${r - R} ${R}`, W)],
      right: r + H,
    };
  },
  // n + y sharing one stroke: the arch of n falls straight into the cup of y.
  ny(x, o) {
    const l = x + H;
    const m = l + 2 * R;
    const r = m + 2 * R;
    const role = o.nyRole ?? "p";
    // nyStem: the shared middle stem runs the full x-height, so n and y each stay whole
    // (the bare wave reads as "ry" at small sizes)
    const stem = o.nyStem ? `M${m} ${-XH + H}V${-H}` : "";
    return {
      els: [
        line(
          `M${l} ${-XH + H}V${-H}M${l} -6A${R} ${R} 0 0 1 ${m} -6A${R} ${R} 0 0 0 ${r} -6${stem}M${r} ${-XH + H}V0A${R} ${R} 0 0 1 ${r - R} ${R}`,
          W,
          role,
        ),
      ],
      right: r + H,
    };
  },
};

// gap after each glyph (outer edge to outer edge), tuned optically
const gaps = { j: 3, a: 3, d: 3.6, i: 3.6, n: 3.2, y: 2.8, ny: 2.8 };

function wordmark(o = {}) {
  const seq = o.ligature ? ["j", "a", "d", "i", "ny", "a"] : ["j", "a", "d", "i", "n", "y", "a"];
  let x = 0;
  const els = [];
  seq.forEach((g, k) => {
    const out = glyphs[g](x, o);
    els.push(...out.els);
    x = out.right + (k < seq.length - 1 ? gaps[g] : 0);
  });
  return { els, width: x };
}

// ---------- symbols (24u grid) ----------

const symbols = {
  // 01: j with two equal dots, the tittle (prompt) and a ball terminal (result)
  titik(t = {}) {
    const w = 4;
    const sx = 14.5;
    const r = t.hook ?? 5;
    const top = 10;
    const bend = 20 - r;
    return [
      line(`M${sx} ${top}V${bend}A${r} ${r} 0 0 1 ${sx - r} ${bend + r}`, w),
      dot(sx, 4.25, 2.75),
      dot(sx - r, bend + r, 2.75, "a"),
    ];
  },
  // 02: "=" whose short upper bar sits right like a prompt bubble, long bar is the reply
  samaDengan(t = {}) {
    const w = 5;
    if (!t.slid) {
      return [line(`M12.5 8H18.5`, w), line(`M5.5 16H18.5`, w, "a")];
    }
    // revised: the bars slide apart into the conversation layout (prompt right, result left);
    // the 6u where they still overlap keeps the "=".
    return [line(`M13.5 8H18.5`, w), line(`M5.5 16H14.5`, w, "a")];
  },
  // 03: a wavy stroke (vibe) that straightens and lands in a solid square (the product)
  vibe() {
    const w = 3.5;
    return [
      line(`M2.25 12C3.6 6.6 6.4 6.6 7.25 12S10.9 17.4 12.25 12L14 12`, w),
      shape(rrectPath(14, 8, 8.5, 8, 1.5), "a"),
    ];
  },
  // 04: typing indicator whose third dot grows into a j
  ngetik(t = {}) {
    const r = t.dot ?? 2.75;
    const y = 5;
    const sx = 19;
    const hook = 5;
    return [
      dot(4.75, y, r),
      dot(11.875, y, r),
      dot(sx, y, r, "a"),
      line(`M${sx} 11.5V${21.5 - hook}A${hook} ${hook} 0 0 1 ${sx - hook} 21.5`, 4, "a"),
    ];
  },
  // 05: the n+y ligature from the wordmark, standing alone
  nya(t = {}) {
    const s = t.scale ?? 1;
    const word = glyphs.ny(0, {});
    const width = word.right * s;
    // x-height band sits on 3u..15u, descender reaches 21u
    return [{ group: true, transform: `translate(${f((24 - width) / 2)} 15) scale(${s})`, els: word.els }];
  },
};

// expand grouped elements (only the ligature uses a transform)
function renderEls(els, colors, inline) {
  return els
    .map((e) =>
      e.group ? `<g transform="${e.transform}">${paint(e.els, colors, inline)}</g>` : paint([e], colors, inline),
    )
    .join("");
}

// ---------- options ----------

const options = [
  {
    id: "01-titik-ke-titik",
    name: "Titik ke Titik",
    type: "Lettermark",
    symbol: () => symbols.titik(),
    word: { ball: true },
    colors: { p: "#141414", a: "#FF5A1F", pd: "#F4F4F2", ad: "#FF6B35", neutral: "#F2F3F5", extra: "#2A2B2F" },
    font: "Plus Jakarta Sans",
    idea: "Huruf j punya dua titik yang sama besar: titik di atas adalah prompt (awal obrolan), bola di ujung kait adalah hasil yang jadi. Garis di antaranya adalah proses, bagian yang justru dipamerkan Jadinya lewat sesi, kendala, dan solusi.",
    construction: "Grid 24u. Stroke 4u ujung bulat, kait seperempat lingkaran r 5u, dua titik r 2,75u (sedikit lebih besar dari stroke supaya tetap terbaca di 16 px). Jarak titik ke batang 1,75u.",
    personality: "Tenang, ramah, jelas.",
    pros: "Paling mudah dibaca di 16 px. Langsung terbaca sebagai j. Titik-garis-titik bisa jadi pola timeline sesi tanpa dipaksakan.",
    cons: "Lettermark j bulat cukup umum, unik tidaknya bergantung pada detail bola terminal. Ball terminal terasa sedikit klasik, bisa jadi kekuatan atau terkesan kuno. Tidak ada risiko kemiripan yang spesifik.",
    system: "Ikon: stroke 1,5 px ujung bulat, tiap ikon boleh punya satu titik aksen. Pola: titik-garis-titik untuk timeline sesi dan stepper submit. Motion: titik bergerak dari atas ke ujung kait sebagai loader \"lagi diproses\".",
    shape: "Radius penuh untuk tombol dan chip, radius 12 px untuk kartu, semua ujung garis bulat, tanpa sudut tajam.",
    scores: { unik: 3, kecil: 5, relevan: 4, waktu: 5, sistem: 4 },
  },
  {
    id: "02-sama-dengan",
    name: "Sama Dengan",
    type: "Simbol abstrak aksi inti",
    symbol: () => symbols.samaDengan({ slid: true }),
    firstDraft: () => symbols.samaDengan(),
    word: {},
    colors: { p: "#0F1B3D", a: "#2F5BFF", pd: "#EEF1F7", ad: "#6F8BFF", neutral: "#EEF1F7", extra: "#FFC23D" },
    font: "Manrope",
    idea: "Dalam bahasa sehari-hari \"jadi\" adalah hasil hitungan: dua tambah dua jadi empat. Dua batang tanda sama dengan digeser: batang atas ke kanan seperti pesan prompt, batang bawah yang lebih panjang ke kiri seperti balasan berisi hasil. Ini persis susunan obrolan di Jadinya, dan bagian yang masih bertumpuk di tengah tetap terbaca sebagai \"=\".",
    construction: "Grid 24u. Dua pil setebal 5u dengan jarak 3u. Pil atas 10u rata kanan di 21u, pil bawah 14u rata kiri di 3u, keduanya bertumpuk 6u di tengah.",
    personality: "Ringkas, logis, percaya diri.",
    pros: "Bentuk paling sederhana dan paling kuat di 16 px. Mudah dianimasikan: pesan masuk dari kanan, hasil tumbuh dari kiri. Netral untuk pasar global.",
    cons: "Draf pertama (\"=\" rata kanan) terlalu mirip ikon menu, jadi direvisi. Varian dua pil di atas satu pil juga dibuang karena terbaca sebagai wajah. Versi akhir tetap dekat dengan ikon \"chat\" generik, dan bacaan \"=\" butuh penjelasan sekali.",
    system: "Ikon: bidang tebal berujung bulat. Pola: daftar obrolan sebagai pasangan pil kanan/kiri, skeleton loading identik dengan logo. Motion: pil hasil tumbuh dari kiri saat proyek berhasil dikirim.",
    shape: "Pill penuh untuk tombol, chip, dan bubble. Grid 8 px, kartu radius 16 px, susunan asimetris kanan-kiri sebagai ritme layout.",
    scores: { unik: 3, kecil: 5, relevan: 4, waktu: 5, sistem: 4 },
    firstScores: { unik: 2, kecil: 5, relevan: 4, waktu: 5, sistem: 4 },
  },
  {
    id: "03-vibe-jadi-kotak",
    name: "Vibe Jadi Kotak",
    type: "Metafora masalah → solusi",
    symbol: () => symbols.vibe(),
    word: { squareTittle: true },
    colors: { p: "#161616", a: "#F2A900", pd: "#F5F5F5", ad: "#FFC21A", neutral: "#F4F4F4", extra: "#3B5BFF" },
    font: "Archivo",
    idea: "Masalahnya: vibe coding dianggap asal-asalan, prosesnya bergelombang dan tidak kelihatan. Garis bergelombang (vibe) melurus lalu berakhir di kotak padat (produk yang jadi). Dibaca kiri ke kanan seperti sebelum dan sesudah. Di wordmark, titik huruf i ikut jadi kotak.",
    construction: "Grid 24u. Stroke 3,5u, satu periode gelombang selebar 10u dengan amplitudo kira-kira 3u, garis lurus 1,75u, kotak 8,5 × 8u radius 1,5u.",
    personality: "Energik, jujur, sedikit nakal.",
    pros: "Cerita masalah → solusi paling langsung. Bentuknya horizontal, cocok jadi loader atau progress bar. Kuning memberi energi tanpa ikut tren \"AI ungu\".",
    cons: "Dua jenis elemen (garis dan bidang) membuatnya kurang padat di app icon persegi. Di 16 px gelombangnya menipis. Kuning di atas putih kontrasnya rendah, jadi di latar terang kotak sebaiknya hitam. Gelombang mendekati ikon \"sinyal\" generik.",
    system: "Ikon: garis 1,75 px dipadu bidang kecil bersudut 2 px. Pola: divider bergelombang yang melurus saat sebuah langkah selesai. Motion: progress submit sebagai gelombang yang melurus lalu mengisi kotak.",
    shape: "Garis berujung bulat, bidang bersudut kecil (radius 4–6 px). Tombol bersudut 6 px, bukan pill.",
    scores: { unik: 3, kecil: 3, relevan: 4, waktu: 4, sistem: 4 },
  },
  {
    id: "04-lagi-ngetik",
    name: "Lagi Ngetik",
    type: "Makna ganda",
    symbol: () => symbols.ngetik(),
    word: { jRole: "p" },
    colors: { p: "#1A1A1A", a: "#E6336B", pd: "#F6F4F5", ad: "#FF5C8D", neutral: "#F6F4F5", extra: "#FFD8E4" },
    font: "Figtree",
    idea: "Tiga titik \"sedang mengetik…\" adalah jeda antara prompt dan jawaban. Titik ketiga menumbuhkan batang dan kait, jadi huruf j. Sekilas indikator mengetik, dilihat lagi ternyata j dari Jadinya: proses yang berubah jadi hasil, dalam format obrolan yang memang dipakai produk ini.",
    construction: "Grid 24u. Tiga titik r 2,75u dengan jarak antar pusat 7,125u, sejajar di y 5u. Batang j stroke 4u, kait seperempat lingkaran r 5u, jarak titik ke batang 1,75u.",
    personality: "Hangat, playful, komunikatif.",
    pros: "Ada momen \"aha\" yang kuat dan sangat terkait dengan produk. Animasinya alami: titik memantul, lalu titik terakhir jatuh jadi j. Pas untuk empty state, loading, dan avatar sistem.",
    cons: "Indikator mengetik sangat lekat dengan iMessage/WhatsApp, jadi bisa terasa \"aplikasi chat\". Di 16 px dua titik kiri tinggal sekitar 3,5 px tapi masih terlihat. Tanpa konteks bisa dibaca \"..j\". Animasi titik memantul akan terasa umum kalau terlalu sering dipakai.",
    system: "Ikon: lingkaran sebagai unit dasar, stroke 1,5 px ujung bulat. Pola: tiga titik sebagai penanda status (menunggu review, offline, tayang). Motion: titik memantul lalu jatuh jadi j di loader dan transisi sukses submit.",
    shape: "Radius penuh di mana-mana (pill, avatar, chip). Kartu radius 20 px.",
    scores: { unik: 4, kecil: 4, relevan: 5, waktu: 4, sistem: 5 },
  },
  {
    id: "05-nya-mengalir",
    name: "Nya Mengalir",
    type: "Wordmark dengan ligatur custom",
    symbol: () => symbols.nya({ scale: 1 }),
    word: { ligature: true, nyRole: "a" },
    wordOnly: true,
    colors: { p: "#151515", a: "#E0362C", pd: "#F5F5F3", ad: "#FF5A4E", neutral: "#F5F5F3", extra: "#FFE7E4" },
    font: "DM Sans",
    idea: "Wordmark geometris monoline. Huruf n dan y disatukan jadi satu tarikan: lengkung n langsung turun menjadi cekungan y, membentuk satu gelombang. Akhiran \"-nya\" yang membuat \"jadi\" menjadi milik seseorang, dan gelombang itu adalah vibe yang terselip di nama. Ekor y sama persis dengan ekor j, jadi kata dibuka dan ditutup dengan kait yang sama.",
    construction: "x-height 12u, ascender 18u, descender 6u, stroke 3u. Semua mangkuk berupa lingkaran sempurna r 4,5u. Ligatur terdiri dari dua setengah lingkaran r 4,5u yang bertemu tangen vertikal. Spasi diatur optis: 2,8u sampai 3,6u.",
    personality: "Luwes, percaya diri, khas.",
    pros: "Paling unik dan paling mudah dimiliki: namanya sendiri adalah logonya. Tanpa simbol tambahan. Ligaturnya bisa dipakai lepas sebagai elemen grafis.",
    cons: "Sebagian orang bisa membaca ligaturnya sebagai \"nu\" atau \"w\". Simbol mandiri (ligatur) abstrak dan butuh waktu dikenali sebagai app icon. Wordmark 7 huruf tidak bisa dipakai di 16 px, jadi favicon wajib pakai ligatur.",
    system: "Ikon: monoline 1,5 px, lingkaran sempurna. Pola: gelombang ligatur sebagai divider dan garis bawah judul. Motion: garis ligatur digambar (stroke-dashoffset) saat halaman dimuat.",
    shape: "Lingkaran sempurna dan garis berujung bulat. Pill untuk tombol, kartu radius 16 px, tanpa bayangan.",
    scores: { unik: 5, kecil: 3, relevan: 4, waktu: 4, sistem: 4 },
  },
];

// ---------- writers ----------

const SYM_H = 26; // symbol height inside the lockup, in wordmark units
const LOCK_GAP = 9;

function lockup(opt, colors, inline) {
  const word = wordmark(opt.word);
  const k = SYM_H / 24;
  let body = "";
  let x = 0;
  if (!opt.wordOnly) {
    body += `<g transform="translate(0 ${f(-6 - SYM_H / 2)}) scale(${f(k)})">${renderEls(opt.symbol(), colors, inline)}</g>`;
    x = SYM_H + LOCK_GAP;
  }
  body += `<g transform="translate(${f(x + H)} 0)">${paint(word.els, colors, inline)}</g>`;
  const width = x + word.width + 2 * H;
  const vb = `-2 -21 ${f(width + 4)} 30`;
  return { body, vb, width: width + 4, height: 30 };
}

const svgDoc = (vb, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img"><title>${title}</title>${body}</svg>\n`;

// symbol 04 next to the ligature wordmark of 05; only the stem variant (index 2) gets its own files
const opt04 = options.find((o) => o.id === "04-lagi-ngetik");
const combos = [
  { ...opt04, id: "04x-gelombang", name: "Lagi Ngetik + Nya Mengalir (gelombang)", word: { ligature: true } },
  { ...opt04, id: "04x-aksen", name: "Lagi Ngetik + Nya Mengalir (ny aksen)", word: { ligature: true, nyRole: "a" } },
  { ...opt04, id: "04x-ngetik-mengalir", name: "Lagi Ngetik + Nya Mengalir", word: { ligature: true, nyStem: true } },
];

for (const opt of [...options, combos[2]]) {
  const dir = join(root, opt.id);
  mkdirSync(dir, { recursive: true });
  const c = { p: opt.colors.p, a: opt.colors.a };
  writeFileSync(join(dir, "symbol.svg"), svgDoc("0 0 24 24", renderEls(opt.symbol(), c), `Jadinya — ${opt.name}`));
  const lk = lockup(opt, c);
  writeFileSync(join(dir, "horizontal.svg"), svgDoc(lk.vb, lk.body, `Jadinya — ${opt.name}`));
  const mono = lockup(opt, { p: "#000000", a: "#000000" });
  writeFileSync(join(dir, "mono.svg"), svgDoc(mono.vb, mono.body, `Jadinya — ${opt.name} (mono)`));
}

// ---------- index.html ----------

const V = { p: "var(--p)", a: "var(--a)" };
const symInline = (els, size, extra = "") =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" ${extra} aria-hidden="true">${renderEls(els, V, true)}</svg>`;
const lockInline = (opt, height) => {
  const lk = lockup(opt, V, true);
  return `<svg viewBox="${lk.vb}" height="${height}" width="${f((lk.width / lk.height) * height)}" aria-hidden="true">${lk.body}</svg>`;
};
const appIcon = (opt, size, variant) => {
  const els = opt.symbol();
  return `<div class="app ${variant}" style="width:${size}px;height:${size}px">${symInline(els, Math.round(size * 0.62))}</div>`;
};
const optVars = (o) =>
  `--P:${o.colors.p};--A:${o.colors.a};--Pd:${o.colors.pd};--Ad:${o.colors.ad};--N:${o.colors.neutral};--X:${o.colors.extra};--font:'${o.font}'`;

const comboColumns = [
  ["04 murni", opt04],
  ["04 + 05 gelombang, tinta", combos[0]],
  ["04 + 05 gelombang, aksen", combos[1]],
  ["04 + 05 batang tengah, tinta", combos[2]],
];
const comboVerdict = [
  ["Yang membaik", "Wordmark punya ciri sendiri, jadi logo tetap dikenali saat simbol tidak ikut tampil (teks OG, footer, tanda tangan email). Bahasa bentuknya sama-sama monoline bulat dengan stroke dan radius yang setara, jadi keduanya menyatu tanpa penyesuaian. Kait j di simbol, kait j di wordmark, dan ekor y kini memakai lengkung yang sama."],
  ["Yang memburuk", "Ada dua ide khas dalam satu lockup (titik yang jadi j dan ligatur ny) yang berebut perhatian. Versi ny aksen paling parah: dua titik magenta menarik mata ke dua arah dan menyorot \"-nya\" seolah itu inti nama. Ligatur gelombang asli terbaca \"jadirya\" di header kecil, karena n kehilangan kaki kanannya dan terlihat seperti r."],
  ["Simpulan", "Kalau digabung, pakai varian batang tengah berwarna tinta (kolom keempat, ini yang disimpan di 04x-ngetik-mengalir/). n dan y berbagi satu batang penuh, jadi keterbacaannya pulih. Ligaturnya turun jadi detail halus yang baru tertangkap saat dilihat kedua kali, dan simbol 04 tetap satu-satunya pusat perhatian. Gelombang yang jadi cerita opsi 05 memang hilang. Skor: unik 5, 16 px 4 (favicon tetap simbol 04), relevan 5, waktu 4, sistem 5, total 23 (04 murni 22). Selisihnya kecil: 04 murni lebih tenang, gabungan lebih mudah dimiliki."],
];
const comboSection = () => `
<section class="opt" id="gabungan" style="${optVars(opt04)}">
  <header class="opt-head">
    <span class="num">04×05</span>
    <div><h2>Gabungan: simbol 04 + wordmark 05</h2><p class="type">Dibandingkan dengan 04 murni</p></div>
    <a class="files" href="${combos[2].id}/horizontal.svg">horizontal.svg</a>
    <a class="files" href="${combos[2].id}/mono.svg">mono.svg</a>
  </header>
  <div class="combo">
    ${comboColumns
      .map(
        ([label, o]) => `<div class="col">
      <div class="label">${label}</div>
      <div class="tile light">${lockInline(o, 52)}</div>
      <div class="tile dark">${lockInline(o, 52)}</div>
      <div class="tile light small">${lockInline(o, 22)}${lockInline(o, 16)}</div>
      <div class="tile mono-l">${lockInline(o, 36)}</div>
      <div class="tile mono-d">${lockInline(o, 36)}</div>
      <div class="mock light"><div class="nav">${lockInline(o, 26)}<button>Pamerin</button></div></div>
    </div>`,
      )
      .join("")}
  </div>
  <dl class="notes">${comboVerdict.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join("")}</dl>
</section>`;

const ideas = [
  ["j dengan dua titik: tittle = prompt, bola terminal = hasil", true],
  ["Tanda = dengan batang atas pendek rata kanan (prompt) dan bawah panjang (hasil)", true],
  ["Garis bergelombang (vibe) yang melurus lalu masuk ke kotak padat (produk)", true],
  ["Indikator \"sedang mengetik…\" yang titik ketiganya tumbuh jadi j", true],
  ["Wordmark dengan ligatur ny yang membentuk satu gelombang", true],
  ["Tanda kutip ❝ yang ekornya melebar jadi bingkai layar", false],
  ["Bentuk setengah bulat setengah kotak: ide lunak menjadi produk tegas", false],
  ["Tiga batang sesi bertumpuk yang menyatu jadi satu blok", false],
  ["Monogram jd: batang d sekaligus batang j (ternyata terbaca g)", false],
  ["Bubble obrolan solid dengan ekor berbentuk kait j", false],
  ["Elipsis … yang titik terakhirnya kotak (\"X jam kemudian\")", false],
  ["Kait j dan kait y sebagai kurung pembuka-penutup ⌐ ¬", false],
  ["Titik i yang membesar jadi lingkaran: satu pesan yang tumbuh", false],
  ["Cetakan: tetesan yang masuk ke wadah persegi", false],
];

const aspects = [
  ["unik", "Keunikan"],
  ["kecil", "Terbaca di 16 px"],
  ["relevan", "Relevansi"],
  ["waktu", "Ketahanan waktu"],
  ["sistem", "Potensi sistem"],
];

const sizes = [16, 32, 64, 256];

const optionSection = (o, n) => `
<section class="opt" id="${o.id}" style="${optVars(o)}">
  <header class="opt-head">
    <span class="num">0${n + 1}</span>
    <div><h2>${o.name}</h2><p class="type">${o.type}</p></div>
    <a class="files" href="${o.id}/symbol.svg">symbol.svg</a>
    <a class="files" href="${o.id}/horizontal.svg">horizontal.svg</a>
    <a class="files" href="${o.id}/mono.svg">mono.svg</a>
  </header>

  <div class="stage">
    <div class="tile light hero">${lockInline(o, 72)}</div>
    <div class="tile dark hero">${lockInline(o, 72)}</div>
  </div>

  <h3>Ukuran 16 / 32 / 64 / 256 px</h3>
  <div class="sizes light">${sizes.map((s) => `<figure>${symInline(o.symbol(), s)}<figcaption>${s}</figcaption></figure>`).join("")}</div>
  <div class="sizes dark">${sizes.map((s) => `<figure>${symInline(o.symbol(), s)}<figcaption>${s}</figcaption></figure>`).join("")}</div>
  ${o.firstDraft ? `<p class="note">Draf pertama sebelum revisi: <span class="tile light inline">${symInline(o.firstDraft(), 32)}</span> <span class="tile light inline">${symInline(o.firstDraft(), 16)}</span> Tanda = rata kanan ini terlalu mirip ikon menu, jadi kedua batang digeser ke susunan obrolan.</p>` : ""}

  <div class="row2">
    <div>
      <h3>App icon</h3>
      <div class="icons">
        ${appIcon(o, 120, "ink")}${appIcon(o, 120, "acc")}${appIcon(o, 120, "paper")}
        ${appIcon(o, 48, "ink")}${appIcon(o, 32, "ink")}${appIcon(o, 16, "ink")}
      </div>
    </div>
    <div>
      <h3>Mono</h3>
      <div class="monos">
        <div class="tile mono-l">${lockInline(o, 40)}</div>
        <div class="tile mono-d">${lockInline(o, 40)}</div>
        <div class="tile mono-l sq">${symInline(o.symbol(), 56)}</div>
        <div class="tile mono-d sq">${symInline(o.symbol(), 56)}</div>
      </div>
    </div>
  </div>

  <h3>Header web</h3>
  <div class="mock light">
    <div class="nav">${lockInline(o, 30)}<nav><span>Jelajah</span><span>Tools</span><span>Dukung kami</span></nav><button>Pamerin proyekmu</button></div>
    <div class="mock-body"><p class="eyebrow">Katalog vibe coding Indonesia</p><p class="h">Kamu bilang apa, AI bikin apa.</p></div>
  </div>
  <div class="mock dark">
    <div class="nav">${lockInline(o, 30)}<nav><span>Jelajah</span><span>Tools</span><span>Dukung kami</span></nav><button>Pamerin proyekmu</button></div>
  </div>

  <dl class="notes">
    <dt>Ide &amp; makna</dt><dd>${o.idea}</dd>
    <dt>Konstruksi</dt><dd>${o.construction}</dd>
    <dt>Kepribadian</dt><dd>${o.personality}</dd>
    <dt>Kelebihan</dt><dd>${o.pros}</dd>
    <dt>Kelemahan &amp; risiko</dt><dd>${o.cons}</dd>
  </dl>

  <h3>Benih design system</h3>
  <div class="palette">
    ${[
      ["Primary", o.colors.p],
      ["Accent", o.colors.a],
      ["Neutral", o.colors.neutral],
      ["Pendukung", o.colors.extra],
      ["Primary (gelap)", o.colors.pd],
      ["Accent (gelap)", o.colors.ad],
    ]
      .map(([l, c]) => `<div class="sw"><span style="background:${c}"></span><b>${l}</b><code>${c}</code></div>`)
      .join("")}
  </div>
  <dl class="notes">
    <dt>Typeface</dt><dd><span class="font-demo">${o.font}</span>, open source (Google Fonts). Dipakai untuk UI dan judul; wordmark tetap digambar custom.</dd>
    <dt>Bahasa bentuk</dt><dd>${o.shape}</dd>
    <dt>Turunan ke UI</dt><dd>${o.system}</dd>
  </dl>
</section>`;

const scoreCell = (o, k) => {
  const v = o.scores[k];
  const was = o.firstScores?.[k];
  return `<td class="s${v}">${was && was !== v ? `<s>${was}</s> ` : ""}${v}</td>`;
};

const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jadinya Logo Exploration</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700&family=Manrope:wght@500;700&family=Archivo:wght@500;700&family=Figtree:wght@500;700&family=DM+Sans:wght@500;700&display=swap">
<style>
  :root { --page:#FAFAFA; --ink:#18181B; --soft:#71717A; --line:#E4E4E7; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--page); color:var(--ink); font:15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width:1180px; margin:0 auto; padding:40px 16px 96px; }
  h1 { font-size:32px; margin:0 0 8px; letter-spacing:-.02em; }
  h2 { font-size:24px; margin:0; letter-spacing:-.01em; }
  h3 { font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:var(--soft); margin:28px 0 10px; font-weight:600; }
  p.lede { color:var(--soft); max-width:720px; margin:0 0 32px; }
  .light { --p:var(--P); --a:var(--A); background:#FFFFFF; color:#18181B; }
  .dark { --p:var(--Pd); --a:var(--Ad); background:#111113; color:#F4F4F5; }
  .mono-l { --p:#000; --a:#000; background:#fff; }
  .mono-d { --p:#fff; --a:#fff; background:#000; }
  .tile { border:1px solid var(--line); border-radius:12px; display:flex; align-items:center; justify-content:center; padding:20px; }
  .dark.tile, .mono-d.tile { border-color:#27272A; }
  .tile.inline { display:inline-flex; padding:6px; vertical-align:middle; border-radius:8px; }
  svg { display:block; overflow:visible; }

  /* comparison */
  .compare { display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:10px; }
  .compare .col { display:flex; flex-direction:column; gap:10px; min-width:0; }
  .compare .tile { padding:16px 8px; min-height:120px; }
  .compare .strip { display:flex; align-items:center; justify-content:center; gap:14px; min-height:84px; }
  .compare .label { font-size:13px; font-weight:600; text-align:center; }
  .compare .lk svg { max-width:100%; height:auto; }
  @media (max-width: 900px) { .compare { grid-template-columns:repeat(2, minmax(0,1fr)); } }

  /* combo */
  .combo { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px; margin-top:20px; }
  .combo .col { display:flex; flex-direction:column; gap:10px; min-width:0; }
  .combo .label { font-size:13px; font-weight:600; text-align:center; }
  .combo .tile { min-height:110px; padding:16px; }
  .combo .tile.small { min-height:70px; gap:20px; }
  .combo svg { max-width:100%; height:auto; }
  .combo .mock { margin:0; }
  .combo .nav { padding:12px 14px; }
  .combo .nav button { margin-left:auto; }
  @media (max-width: 800px) { .combo { grid-template-columns:1fr; } }

  /* option */
  .opt { border-top:1px solid var(--line); margin-top:56px; padding-top:32px; }
  .opt-head { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
  .opt-head .num { font:700 13px/1 ui-monospace, monospace; color:var(--soft); }
  .opt-head .type { margin:2px 0 0; color:var(--soft); font-size:13px; }
  .opt-head div { flex:1; min-width:200px; }
  .files { font:12px ui-monospace, monospace; color:var(--ink); border:1px solid var(--line); border-radius:6px; padding:4px 8px; text-decoration:none; background:#fff; }
  .stage { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:20px; }
  .stage .hero { min-height:200px; }
  .stage svg { max-width:100%; height:auto; }
  @media (max-width: 700px) { .stage { grid-template-columns:1fr; } }
  .sizes { display:flex; align-items:flex-end; gap:32px; padding:20px 24px; border-radius:12px; border:1px solid var(--line); overflow-x:auto; margin-bottom:10px; }
  .sizes.dark { border-color:#27272A; }
  .sizes figure { margin:0; display:flex; flex-direction:column; align-items:center; gap:8px; }
  .sizes figcaption { font:11px ui-monospace, monospace; opacity:.55; }
  .note { font-size:13px; color:var(--soft); }
  .row2 { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
  @media (max-width: 800px) { .row2 { grid-template-columns:1fr; } }
  .icons { display:flex; flex-wrap:wrap; align-items:flex-end; gap:14px; }
  .app { border-radius:22.5%; display:flex; align-items:center; justify-content:center; }
  .app.ink { background:var(--P); --p:#fff; --a:var(--Ad); }
  .app.acc { background:var(--A); --p:#fff; --a:#fff; }
  .app.paper { background:#fff; border:1px solid var(--line); --p:var(--P); --a:var(--A); }
  .monos { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .monos .tile { min-height:90px; }
  .monos svg { max-width:100%; height:auto; }
  .mock { border:1px solid var(--line); border-radius:12px; overflow:hidden; margin-bottom:10px; font-family:var(--font), system-ui, sans-serif; }
  .mock.dark { border-color:#27272A; }
  .nav { display:flex; align-items:center; gap:24px; padding:14px 20px; border-bottom:1px solid rgba(127,127,127,.18); }
  .nav nav { display:flex; gap:20px; font-size:14px; font-weight:500; margin-left:auto; opacity:.8; }
  .nav button { font:600 14px var(--font), system-ui, sans-serif; background:var(--a); color:#fff; border:0; border-radius:999px; padding:9px 16px; }
  .mock-body { padding:28px 20px 32px; }
  .mock-body .eyebrow { margin:0 0 6px; font-size:12px; letter-spacing:.06em; text-transform:uppercase; opacity:.6; }
  .mock-body .h { margin:0; font-size:30px; font-weight:700; letter-spacing:-.02em; }
  @media (max-width: 700px) { .nav nav { display:none; } .nav button { margin-left:auto; } }
  .notes { display:grid; grid-template-columns:170px 1fr; gap:8px 20px; margin:20px 0 0; }
  .notes dt { font-weight:600; }
  .notes dd { margin:0; color:#3F3F46; }
  @media (max-width: 700px) { .notes { grid-template-columns:1fr; } .notes dd { margin-bottom:8px; } }
  .palette { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px,1fr)); gap:10px; }
  .sw { display:flex; flex-direction:column; gap:2px; font-size:12px; }
  .sw span { height:52px; border-radius:10px; border:1px solid rgba(0,0,0,.08); margin-bottom:6px; }
  .sw code { color:var(--soft); }
  .font-demo { font-family:var(--font); font-weight:700; font-size:17px; }

  /* tables & lists */
  table { border-collapse:collapse; width:100%; font-size:14px; }
  th, td { border-bottom:1px solid var(--line); padding:10px 8px; text-align:left; }
  td[class^="s"] { text-align:center; font-weight:600; font-variant-numeric:tabular-nums; }
  td s { color:#A1A1AA; font-weight:400; }
  .s2 { background:#FEE2E2; } .s3 { background:#FEF9C3; } .s4 { background:#ECFCCB; } .s5 { background:#D9F99D; }
  .table-wrap { overflow-x:auto; }
  ol.ideas { columns:2; column-gap:40px; padding-left:20px; }
  ol.ideas li { break-inside:avoid; margin-bottom:6px; }
  ol.ideas li.pick { font-weight:600; }
  @media (max-width: 700px) { ol.ideas { columns:1; } }
  .verdict { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:20px; }
  .verdict > div { border:1px solid var(--line); border-radius:12px; padding:20px; background:#fff; }
  .verdict b.tag { display:inline-block; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--soft); margin-bottom:6px; }
  @media (max-width: 700px) { .verdict { grid-template-columns:1fr; } }
</style>
</head>
<body>
<main>
  <h1>Jadinya: eksplorasi logo</h1>
  <p class="lede">Lima arah logo yang diturunkan dari esensi produk (prompt → proses → hasil yang jadi), bukan dari UI yang ada sekarang. Semua bentuk digambar di grid 24u dan wordmark-nya dibangun custom dari lingkaran dan garis, tanpa font.</p>

  <h3>Brief yang disepakati</h3>
  <dl class="notes" style="margin-top:0">
    <dt>Nama di logo</dt><dd>jadinya (huruf kecil, tanpa titik, tanpa .dev), artinya \"hasilnya\" atau <i>how it turned out</i></dd>
    <dt>Target</dt><dd>B2C, maker vibe coding usia 18–35, lokal Indonesia dulu, tetap netral untuk pengunjung global</dd>
    <dt>Kepribadian</dt><dd>Santai, jujur, bangga. Bukan korporat, bukan hype AI futuristik, bukan alay.</dd>
    <dt>Warna</dt><dd>Bebas dari palet lama (hijau tua, krem). Hindari gradient ungu-biru \"AI\".</dd>
    <dt>Jenis &amp; pemakaian</dt><dd>Simbol + wordmark. Favicon, header web, OG image, app icon (PWA), stiker.</dd>
    <dt>Pembeda dari</dt><dd>Product Hunt, Peerlist, galeri \"made with\" (Lovable/Bolt). Tidak ada elemen lama yang dipertahankan.</dd>
  </dl>

  <h3>Ide kasar (14), yang dipilih ditebalkan</h3>
  <ol class="ideas">${ideas.map(([t, pick]) => `<li${pick ? ' class="pick"' : ""}>${t}</li>`).join("")}</ol>

  <h3>Berdampingan</h3>
  <div class="compare">
    ${options
      .map(
        (o, n) => `<div class="col" style="${optVars(o)}">
      <div class="label">0${n + 1} · ${o.name}</div>
      <div class="tile light">${symInline(o.symbol(), 88)}</div>
      <div class="tile dark">${symInline(o.symbol(), 88)}</div>
      <div class="tile light strip">${symInline(o.symbol(), 64)}${symInline(o.symbol(), 32)}${symInline(o.symbol(), 16)}</div>
      <div class="tile dark strip">${symInline(o.symbol(), 64)}${symInline(o.symbol(), 32)}${symInline(o.symbol(), 16)}</div>
      <div class="tile light strip">${appIcon(o, 64, "ink")}${appIcon(o, 32, "ink")}${appIcon(o, 16, "ink")}</div>
      <div class="tile light lk">${lockInline(o, 26)}</div>
      <div class="tile mono-d lk">${lockInline(o, 26)}</div>
    </div>`,
      )
      .join("")}
  </div>

  ${options.map(optionSection).join("")}

  ${comboSection()}

  <section class="opt" id="kritik">
    <h2>Kritik diri</h2>
    <p class="note">Skor 1–5. Angka yang dicoret adalah skor draf pertama sebelum revisi.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Opsi</th>${aspects.map(([, l]) => `<th>${l}</th>`).join("")}<th>Total</th></tr></thead>
      <tbody>${options
        .map(
          (o, n) =>
            `<tr><td>0${n + 1} ${o.name}</td>${aspects.map(([k]) => scoreCell(o, k)).join("")}<td><b>${Object.values(o.scores).reduce((s, v) => s + v, 0)}</b></td></tr>`,
        )
        .join("")}</tbody>
    </table></div>
    <div class="verdict">
      <div><b class="tag">Rekomendasi</b><h2>04 · Lagi Ngetik</h2><p>Satu-satunya opsi yang menyatukan nama (huruf j) dan mekanisme produk (jeda obrolan yang berubah jadi hasil) dalam satu bentuk. Tetap terbaca di 16 px dan langsung memberi bahasa UI: titik sebagai penanda status, gerakan titik yang jatuh jadi j untuk loading dan sukses submit. Kesan \"aplikasi chat\" diredam lewat wordmark geometris dan animasi titik yang dipakai seperlunya.</p></div>
      <div><b class="tag">Wildcard paling berani</b><h2>05 · Nya Mengalir</h2><p>Seluruh identitas ditaruh di tipografi: tanpa simbol terpisah, ligatur ny jadi tanda tangan. Kalau berhasil, opsi ini paling mudah dimiliki. Risikonya ada di keterbacaan ligatur dan favicon yang abstrak. Jalan tengah yang layak dicoba: wordmark 05 dipasangkan dengan simbol 04.</p></div>
    </div>
  </section>
</main>
</body>
</html>
`;

writeFileSync(join(root, "index.html"), html);
console.log("wrote", options.length, "options + index.html");
