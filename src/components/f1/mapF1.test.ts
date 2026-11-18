import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildF1Data, countdown, mapConstructors, mapDrivers, mapNext } from "./mapF1";
import { teamColour, NEUTRAL_TEAM_COLOUR } from "./config";

/* Small inline samples in Jolpica's shape. Real responses dropped into __fixtures__/ are tested below. */
const driversRaw = {
  MRData: {
    StandingsTable: {
      season: "2026",
      StandingsLists: [
        {
          season: "2026",
          round: "22",
          DriverStandings: [
            {
              position: "1", points: "412.5",
              Driver: { givenName: "Max", familyName: "Verstappen", code: "VER" },
              Constructors: [{ constructorId: "red_bull", name: "Red Bull" }],
            },
            {
              position: "2", points: "300",
              Driver: { givenName: "Lando", familyName: "Norris" },
              Constructors: [
                { constructorId: "mclaren", name: "McLaren" },
                { constructorId: "ferrari", name: "Ferrari" },
              ],
            },
            { position: "-", points: "oops", Driver: { code: "XYZ" } }, // missing fields
          ],
        },
      ],
    },
  },
};
const constructorsRaw = {
  MRData: {
    StandingsTable: {
      StandingsLists: [
        { season: "2026", ConstructorStandings: [{ position: "1", points: "700", Constructor: { constructorId: "mclaren", name: "McLaren" } }] },
      ],
    },
  },
};
const nextRaw = {
  MRData: {
    RaceTable: {
      season: "2026",
      Races: [
        {
          season: "2026", round: "23", raceName: "Abu Dhabi Grand Prix", date: "2026-11-29", time: "13:00:00Z",
          Circuit: { circuitId: "yas_marina", circuitName: "Yas Marina Circuit", Location: { locality: "Abu Dhabi", country: "UAE" } },
        },
      ],
    },
  },
};
const emptyNext = { MRData: { RaceTable: { season: "2026", Races: [] } } };

describe("mapDrivers", () => {
  it("converts string points to numbers and builds names", () => {
    const d = mapDrivers(driversRaw)!;
    expect(d[0]).toEqual({ pos: 1, name: "Max Verstappen", team: "Red Bull", teamId: "red_bull", points: 412.5 });
  });
  it("uses the latest team when a driver changed teams", () => {
    expect(mapDrivers(driversRaw)![1].teamId).toBe("ferrari");
  });
  it("survives missing fields", () => {
    expect(mapDrivers(driversRaw)![2]).toEqual({ pos: 3, name: "XYZ", team: "—", teamId: "", points: 0 });
  });
  it("returns null for junk and [] for a season with no standings yet", () => {
    expect(mapDrivers(null)).toBe(null);
    expect(mapDrivers({ nope: 1 })).toBe(null);
    expect(mapDrivers({ MRData: { StandingsTable: { StandingsLists: [] } } })).toEqual([]);
  });
});

describe("mapConstructors", () => {
  it("maps rows with numeric points", () => {
    expect(mapConstructors(constructorsRaw)).toEqual([{ pos: 1, name: "McLaren", teamId: "mclaren", points: 700 }]);
    expect(mapConstructors(undefined)).toBe(null);
  });
});

describe("mapNext", () => {
  it("builds the race start as a UTC ISO string", () => {
    expect(mapNext(nextRaw)).toEqual({
      round: 23, name: "Abu Dhabi Grand Prix", dateISO: "2026-11-29T13:00:00Z",
      circuitId: "yas_marina", circuitName: "Yas Marina Circuit", place: "Abu Dhabi, UAE",
    });
  });
  it("adds Z when the time has no zone, and midnight UTC when there is no time", () => {
    const withTime = (time?: string) => ({ MRData: { RaceTable: { Races: [{ date: "2026-03-01", ...(time ? { time } : {}) }] } } });
    expect(mapNext(withTime("05:30:00"))!.dateISO).toBe("2026-03-01T05:30:00Z");
    expect(mapNext(withTime())!.dateISO).toBe("2026-03-01T00:00:00Z");
  });
  it("returns null when there is no next race (season over)", () => {
    expect(mapNext(emptyNext)).toBe(null);
    expect(mapNext(null)).toBe(null);
    expect(mapNext({ MRData: { RaceTable: { Races: [{ raceName: "No date" }] } } })).toBe(null);
  });
});

