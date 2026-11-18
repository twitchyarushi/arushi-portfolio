import { describe, expect, it } from "vitest";
import {
  AUTO_ADVANCE_MS,
  BUBBLE_OVERSIZE,
  BUBBLES_MAX,
  FROTH_PER_TURN,
  IDLE_END_MS,
  KEY_TAP_FROTH,
  MIN_FROTH_TO_END,
  POUR_SECONDS,
  RESULT_BANDS,
  SIFT_SECONDS,
  ZONE,
} from "./config";
import {
  advanceStep,
  bubbleCount,
  clampToEllipse,
  createInitialState,
  elapsedMs,
  finishWhisk,
  formatTime,
  holdStep,
  isStepFilled,
  keyTap,
  rate,
  resetWhisk,
  shouldFinish,
  visuals,
  whiskMove,
  type MatchaState,
  type Point,
} from "./MatchaLogic";

const CENTER: Point = { x: 50, y: 50 };
const PANEL = 100; // min radius = MIN_RADIUS_FRAC * 100 = 12px

/** Point on a circle around CENTER at `deg` degrees. */
function at(radius: number, deg: number): Point {
  const a = (deg * Math.PI) / 180;
  return { x: CENTER.x + radius * Math.cos(a), y: CENTER.y + radius * Math.sin(a) };
}

/** Drag `turns` full circles (negative = the other direction) in 10-degree steps, 10ms apart. */
function circle(state: MatchaState, turns: number, radius = 30, startMs = 1000): MatchaState {
  const dir = turns < 0 ? -1 : 1;
  const steps = Math.round(Math.abs(turns) * 36);
  let s = state;
  let t = startMs;
  for (let i = 0; i < steps; i++) {
    s = whiskMove(s, CENTER, at(radius, dir * i * 10), at(radius, dir * (i + 1) * 10), t, PANEL);
    t += 10;
  }
  return s;
}

function sifted(): MatchaState {
  return advanceStep(holdStep(createInitialState(), SIFT_SECONDS * 1000));
}

function poured(): MatchaState {
  return advanceStep(holdStep(sifted(), POUR_SECONDS * 1000));
}

/** A whisk-step state with the given overrides. */
function whisking(patch: Partial<MatchaState> = {}): MatchaState {
  return { ...poured(), ...patch };
}

describe("createInitialState", () => {
  it("starts on sift with nothing done", () => {
    expect(createInitialState()).toEqual({
      step: "sift",
      completed: [],
      progress: 0,
      froth: 0,
      startedAt: null,
      lastMoveAt: null,
      endedAt: null,
      result: null,
    });
  });
});

describe("holdStep", () => {
  it("fills sift over SIFT_SECONDS", () => {
    const half = holdStep(createInitialState(), (SIFT_SECONDS * 1000) / 2);
    expect(half.progress).toBeCloseTo(0.5, 5);
    expect(isStepFilled(half)).toBe(false);
    const full = holdStep(half, (SIFT_SECONDS * 1000) / 2);
    expect(full.progress).toBe(1);
    expect(isStepFilled(full)).toBe(true);
  });

  it("fills pour over POUR_SECONDS", () => {
    const s = holdStep(sifted(), (POUR_SECONDS * 1000) / 4);
    expect(s.step).toBe("pour");
    expect(s.progress).toBeCloseTo(0.25, 5);
  });

  it("resumes where it left off after releasing mid-hold", () => {
    let s = holdStep(createInitialState(), 1000);
    const paused = s.progress;
    expect(paused).toBeCloseTo(1000 / (SIFT_SECONDS * 1000), 5);
    // released: nothing happens, progress is kept
    s = holdStep(s, 0);
    expect(s.progress).toBe(paused);
    s = holdStep(s, 1000);
    expect(s.progress).toBeCloseTo(2000 / (SIFT_SECONDS * 1000), 5);
  });

  it("caps at 1 and ignores negative time", () => {
    expect(holdStep(createInitialState(), 60_000).progress).toBe(1);
    const s = holdStep(createInitialState(), 500);
    expect(holdStep(s, -500).progress).toBe(s.progress);
  });

  it("does nothing on the whisk step", () => {
    const s = poured();
    expect(holdStep(s, 5000)).toBe(s);
  });
});

