import { describe, expect, it } from "vitest";
import { HAPPY_DURATION_MS, METER, STORAGE_KEYS, type CatId } from "./config";
import {
  createInitialState,
  expireHappy,
  loadPersisted,
  petCat,
  resetGame,
  savePersisted,
  tick,
  type GameEvent,
  type GameState,
  type StorageLike,
} from "./useCatGame";

/** Pet `n` times, 10ms apart, collecting events. */
function petN(state: GameState, catId: CatId, n: number, start = 1000) {
  let s = state;
  let t = start;
  const events: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    const r = petCat(s, catId, t);
    s = r.state;
    events.push(...r.events);
    t += 10;
  }
  return { state: s, events, endedAt: t - 10 };
}

const types = (events: GameEvent[]) => events.map((e) => e.type);
const PETS_TO_FULL = Math.ceil(METER.max / METER.perPet);

describe("streak", () => {
  it("counts consecutive pets on the same cat and resets when switching", () => {
    let { state } = petN(createInitialState(), "ash", 3);
    expect(state.streak).toBe(3);
    expect(state.pets).toBe(3);

    state = petCat(state, "cheese", 2000).state;
    expect(state.streak).toBe(1);
    expect(state.pets).toBe(4);
  });

  it("keeps best as the highest streak ever", () => {
    let { state } = petN(createInitialState(), "ash", 4);
    state = petCat(state, "booboo", 2000).state;
    expect(state.streak).toBe(1);
    expect(state.best).toBe(4);
  });
});

describe("per-cat meters", () => {
  it("each cat fills its own meter", () => {
    let s = petN(createInitialState(), "ash", 3).state;
    s = petN(s, "cheese", 2, 5000).state;
    expect(s.meters).toEqual({ booboo: 0, ash: 3 * METER.perPet, cheese: 2 * METER.perPet });
  });

  it("the purr stops when you switch to a cat whose meter is below 50%", () => {
    let { state } = petN(createInitialState(), "ash", 10); // 50%
    expect(state.purring).toBe(true);
    const r = petCat(state, "cheese", 5000);
    expect(types(r.events)).toEqual(["purrStop"]);
    expect(r.state.purring).toBe(false);
    state = r.state;
    expect(state.meters.ash).toBe(10 * METER.perPet);
  });
});

describe("meter drain", () => {
  it("does not drain during the idle grace period", () => {
    const { state, endedAt } = petN(createInitialState(), "ash", 3);
    const before = state.meters.ash;
    const r = tick(state, endedAt + METER.idleBeforeDrainMs - 1);
    expect(r.state.meters.ash).toBe(before);
  });

  it("drains at drainPerSecond once the grace period has passed, never below 0", () => {
    const { state, endedAt } = petN(createInitialState(), "ash", 3); // 15%
    const start = state.meters.ash;
    const t1 = endedAt + METER.idleBeforeDrainMs + 1000;
    const r1 = tick(state, t1);
    expect(r1.state.meters.ash).toBeCloseTo(start - METER.drainPerSecond, 5);

    const r2 = tick(r1.state, t1 + 60_000);
    expect(r2.state.meters.ash).toBe(0);
  });

  it("returns the same state object when nothing changed", () => {
    const s = createInitialState();
    expect(tick(s, 5000).state).toBe(s);
  });

  it("stops the purr when petting stops", () => {
    const { state, events, endedAt } = petN(createInitialState(), "ash", 10); // 50%
    expect(types(events)).toContain("purrStart");
    const r = tick(state, endedAt + METER.idleBeforeDrainMs + 10);
    expect(types(r.events)).toEqual(["purrStop"]);
    expect(r.state.purring).toBe(false);
  });
});

describe("checkpoints", () => {
  it("fires bubble at 25%, purrStart at 50%, hearts at 75%, each once", () => {
    const { events } = petN(createInitialState(), "booboo", PETS_TO_FULL - 1);
    expect(types(events)).toEqual(["bubble", "purrStart", "hearts"]);
  });
});

