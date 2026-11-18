/* Matcha game constants and copy. Everything here comes from MATCHA_SPEC.md; tune by editing this file only. */

export type StepId = "sift" | "pour" | "whisk";
export type Stars = 1 | 2 | 3;

export interface StepConfig {
  id: StepId;
  /** Number shown in the step pill. */
  n: number;
  label: string;
  subtitle: string;
  caption: string;
}

export const TITLE = "Whisk the matcha";

export const STEPS: readonly StepConfig[] = [
  { id: "sift", n: 1, label: "Sift", subtitle: "hold down to sift the matcha powder.", caption: "sift the powder" },
  { id: "pour", n: 2, label: "Pour", subtitle: "hold down to pour in the water.", caption: "pour in the water" },
  {
    id: "whisk",
    n: 3,
    label: "Whisk",
    subtitle: "hold and drag in circles to whisk, stop when the froth hits the perfect zone.",
    caption: "whisk in circles",
  },
];

/** Steps always run in this order. */
export const STEP_ORDER: readonly StepId[] = ["sift", "pour", "whisk"];

/* ---------- Tuning constants ---------- */

/** Froth percentage (rounded) that counts as perfect. Matches the green segment on the bar. */
export const ZONE = { min: 72, max: 88 } as const;
/** Froth added per full circle around the bowl centre. */
export const FROTH_PER_TURN = 15;
/** Froth added per keyboard tap (Space/Enter) while whisking. */
export const KEY_TAP_FROTH = 2;
export const SIFT_SECONDS = 2.5;
export const POUR_SECONDS = 2;
/** Whisking must stop this long before the round ends. */
export const IDLE_END_MS = 800;
/** The round can only end once froth has reached this. */
export const MIN_FROTH_TO_END = 15;
/** Pause at 100% before a sift/pour step completes and the next one starts. */
export const AUTO_ADVANCE_MS = 600;
/** Pointer moves closer than this fraction of the panel size to the centre don't count. */
export const MIN_RADIUS_FRAC = 0.12;

/** The oval where the drink sits, as fractions of the bowl image (approximate, tune by eye). */
export const SURFACE = { cx: 0.5, cy: 0.35, rx: 0.34, ry: 0.12 };
export const BUBBLES_MAX = 40;
/** Bubbles are drawn this much larger once froth is above ZONE.max. */
export const BUBBLE_OVERSIZE = 1.4;
/** Opacity of the pale foam tint at 100% froth. */
export const FOAM_TINT_MAX = 0.6;
/** Pitcher tilt while pouring (counter-clockwise is negative). */
export const POUR_TILT_DEG = -35;
/** Whisk image is rotated this much so the tines point down into the bowl. */
export const WHISK_ROTATE_DEG = 180;
/** Centre of the tines, as fractions of the whisk image. It sits on the pointer. */
export const WHISK_ANCHOR = { x: 0.5, y: 0.3 };
/** The drawn whisk is clamped to the SURFACE oval scaled by this. */
export const WHISK_CLAMP_PAD = 1.1;
/** Spout tip, as fractions of the pitcher image. */
export const JUG_SPOUT = { x: 0.07, y: 0.32 };
/** Where powder dots start falling, as fractions of the sieve image. */
export const SIEVE_DROP = { x: 0.3, y: 0.8 };

/** Positions are fractions of the illustration panel; w is a fraction of the panel width. Tune by eye. */
export const SCENE = {
  bowl: { cx: 0.5, cy: 0.62, w: 0.58 },
  sieve: { cx: 0.46, cy: 0.22, w: 0.55 },
  pitcher: { cx: 0.76, cy: 0.24, w: 0.36 },
  scoop: { cx: 0.18, cy: 0.84, w: 0.3 },
} as const;

/**
 * Per-image nudge so the three bowl states line up when they crossfade.
 * Scale about the image centre, then shift by dx/dy as fractions of the image size
 * (CSS: transform: translate(dx*100%, dy*100%) scale(scale)).
 * Measured from the current 2400x2400 exports (rim width and foot aligned to bowl-liquid); adjust if you re-export.
 */
export const BOWL_FIT = {
  bowlEmpty: { scale: 1.068, dx: -0.0035, dy: 0.0338 },
  bowlPowder: { scale: 0.924, dx: 0.0084, dy: -0.0253 },
  bowlLiquid: { scale: 1, dx: 0, dy: 0 },
} as const;

/* ---------- Images (public/matcha/) ---------- */

/** Change this one line if you export PNGs instead of WebP. */
export const IMAGE_EXT = "webp";

export type ImageId =
  | "bowlEmpty"
  | "bowlPowder"
  | "bowlLiquid"
  | "sieveEmpty"
  | "sievePowder"
  | "pitcher"
  | "whisk"
  | "scoop";

/** `alt` doubles as the text shown by the onError fallback. */
export const IMAGES: Record<ImageId, { src: string; alt: string }> = {
  bowlEmpty: { src: `/matcha/bowl-empty.${IMAGE_EXT}`, alt: "empty bowl" },
  bowlPowder: { src: `/matcha/bowl-sift.${IMAGE_EXT}`, alt: "bowl with matcha powder" },
  bowlLiquid: { src: `/matcha/bowl-liquid.${IMAGE_EXT}`, alt: "bowl with matcha" },
  sieveEmpty: { src: `/matcha/empty-sieve.${IMAGE_EXT}`, alt: "sieve" },
  sievePowder: { src: `/matcha/sieve.${IMAGE_EXT}`, alt: "sieve with matcha powder" },
  pitcher: { src: `/matcha/pitcher.${IMAGE_EXT}`, alt: "measuring jug" },
  whisk: { src: `/matcha/whisk.${IMAGE_EXT}`, alt: "bamboo whisk" },
  scoop: { src: `/matcha/scoop.${IMAGE_EXT}`, alt: "bamboo scoop" },
};

/* ---------- Results ---------- */

export interface ResultBand {
  /** Inclusive, whole-number froth percentages (froth is rounded before it is rated). */
  min: number;
  max: number;
  stars: Stars;
  message: string;
}

export const RESULT_BANDS: readonly ResultBand[] = [
  { min: 72, max: 88, stars: 3, message: "Perfectly frothy!" },
  { min: 60, max: 71, stars: 2, message: "Almost there!" },
  { min: 35, max: 59, stars: 1, message: "A bit flat, whisk a little more next time." },
  { min: 0, max: 34, stars: 1, message: "Barely any froth." },
  { min: 89, max: 95, stars: 2, message: "Over-whisked, a bit too bubbly." },
  { min: 96, max: 100, stars: 1, message: "Way too foamy!" },
];

/** Shown in the result card before the round ends. */
export const WHISK_HINT = "stop when the bar reaches the green zone";

/* ---------- Added with the static UI (MatchaGame.tsx) ---------- */

/** Illustration panel width / height. */
export const PANEL_RATIO = 1.06;
/** Width / height of each exported image (2400x2400 bowls, 2400x1800 sieve, ...). Update if you re-export. */
export const IMAGE_ASPECT = { bowl: 1, sieve: 4 / 3, pitcher: 1, whisk: 2 / 3, scoop: 5 / 3 } as const;
/** Whisk image width as a fraction of the panel width. */
export const WHISK_W = 0.28;
/**
 * sieve.webp (2400x1800, with powder) is the reference canvas. empty-sieve.webp is a differently cropped export of the
 * same strainer, so it is drawn at these fractions of that canvas to line up when they crossfade (fitted by silhouette overlap).
 */
export const SIEVE_FIT = { left: 0.047, top: -0.133, w: 0.924, h: 1.327 } as const;