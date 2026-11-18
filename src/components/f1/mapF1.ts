/* Pure: Jolpica (Ergast-format) JSON -> the small shapes the UI uses. No fetch, no React. */

export interface F1Driver { pos: number; name: string; team: string; teamId: string; points: number }
export interface F1Constructor { pos: number; name: string; teamId: string; points: number }
export interface F1Next {
  round: number;
  name: string;
  dateISO: string; // race start, UTC
  circuitId: string;
  circuitName: string;
  place: string;
}
/** A part is null when its upstream call failed (or had nothing usable). */
export interface F1Data {
  season: string | null;
  drivers: F1Driver[] | null;
  constructors: F1Constructor[] | null;
  next: F1Next | null;
}
export interface Countdown { d: number; h: number; m: number; started: boolean }

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const get = (o: unknown, ...path: string[]): unknown =>
  path.reduce<unknown>((acc, k) => (isObj(acc) ? acc[k] : undefined), o);
const str = (v: unknown, fallback = ""): string => {
  if (typeof v === "string") return v.trim() || fallback;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
};
/** Jolpica sends numbers as strings ("25"); tolerate junk. */
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
};
const last = (a: unknown[]): unknown => a[a.length - 1];

function standings(raw: unknown, key: "DriverStandings" | "ConstructorStandings") {
  const table = get(raw, "MRData", "StandingsTable");
  if (!isObj(table)) return null;
  const list = arr(table.StandingsLists)[0]; // undefined early in a season -> empty rows
  return {
    season: str(get(list, "season")) || str(table.season) || null,
    rows: arr(get(list, key)),
  };
}

export function mapDrivers(raw: unknown): F1Driver[] | null {
  const s = standings(raw, "DriverStandings");
  if (!s) return null;
  return s.rows.map((r, i) => {
    const team = last(arr(get(r, "Constructors"))); // latest team if they moved mid-season
    const name = `${str(get(r, "Driver", "givenName"))} ${str(get(r, "Driver", "familyName"))}`.trim();
    return {
      pos: num(get(r, "position"), i + 1),
      name: name || str(get(r, "Driver", "code"), "Unknown driver"),
      team: str(get(team, "name"), "—"),
      teamId: str(get(team, "constructorId")),
      points: num(get(r, "points")),
    };
  });
}

export function mapConstructors(raw: unknown): F1Constructor[] | null {
  const s = standings(raw, "ConstructorStandings");
  if (!s) return null;
  return s.rows.map((r, i) => ({
    pos: num(get(r, "position"), i + 1),
    name: str(get(r, "Constructor", "name"), "Unknown team"),
    teamId: str(get(r, "Constructor", "constructorId")),
    points: num(get(r, "points")),
  }));
}

/** Next race, or null when there isn't one (season over) or the data is unusable. */
export function mapNext(raw: unknown): F1Next | null {
  const race = arr(get(raw, "MRData", "RaceTable", "Races"))[0];
  if (!isObj(race)) return null;
  const date = str(race.date);
  if (!date) return null;
  const time = str(race.time);
  const hasZone = /Z$|[+-]\d{2}:?\d{2}$/.test(time);
  const dateISO = time ? `${date}T${hasZone ? time : `${time}Z`}` : `${date}T00:00:00Z`;
  return {
    round: num(race.round),
    name: str(race.raceName, "Grand Prix"),
    dateISO,
    circuitId: str(get(race, "Circuit", "circuitId")),
    circuitName: str(get(race, "Circuit", "circuitName")),
    place: [str(get(race, "Circuit", "Location", "locality")), str(get(race, "Circuit", "Location", "country"))]
      .filter(Boolean)
      .join(", "),
  };
}

/** Combine the three raw upstream responses (null = that call failed). */
export function buildF1Data(raw: { drivers?: unknown; constructors?: unknown; next?: unknown }): F1Data {
  const season =
    standings(raw.drivers, "DriverStandings")?.season ??
    standings(raw.constructors, "ConstructorStandings")?.season ??
    (str(get(arr(get(raw.next, "MRData", "RaceTable", "Races"))[0], "season")) || null);
  return {
    season,
    drivers: mapDrivers(raw.drivers),
    constructors: mapConstructors(raw.constructors),
    next: mapNext(raw.next),
  };
}

/** Time left until `targetISO`. `started` is true once the target time has passed. */
export function countdown(targetISO: string, nowMs: number): Countdown {
  const target = Date.parse(targetISO);
  if (!Number.isFinite(target)) return { d: 0, h: 0, m: 0, started: false };
  const diff = target - nowMs;
  if (diff <= 0) return { d: 0, h: 0, m: 0, started: true };
  const mins = Math.floor(diff / 60_000);
  return { d: Math.floor(mins / 1440), h: Math.floor((mins % 1440) / 60), m: mins % 60, started: false };
}
