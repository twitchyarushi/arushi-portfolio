"use client";
/* Timers, pointer and keyboard handling around the pure logic in MatchaLogic.ts. */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AUTO_ADVANCE_MS, WHISK_CLAMP_PAD } from "./config";
import {
  advanceStep, clampToEllipse, createInitialState, elapsedMs, finishWhisk, holdStep, isStepFilled, keyTap, resetWhisk,
  shouldFinish, whiskMove, type Ellipse, type MatchaState, type Point,
} from "./MatchaLogic";

/** Longest time one animation frame can add to a hold, so a sleeping tab doesn't fill the bar. */
const MAX_FRAME_MS = 100;
/** Timer display refresh, and how often the idle end-of-round check runs. */
const TICK_MS = 100;
/** Length of the small whisk circle drawn per keyboard tap. */
const TAP_MS = 300;

type HoldSource = "pointer" | "key";

/**
 * `surf` is the SURFACE oval in panel units (panel width = 1). All points the hook takes or returns use the same units,
 * so the circle centre for whisking is simply the oval's centre.
 */
export function useMatcha(surf: Ellipse) {
  const [state, setState] = useState<MatchaState>(createInitialState);
  const [held, setHeld] = useState(false);
  const [whiskPos, setWhiskPos] = useState<Point | null>(null); // drawn (clamped) whisk position; null = resting
  const [now, setNow] = useState(0);

  const stateRef = useRef(state);
  const panelRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef({ pointer: false, key: false, raf: 0, last: 0, advance: 0 });
  const dragRef = useRef<{ id: number; last: Point } | null>(null);
  const tapRef = useRef(0);

  const commit = useCallback((next: MatchaState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  /* ---------- sift / pour: hold ---------- */
  const haltLoop = useCallback(() => {
    const h = holdRef.current;
    if (h.raf) cancelAnimationFrame(h.raf);
    h.raf = 0;
    setHeld(false);
  }, []);

  const tick = useCallback(
    (t: number) => {
      const h = holdRef.current;
      const dt = Math.min(MAX_FRAME_MS, t - h.last);
      h.last = t;
      const prev = stateRef.current;
      const next = holdStep(prev, dt);
      if (next !== prev) commit(next);
      if (isStepFilled(next)) {
        // 100%: stop holding, wait a moment, then complete the step and move on.
        h.pointer = false;
        h.key = false;
        h.raf = 0;
        setHeld(false);
        h.advance = window.setTimeout(() => {
          h.advance = 0;
          commit(advanceStep(stateRef.current));
        }, AUTO_ADVANCE_MS);
        return;
      }
      h.raf = requestAnimationFrame(tick);
    },
    [commit],
  );

  const startHold = useCallback(
    (src: HoldSource) => {
      const s = stateRef.current;
      if (s.step === "whisk" || isStepFilled(s)) return;
      const h = holdRef.current;
      h[src] = true;
      if (h.raf) return;
      h.last = performance.now();
      setHeld(true);
      h.raf = requestAnimationFrame(tick);
    },
    [tick],
  );

  const stopHold = useCallback(
    (src: HoldSource) => {
      const h = holdRef.current;
      h[src] = false;
      if (!h.pointer && !h.key && h.raf) haltLoop();
    },
    [haltLoop],
  );

  /* ---------- whisk ---------- */
  const follow = useCallback(
    (p: Point) => {
      // Drawn position is clamped to the (padded) surface oval; froth maths keeps using the raw pointer.
      setWhiskPos(clampToEllipse(p, { cx: surf.cx, cy: surf.cy, rx: surf.rx * WHISK_CLAMP_PAD, ry: surf.ry * WHISK_CLAMP_PAD }));
    },
    [surf],
  );

  const cancelTap = useCallback(() => {
    if (tapRef.current) cancelAnimationFrame(tapRef.current);
    tapRef.current = 0;
  }, []);

  /** One keyboard tap: +froth, and the whisk does a small circle at the surface centre. */
  const tap = useCallback(() => {
    const t0 = performance.now();
    const s = stateRef.current;
    const next = keyTap(s, t0);
    if (next === s) return;
    commit(next);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    cancelTap();
    const rx = surf.rx * 0.18;
    const ry = surf.ry * 0.18;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / TAP_MS);
      if (k >= 1) {
        tapRef.current = 0;
        setWhiskPos(null);
        return;
      }
      const a = k * Math.PI * 2;
      setWhiskPos({ x: surf.cx + rx * Math.sin(a), y: surf.cy + ry * (1 - Math.cos(a)) });
      tapRef.current = requestAnimationFrame(step);
    };
    tapRef.current = requestAnimationFrame(step);
  }, [commit, cancelTap, surf]);

  const again = useCallback(() => {
    cancelTap();
    dragRef.current = null;
    setWhiskPos(null);
    setNow(0);
    commit(resetWhisk(stateRef.current));
  }, [cancelTap, commit]);

  /** Pointer position in panel units (panel width = 1). */
  const toPanel = (e: ReactPointerEvent<HTMLElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.width };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    const s = stateRef.current;
    if (s.step !== "whisk") {
      startHold("pointer");
    } else if (s.endedAt === null) {
      cancelTap();
      const p = toPanel(e);
      dragRef.current = { id: e.pointerId, last: p };
      follow(p);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const s = stateRef.current;
    if (s.step !== "whisk" || s.endedAt !== null) return;
    const p = toPanel(e);
    const next = whiskMove(s, { x: surf.cx, y: surf.cy }, d.last, p, performance.now(), 1);
    if (next !== s) commit(next);
    d.last = p;
    follow(p);
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.id === e.pointerId) dragRef.current = null;
    stopHold("pointer");
  };

  /* ---------- timer + end of round ---------- */
  useEffect(() => {
    if (state.step !== "whisk" || state.startedAt === null || state.endedAt !== null) return;
    const id = window.setInterval(() => {
      const t = performance.now();
      const s = stateRef.current;
      if (shouldFinish(s, t)) commit(finishWhisk(s, t));
      setNow(t);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [state.step, state.startedAt, state.endedAt, commit]);

  /* ---------- keyboard: hold Space/Enter for sift/pour, tap to whisk ---------- */
  useEffect(() => {
    const onButton = (t: EventTarget | null) => t instanceof Element && !!t.closest("button, a, input, textarea, select, [contenteditable]");
    const down = (e: KeyboardEvent) => {
      if ((e.key !== " " && e.key !== "Enter") || e.ctrlKey || e.metaKey || e.altKey || onButton(e.target)) return;
      e.preventDefault();
      if (e.repeat) return;
      if (stateRef.current.step === "whisk") tap();
      else startHold("key");
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") stopHold("key");
    };
    const blur = () => {
      stopHold("key");
      stopHold("pointer");
      dragRef.current = null;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [tap, startHold, stopHold]);

  /* ---------- cleanup: no frame, timeout or interval outlives the modal ---------- */
  useEffect(() => {
    const h = holdRef.current;
    return () => {
      if (h.raf) cancelAnimationFrame(h.raf);
      if (h.advance) window.clearTimeout(h.advance);
      h.raf = 0;
      h.advance = 0;
      h.pointer = false;
      h.key = false;
      cancelTap();
    };
  }, [cancelTap]);

  return {
    state,
    /** True while a sift/pour hold is active (pointer or key). */
    held,
    /** Drawn whisk position in panel units, or null while it rests at the surface centre. */
    whiskPos,
    timeMs: elapsedMs(state, now),
    again,
    panelRef,
    panelProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onLostPointerCapture: onPointerEnd,
      onContextMenu: (e: { preventDefault(): void }) => e.preventDefault(),
    },
  };
}