describe("advanceStep", () => {
  it("does nothing until the step is full", () => {
    const s = holdStep(createInitialState(), 500);
    expect(advanceStep(s)).toBe(s);
  });

  it("goes sift -> pour -> whisk, marking each complete and resetting progress", () => {
    const pour = sifted();
    expect(pour.step).toBe("pour");
    expect(pour.completed).toEqual(["sift"]);
    expect(pour.progress).toBe(0);
    const whisk = poured();
    expect(whisk.step).toBe("whisk");
    expect(whisk.completed).toEqual(["sift", "pour"]);
    expect(whisk.progress).toBe(0);
  });

  it("does nothing on the whisk step", () => {
    const s = poured();
    expect(advanceStep(s)).toBe(s);
  });

  it("AUTO_ADVANCE_MS is a sane pause", () => {
    expect(AUTO_ADVANCE_MS).toBeGreaterThan(0);
  });
});

describe("whiskMove", () => {
  it("one full turn adds FROTH_PER_TURN", () => {
    const s = circle(whisking(), 1);
    expect(s.froth).toBeCloseTo(FROTH_PER_TURN, 5);
  });

  it("counts both directions equally", () => {
    const cw = circle(whisking(), 2);
    const ccw = circle(whisking(), -2);
    expect(cw.froth).toBeCloseTo(2 * FROTH_PER_TURN, 5);
    expect(ccw.froth).toBeCloseTo(cw.froth, 5);
  });

  it("handles the +-180 degree wrap-around as a short move, not a near-full turn", () => {
    // 170deg -> -170deg is 20deg of travel
    const s = whiskMove(whisking(), CENTER, at(30, 170), at(30, -170), 1000, PANEL);
    expect(s.froth).toBeCloseTo((20 / 360) * FROTH_PER_TURN, 5);
  });

  it("ignores moves inside the minimum radius", () => {
    const start = whisking();
    // radius 5 < 12
    const inner = circle(start, 3, 5);
    expect(inner.froth).toBe(0);
    expect(inner.startedAt).toBeNull();
    // starting outside and ending inside is ignored too
    const crossing = whiskMove(start, CENTER, at(30, 0), at(5, 90), 1000, PANEL);
    expect(crossing).toBe(start);
    // exactly on the limit counts
    const edge = whiskMove(start, CENTER, at(12, 0), at(12, 90), 1000, PANEL);
    expect(edge.froth).toBeGreaterThan(0);
  });

  it("ignores a pointer that hasn't moved", () => {
    const start = whisking();
    expect(whiskMove(start, CENTER, at(30, 45), at(30, 45), 1000, PANEL)).toBe(start);
  });

  it("caps froth at 100", () => {
    const s = circle(whisking(), 20);
    expect(s.froth).toBe(100);
    // more whisking at the cap keeps it at 100 and keeps the round alive
    const more = whiskMove(s, CENTER, at(30, 0), at(30, 10), 9999, PANEL);
    expect(more.froth).toBe(100);
    expect(more.lastMoveAt).toBe(9999);
  });

  it("starts the timer at the first counted move only", () => {
    const first = whiskMove(whisking(), CENTER, at(30, 0), at(30, 10), 1000, PANEL);
    expect(first.startedAt).toBe(1000);
    const second = whiskMove(first, CENTER, at(30, 10), at(30, 20), 1500, PANEL);
    expect(second.startedAt).toBe(1000);
    expect(second.lastMoveAt).toBe(1500);
  });

  it("only works on the whisk step and before the round ends", () => {
    const sift = createInitialState();
    expect(whiskMove(sift, CENTER, at(30, 0), at(30, 10), 1000, PANEL)).toBe(sift);
    const ended = finishWhisk(circle(whisking(), 2), 5000); // 2 turns = 24% >= MIN_FROTH_TO_END
    expect(ended.result).not.toBeNull();
    expect(whiskMove(ended, CENTER, at(30, 0), at(30, 10), 6000, PANEL)).toBe(ended);
  });

  it("scales the minimum radius with the panel size", () => {
    // radius 30 is fine on a 100px panel (min 12) but too small on a 400px panel (min 48)
    const s = whiskMove(whisking(), CENTER, at(30, 0), at(30, 10), 1000, 400);
    expect(s.froth).toBe(0);
  });
});

