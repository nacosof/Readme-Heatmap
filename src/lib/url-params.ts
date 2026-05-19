import type { HeatmapConfig } from "./types";
import { DEFAULT_ACCENT, parseAccentColor } from "./colors";
import { defaultPeriod, parsePeriod } from "./date-range";

export const DEFAULT_BG = "#1a1c2c";
export const DEFAULT_CARD_BG = "#0f1118";
export const DEFAULT_CARD_TEXT = "#f4f4f4";

export function normalizeBgParam(bg: string | null): string {
  if (!bg) return DEFAULT_BG;
  const raw = bg.replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw}`;
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
  }
  if (bg.startsWith("#")) return bg;
  return DEFAULT_BG;
}

export function configFromSearchParams(
  params: URLSearchParams,
): HeatmapConfig {
  const period = parsePeriod(params.get("period"));

  return {
    username: params.get("user") ?? params.get("username") ?? "",
    accentColor: parseAccentColor(
      params.get("accent"),
      params.get("color") ?? params.get("scheme"),
    ),
    viz: "constellation",
    caption: params.get("caption") ?? params.get("text") ?? "",
    bg: normalizeBgParam(params.get("bg")),
    cardBg: params.get("cardBg")
      ? normalizeBgParam(params.get("cardBg"))
      : DEFAULT_CARD_BG,
    cardText: params.get("cardText")
      ? normalizeBgParam(params.get("cardText"))
      : DEFAULT_CARD_TEXT,
    period,
    repo: params.get("repo") ?? "",
  };
}

export function buildShareUrl(
  config: HeatmapConfig,
  origin: string,
): string {
  const params = new URLSearchParams();
  if (config.username) params.set("user", config.username);
  if (config.accentColor !== DEFAULT_ACCENT) {
    params.set("accent", config.accentColor.replace("#", ""));
  }
  if (config.caption) params.set("caption", config.caption);
  if (config.bg !== DEFAULT_BG) params.set("bg", config.bg.replace("#", ""));
  if (config.cardBg !== DEFAULT_CARD_BG) {
    params.set("cardBg", config.cardBg.replace("#", ""));
  }
  if (config.cardText !== DEFAULT_CARD_TEXT) {
    params.set("cardText", config.cardText.replace("#", ""));
  }
  if (config.period !== defaultPeriod()) params.set("period", config.period);
  if (config.repo) params.set("repo", config.repo);
  const qs = params.toString();
  return qs ? `${origin}/?${qs}` : `${origin}/`;
}
