import type { ContributionsResponse } from "./types";
import { parsePeriod, rangeFromPeriod } from "./date-range";
import { fetchUserCommits } from "./github-commits";
import { fetchContributionsFromGitHub } from "./github-graphql";
import { hasGitHubToken } from "./github-token";

const FALLBACK_API = "https://github-contributions-api.deno.dev";

function validateUsername(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (!normalized || !/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i.test(normalized)) {
    throw new Error("Invalid GitHub username");
  }
  return normalized;
}

async function fetchFromDenoApi(username: string): Promise<ContributionsResponse> {
  const res = await fetch(`${FALLBACK_API}/${encodeURIComponent(username)}.json`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`User «${username}» not found`);
    }
    throw new Error(`Fallback API: ${res.status}`);
  }

  const data = (await res.json()) as ContributionsResponse;
  if (!data.contributions?.length) {
    throw new Error("No contribution data");
  }

  return { ...data, source: "fallback" };
}

export async function fetchContributions(
  username: string,
  opts?: { period?: string | null },
): Promise<ContributionsResponse> {
  const normalized = validateUsername(username);
  const { from, to } = rangeFromPeriod(parsePeriod(opts?.period ?? null));
  const hasToken = hasGitHubToken();

  let base: ContributionsResponse;

  if (hasToken) {
    try {
      base = await fetchContributionsFromGitHub(normalized);
    } catch {
      base = await fetchFromDenoApi(normalized);
    }
  } else {
    base = await fetchFromDenoApi(normalized);
  }

  if (!hasToken) {
    return { ...base, commits: [] };
  }

  const { commits, commitsTotal } = await fetchUserCommits(
    normalized,
    from,
    to,
  );
  return { ...base, commits, commitsTotal };
}

export async function fetchContributionsClient(
  username: string,
  period: string,
): Promise<ContributionsResponse> {
  const normalized = validateUsername(username);
  const params = new URLSearchParams({ period });
  const res = await fetch(
    `/api/contributions/${encodeURIComponent(normalized)}?${params}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Error ${res.status}`);
  }

  return res.json() as Promise<ContributionsResponse>;
}
