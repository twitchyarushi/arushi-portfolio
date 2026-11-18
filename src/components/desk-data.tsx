import type { ReactNode } from "react";

/*
 * Layout data, taken from the Figma "final landing" frame (1916 x 1187).
 *
 * Every top-level piece has a DESKTOP box (x, y, w in Figma px, unrotated) and a
 * MOBILE box (mx, my, mw in a 430-wide portrait layout). `ar` is the image
 * width/height, `r` the rotation in degrees and `z` the stacking order.
 */
export type Box = { x: number; y: number; w: number; mx: number; my: number; mw: number; ar: string; r?: number; z: number };
export type Sticker = Box & { src: string; tip: string };

export const STICKERS: Record<string, Sticker> = {
  matcha: { x: 1169.7, y: 305.1, w: 234.3, mx: 22, my: 450, mw: 96, ar: "451/536", r: 30.21, z: 2, src: "/scrapbook/matcha.webp", tip: "If matcha is there, I’m coming!" },
  stamp: { x: 885.2, y: 365.1, w: 279, mx: 282, my: 238, mw: 130, ar: "397/336", r: -154.03, z: 4, src: "/scrapbook/stamp.webp", tip: "Emirates" },
  plate: { x: 479.6, y: 345.6, w: 400.2, mx: 190, my: 340, mw: 230, ar: "560/298", z: 5, src: "/scrapbook/plate.webp", tip: "F1" },
  cats: { x: 1455, y: 232.1, w: 230.5, mx: 332, my: 445, mw: 78, ar: "235/491", r: -18.52, z: 6, src: "/scrapbook/cats.webp", tip: "cats" },
  girl: { x: 159, y: 230.4, w: 387.2, mx: 14, my: 236, mw: 250, ar: "665/375", z: 8, src: "/scrapbook/girl.webp", tip: "me" },
};

export const BUNNY: Sticker = { x: 193.4, y: 812.4, w: 276.1, mx: 6, my: 845, mw: 128, ar: "500/478", z: 7, src: "/scrapbook/bunny.webp", tip: "" };

export const BANNER: Box = { x: 687, y: 4, w: 575, mx: 65, my: 76, mw: 300, ar: "575/302", z: 14 };
export const SIGNATURE: Box = { x: 728, y: 72, w: 473, mx: 86.4, my: 111.5, mw: 246.8, ar: "473/161", z: 15 };

/* The denim patch with the skill logos. Logos are positioned as % of the patch. */
export const DENIM: Box = { x: 350.95, y: 525.88, w: 615.7, mx: 20, my: 565, mw: 392, ar: "324/295", z: 1 };

/* The pad (torn paper + grid sheet + folders + tape + coconut) is one box; children are % of it. */
export const PAD = { x: 968, y: 519, w: 662, h: 575, mx: 40, my: 910, mw: 380 };
const px = (v: number) => `${(((v - PAD.x) / PAD.w) * 100).toFixed(3)}%`;
const py = (v: number) => `${(((v - PAD.y) / PAD.h) * 100).toFixed(3)}%`;
const pw = (v: number) => `${((v / PAD.w) * 100).toFixed(3)}%`;
export const padPos = (x: number, y: number, w: number) => ({ left: px(x), top: py(y), width: pw(w) });

export const PAD_PAPER = { ...padPos(981.6, 538, 563.7), aspectRatio: "323/306", rotate: "3deg", zIndex: 3 };
export const PAD_SHEET = { ...padPos(1029.2, 543.6, 510.2), aspectRatio: "510.2/524.7", rotate: "5.63deg", zIndex: 9 };
export const PAD_TAPE = { ...padPos(1160.5, 531.1, 328.6), aspectRatio: "224/61", zIndex: 12 };
export const PAD_COCONUT = { ...padPos(1467.9, 880.9, 160.1), aspectRatio: "188/224", zIndex: 11 };

