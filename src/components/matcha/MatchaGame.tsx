"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import "../cat-game/cat-game.css"; // shell: .cg-ov .cg-wrap .cg .cg-x .cg-btn
import "./Matcha.css";
import Froth from "./Froth";
import {
  BOWL_FIT, IMAGE_ASPECT, IMAGES, JUG_SPOUT, PANEL_RATIO, POUR_TILT_DEG, SCENE, SIEVE_DROP, SIEVE_FIT, STEPS,
  SURFACE, TITLE, WHISK_ANCHOR, WHISK_HINT, WHISK_ROTATE_DEG, WHISK_W, ZONE, type ImageId,
} from "./config";
import { clampToEllipse, formatTime, visuals } from "./MatchaLogic";
import { useMatcha } from "./useMatcha";

/* ---------- Scene geometry. Panel width = 1 unit; panel height = HN units. ---------- */
const HN = 1 / PANEL_RATIO;
const pct = (n: number) => `${n * 100}%`;

const bowlW = SCENE.bowl.w;
const bowlH = bowlW / IMAGE_ASPECT.bowl;
const bowlTop = SCENE.bowl.cy * HN - bowlH / 2;
/** The drink's surface oval in panel units. */
const SURF = {
  cx: SCENE.bowl.cx + (SURFACE.cx - 0.5) * bowlW,
  cy: bowlTop + SURFACE.cy * bowlH,
  rx: SURFACE.rx * bowlW,
  ry: SURFACE.ry * bowlH,
};
/** How far the powder dots fall, as a percentage of the sieve box height (from SIEVE_DROP down to the drink surface). */
const SIEVE_H = SCENE.sieve.w / IMAGE_ASPECT.sieve;
const DROP_LEN = ((SURF.cy - (SCENE.sieve.cy * HN - SIEVE_H / 2 + SIEVE_DROP.y * SIEVE_H)) / SIEVE_H) * 100;

/** Centre-anchored box: x/y/w are fractions of the panel; ratio is the image's width / height. */
const place = (cx: number, cy: number, w: number, ratio: number): CSSProperties => ({
  left: pct(cx), top: pct(cy), width: pct(w), aspectRatio: String(ratio), transform: "translate(-50%, -50%)",
});

/** Spout tip in panel units after the pitcher tilts about its centre. */
function spoutPoint(tiltDeg: number) {
  const w = SCENE.pitcher.w;
  const vx = (JUG_SPOUT.x - 0.5) * w;
  const vy = (JUG_SPOUT.y - 0.5) * (w / IMAGE_ASPECT.pitcher);
  const t = (tiltDeg * Math.PI) / 180;
  return {
    x: SCENE.pitcher.cx + vx * Math.cos(t) - vy * Math.sin(t),
    y: SCENE.pitcher.cy * HN + vx * Math.sin(t) + vy * Math.cos(t),
  };
}

/* ---------- Pieces ---------- */
type Fit = { scale: number; dx: number; dy: number };
type Box = { left: number; top: number; w: number; h: number };

/** One image layer with a labelled fallback box if the file is missing. */
function Layer({ id, opacity = 1, fit, box }: { id: ImageId; opacity?: number; fit?: Fit; box?: Box }) {
  const [failed, setFailed] = useState(false);
  const { src, alt } = IMAGES[id];
  const style: CSSProperties = { opacity };
  if (fit) style.transform = `translate(${fit.dx * 100}%, ${fit.dy * 100}%) scale(${fit.scale})`;
  if (box) Object.assign(style, { left: pct(box.left), top: pct(box.top), width: pct(box.w), height: pct(box.h), right: "auto", bottom: "auto" });
  return failed ? (
    <span className="mt-layer mt-fb" style={style}>{alt}</span>
  ) : (
    <img className="mt-layer" src={src} alt="" draggable={false} style={style} onError={() => setFailed(true)} />
  );
}

function Sparkle({ x, y, s, delay = 0 }: { x: number; y: number; s: number; delay?: number }) {
  return (
    <path
      className="mt-spark" style={{ animationDelay: `${delay}s` }} vectorEffect="non-scaling-stroke"
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -1 C.12 -.16 .16 -.12 1 0 C.16 .12 .12 .16 0 1 C-.12 .16 -.16 .12 -1 0 C-.16 -.12 -.12 -.16 0 -1Z"
    />
  );
}

function Star({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`mt-star${on ? " on" : ""}`} aria-hidden="true">
      <path d="M12 2.6l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6L2.5 9.5l6.6-.8z" />
    </svg>
  );
}

