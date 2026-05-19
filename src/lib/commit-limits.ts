export function maxCommitsDisplay(): number {
  const n = Number(process.env.MAX_COMMITS);
  if (Number.isFinite(n) && n >= 100 && n <= 1200) {
    return Math.floor(n);
  }
  return 600;
}

export function maxCommitsFetch(displayCap: number): number {
  return Math.min(displayCap * 5, 4000);
}
