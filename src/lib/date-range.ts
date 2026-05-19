import type { CommitRecord } from "./types";
import type { DateRange, PeriodPreset } from "./types";

export const ALL_TIME_FROM = "2008-01-01";

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function defaultPeriod(): PeriodPreset {
  return "365";
}

export function parsePeriod(value: string | null): PeriodPreset {
  if (
    value === "30" ||
    value === "90" ||
    value === "180" ||
    value === "365" ||
    value === "all"
  ) {
    return value;
  }
  return defaultPeriod();
}

export function rangeAllTime(): DateRange {
  return { from: ALL_TIME_FROM, to: toIsoDate(new Date()) };
}

export function rangeFromDays(days: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export function rangeFromPeriod(period: PeriodPreset): DateRange {
  if (period === "all") return rangeAllTime();
  return rangeFromDays(Number(period));
}

export function formatPeriodLabel(period: PeriodPreset): string {
  switch (period) {
    case "30":
      return "last month";
    case "90":
      return "last 3 months";
    case "180":
      return "last 6 months";
    case "365":
      return "last year";
    case "all":
      return "all time";
  }
}

export function rangeBounds(range: DateRange): { fromMs: number; toMs: number } {
  const fromMs = new Date(`${range.from}T00:00:00Z`).getTime();
  const toMs = new Date(`${range.to}T23:59:59.999Z`).getTime();
  return { fromMs, toMs };
}

export function filterCommitsByPeriod(
  commits: CommitRecord[],
  period: PeriodPreset,
): CommitRecord[] {
  const { fromMs, toMs } = rangeBounds(rangeFromPeriod(period));
  return commits.filter((c) => {
    const t = new Date(c.date).getTime();
    return t >= fromMs && t <= toMs;
  });
}
