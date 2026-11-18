"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  BANNER, BUNNY, CARDS, CARD_SIDE, DENIM, FOLDERS, FOLDER_POS, FOLDER_W, PAD, PAD_COCONUT, PAD_PAPER, PAD_SHEET, PAD_TAPE,
  NAMEPLATE, PAGES, SIGNATURE, STICKERS, TOOLS, nameplatePos, padPos, tilePos, type Box, type FolderId,
} from "./desk-data";
import CatGame from "./cat-game/CatGame";
import PawBadges from "./cat-game/PawBadges";
import F1Modal from "./f1/F1Modal";
import MatchaGame from "./matcha/MatchaGame";

type Open = { k: "pad"; tab: FolderId } | { k: "card"; id: string } | { k: "tool"; id: string } | { k: "game" } | { k: "f1" } | { k: "matcha" } | null;

/* Figma px (desktop) and 430-wide units (mobile) → CSS custom properties, resolved in scrapbook.css */
const at = (b: Box): CSSProperties =>
  ({ "--x": b.x, "--y": b.y, "--w": b.w, "--mx": b.mx, "--my": b.my, "--mw": b.mw, "--ar": b.ar, "--r": `${b.r ?? 0}deg`, zIndex: b.z }) as CSSProperties;

function FolderIcon() {
  return (
    <svg viewBox="0 0 100 83.3" aria-hidden="true">
      <path d="M5 16a6 6 0 0 1 6-6h24l8 10h46a6 6 0 0 1 6 6v47a6 6 0 0 1-6 6H11a6 6 0 0 1-6-6z" fill="#a64b43" />
      <ellipse cx="42" cy="38" rx="4" ry="10" fill="#f6e9e0" />
      <ellipse cx="58" cy="38" rx="4" ry="10" fill="#f6e9e0" />
      <circle cx="50" cy="56" r="15" fill="#f6e9e0" />
    </svg>
  );
}

/* A sewn-on linen label: cream cloth, pinked edge, rust running stitch, embroidered caps. */
function NamePlate() {
  const { w, h } = NAMEPLATE;
  const pink = (() => {
    /* zig-zag "pinking shears" edge around a rectangle */
    const t = 3.2, pts: string[] = [];
    for (let x = 0; x <= w; x += t * 2) { pts.push(`${x},0`, `${x + t},${t}`); }
    for (let y = t; y <= h; y += t * 2) { pts.push(`${w},${y}`, `${w - t},${y + t}`); }
    for (let x = w; x >= 0; x -= t * 2) { pts.push(`${x},${h}`, `${x - t},${h - t}`); }
    for (let y = h - t; y >= 0; y -= t * 2) { pts.push(`0,${y}`, `${t},${y - t}`); }
    return pts.join(" ");
  })();
  return (
    <svg className="nameplate" style={nameplatePos()} viewBox={`0 0 ${w} ${h}`} role="heading" aria-level={2} aria-label="Skills">
      <defs>
        <pattern id="np-weave" width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M0 .5h3M.5 0v3" stroke="#8a6f55" strokeWidth=".35" opacity=".22" />
        </pattern>
        <linearGradient id="np-cloth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf4e4" /><stop offset="1" stopColor="#efe2c6" />
        </linearGradient>
        <filter id="np-lift" x="-10%" y="-20%" width="120%" height="150%">
          <feDropShadow dx="0" dy="2.2" stdDeviation="2.2" floodColor="#1d2a44" floodOpacity=".45" />
        </filter>
      </defs>
      <g filter="url(#np-lift)">
        <polygon points={pink} fill="url(#np-cloth)" />
        <polygon points={pink} fill="url(#np-weave)" />
      </g>
      {/* running stitch */}
      <rect x="9" y="9" width={w - 18} height={h - 18} rx="5" fill="none" stroke="#a64b43" strokeWidth="1.8" strokeDasharray="7 4.5" strokeLinecap="round" />
      <rect x="14.5" y="14.5" width={w - 29} height={h - 29} rx="3" fill="none" stroke="#a64b43" strokeWidth=".7" opacity=".55" />
      {/* little diamonds either side of the word */}
      {[40, w - 40].map((x) => (
        <path key={x} d={`M${x} ${h / 2 - 5}l4.5 5-4.5 5-4.5-5z`} fill="#a64b43" />
      ))}
      {[27, w - 27].map((x) => <circle key={x} cx={x} cy={h / 2} r="1.8" fill="#a64b43" opacity=".7" />)}
      {/* embroidered word: pale highlight, dark body */}
      <text x={w / 2 + 5} y={h / 2 + 1} dy=".36em" textAnchor="middle" className="np-word" fill="#fff8e8" opacity=".9" transform="translate(0 1.1)">SKILLS</text>
      <text x={w / 2 + 5} y={h / 2 + 1} dy=".36em" textAnchor="middle" className="np-word" fill="#49372f">SKILLS</text>
    </svg>
  );
}

