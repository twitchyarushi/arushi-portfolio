import { useCallback, useEffect, useRef, useState } from "react";
import {
  CATS,
  HAPPY_DURATION_MS,
  METER,
  MUTED_DEFAULT,
  STORAGE_KEYS,
  type CatId,
} from "./config";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/**
 * One-off things the UI should react to (sounds, bubbles, messages).
 * The UI should play the meow on both `badgeUnlocked` and `badgeAlreadyOwned`.
 */
export type GameEvent =
  | { type: "bubble"; catId: CatId }                 // meter crossed 25%
  | { type: "purrStart"; catId: CatId }              // meter >= 50% while petting
  | { type: "purrStop" }                             // petting stopped / meter fell < 50% / meter reset
  | { type: "hearts"; catId: CatId }                 // meter crossed 75%
  | { type: "badgeUnlocked"; catId: CatId; color: string; message: string }
  | { type: "badgeAlreadyOwned"; catId: CatId; message: string };

export interface GameState {
  pets: number;
  streak: number;                       // consecutive pets on the same cat
  best: number;                         // best streak ever (persisted)
  meters: Record<CatId, number>;        // one purr-o-meter per cat, 0..METER.max
  lastCatId: CatId | null;
  petting: boolean;                     // true until idleBeforeDrainMs passes with no pet
  purring: boolean;
  lastPetAt: number;
  lastPetAtBy: Record<CatId, number>;   // per cat, so each meter drains on its own
  lastTickAt: number;
  happy: Record<CatId, boolean>;
  happyUntil: Record<CatId, number>;
  badges: CatId[];                      // persisted
  muted: boolean;                       // persisted
}

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

/* ------------------------------------------------------------------ */
/* Pure logic (no React, no timers, no storage; easy to unit test)      */
/* ------------------------------------------------------------------ */

const noneRecord = <T,>(v: T): Record<CatId, T> =>
  Object.fromEntries(CATS.map((c) => [c.id, v])) as Record<CatId, T>;

export function createInitialState(muted: boolean = MUTED_DEFAULT): GameState {
  return {
    pets: 0,
    streak: 0,
    best: 0,
    meters: noneRecord(0),
    lastCatId: null,
    petting: false,
    purring: false,
    lastPetAt: 0,
    lastPetAtBy: noneRecord(0),
    lastTickAt: 0,
    happy: noneRecord(false),
    happyUntil: noneRecord(0),
    badges: [],
    muted,
  };
}

/**
 * One pet on one cat. Each cat has its own meter. A full meter stays full while petting
 * continues; the badge/meow event fires once per fill (when the meter crosses 100%).
 */
export function petCat(state: GameState, catId: CatId, now: number): StepResult {
  const cat = CATS.find((c) => c.id === catId);
  if (!cat) return { state, events: [] };

  const cp = METER.checkpoints;
  const events: GameEvent[] = [];

  const streak = state.lastCatId === catId ? state.streak + 1 : 1;
  const prev = state.meters[catId];
  const meter = Math.min(METER.max, prev + METER.perPet);
  const crossed = (t: number) => prev < t && meter >= t;

  if (crossed(cp.bubble)) events.push({ type: "bubble", catId });
  if (crossed(cp.hearts)) events.push({ type: "hearts", catId });

  let badges = state.badges;
  if (crossed(cp.badge)) {
    if (state.badges.includes(catId)) {
      events.push({
        type: "badgeAlreadyOwned",
        catId,
        message: `you already have ${cat.name}'s paw, try another cat!`,
      });
    } else {
      badges = [...state.badges, catId];
      events.push({
        type: "badgeUnlocked",
        catId,
        color: cat.color,
        message: `you got the ${cat.color} paw badge!`,
      });
    }
  }

  // The purr follows the cat being petted (and keeps going while its meter is >= 50%).
  let purring = state.purring;
  if (meter >= cp.purr && !purring) {
    purring = true;
    events.push({ type: "purrStart", catId });
  } else if (meter < cp.purr && purring) {
    purring = false;
    events.push({ type: "purrStop" });
  }

  return {
    state: {
      ...state,
      pets: state.pets + 1,
      streak,
      best: Math.max(state.best, streak),
      meters: { ...state.meters, [catId]: meter },
      lastCatId: catId,
      petting: true,
      purring,
      lastPetAt: now,
      lastPetAtBy: { ...state.lastPetAtBy, [catId]: now },
      lastTickAt: now,
      happy: { ...state.happy, [catId]: true },
      happyUntil: { ...state.happyUntil, [catId]: now + HAPPY_DURATION_MS },
      badges,
    },
    events,
  };
}

