/* Pure game logic for the matcha game: no React, no timers, no DOM. useMatcha.ts drives it. */
import {
  BUBBLE_OVERSIZE,
  BUBBLES_MAX,
  FOAM_TINT_MAX,
  FROTH_PER_TURN,
  IDLE_END_MS,
  KEY_TAP_FROTH,
  MIN_FROTH_TO_END,
  MIN_RADIUS_FRAC,
  POUR_SECONDS,
  RESULT_BANDS,
  SIFT_SECONDS,
  STEP_ORDER,
  ZONE,
  type Stars,
  type StepId,
} from "./config";

export interface Point {
  x: number;
  y: number;
}

export interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface MatchaResult {
  stars: Stars;
  message: string;
}

export interface MatchaState {
  step: StepId;
  /** Sift/pour steps that have finished. Whisk is never listed. */
  completed: StepId[];
  /** Hold progress of the current sift/pour step, 0..1. Unused while whisking. */
  progress: number;
  /** Whisk froth, 0..100. */
  froth: number;
  /** Time of the first counted whisk movement; null until then. */
  startedAt: number | null;
  /** Time of the latest counted whisk movement. */
  lastMoveAt: number | null;
  /** Set when the round ends (the timer stops here). */
  endedAt: number | null;
  result: MatchaResult | null;
}

/** Layer levels for the scene. Opacities are 0..1. */
export interface Visuals {
  bowlEmpty: number;
  bowlPowder: number;
  bowlLiquid: number;
  sieveEmpty: number;
  sieveFull: number;
  frothTint: number;
  /** How many of the BUBBLES_MAX bubbles are visible. */
  bubbles: number;
  /** 1 normally, BUBBLE_OVERSIZE when over-whisked. */
  bubbleScale: number;
}

const TWO_PI = Math.PI * 2;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function createInitialState(): MatchaState {
  return {
    step: "sift",
    completed: [],
    progress: 0,
    froth: 0,
    startedAt: null,
    lastMoveAt: null,
    endedAt: null,
    result: null,
  };
}

/* ---------- Sift / pour ---------- */

/** Add `dtMs` of holding to the current sift/pour step. Progress is cumulative, so releasing just pauses it. */
export function holdStep(state: MatchaState, dtMs: number): MatchaState {
  if (state.step === "whisk" || state.progress >= 1) return state;
  const seconds = state.step === "sift" ? SIFT_SECONDS : POUR_SECONDS;
  const progress = clamp(state.progress + Math.max(0, dtMs) / (seconds * 1000), 0, 1);
  return progress === state.progress ? state : { ...state, progress };
}

/** True once the current sift/pour step is at 100% (the hook then waits AUTO_ADVANCE_MS and calls advanceStep). */
export function isStepFilled(state: MatchaState): boolean {
  return state.step !== "whisk" && state.progress >= 1;
}

/** Mark a filled sift/pour step complete and move to the next one. Does nothing if it isn't filled yet. */
export function advanceStep(state: MatchaState): MatchaState {
  if (!isStepFilled(state)) return state;
  const next = STEP_ORDER[STEP_ORDER.indexOf(state.step) + 1];
  if (!next) return state;
  return { ...state, step: next, completed: [...state.completed, state.step], progress: 0 };
}

/* ---------- Whisk ---------- */

/** Add `froth` (clamped to 100) and record that whisking happened at `nowMs`. */
function addFroth(state: MatchaState, froth: number, nowMs: number): MatchaState {
  return {
    ...state,
    froth: clamp(state.froth + froth, 0, 100),
    startedAt: state.startedAt ?? nowMs,
    lastMoveAt: nowMs,
  };
}

function canWhisk(state: MatchaState): boolean {
  return state.step === "whisk" && state.endedAt === null;
}

/**
 * Pointer moved `from` -> `to` around `center` (all in panel pixels). Froth grows with the angle travelled,
 * in either direction. Moves that start or end closer than MIN_RADIUS_FRAC * panelSize to the centre are ignored.
 */
export function whiskMove(
  state: MatchaState,
  center: Point,
  from: Point,
  to: Point,
  nowMs: number,
  panelSize: number,
): MatchaState {
  if (!canWhisk(state)) return state;
  const minRadius = MIN_RADIUS_FRAC * panelSize;
  const fx = from.x - center.x;
  const fy = from.y - center.y;
  const tx = to.x - center.x;
  const ty = to.y - center.y;
  if (Math.hypot(fx, fy) < minRadius || Math.hypot(tx, ty) < minRadius) return state;

  let delta = Math.atan2(ty, tx) - Math.atan2(fy, fx);
  if (delta > Math.PI) delta -= TWO_PI;
  else if (delta < -Math.PI) delta += TWO_PI;

  const turns = Math.abs(delta) / TWO_PI;
  if (turns === 0) return state;
  return addFroth(state, turns * FROTH_PER_TURN, nowMs);
}