describe("badges at 100%", () => {
  it("unlocks the badge for the cat being petted and the meter stays full", () => {
    const { state, events } = petN(createInitialState(), "ash", PETS_TO_FULL);
    const unlocked = events.find((e) => e.type === "badgeUnlocked");
    expect(unlocked).toMatchObject({ catId: "ash", message: "you got the black paw badge!" });
    expect(state.badges).toEqual(["ash"]);
    expect(state.meters.ash).toBe(METER.max);
  });

  it("fires the badge moment once, even if petting continues at 100%", () => {
    const first = petN(createInitialState(), "ash", PETS_TO_FULL);
    const more = petN(first.state, "ash", 10, first.endedAt + 10);
    expect(more.events).toEqual([]);
    expect(more.state.meters.ash).toBe(METER.max);
    expect(more.state.badges).toEqual(["ash"]);
  });

  it("says 'already have it' and adds no duplicate when the cat's badge is owned", () => {
    const first = petN(createInitialState(), "ash", PETS_TO_FULL);
    const later = first.endedAt + METER.idleBeforeDrainMs + 60_000; // meter drains to 0
    const drained = tick(first.state, later).state;
    const second = petN(drained, "ash", PETS_TO_FULL, later + 10);
    const owned = second.events.find((e) => e.type === "badgeAlreadyOwned");
    expect(owned).toMatchObject({
      catId: "ash",
      message: "you already have Ash's paw, try another cat!",
    });
    expect(types(second.events)).not.toContain("badgeUnlocked");
    expect(second.state.badges).toEqual(["ash"]);
  });

  it("lets each cat earn its own badge", () => {
    let s = petN(createInitialState(), "ash", PETS_TO_FULL).state;
    s = petN(s, "cheese", PETS_TO_FULL, 5000).state;
    s = petN(s, "booboo", PETS_TO_FULL, 9000).state;
    expect([...s.badges].sort()).toEqual(["ash", "booboo", "cheese"]);
  });
});

describe("happy timer", () => {
  it("expires 10s after the last pet, and each pet restarts it", () => {
    let s = petCat(createInitialState(), "cheese", 1000).state;
    expect(s.happy.cheese).toBe(true);

    s = petCat(s, "cheese", 8000).state; // restart
    expect(expireHappy(s, "cheese", 1000 + HAPPY_DURATION_MS)).toBe(s); // old deadline: still happy
    const expired = expireHappy(s, "cheese", 8000 + HAPPY_DURATION_MS);
    expect(expired.happy.cheese).toBe(false);
  });

  it("tracks each cat separately", () => {
    let s = petCat(createInitialState(), "ash", 1000).state;
    s = petCat(s, "cheese", 6000).state;
    s = expireHappy(s, "ash", 1000 + HAPPY_DURATION_MS);
    expect(s.happy.ash).toBe(false);
    expect(s.happy.cheese).toBe(true);
  });
});

describe("reset and persistence", () => {
  it("reset clears everything except the mute setting", () => {
    let s = petN(createInitialState(false), "ash", PETS_TO_FULL).state;
    s = resetGame(s);
    expect(s).toMatchObject({ pets: 0, streak: 0, best: 0, meters: { booboo: 0, ash: 0, cheese: 0 }, badges: [], muted: false });
  });

  const memoryStorage = (): StorageLike & { data: Record<string, string> } => {
    const data: Record<string, string> = {};
    return {
      data,
      getItem: (k) => (k in data ? data[k] : null),
      setItem: (k, v) => void (data[k] = v),
      removeItem: (k) => void delete data[k],
    };
  };

  it("round-trips best, badges and mute", () => {
    const st = memoryStorage();
    savePersisted(st, { best: 12, badges: ["ash", "cheese"], muted: false });
    expect(loadPersisted(st)).toEqual({ best: 12, badges: ["ash", "cheese"], muted: false });
  });

  it("falls back to defaults on corrupted or unknown data", () => {
    const st = memoryStorage();
    st.data[STORAGE_KEYS.best] = "banana";
    st.data[STORAGE_KEYS.badges] = "{not json";
    expect(loadPersisted(st)).toEqual({ best: 0, badges: [], muted: null });

    st.data[STORAGE_KEYS.badges] = JSON.stringify(["ash", "ash", "dog", 3]);
    expect(loadPersisted(st).badges).toEqual(["ash"]);
  });
});