describe("keyTap", () => {
  it("adds KEY_TAP_FROTH, starts the timer, and caps at 100", () => {
    const one = keyTap(whisking(), 2000);
    expect(one.froth).toBe(KEY_TAP_FROTH);
    expect(one.startedAt).toBe(2000);
    expect(one.lastMoveAt).toBe(2000);
    let s = one;
    for (let i = 0; i < 100; i++) s = keyTap(s, 2000 + i);
    expect(s.froth).toBe(100);
    expect(s.startedAt).toBe(2000);
  });

  it("only works on the whisk step", () => {
    const s = createInitialState();
    expect(keyTap(s, 1000)).toBe(s);
  });
});

describe("shouldFinish / finishWhisk", () => {
  it("waits for IDLE_END_MS of stillness", () => {
    const s = keyTap(whisking({ froth: 50 }), 1000);
    expect(shouldFinish(s, 1000 + IDLE_END_MS - 1)).toBe(false);
    expect(shouldFinish(s, 1000 + IDLE_END_MS)).toBe(true);
  });

  it("needs froth >= MIN_FROTH_TO_END", () => {
    const low = whisking({ froth: MIN_FROTH_TO_END - 1, startedAt: 1000, lastMoveAt: 1000 });
    expect(shouldFinish(low, 99_999)).toBe(false);
    expect(finishWhisk(low, 99_999)).toBe(low);
    const ok = whisking({ froth: MIN_FROTH_TO_END, startedAt: 1000, lastMoveAt: 1000 });
    expect(shouldFinish(ok, 99_999)).toBe(true);
    expect(finishWhisk(ok, 99_999).result).not.toBeNull();
  });

  it("does nothing before whisking has started", () => {
    const s = whisking({ froth: 50 });
    expect(shouldFinish(s, 99_999)).toBe(false);
    expect(finishWhisk(s, 99_999)).toBe(s);
  });

  it("rates the froth and stops the timer at the last movement", () => {
    const s = whisking({ froth: 80, startedAt: 1000, lastMoveAt: 13_000 });
    const done = finishWhisk(s, 13_800);
    expect(done.result).toEqual(rate(80));
    expect(done.endedAt).toBe(13_000);
    expect(elapsedMs(done, 99_999)).toBe(12_000);
  });

  it("ends only once", () => {
    const done = finishWhisk(whisking({ froth: 80, startedAt: 1000, lastMoveAt: 2000 }), 3000);
    expect(finishWhisk(done, 9000)).toBe(done);
    expect(shouldFinish(done, 9000)).toBe(false);
  });
});

describe("elapsedMs", () => {
  it("is 0 before whisking, runs while whisking, and freezes at the end", () => {
    expect(elapsedMs(whisking(), 5000)).toBe(0);
    const running = whisking({ froth: 40, startedAt: 1000, lastMoveAt: 4000 });
    expect(elapsedMs(running, 6000)).toBe(5000);
    const ended = { ...running, endedAt: 4000 };
    expect(elapsedMs(ended, 60_000)).toBe(3000);
  });
});

describe("resetWhisk", () => {
  it("clears froth, timer and result but keeps sift and pour complete", () => {
    const done = finishWhisk(circle(whisking(), 7), 60_000);
    expect(done.result).not.toBeNull();
    const again = resetWhisk(done);
    expect(again.step).toBe("whisk");
    expect(again.completed).toEqual(["sift", "pour"]);
    expect(again.froth).toBe(0);
    expect(again.startedAt).toBeNull();
    expect(again.lastMoveAt).toBeNull();
    expect(again.endedAt).toBeNull();
    expect(again.result).toBeNull();
    // and the new round works
    expect(circle(again, 1).froth).toBeCloseTo(FROTH_PER_TURN, 5);
  });
});