export default function Desk() {
  const [open, setOpen] = useState<Open>(null);
  const girl = useRef<HTMLSpanElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  const show = useCallback((o: NonNullable<Open>) => {
    if (!returnFocus.current) returnFocus.current = document.activeElement as HTMLElement | null;
    setOpen(o);
  }, []);
  const close = useCallback(() => {
    setOpen(null);
    returnFocus.current?.focus?.({ preventScroll: true });
    returnFocus.current = null;
  }, []);

  /* eyes follow the cursor (and touch) */
  useEffect(() => {
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const move = (e: PointerEvent) => {
      const g = girl.current;
      if (!g) return;
      const r = g.getBoundingClientRect();
      const span = Math.max(r.width, 1);
      g.style.setProperty("--dx", String(clamp((e.clientX - r.left - r.width / 2) / (span * 1.1))));
      const dy = clamp((e.clientY - r.top - r.height / 2) / (span * 0.8));
      g.style.setProperty("--ty", String(dy < 0 ? dy * 1.8 : dy * 0.4)); /* looks up further than down */
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", move, { passive: true });
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerdown", move); };
  }, []);

  /* esc closes; tapping outside the sticky note closes it; lock scroll behind modals */
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const outside = (e: PointerEvent) => {
      if (open.k !== "tool") return;
      const t = e.target as HTMLElement;
      if (!t.closest(".sticky") && !t.closest(".tool")) close();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", outside);
    const modal = open.k !== "tool";
    if (modal) document.body.style.overflow = "hidden";
    dialog.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", outside);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  const sticker = (id: string, extra?: { tilt?: string }) => {
    const s = STICKERS[id];
    const on = (open?.k === "card" && open.id === id) || (id === "cats" && open?.k === "game");
    return (
      <button
        key={id} className={`item at${on ? " on" : ""}`} data-tip={s.tip} aria-label={s.tip} style={{ ...at(s), "--tilt": extra?.tilt ?? "-5deg" } as CSSProperties}
        onClick={() => (on ? close() : show(id === "cats" ? { k: "game" } : id === "plate" ? { k: "f1" } : id === "matcha" ? { k: "matcha" } : { k: "card", id }))}
      >
        <span className="rot">
          {id === "girl" ? (
            <span className="gl" ref={girl}>
              <img src={s.src} alt="" draggable={false} />
              <span className="pm"><img src="/scrapbook/pupils.webp" alt="" draggable={false} /></span>
            </span>
          ) : (
            <img src={s.src} alt="" draggable={false} />
          )}
        </span>
      </button>
    );
  };

  const tool = open?.k === "tool" ? TOOLS.find((t) => t.id === open.id) : undefined;
  const page = open?.k === "pad" ? PAGES[open.tab] : undefined;
  const card = open?.k === "card" ? CARDS[open.id] : undefined;

  return (
    <div className="desk">
      {/* torn-paper corners */}
      <div className="torn tl">
        <img src="/scrapbook/torn-tl.png" alt="" />
        <p>Software Development · AI/ML · Data Analytics</p>
      </div>
      <nav className="torn br" aria-label="Quick links">
        <img src="/scrapbook/torn-br.png" alt="" />
        <button style={{ left: "calc(82*var(--p))" }} onClick={() => show({ k: "pad", tab: "resume" })}>Resume</button>
        <button style={{ left: "calc(207*var(--p))" }} onClick={() => show({ k: "pad", tab: "contact" })}>Contact</button>
      </nav>
      <div className={`torn br paws-layer${open?.k === "game" ? " lit" : ""}`}>
        <img src="/scrapbook/torn-br.png" alt="" style={{ visibility: "hidden" }} />
        <PawBadges />
      </div>

      <main className="stage">
        <h1 className="sr">Arushi Shree Manoj</h1>

        {/* denim patch + skill logos */}
        <div className="patch at" style={at(DENIM)}>
          <img className="bg" src="/scrapbook/denim.webp" alt="" draggable={false} />
          <NamePlate />
          {TOOLS.map((t) => (
            <button
              key={t.id} className="tool" aria-label={t.label} aria-pressed={open?.k === "tool" && open.id === t.id}
              style={tilePos(t)}
              onClick={() => (open?.k === "tool" && open.id === t.id ? close() : show({ k: "tool", id: t.id }))}
            >
              <img src={t.logo} alt="" draggable={false} style={"zoom" in t ? { scale: t.zoom } : undefined} />
            </button>
          ))}
        </div>

        {sticker("matcha", { tilt: "-4deg" })}

        {/* the pad: torn paper, grid sheet, folders, tape, coconut (children keep the Figma stacking order) */}
        <div className="pad at" style={{ "--x": PAD.x, "--y": PAD.y, "--w": PAD.w, "--mx": PAD.mx, "--my": PAD.my, "--mw": PAD.mw, "--ar": `${PAD.w}/${PAD.h}` } as CSSProperties}>
          <img className="abs" src="/scrapbook/paper.webp" alt="" draggable={false} style={PAD_PAPER} />
          <div className="abs sheet" style={PAD_SHEET} />
          {FOLDERS.map((f, i) => (
            <button
              key={f} className="fold" onClick={() => show({ k: "pad", tab: f })}
              style={{ ...padPos(FOLDER_POS[f].x, FOLDER_POS[f].y, FOLDER_W), zIndex: 10, "--tilt": i % 2 ? "-6deg" : "5deg" } as CSSProperties}
            >
              <FolderIcon />
              <span>{PAGES[f].title}</span>
            </button>
          ))}
          <button className={`item abs${open?.k === "card" && open.id === "coconut" ? " on" : ""}`} data-tip="Kerala" aria-label="Kerala" style={{ ...PAD_COCONUT, "--tilt": "7deg" } as CSSProperties} onClick={() => (open?.k === "card" && open.id === "coconut" ? close() : show({ k: "card", id: "coconut" }))}>
            <span className="rot"><img src="/scrapbook/coconut.webp" alt="" draggable={false} /></span>
          </button>
          <img className="abs" src="/scrapbook/tape.webp" alt="" draggable={false} style={{ ...PAD_TAPE, rotate: "-1.5deg" }} />
        </div>

        {sticker("stamp", { tilt: "6deg" })}
        {sticker("plate", { tilt: "-3deg" })}
        {sticker("cats", { tilt: "6deg" })}
        <div className="deco at" aria-hidden="true" style={at(BUNNY)}><img src={BUNNY.src} alt="" draggable={false} /></div>
        {sticker("girl", { tilt: "-3deg" })}

        {/* name banner */}
        <div className="deco at" aria-hidden="true" style={at(BANNER)}><img src="/scrapbook/banner.png" alt="" draggable={false} /></div>
        <div className="deco at" style={at(SIGNATURE)}><img src="/scrapbook/signature.png" alt="Arushi Manoj" draggable={false} /></div>

        {tool && (
          <aside className="sticky" role="status" key={tool.id}>
            <i className="tape" aria-hidden="true" />
            <b>{tool.label}</b>
            <p>{tool.note}</p>
            <button className="x" aria-label="Close note" onClick={close}>×</button>
          </aside>
        )}
      </main>

      {/* notepad */}
      {page && open?.k === "pad" && (
        <div className="ov" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="np" role="dialog" aria-modal="true" aria-label={page.title} tabIndex={-1} ref={dialog}>
            <div className="np-tabs" role="tablist" aria-label="Sections">
              {FOLDERS.map((f) => (
                <button
                  key={f} role="tab" aria-selected={open.tab === f} className="np-tab"
                  style={{ background: open.tab === f ? "#a64b43" : PAGES[f].tab, color: open.tab === f ? "#f7efde" : "#3b3140" }}
                  onClick={() => setOpen({ k: "pad", tab: f })}
                >
                  {PAGES[f].title}
                </button>
              ))}
            </div>
            <img className="np-paper" src="/scrapbook/notepad-paper.png" alt="" draggable={false} />
            <div className="np-sheet" key={open.tab} role="tabpanel">
              <button className="x" aria-label="Close" onClick={close}>×</button>
              <h2>{page.title}</h2>
              <p className="sub">{page.sub}</p>
              <div className="np-body">{page.body}</div>
              <p className="hint">esc or click outside to close</p>
            </div>
            <img className="np-clip" src="/scrapbook/clip.png" alt="" draggable={false} />
          </div>
        </div>
      )}

      {/* envelope: slides in from a screen edge; the chosen sticker stays lit above the dim layer */}
      {card && open?.k === "card" && (
        <div className="ov card" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className={`env ${CARD_SIDE[open.id] ?? "r"}`} key={open.id} role="dialog" aria-modal="true" aria-label={card.title} tabIndex={-1} ref={dialog}>
            <img src="/scrapbook/envelope.png" alt="" draggable={false} />
            <div className="env-txt">
              <h2>{card.title}</h2>
              {card.body}
            </div>
          </div>
        </div>
      )}

      {open?.k === "game" && <CatGame onClose={close} />}
      {open?.k === "f1" && <F1Modal onClose={close} />}
      {open?.k === "matcha" && <MatchaGame onClose={close} />}
    </div>
  );
}