/* ---------- Scenes ---------- */
/** Horizontal offsets (px) of the falling powder dots; each starts at a different point of the fall cycle. */
const DOTS = [-8, 6, -3, 9, -9, 2, 8, -5];

function SiftScene({ v, held }: { v: ReturnType<typeof visuals>; held: boolean }) {
  const sieve = SCENE.sieve;
  return (
    <>
      <div className="mt-item" style={place(SCENE.bowl.cx, SCENE.bowl.cy, bowlW, IMAGE_ASPECT.bowl)}>
        <Layer id="bowlEmpty" opacity={v.bowlEmpty} fit={BOWL_FIT.bowlEmpty} />
        <Layer id="bowlPowder" opacity={v.bowlPowder} fit={BOWL_FIT.bowlPowder} />
      </div>
      <div className={`mt-item${held ? " jig" : ""}`} style={place(sieve.cx, sieve.cy, sieve.w, IMAGE_ASPECT.sieve)}>
        {held && (
          <span className="mt-drops" aria-hidden="true" style={{ left: pct(SIEVE_DROP.x), top: pct(SIEVE_DROP.y), height: `${DROP_LEN}%` }}>
            {DOTS.map((dx, i) => (
              <i key={i} className="mt-dot" style={{ marginLeft: dx, width: 3 + (i % 3), height: 3 + (i % 3), animationDelay: `${-i * 0.11}s` }} />
            ))}
          </span>
        )}
        <Layer id="sieveEmpty" opacity={v.sieveEmpty} box={SIEVE_FIT} />
        <Layer id="sievePowder" opacity={v.sieveFull} />
      </div>
      <div className="mt-item" style={place(SCENE.scoop.cx, SCENE.scoop.cy, SCENE.scoop.w, IMAGE_ASPECT.scoop)}>
        <Layer id="scoop" />
      </div>
    </>
  );
}

function PourScene({ v, held }: { v: ReturnType<typeof visuals>; held: boolean }) {
  const spout = spoutPoint(POUR_TILT_DEG);
  const land = clampToEllipse({ x: spout.x, y: SURF.cy }, SURF);
  const top = spout.y;
  const bottom = land.y;
  const sx = spout.x;
  const tx = land.x;
  const mid = (top + bottom) / 2;
  return (
    <>
      <div className="mt-item" style={place(SCENE.bowl.cx, SCENE.bowl.cy, bowlW, IMAGE_ASPECT.bowl)}>
        <Layer id="bowlEmpty" opacity={v.bowlEmpty} fit={BOWL_FIT.bowlEmpty} />
        <Layer id="bowlPowder" opacity={v.bowlPowder} fit={BOWL_FIT.bowlPowder} />
        <Layer id="bowlLiquid" opacity={v.bowlLiquid} fit={BOWL_FIT.bowlLiquid} />
      </div>
      {/* water stream: spout tip down to the surface */}
      <svg className={`mt-fx mt-pour${held ? " on" : ""}`} viewBox={`0 0 1 ${HN}`} preserveAspectRatio="none" aria-hidden="true">
        <path
          className="mt-stream"
          d={`M${sx - 0.007} ${top} C${sx - 0.007} ${mid} ${tx - 0.011} ${mid} ${tx - 0.011} ${bottom} L${tx + 0.011} ${bottom} C${tx + 0.011} ${mid} ${sx + 0.007} ${mid} ${sx + 0.007} ${top}Z`}
        />
        <ellipse className="mt-ripple" cx={tx} cy={bottom} rx={0.04} ry={0.011} />
      </svg>
      <div className="mt-item mt-pitcher" style={{ ...place(SCENE.pitcher.cx, SCENE.pitcher.cy, SCENE.pitcher.w, IMAGE_ASPECT.pitcher), transform: `translate(-50%, -50%) rotate(${held ? POUR_TILT_DEG : 0}deg)` }}>
        <Layer id="pitcher" />
      </div>
    </>
  );
}

