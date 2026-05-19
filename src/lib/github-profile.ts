import { ALL_TIME_FROM, toIsoDate } from "./date-range";
import { fetchUserCommits } from "./github-commits";
import { getGitHubToken } from "./github-token";
import { buildUserCardMeta } from "./user-card-meta";
import type { UserProfile } from "./types";

interface RestUser {
  login: string;
  name: string | null;
  avatar_url: string;
  public_repos: number;
  followers: number;
  bio: string | null;
}

export async function fetchGitHubProfile(
  username: string,
  longestStreak = 0,
): Promise<UserProfile> {
  const token = getGitHubToken();
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "readme-heatmap-canvas",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}`,
    { headers, next: { revalidate: 600 } },
  );

  if (!res.ok) {
    if (res.status === 404) throw new Error(`User «${username}» not found`);
    throw new Error(`GitHub profile: ${res.status}`);
  }

  const user = (await res.json()) as RestUser;
  const to = toIsoDate(new Date());

  let commitsAllTime = 0;
  let commitsSample: Awaited<ReturnType<typeof fetchUserCommits>>["commits"] =
    [];

  if (token) {
    const all = await fetchUserCommits(username, ALL_TIME_FROM, to);
    commitsAllTime = all.commitsTotal;
    commitsSample = all.commits;
  }

  const meta = buildUserCardMeta(
    user.login,
    commitsSample,
    commitsAllTime,
    longestStreak,
  );

  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    publicRepos: user.public_repos,
    followers: user.followers,
    bio: user.bio,
    commitsAllTime,
    uniqueRepos: meta.uniqueRepos,
    longestStreak,
    rank: meta.rank,
    tagline: meta.tagline,
    nightOwl: meta.nightOwl,
    topRepo: meta.topRepo,
  };
}
