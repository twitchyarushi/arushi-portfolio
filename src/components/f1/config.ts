export const API_BASE = "https://api.jolpi.ca/ergast/f1";
export const REVALIDATE_SECONDS = 3600;
export const ROWS = { drivers: 5, constructors: 3 };

export const NEUTRAL_TEAM_COLOUR = "#8a7f8a";

/** Keyed by Jolpica/Ergast constructorId. Unknown ids fall back to neutral grey. */
export const TEAM_COLOURS: Record<string, string> = {
  ferrari: "#b8473f",
  mclaren: "#e08a3c",
  mercedes: "#4fb0a5",
  red_bull: "#4f6fb5",
  rb: "#7b8fd1",
  aston_martin: "#3f8a6b",
  alpine: "#5b8ad0",
  williams: "#3f78c8",
  haas: "#9a9fa8",
  sauber: "#6faa3f",
  audi: "#8fb04a",
  cadillac: "#a58bc9",
};

export const teamColour = (constructorId: string): string =>
  TEAM_COLOURS[constructorId] ?? NEUTRAL_TEAM_COLOUR;
