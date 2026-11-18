"use client";
import { useId, useMemo } from "react";
import { BUBBLES_MAX, SURFACE } from "./config";
import { createInitialState, visuals } from "./MatchaLogic";

/* Seeded generator so the bubbles are the same every render (no flicker). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Bubble { x: number; y: number; r: number }

/** All bubbles, generated once, in the order they appear as froth rises. Coordinates are fractions of the bowl image. */
function makeBubbles(n: number): Bubble[] {
  const rand = rng(20260);
  return Array.from({ length: n }, () => {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * 0.92; // uniform over the oval, kept off the very edge
    return {
      x: SURFACE.cx + Math.cos(a) * d * SURFACE.rx,
      y: SURFACE.cy + Math.sin(a) * d * SURFACE.ry,
      r: 0.014 + rand() * 0.022,
    };
  });
}

/** Foam tint and bubbles, clipped to the SURFACE oval. Sits on top of bowl-liquid and fills the same box. */
export default function Froth({ froth }: { froth: number }) {
  const id = useId().replace(/:/g, "");
  const all = useMemo(() => makeBubbles(BUBBLES_MAX), []);

  // Levels come from the same function the rest of the game uses (bubbleCount, tint, over-whisk size).
  const v = visuals({ ...createInitialState(), step: "whisk", froth });
  const shown = all.slice(0, v.bubbles).sort((a, b) => a.y - b.y); // lower bubbles paint over higher ones

  return (
    <svg className="mt-froth" viewBox="0 0 1 1" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <ellipse cx={SURFACE.cx} cy={SURFACE.cy} rx={SURFACE.rx} ry={SURFACE.ry} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <ellipse cx={SURFACE.cx} cy={SURFACE.cy} rx={SURFACE.rx} ry={SURFACE.ry} fill="#eef3d6" opacity={v.frothTint} />
        {shown.map((b, i) => {
          const r = b.r * v.bubbleScale;
          return (
            <g key={i}>
              <circle cx={b.x} cy={b.y} r={r} fill="#9caf88" fillOpacity={0.35} stroke="#b4c5a2" strokeOpacity={0.9} strokeWidth={0.004} />
              <circle cx={b.x - r * 0.32} cy={b.y - r * 0.32} r={r * 0.26} fill="#dbe6cc" fillOpacity={0.85} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}