export const FOLDERS = ["work", "projects", "research", "resume", "contact"] as const;
export type FolderId = (typeof FOLDERS)[number];
export const FOLDER_POS: Record<FolderId, { x: number; y: number }> = {
  work: { x: 1074.3, y: 669.3 },
  projects: { x: 1228.9, y: 682.3 },
  research: { x: 1390.7, y: 699.5 },
  resume: { x: 1150, y: 826 },
  contact: { x: 1312, y: 846 },
};
export const FOLDER_W = 109;

/* Skill logos on the denim. cx, cy = logo centre in Figma px; the patch converts them to %.
 * Three rows (4 / 4 / 3), centred on the patch (x = 659). The sticky note opens below them. */
const TILE = 80;
const COL = [472.5, 597.5, 722.5, 847.5];
const COL3 = [535, 660, 785];
const ROW = [700, 806, 912];
export const TOOLS = [
  { id: "pytorch", label: "PyTorch", logo: "/logos/pytorch.webp", cx: COL[0], cy: ROW[0], note: "Built CNN models for image recognition and object detection." },
  { id: "tensorflow", label: "TensorFlow", logo: "/logos/tensorflow.webp", cx: COL[1], cy: ROW[0], note: "Applied deep learning and hyperparameter tuning to improve model performance." },
  { id: "powerbi", label: "Power BI", logo: "/logos/powerbi.webp", cx: COL[2], cy: ROW[0], note: "Developed interactive dashboards for sales performance and business insights." },
  { id: "docker", label: "Docker", logo: "/logos/docker.webp", zoom: 1.2, cx: COL[3], cy: ROW[0], note: "Used containerized environments for backend development." },
  { id: "git", label: "Git", logo: "/logos/git.webp", cx: COL[0], cy: ROW[1], note: "Managed version control and code reviews while coordinating a team." },
  { id: "sqlserver", label: "SQL Server", logo: "/logos/sqlserver.webp", cx: COL[1], cy: ROW[1], note: "Developed and optimized stored procedures for an enterprise asset tracking system." },
  { id: "postgres", label: "PostgreSQL", logo: "/logos/postgres.webp", cx: COL[2], cy: ROW[1], note: "Managed database schemas, migrations and production operations." },
  { id: "react", label: "React", logo: "/logos/react.webp", cx: COL[3], cy: ROW[1], note: "Built frontend experiences through Next.js and TypeScript development." },
  { id: "javascript", label: "JavaScript", logo: "/logos/javascript.webp", cx: COL3[0], cy: ROW[2], note: "Developed dynamic web functionality and interactive user experiences." },
  { id: "python", label: "Python", logo: "/logos/python.webp", cx: COL3[1], cy: ROW[2], note: "Automated product data extraction and processing using Selenium." },
  { id: "java", label: "Java", logo: "/logos/java.webp", cx: COL3[2], cy: ROW[2], note: "Applied object-oriented programming and problem-solving to software development." },
] as const;

/* patch height = width / 1.0983 (the denim art is 324 x 295) */
const PATCH_H = DENIM.w / 1.0983;
export const tilePos = (t: { cx: number; cy: number }) => ({
  left: `${(((t.cx - TILE / 2 - DENIM.x) / DENIM.w) * 100).toFixed(3)}%`,
  top: `${(((t.cy - TILE / 2 - DENIM.y) / PATCH_H) * 100).toFixed(3)}%`,
  width: `${((TILE / DENIM.w) * 100).toFixed(3)}%`,
});

/* The "SKILLS" name plate sewn onto the top edge of the denim. */
export const NAMEPLATE = { cx: 659, cy: 602, w: 272, h: 74 };
export const nameplatePos = () => ({
  left: `${(((NAMEPLATE.cx - NAMEPLATE.w / 2 - DENIM.x) / DENIM.w) * 100).toFixed(3)}%`,
  top: `${(((NAMEPLATE.cy - NAMEPLATE.h / 2 - DENIM.y) / PATCH_H) * 100).toFixed(3)}%`,
  width: `${((NAMEPLATE.w / DENIM.w) * 100).toFixed(3)}%`,
  aspectRatio: `${NAMEPLATE.w}/${NAMEPLATE.h}`,
});

