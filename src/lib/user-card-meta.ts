import type { CommitRecord } from "./types";

export interface UserCardMeta {
  rank: string;
  tagline: string;
  uniqueRepos: number;
  nightOwl: boolean;
  topRepo: string | null;
}

const RANKS: { min: number; label: string }[] = [
  { min: 5000, label: "GITHUB FINAL BOSS" },
  { min: 1500, label: "SLEEP IS OPTIONAL" },
  { min: 500, label: "COMMIT GOBLIN" },
  { min: 200, label: "CODE ENJOYER" },
  { min: 50, label: "GIT REGULAR" },
  { min: 10, label: "TERMINAL TOURIST" },
  { min: 0, label: "FRESH SPAWN" },
];

function pickRank(commitsTotal: number): string {
  for (const r of RANKS) {
    if (commitsTotal >= r.min) return r.label;
  }
  return "FRESH SPAWN";
}

function pickTagline(
  login: string,
  opts: {
    nightPct: number;
    longestStreak: number;
    topRepo: string | null;
    commitsTotal: number;
  },
): string {
  const lines: string[] = [];

  if (opts.nightPct >= 0.4) lines.push("peak hours: 03:00");
  if (opts.longestStreak >= 14) {
    lines.push(`${opts.longestStreak}-day streak demon`);
  }
  if (opts.topRepo) {
    const short = opts.topRepo.split("/").pop() ?? opts.topRepo;
    lines.push(`main quest: ${short}`);
  }
  if (opts.commitsTotal >= 1000) lines.push("git push and pray");
  if (opts.commitsTotal >= 100 && opts.commitsTotal < 500) {
    lines.push("one more commit won't hurt");
  }
  if (!lines.length) lines.push("hello world energy");

  return pickLine(login, lines);
}

function pickLine(login: string, lines: string[]): string {
  if (!lines.length) return "hello world energy";
  let h = 0;
  for (let i = 0; i < login.length; i++) {
    h = (h + login.charCodeAt(i) * (i + 1)) % 9973;
  }
  return lines[h % lines.length]!;
}

export function buildUserCardMeta(
  login: string,
  commitsSample: CommitRecord[],
  commitsTotal: number,
  longestStreak: number,
): UserCardMeta {
  const repos = new Set(commitsSample.map((c) => c.repo));
  const hours = commitsSample.map((c) => new Date(c.date).getUTCHours());
  const night = hours.filter((h) => h >= 22 || h < 5).length;
  const nightPct = commitsSample.length ? night / commitsSample.length : 0;

  const repoCounts = new Map<string, number>();
  for (const c of commitsSample) {
    repoCounts.set(c.repo, (repoCounts.get(c.repo) ?? 0) + 1);
  }
  let topRepo: string | null = null;
  let topCount = 0;
  for (const [repo, count] of repoCounts) {
    if (count > topCount) {
      topCount = count;
      topRepo = repo;
    }
  }

  return {
    rank: pickRank(commitsTotal),
    tagline: pickTagline(login, {
      nightPct,
      longestStreak,
      topRepo,
      commitsTotal,
    }),
    uniqueRepos: repos.size,
    nightOwl: nightPct >= 0.35,
    topRepo,
  };
}

export function formatStat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
