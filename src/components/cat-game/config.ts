/* Inferred from useCatGame.ts + its tests. SPEC.md was not in the zip, so confirm the numbers. */
export type CatId = "booboo" | "ash" | "cheese";

export interface CatConfig {
  id: CatId;
  name: string;
  color: "grey" | "black" | "orange";
  neutral: string;
  happy: string;
  paw: string;
}

export const CATS: CatConfig[] = [
  { id: "booboo", name: "Boo-boo Bear", color: "grey", neutral: "/cats/cat1-neutral.png", happy: "/cats/cat1-happy.png", paw: "/paws/paw-grey.png" },
  { id: "ash", name: "Ash", color: "black", neutral: "/cats/cat2-neutral.png", happy: "/cats/cat2-happy.png", paw: "/paws/paw-black.png" },
  { id: "cheese", name: "Cheese", color: "orange", neutral: "/cats/cat3-neutral.png", happy: "/cats/cat3-happy.png", paw: "/paws/paw-orange.png" },
];

export const AUDIO = { meow: "/audio/meow.mp3", purr: "/audio/purr.mp3" };

export const HAPPY_DURATION_MS = 10_000;
export const MUTED_DEFAULT = true;

export const METER = {
  max: 100,
  perPet: 5,
  idleBeforeDrainMs: 1500,
  drainPerSecond: 10,
  holdIntervalMs: 120,
  checkpoints: { bubble: 25, purr: 50, hearts: 75, badge: 100 },
};

export const STORAGE_KEYS = {
  best: "catgame:best",
  badges: "catgame:badges",
  muted: "catgame:muted",
};

/** window event the game fires when badges change, so the desk badge row can refresh */
export const BADGES_EVENT = "catgame:badges";