const link = (href: string, label: string) => (
  <a className="lnk" href={href} target="_blank" rel="noopener noreferrer">{label}</a>
);
const stack = (t: string) => <p className="stack"><span>Tech Stack:</span> {t}</p>;

/* ---------- Notepad pages (tabs: colours from Figma) ---------- */
export type Page = { title: string; sub: string; tab: string; body: ReactNode };
export const PAGES: Record<FolderId, Page> = {
  work: {
    title: "Work", sub: "internships and roles", tab: "#a64b43",
    body: (
      <>
        <details className="acc" open><summary><span><b>Prarabdha Info Solutions</b><i>Full-Stack Developer Intern · Feb 2026 – now</i></span></summary><p>Led a team of 3 interns. Built FamilyScript features in Next.js and TypeScript, the family tree APIs, and the admin dashboard backend on Prisma, PostgreSQL and Docker.</p></details>
        <details className="acc"><summary><span><b>NFPC</b><i>Intern · Jul 2026</i></span></summary><p>Power Apps and Power Automate workflows, Power BI sales dashboards, and an AI recipe recommender.</p></details>
        <details className="acc"><summary><span><b>Lulu Retail Holdings</b><i>Software Engineering Intern · Jul – Aug 2025</i></span></summary><p>Scraped competitor products from Amazon, Carrefour and Noon with Python and Selenium.</p></details>
        <details className="acc"><summary><span><b>Data Capture Systems</b><i>Web Developer Intern · Jul – Aug 2025</i></span></summary><p>Built an asset tracking system with 15+ API routes, in Angular and .NET.</p></details>
        <p className="fine">Also: GDG on Campus mentor (AR, 20 students) · IGDTUW summer intern (CNN vision models)</p>
      </>
    ),
  },
  projects: {
    title: "Projects", sub: "things I’ve built", tab: "#d9c8cf",
    body: (
      <>
        <div className="entry"><b>FamilyScript</b><p>An AI-powered family storytelling platform featuring interactive family trees and digital legacy preservation.</p>{stack("Next.js, TypeScript, Prisma, PostgreSQL, GSAP")}{link("https://familyscript.com", "familyscript.com")}</div>
        <div className="entry"><b>Smart Pantry</b><p>An AI-powered pantry companion for ingredient tracking, recipe discovery and shopping lists.</p>{stack("Flutter, Dart, Firebase, Riverpod, Gemini API")}{link("https://github.com/twitchyarushi/smart-pantry", "GitHub")}</div>
        <div className="entry"><b>Smart Market Watchlist</b><p>A web application for tracking and organising market watchlists.</p>{stack("Next.js, TypeScript")}{link("https://github.com/twitchyarushi/smart-market-watchlist", "GitHub")}</div>
        <div className="entry"><b>Student Intel</b><p>A university-focused professor review platform for sharing student experiences and ratings.</p>{stack("Node.js, Express.js, Angular, SQL")}{link("https://github.com/twitchyarushi/the-student-intel", "GitHub")}</div>
        <div className="entry"><b>Pink Neurons</b><p>An NLP-powered video generator that transforms natural language prompts into animated educational videos.</p>{stack("Python, Manim, Gemini API")}{link("https://github.com/twitchyarushi/pink_neurons-", "GitHub")}</div>
      </>
    ),
  },
  research: {
    title: "Research", sub: "papers and experiments", tab: "#c9d3c0",
    body: (
      <>
        <div className="entry"><b>Sign Language Recognition System</b><i>ICICC 2025, co-author</i><p>Real-time ASL recognition with CNNs and transfer learning, 97% accuracy.</p>{link("https://link.springer.com/chapter/10.1007/978-981-96-6715-4_31", "Read the paper")}</div>
        <div className="entry"><b>Quantum research</b><i>In progress</i><p>Learning and building with Qiskit.</p></div>
      </>
    ),
  },
  resume: {
    title: "Resume", sub: "the full story, one page", tab: "#f0d9b5",
    body: (
      <>
        <p>My experience, projects and research on a single page.</p>
        <a className="btn" href="/Arushi_Resume.pdf" download>Download resume (PDF)</a>
      </>
    ),
  },
  contact: {
    title: "Contact", sub: "say hello", tab: "#e3c2c0",
    body: (
      <p>
        Email: <a className="lnk" href="mailto:arushis3139@gmail.com">arushis3139@gmail.com</a><br />
        LinkedIn: {link("https://www.linkedin.com/in/arushi-manoj-131545292/", "arushi-manoj")}<br />
        GitHub: {link("https://github.com/twitchyarushi", "twitchyarushi")}
      </p>
    ),
  },
};