describe("rate", () => {
  const stars = (f: number) => rate(f).stars;
  const band = (min: number) => RESULT_BANDS.find((b) => b.min === min)!;

  it("rates every band at both of its boundaries", () => {
    // [froth, stars, band's min]
    const cases: Array<[number, 1 | 2 | 3, number]> = [
      [0, 1, 0],
      [34, 1, 0],
      [35, 1, 35],
      [59, 1, 35],
      [60, 2, 60],
      [71, 2, 60],
      [72, 3, 72],
      [88, 3, 72],
      [89, 2, 89],
      [95, 2, 89],
      [96, 1, 96],
      [100, 1, 96],
    ];
    for (const [froth, expected, bandMin] of cases) {
      expect(stars(froth), `froth ${froth}`).toBe(expected);
      expect(rate(froth).message, `froth ${froth}`).toBe(band(bandMin).message);
    }
  });

  it("rounds to the whole percentage the player sees", () => {
    expect(stars(71.4)).toBe(2);
    expect(stars(71.5)).toBe(3);
    expect(stars(88.4)).toBe(3);
    expect(stars(88.5)).toBe(2);
    expect(stars(95.4)).toBe(2);
    expect(stars(95.5)).toBe(1);
    expect(stars(34.4)).toBe(1);
  });

  it("clamps out-of-range froth", () => {
    expect(rate(-10)).toEqual(rate(0));
    expect(rate(150)).toEqual(rate(100));
  });

  it("the result table covers 0-100 with no gaps or overlaps, and 3 stars is exactly the perfect zone", () => {
    for (let f = 0; f <= 100; f++) {
      const matches = RESULT_BANDS.filter((b) => f >= b.min && f <= b.max);
      expect(matches, `froth ${f}`).toHaveLength(1);
    }
    const three = RESULT_BANDS.filter((b) => b.stars === 3);
    expect(three).toHaveLength(1);
    expect(three[0].min).toBe(ZONE.min);
    expect(three[0].max).toBe(ZONE.max);
  });

  it("gives every result a message", () => {
    for (const b of RESULT_BANDS) expect(b.message.length).toBeGreaterThan(0);
  });
});

describe("formatTime", () => {
  it("formats m:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(12_000)).toBe("0:12");
    expect(formatTime(11_999)).toBe("0:11");
    expect(formatTime(65_000)).toBe("1:05");
    expect(formatTime(600_000)).toBe("10:00");
  });

  it("treats negative time as zero", () => {
    expect(formatTime(-500)).toBe("0:00");
  });
});

describe("bubbleCount", () => {
  it("is 0 at 0 and max at 100", () => {
    expect(bubbleCount(0, 40)).toBe(0);
    expect(bubbleCount(100, 40)).toBe(40);
  });

  it("rounds to the nearest whole bubble", () => {
    expect(bubbleCount(33, 40)).toBe(13); // 13.2
    expect(bubbleCount(34, 40)).toBe(14); // 13.6
    expect(bubbleCount(50, 25)).toBe(13); // 12.5 rounds up
    expect(bubbleCount(1, 40)).toBe(0); // 0.4
  });

  it("stays within 0..max", () => {
    expect(bubbleCount(150, 40)).toBe(40);
    expect(bubbleCount(-20, 40)).toBe(0);
  });
});

describe("clampToEllipse", () => {
  const e = { cx: 100, cy: 60, rx: 40, ry: 10 };
  const onEdge = (p: Point) => Math.hypot((p.x - e.cx) / e.rx, (p.y - e.cy) / e.ry);

  it("leaves points inside unchanged", () => {
    expect(clampToEllipse({ x: 100, y: 60 }, e)).toEqual({ x: 100, y: 60 });
    expect(clampToEllipse({ x: 120, y: 64 }, e)).toEqual({ x: 120, y: 64 });
  });

  it("leaves points on the boundary unchanged", () => {
    expect(clampToEllipse({ x: 140, y: 60 }, e)).toEqual({ x: 140, y: 60 });
    expect(clampToEllipse({ x: 100, y: 50 }, e)).toEqual({ x: 100, y: 50 });
  });

  it("moves points outside onto the boundary, towards the centre", () => {
    const right = clampToEllipse({ x: 300, y: 60 }, e);
    expect(right.x).toBeCloseTo(140, 8);
    expect(right.y).toBeCloseTo(60, 8);

    const above = clampToEllipse({ x: 100, y: -500 }, e);
    expect(above.x).toBeCloseTo(100, 8);
    expect(above.y).toBeCloseTo(50, 8);

    const diag = { x: 220, y: 100 };
    const clamped = clampToEllipse(diag, e);
    expect(onEdge(clamped)).toBeCloseTo(1, 8);
    // same direction from the centre as the original point
    expect((clamped.y - e.cy) / (clamped.x - e.cx)).toBeCloseTo((diag.y - e.cy) / (diag.x - e.cx), 8);
  });

  it("collapses to the centre for a degenerate ellipse", () => {
    expect(clampToEllipse({ x: 5, y: 5 }, { cx: 1, cy: 2, rx: 0, ry: 10 })).toEqual({ x: 1, y: 2 });
    expect(clampToEllipse({ x: 5, y: 5 }, { cx: 1, cy: 2, rx: 10, ry: 0 })).toEqual({ x: 1, y: 2 });
  });
});

