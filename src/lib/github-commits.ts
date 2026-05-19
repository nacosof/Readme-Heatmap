import type { CommitRecord } from "./types";
import { maxCommitsDisplay, maxCommitsFetch } from "./commit-limits";
import { getGitHubToken } from "./github-token";

const MAX_REPOS = 40;
const MAX_PAGES_PER_REPO = 5;

interface RestCommitItem {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { date: string };
    committer: { date: string };
  };
  author: { login: string } | null;
}

interface RepoItem {
  full_name: string;
  fork: boolean;
  pushed_at: string;
}

interface PushEvent {
  type: string;
  created_at: string;
  repo: { name: string };
  payload: {
    commits?: { sha: string; message: string; url: string }[];
  };
}

function sinceIso(fromDate: string): string {
  return new Date(`${fromDate}T00:00:00Z`).toISOString();
}

function headline(message: string): string {
  const line = message.split("\n")[0]?.trim() || "commit";
  return line.length > 80 ? `${line.slice(0, 77)}...` : line;
}

function dedupeByOid(commits: CommitRecord[]): CommitRecord[] {
  const map = new Map<string, CommitRecord>();
  for (const c of commits) {
    map.set(c.oid, c);
  }
  return [...map.values()];
}

function sampleEvenly<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) {
    out.push(items[Math.floor(i * step)]!);
  }
  return out;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function fetchRepos(
  username: string,
  token: string,
): Promise<RepoItem[]> {
  const res = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=${MAX_REPOS}`,
    { headers: authHeaders(token), next: { revalidate: 1800 } },
  );
  if (!res.ok) return [];
  const repos = (await res.json()) as RepoItem[];
  return repos.filter((r) => !r.fork);
}

async function fetchCommitsFromRepos(
  username: string,
  token: string,
  since: string,
  fetchCap: number,
): Promise<CommitRecord[]> {
  const repos = await fetchRepos(username, token);
  const all: CommitRecord[] = [];

  for (const repo of repos) {
    if (all.length >= fetchCap) break;

    for (let page = 1; page <= MAX_PAGES_PER_REPO; page++) {
      const res = await fetch(
        `https://api.github.com/repos/${repo.full_name}/commits?author=${encodeURIComponent(username)}&since=${since}&per_page=100&page=${page}`,
        { headers: authHeaders(token), next: { revalidate: 1800 } },
      );

      if (!res.ok) break;

      const items = (await res.json()) as RestCommitItem[];
      if (!Array.isArray(items) || !items.length) break;

      for (const item of items) {
        const login = item.author?.login?.toLowerCase();
        if (login && login !== username.toLowerCase()) {
          continue;
        }
        const date =
          item.commit.committer?.date ?? item.commit.author?.date ?? since;
        all.push({
          oid: item.sha,
          message: item.commit.message,
          headline: headline(item.commit.message),
          date,
          url: item.html_url,
          repo: repo.full_name,
        });
      }

      if (items.length < 100 || all.length >= fetchCap) break;
    }
  }

  return all;
}

async function fetchCommitsFromEvents(
  username: string,
  token: string,
  sinceMs: number,
  maxPages = 5,
): Promise<CommitRecord[]> {
  const all: CommitRecord[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100&page=${page}`,
      { headers: authHeaders(token), next: { revalidate: 1800 } },
    );
    if (!res.ok) break;

    const events = (await res.json()) as PushEvent[];
    if (!Array.isArray(events) || !events.length) break;

    let stop = false;
    for (const ev of events) {
      if (new Date(ev.created_at).getTime() < sinceMs) {
        stop = true;
        break;
      }
      if (ev.type !== "PushEvent" || !ev.payload?.commits?.length) continue;

      const repo = ev.repo?.name ?? "";
      for (const c of ev.payload.commits) {
        if (!c.sha) continue;
        all.push({
          oid: c.sha,
          message: c.message,
          headline: headline(c.message),
          date: ev.created_at,
          url:
            c.url ||
            (repo ? `https://github.com/${repo}/commit/${c.sha}` : c.url),
          repo,
        });
      }
    }

    if (stop) break;
  }

  return all;
}

export async function fetchUserCommits(
  username: string,
  from: string,
  to: string,
): Promise<{ commits: CommitRecord[]; commitsTotal: number }> {
  const token = getGitHubToken();
  if (!token) return { commits: [], commitsTotal: 0 };

  const displayCap = maxCommitsDisplay();
  const fetchCap = maxCommitsFetch(displayCap);
  const since = sinceIso(from);
  const fromMs = new Date(since).getTime();
  const toMs = new Date(`${to}T23:59:59.999Z`).getTime();
  const eventPages = from <= "2008-01-02" ? 10 : 8;

  const [fromRepos, fromEvents] = await Promise.all([
    fetchCommitsFromRepos(username, token, since, fetchCap),
    fetchCommitsFromEvents(username, token, fromMs, eventPages),
  ]);

  const merged = dedupeByOid([...fromEvents, ...fromRepos])
    .filter((c) => {
      const t = new Date(c.date).getTime();
      return t >= fromMs && t <= toMs;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const commitsTotal = merged.length;
  const commits = sampleEvenly(merged, displayCap);
  return { commits, commitsTotal };
}