/* ---------- Sticker pop-ups (the envelope) ---------- */
export type Card = { title: string; body: ReactNode };
/* Which screen edge each envelope slides in from: right, left, bottom-right, top-left */
export const CARD_SIDE: Record<string, "r" | "l" | "br" | "tl"> = {
  stamp: "r", plate: "r", matcha: "l", cats: "l", girl: "br", coconut: "tl",
};
export const CARDS: Record<string, Card> = {
  girl: {
    title: "About me",
    body: (
      <>
        <p>
          A software developer who loves creating as much as engineering.
          I enjoy building things from the ground up, whether that's an
          interactive frontend, a thoughtfully structured backend, or an
          idea that's been sitting in my head for far too long.
        </p>

        <p>
          <strong>Fun fact:</strong> I've spent over a decade training in
          Bharatanatyam and Carnatic music, so creativity has always been a
          big part of my life. Of course, the creative juices run dry
          sometimes — that's when I turn to my novels or lose a few hours
          scrolling through Pinterest.
        </p>

        <p>
          <em>Psst... click the other stickers to know more about me!</em>
        </p>
      </>
    ),
  },
  stamp: {
    title: "My first home",
    body: (
      <>
        <p>
          Born and raised in Abu Dhabi, I love this place to death. It’s my
          favourite place to return to after a long semester, spend time with
          family and friends, and most importantly, eat REALLY good food.
        </p>

        <p>
          <strong>Some of my favourites:</strong> Bain Al Jessrain shawarma,
          Lacnor banana milk, Cheetos (the export edition, obviously), and
          pretty much anything from Lulu because somehow everything hits the
          spot. (can u tell my dad spoils me)
        </p>

        <figure>
          <img src="/scrapbook/abu-dhabi-gp.webp" alt="Me as a kid in a red toy Formula 1 car on a little race track" loading="lazy" />
          <figcaption>AND ARUSHI WINS THE 2011 ABU DHABI GRAND PRIX!</figcaption>
        </figure>
      </>
    ),
  },
  coconut: {
    title: "God’s Own Country 🌴",
    body: (
      <>
        <p><em>Ah, Malayali aano?</em></p>

        <p>
          Kerala was where I spent so much of my childhood making memories with
          my cousins. As a kid, I wasn’t the biggest fan of the lack of
          facilities, but funny how things change — now I find myself missing
          the greenery, the slower pace, and all the little things I probably
          took for granted.
        </p>

        <p>
          And of course, no conversation about Kerala is complete without food.
          My forever favourite has to be Thalassery chicken biryani.
        </p>

        <p>P.S. Nothing beats Amma’s biryani though ♡</p>

        <figure>
          <img src="/scrapbook/amma-biryani.webp" alt="A steel plate of Amma’s biryani with onion raita on the side" loading="lazy" />
        </figure>
      </>
    ),
  },
  plate: { title: "F1", body: <><p>I like F1.</p><p className="muted">Live standings coming soon.</p></> },
  cats: { title: "Cats", body: <><p>I love cats.</p><p className="muted">Cat game coming soon.</p></> },
  matcha: { title: "Matcha", body: <><p>I love matcha.</p><p className="muted">Matcha game coming soon.</p></> },
};