describe("visuals", () => {
  const sift = (p: number): MatchaState => ({ ...createInitialState(), progress: p });
  const pour = (p: number): MatchaState => ({ ...sifted(), progress: p });
  const whisk = (froth: number): MatchaState => whisking({ froth });

  it("sift: powder grows in the bowl as the sieve empties", () => {
    for (const [p, powder, full] of [
      [0, 0, 1],
      [0.5, 0.5, 0.5],
      [1, 1, 0],
    ]) {
      const v = visuals(sift(p));
      expect(v.bowlEmpty).toBe(1);
      expect(v.bowlPowder).toBeCloseTo(powder, 8);
      expect(v.sieveFull).toBeCloseTo(full, 8);
      expect(v.sieveEmpty).toBe(1);
      expect(v.bowlLiquid).toBe(0);
      expect(v.frothTint).toBe(0);
      expect(v.bubbles).toBe(0);
    }
  });

  it("pour: powder fades out as liquid fades in, sieve gone", () => {
    for (const [p, powder, liquid] of [
      [0, 1, 0],
      [0.5, 0.5, 0.5],
      [1, 0, 1],
    ]) {
      const v = visuals(pour(p));
      expect(v.bowlEmpty).toBe(1);
      expect(v.bowlPowder).toBeCloseTo(powder, 8);
      expect(v.bowlLiquid).toBeCloseTo(liquid, 8);
      expect(v.sieveEmpty).toBe(0);
      expect(v.sieveFull).toBe(0);
      expect(v.frothTint).toBe(0);
      expect(v.bubbles).toBe(0);
    }
  });

  it("pour starts with the full powder mound carried over from sift", () => {
    expect(visuals(sifted()).bowlPowder).toBe(1);
  });

  it("whisk: liquid base, tint and bubbles follow froth", () => {
    const none = visuals(whisk(0));
    expect(none.bowlLiquid).toBe(1);
    expect(none.bowlPowder).toBe(0);
    expect(none.sieveEmpty).toBe(0);
    expect(none.sieveFull).toBe(0);
    expect(none.frothTint).toBe(0);
    expect(none.bubbles).toBe(0);

    const half = visuals(whisk(50));
    expect(half.frothTint).toBeCloseTo(0.3, 8);
    expect(half.bubbles).toBe(BUBBLES_MAX / 2);

    const full = visuals(whisk(100));
    expect(full.frothTint).toBeCloseTo(0.6, 8);
    expect(full.bubbles).toBe(BUBBLES_MAX);
  });

  it("whisk: bubbles get bigger only above the perfect zone", () => {
    expect(visuals(whisk(ZONE.max)).bubbleScale).toBe(1);
    expect(visuals(whisk(ZONE.max + 0.4)).bubbleScale).toBe(1); // still shows as 88%
    expect(visuals(whisk(ZONE.max + 1)).bubbleScale).toBe(BUBBLE_OVERSIZE);
    expect(visuals(whisk(100)).bubbleScale).toBe(BUBBLE_OVERSIZE);
  });

  it("whisk again returns to a clean liquid bowl", () => {
    const again = resetWhisk(whisking({ froth: 90 }));
    const v = visuals(again);
    expect(v.bowlLiquid).toBe(1);
    expect(v.frothTint).toBe(0);
    expect(v.bubbles).toBe(0);
    expect(v.bubbleScale).toBe(1);
  });
});