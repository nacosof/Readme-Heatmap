import type { ColorScheme, ContributionLevel } from "./types";

export interface SchemeColors {
  empty: string;
  levels: [string, string, string, string];
  accent: string;
}

export const DEFAULT_ACCENT = "#00e436";

export const COLOR_SCHEMES: Record<ColorScheme, SchemeColors> = {
  green: {
    empty: "#0f1a12",
    levels: ["#145c2a", "#1f8a3f", "#00c853", "#00e436"],
    accent: "#00e436",
  },
  purple: {
    empty: "#1e1a2e",
    levels: ["#3b1f5c", "#5c2d91", "#8957e5", "#bc8cff"],
    accent: "#bc8cff",
  },
  blue: {
    empty: "#1a2433",
    levels: ["#0c2d6b", "#1f4b99", "#388bfd", "#79c0ff"],
    accent: "#79c0ff",
  },
  orange: {
    empty: "#2e2218",
    levels: ["#6b3a0c", "#9a5b14", "#d18616", "#f0a030"],
    accent: "#f0a030",
  },
  pink: {
    empty: "#2e1a22",
    levels: ["#6b1f3d", "#9e2f5c", "#db61a2", "#ff8cc8"],
    accent: "#ff8cc8",
  },
  cyan: {
    empty: "#1a2a2e",
    levels: ["#0c4a52", "#147a85", "#2ec4cf", "#5eead4"],
    accent: "#5eead4",
  },
};

const LEVEL_MAP: Record<ContributionLevel, number> = {
  NONE: -1,
  FIRST_QUARTILE: 0,
  SECOND_QUARTILE: 1,
  THIRD_QUARTILE: 2,
  FOURTH_QUARTILE: 3,
};

export function levelToIndex(level: ContributionLevel): number {
  return LEVEL_MAP[level];
}

export function colorForLevel(
  level: number,
  scheme: ColorScheme,
): string {
  const colors = COLOR_SCHEMES[scheme];
  if (level < 0) return colors.empty;
  return colors.levels[level];
}

export function colorForDay(
  level: ContributionLevel,
  scheme: ColorScheme,
): string {
  return colorForLevel(levelToIndex(level), scheme);
}

export function parseScheme(value: string | null): ColorScheme {
  const schemes = Object.keys(COLOR_SCHEMES) as ColorScheme[];
  if (value && schemes.includes(value as ColorScheme)) {
    return value as ColorScheme;
  }
  return "green";
}

export function normalizeHex(hex: string | null | undefined): string {
  if (!hex) return DEFAULT_ACCENT;
  const raw = hex.replace(/^#/, "").trim();
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toLowerCase();
  }
  if (hex.startsWith("#")) return hex;
  return DEFAULT_ACCENT;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mixRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function toHex(c: { r: number; g: number; b: number }): string {
  return rgbToHex(c.r, c.g, c.b);
}

export function buildSchemeFromAccent(accent: string): SchemeColors {
  const base = hexToRgb(accent);
  const black = { r: 0, g: 0, b: 0 };
  const accentHex = toHex(base);
  return {
    accent: accentHex,
    levels: [
      toHex(mixRgb(base, black, 0.55)),
      toHex(mixRgb(base, black, 0.38)),
      toHex(mixRgb(base, black, 0.18)),
      accentHex,
    ],
    empty: toHex(mixRgb(base, black, 0.78)),
  };
}

export function parseAccentColor(
  accentParam: string | null,
  legacySchemeParam: string | null,
): string {
  if (accentParam) return normalizeHex(accentParam);
  if (legacySchemeParam) {
    return COLOR_SCHEMES[parseScheme(legacySchemeParam)].accent;
  }
  return DEFAULT_ACCENT;
}
