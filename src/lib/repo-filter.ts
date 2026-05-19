import type { CommitRecord } from "./types";

export interface RepoOption {
  name: string;
  count: number;
}

export function listRepos(commits: CommitRecord[]): RepoOption[] {
  const counts = new Map<string, number>();
  for (const c of commits) {
    const repo = c.repo?.trim() || "unknown";
    counts.set(repo, (counts.get(repo) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function filterCommitsByRepo(
  commits: CommitRecord[],
  repo: string | null,
): CommitRecord[] {
  if (!repo) return commits;
  return commits.filter((c) => c.repo === repo);
}

export function shortRepoName(full: string): string {
  const parts = full.split("/");
  return parts.length >= 2 ? parts[parts.length - 1]! : full;
}