/** Keyboard alternative to dragging: each Space/Enter tap adds KEY_TAP_FROTH. */
export function keyTap(state: MatchaState, nowMs: number): MatchaState {
  if (!canWhisk(state)) return state;
  return addFroth(state, KEY_TAP_FROTH, nowMs);
}

/** True when the round should end: whisking has stopped for IDLE_END_MS and there is enough froth. */
export function shouldFinish(state: MatchaState, nowMs: number): boolean {
  return (
    canWhisk(state) &&
    state.startedAt !== null &&
    state.lastMoveAt !== null &&
    state.froth >= MIN_FROTH_TO_END &&
    nowMs - state.lastMoveAt >= IDLE_END_MS
  );
}

/**
 * End the round and rate it. The timer stops at the last whisk movement, not after the idle wait.
 * Does nothing before whisking has started, below MIN_FROTH_TO_END, or if the round already ended.
 */
export function finishWhisk(state: MatchaState, nowMs: number): MatchaState {
  if (!canWhisk(state) || state.startedAt === null || state.froth < MIN_FROTH_TO_END) return state;
  return { ...state, endedAt: state.lastMoveAt ?? nowMs, result: rate(state.froth) };
}

/** "Whisk again": clear froth, timer and result. Sift and pour stay completed. */
export function resetWhisk(state: MatchaState): MatchaState {
  return { ...state, froth: 0, startedAt: null, lastMoveAt: null, endedAt: null, result: null };
}

/** Whisk time so far (or the final time once the round has ended). */
export function elapsedMs(state: MatchaState, nowMs: number): number {
  if (state.startedAt === null) return 0;
  return Math.max(0, (state.endedAt ?? nowMs) - state.startedAt);
}

/* ---------- Rating and display helpers ---------- */

/** Stars and message for a froth level. Froth is rounded first, so it matches the % shown on screen. */
export function rate(froth: number): MatchaResult {
  const f = Math.round(clamp(froth, 0, 100));
  const band = RESULT_BANDS.find((b) => f >= b.min && f <= b.max) ?? RESULT_BANDS[RESULT_BANDS.length - 1];
  return { stars: band.stars, message: band.message };
}

/** Milliseconds -> "m:ss", e.g. 12000 -> "0:12". */
export function formatTime(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** How many of `max` bubbles to show at this froth level. */
export function bubbleCount(froth: number, max: number): number {
  return Math.round(clamp((froth * max) / 100, 0, max));
}

/** Keep a point inside an ellipse. Inside (or on the edge) it is unchanged; outside it moves in towards the centre until it lands on the edge. */
export function clampToEllipse(point: Point, ellipse: Ellipse): Point {
  const { cx, cy, rx, ry } = ellipse;
  if (rx <= 0 || ry <= 0) return { x: cx, y: cy };
  const dx = point.x - cx;
  const dy = point.y - cy;
  const d = Math.hypot(dx / rx, dy / ry);
  if (d <= 1) return point;
  return { x: cx + dx / d, y: cy + dy / d };
}

/** Level of every scene layer for the current state. */
export function visuals(state: MatchaState): Visuals {
  const p = clamp(state.progress, 0, 1);
  const base: Visuals = {
    bowlEmpty: 1,
    bowlPowder: 0,
    bowlLiquid: 0,
    sieveEmpty: 0,
    sieveFull: 0,
    frothTint: 0,
    bubbles: 0,
    bubbleScale: 1,
  };

  if (state.step === "sift") {
    return { ...base, bowlPowder: p, sieveEmpty: 1, sieveFull: 1 - p };
  }
  if (state.step === "pour") {
    return { ...base, bowlPowder: 1 - p, bowlLiquid: p };
  }
  const froth = clamp(state.froth, 0, 100);
  return {
    ...base,
    bowlLiquid: 1,
    frothTint: (froth / 100) * FOAM_TINT_MAX,
    bubbles: bubbleCount(froth, BUBBLES_MAX),
    bubbleScale: Math.round(froth) > ZONE.max ? BUBBLE_OVERSIZE : 1,
  };
}