describe("buildF1Data", () => {
  it("combines everything and takes the season from the standings", () => {
    const data = buildF1Data({ drivers: driversRaw, constructors: constructorsRaw, next: nextRaw });
    expect(data.season).toBe("2026");
    expect(data.drivers!.length).toBe(3);
    expect(data.constructors!.length).toBe(1);
    expect(data.next!.round).toBe(23);
  });
  it("keeps the other parts when one upstream call failed", () => {
    const data = buildF1Data({ drivers: null, constructors: constructorsRaw, next: nextRaw });
    expect(data.drivers).toBe(null);
    expect(data.constructors!.length).toBe(1);
    expect(data.season).toBe("2026");
  });
  it("handles an empty next race", () => {
    const data = buildF1Data({ drivers: driversRaw, constructors: constructorsRaw, next: emptyNext });
    expect(data.next).toBe(null);
    expect(data.drivers!.length).toBe(3);
  });
  it("is all-null when nothing came back", () => {
    expect(buildF1Data({})).toEqual({ season: null, drivers: null, constructors: null, next: null });
  });
});

describe("countdown", () => {
  const target = "2026-11-29T13:00:00Z";
  it("splits the time left into days, hours and minutes", () => {
    expect(countdown(target, Date.parse("2026-11-27T10:30:00Z"))).toEqual({ d: 2, h: 2, m: 30, started: false });
  });
  it("rounds partial minutes down", () => {
    expect(countdown(target, Date.parse(target) - 59_999)).toEqual({ d: 0, h: 0, m: 0, started: false });
  });
  it("is started at and after the target time", () => {
    expect(countdown(target, Date.parse(target))).toEqual({ d: 0, h: 0, m: 0, started: true });
    expect(countdown(target, Date.parse(target) + 3_600_000).started).toBe(true);
  });
  it("does not crash on a bad date", () => {
    expect(countdown("not a date", Date.now())).toEqual({ d: 0, h: 0, m: 0, started: false });
  });
});

describe("team colours", () => {
  it("falls back to neutral grey for unknown teams", () => {
    expect(teamColour("some_new_team")).toBe(NEUTRAL_TEAM_COLOUR);
    expect(teamColour("ferrari")).not.toBe(NEUTRAL_TEAM_COLOUR);
  });
});

/* Real responses: save them in __fixtures__/ with "driver", "constructor" or "next" in the file name. */
const dir = join(process.cwd(), "src/components/f1/__fixtures__");
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
const load = (key: string) => {
  const f = files.find((n) => n.toLowerCase().includes(key));
  return f ? JSON.parse(readFileSync(join(dir, f), "utf8")) : undefined;
};
describe("real fixtures", () => {
  const d = load("driver");
  const c = load("constructor");
  const n = load("next");
  if (d) it("driver standings map to ordered rows with numeric points", () => {
    const rows = mapDrivers(d)!;
    expect(rows.length > 0).toBe(true);
    expect(rows.every((r) => r.name !== "Unknown driver" && Number.isFinite(r.points) && r.teamId !== "")).toBe(true);
    expect(rows[0].pos).toBe(1);
  });
  if (c) it("constructor standings map to rows with numeric points", () => {
    const rows = mapConstructors(c)!;
    expect(rows.length > 0).toBe(true);
    expect(rows.every((r) => r.teamId !== "" && Number.isFinite(r.points))).toBe(true);
  });
  if (n) it("next race maps to a parseable start time (or null when the season is over)", () => {
    const race = mapNext(n);
    if (race) expect(Number.isFinite(Date.parse(race.dateISO))).toBe(true);
    else expect(race).toBe(null);
  });
});