/**
 * Advance time: idle detection + per-cat meter drain + purr stop.
 * Returns the SAME state object when nothing changed (cheap to call often).
 */
export function tick(state: GameState, now: number): StepResult {
  let { petting, purring } = state;
  const events: GameEvent[] = [];

  if (petting && now - state.lastPetAt >= METER.idleBeforeDrainMs) petting = false;

  // Each cat's meter drains only after that cat has been idle for the grace period.
  let meters = state.meters;
  for (const c of CATS) {
    const m = meters[c.id];
    if (m <= 0) continue;
    const drainFrom = Math.max(state.lastTickAt, state.lastPetAtBy[c.id] + METER.idleBeforeDrainMs);
    if (now <= drainFrom) continue;
    const next = Math.max(0, m - ((now - drainFrom) / 1000) * METER.drainPerSecond);
    if (next !== m) meters = { ...meters, [c.id]: next };
  }

  const current = state.lastCatId ? meters[state.lastCatId] : 0;
  if (purring && (!petting || current < METER.checkpoints.purr)) {
    purring = false;
    events.push({ type: "purrStop" });
  }

  if (meters === state.meters && petting === state.petting && purring === state.purring) {
    return { state, events };
  }
  return { state: { ...state, meters, petting, purring, lastTickAt: now }, events };
}

/** Happy face times out 10s after that cat's last pet. */
export function expireHappy(state: GameState, catId: CatId, now: number): GameState {
  if (!state.happy[catId] || now < state.happyUntil[catId]) return state;
  return { ...state, happy: { ...state.happy, [catId]: false } };
}

/** Clears pets, streak, best, meters and badges. Mute is a setting, so it stays. */
export function resetGame(state: GameState): GameState {
  return createInitialState(state.muted);
}

/* ------------------------------------------------------------------ */
/* localStorage (best, badges, mute)                                    */
/* ------------------------------------------------------------------ */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Persisted {
  best: number;
  badges: CatId[];
  muted: boolean | null; // null = nothing saved, use default
}

const validIds = new Set<string>(CATS.map((c) => c.id));

export function loadPersisted(storage: StorageLike | null): Persisted {
  const out: Persisted = { best: 0, badges: [], muted: null };
  if (!storage) return out;
  try {
    const best = Number(storage.getItem(STORAGE_KEYS.best));
    if (Number.isFinite(best) && best > 0) out.best = Math.floor(best);

    const rawBadges = storage.getItem(STORAGE_KEYS.badges);
    if (rawBadges) {
      const parsed: unknown = JSON.parse(rawBadges);
      if (Array.isArray(parsed)) {
        out.badges = [...new Set(parsed.filter((b): b is CatId => typeof b === "string" && validIds.has(b)))];
      }
    }

    const rawMuted = storage.getItem(STORAGE_KEYS.muted);
    if (rawMuted === "true") out.muted = true;
    else if (rawMuted === "false") out.muted = false;
  } catch {
    // corrupted or blocked storage: fall back to defaults
  }
  return out;
}

export function savePersisted(
  storage: StorageLike | null,
  s: Pick<GameState, "best" | "badges" | "muted">,
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.best, String(s.best));
    storage.setItem(STORAGE_KEYS.badges, JSON.stringify(s.badges));
    storage.setItem(STORAGE_KEYS.muted, String(s.muted));
  } catch {
    // quota / private mode: ignore
  }
}

function getBrowserStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* React hook                                                           */
/* ------------------------------------------------------------------ */

const HAPPY_TIMER_SLACK_MS = 20;
const TICK_MS = 100;

export interface UseCatGameOptions {
  /** Called for every game event (play sounds, show bubbles/messages here). */
  onEvent?: (event: GameEvent) => void;
}

export function useCatGame(options: UseCatGameOptions = {}) {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [hydrated, setHydrated] = useState(false);

  const stateRef = useRef(state);
  const onEventRef = useRef(options.onEvent);
  onEventRef.current = options.onEvent;

  const happyTimers = useRef<Partial<Record<CatId, ReturnType<typeof setTimeout>>>>({});
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const apply = useCallback((next: GameState, events: GameEvent[] = []) => {
    stateRef.current = next;
    setState(next);
    for (const e of events) onEventRef.current?.(e);
  }, []);

  // Load persisted values after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    const saved = loadPersisted(getBrowserStorage());
    apply({
      ...stateRef.current,
      best: saved.best,
      badges: saved.badges,
      muted: saved.muted ?? stateRef.current.muted,
    });
    setHydrated(true);
  }, [apply]);

  // Save whenever persisted fields change (only after the initial load).
  useEffect(() => {
    if (!hydrated) return;
    savePersisted(getBrowserStorage(), state);
  }, [hydrated, state.best, state.badges, state.muted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drain / idle loop, only runs while there is something to update.
  const anyMeter = CATS.some((c) => state.meters[c.id] > 0);
  const needsTick = anyMeter || state.petting || state.purring;
  useEffect(() => {
    if (!needsTick) return;
    const id = setInterval(() => {
      const r = tick(stateRef.current, Date.now());
      if (r.state !== stateRef.current || r.events.length) apply(r.state, r.events);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [needsTick, apply]);

  const clearTimers = useCallback(() => {
    Object.values(happyTimers.current).forEach((t) => t && clearTimeout(t));
    happyTimers.current = {};
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const pet = useCallback(
    (catId: CatId) => {
      const r = petCat(stateRef.current, catId, Date.now());
      apply(r.state, r.events);

      const existing = happyTimers.current[catId];
      if (existing) clearTimeout(existing);
      happyTimers.current[catId] = setTimeout(() => {
        const next = expireHappy(stateRef.current, catId, Date.now());
        if (next !== stateRef.current) apply(next);
      }, HAPPY_DURATION_MS + HAPPY_TIMER_SLACK_MS);
    },
    [apply],
  );

  /** Call on pointerdown: pets once, then keeps petting until stopHold. */
  const startHold = useCallback(
    (catId: CatId) => {
      if (holdTimer.current) clearInterval(holdTimer.current);
      pet(catId);
      holdTimer.current = setInterval(() => pet(catId), METER.holdIntervalMs);
    },
    [pet],
  );

  /** Call on pointerup / pointerleave / pointercancel. */
  const stopHold = useCallback(() => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    const wasPurring = stateRef.current.purring;
    apply(resetGame(stateRef.current), wasPurring ? [{ type: "purrStop" }] : []);
  }, [apply, clearTimers]);

  const setMuted = useCallback(
    (muted: boolean) => apply({ ...stateRef.current, muted }),
    [apply],
  );
  const toggleMute = useCallback(
    () => apply({ ...stateRef.current, muted: !stateRef.current.muted }),
    [apply],
  );

  return {
    cats: CATS,
    // values
    pets: state.pets,
    streak: state.streak,
    best: state.best,
    meters: state.meters,
    muted: state.muted,
    badges: state.badges,
    happy: state.happy,
    activeCatId: state.petting ? state.lastCatId : null,
    hydrated,
    // actions
    pet,
    startHold,
    stopHold,
    reset,
    setMuted,
    toggleMute,
  };
}