function WhiskScene({ v, froth, pos }: { v: ReturnType<typeof visuals>; froth: number; pos: { x: number; y: number } | null }) {
  // The centre of the tines sits on `pos` (the clamped pointer), or on the surface centre at rest; image rotated so tines point down.
  const ww = WHISK_W;
  const wh = ww / IMAGE_ASPECT.whisk;
  const left = (pos?.x ?? SURF.cx) - WHISK_ANCHOR.x * ww;
  const top = (pos?.y ?? SURF.cy) - WHISK_ANCHOR.y * wh;
  return (
    <>
      <div className="mt-item" style={place(SCENE.bowl.cx, SCENE.bowl.cy, bowlW, IMAGE_ASPECT.bowl)}>
        <Layer id="bowlLiquid" opacity={v.bowlLiquid} fit={BOWL_FIT.bowlLiquid} />
        <Froth froth={froth} />
      </div>
      <svg className="mt-fx" viewBox={`0 0 1 ${HN}`} preserveAspectRatio="none" aria-hidden="true">
        <Sparkle x={0.24} y={0.31} s={0.032} />
        <Sparkle x={0.3} y={0.37} s={0.017} delay={0.6} />
        <Sparkle x={0.78} y={0.52} s={0.028} delay={1.2} />
      </svg>
      <div
        className="mt-item"
        style={{
          left: pct(left), top: pct(top / HN), width: pct(ww), aspectRatio: String(IMAGE_ASPECT.whisk),
          transformOrigin: `${WHISK_ANCHOR.x * 100}% ${WHISK_ANCHOR.y * 100}%`, transform: `rotate(${WHISK_ROTATE_DEG}deg)`,
        }}
      >
        <Layer id="whisk" />
      </div>
    </>
  );
}

/* ---------- Modal ---------- */
export default function MatchaGame({ onClose }: { onClose?: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { state, held, whiskPos, timeMs, again, panelRef, panelProps } = useMatcha(SURF);
  useEffect(() => { dialogRef.current?.focus({ preventScroll: true }); }, []);

  const step = state.step;
  const v = visuals(state);
  const cfg = STEPS.find((s) => s.id === step) ?? STEPS[0];
  const whisking = step === "whisk";
  const froth = Math.round(state.froth);
  const result = state.result;

  return (
    <div className="cg-ov" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="cg-wrap">
        <div className="cg mt" role="dialog" aria-modal="true" aria-labelledby="mt-title" tabIndex={-1} ref={dialogRef}>
          <button className="cg-x" type="button" aria-label="Close" onClick={onClose}>×</button>

          <header className="mt-head">
            <div>
              <h2 id="mt-title">{TITLE}</h2>
              <p className="mt-sub">{cfg.subtitle}</p>
            </div>
            <div className="mt-pills" role="group" aria-label="Steps">
              {STEPS.map((s) => {
                const done = state.completed.includes(s.id);
                return (
                  <span
                    key={s.id} className={`mt-pill${s.id === step ? " now" : ""}${done ? " done" : ""}`}
                    aria-current={s.id === step ? "step" : undefined}
                  >
                    {s.n} {s.label}
                    {done && (
                      <span className="mt-check" aria-label="done">
                        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.4l2.3 2.2 4.7-5" /></svg>
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </header>

          <div className="mt-main">
            <div className="mt-panel" ref={panelRef} style={{ aspectRatio: String(PANEL_RATIO) }} {...panelProps}>
              {step === "sift" && <SiftScene v={v} held={held} />}
              {step === "pour" && <PourScene v={v} held={held} />}
              {step === "whisk" && <WhiskScene v={v} froth={state.froth} pos={whiskPos} />}
              <p className="mt-caption">{cfg.caption}</p>
            </div>

            <aside className="mt-side">
              <div className={`mt-stat${whisking ? "" : " dim"}`}>
                <p className="mt-label">Froth</p>
                <p className="mt-pct">{froth}%</p>
                <div className="mt-bar" role="progressbar" aria-label="Froth" aria-valuemin={0} aria-valuemax={100} aria-valuenow={froth}>
                  <div className="mt-fill" style={{ width: `${froth}%` }} />
                  <i className="mt-zone" style={{ left: `${ZONE.min}%`, width: `${ZONE.max - ZONE.min}%` }} aria-hidden="true" />
                  <span className="mt-zone-label" style={{ left: `${(ZONE.min + ZONE.max) / 2}%` }} aria-hidden="true">perfect zone</span>
                </div>
                <p className="mt-time">{formatTime(timeMs)}</p>
                <p className="mt-time-label">time</p>
              </div>

              <div className={`mt-result${result ? "" : " dim"}`}>
                <div className="mt-stars" role="img" aria-label={result ? `${result.stars} out of 3 stars` : "no stars yet"}>
                  {[1, 2, 3].map((n) => <Star key={n} on={!!result && n <= result.stars} />)}
                </div>
                <p className="mt-msg">{result ? result.message : WHISK_HINT}</p>
                <button className="mt-again" type="button" onClick={again} tabIndex={result ? 0 : -1} aria-hidden={!result} style={{ visibility: result ? "visible" : "hidden" }}>
                  Whisk again
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}