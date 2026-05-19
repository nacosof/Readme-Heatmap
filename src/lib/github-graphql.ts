import type {
  ContributionDay,
  ContributionLevel,
  ContributionsResponse,
} from "./types";
import { getGitHubToken } from "./github-token";

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

interface GraphQLWeek {
  contributionDays: {
    date: string;
    contributionCount: number;
    contributionLevel: string;
  }[];
}

interface GraphQLResponse {
  data?: {
    user?: {
      contributionsCollection?: {
        contributionCalendar?: {
          totalContributions: number;
          weeks: GraphQLWeek[];
        };
      };
    };
  };
  errors?: { message: string }[];
}

const VALID_LEVELS = new Set<string>([
  "NONE",
  "FIRST_QUARTILE",
  "SECOND_QUARTILE",
  "THIRD_QUARTILE",
  "FOURTH_QUARTILE",
]);

function toLevel(raw: string): ContributionLevel {
  if (VALID_LEVELS.has(raw)) return raw as ContributionLevel;
  return "NONE";
}

function computeLongestStreak(weeks: ContributionDay[][]): number {
  const days = weeks.flat().sort((a, b) => a.date.localeCompare(b.date));
  let best = 0;
  let current = 0;
  for (const d of days) {
    if (d.contributionCount > 0) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

const QUERY = `
  query UserContributions($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
            }
          }
        }
      }
    }
  }
`;

export async function fetchContributionsFromGitHub(
  username: string,
): Promise<ContributionsResponse> {
  const token = getGitHubToken();
  if (!token) {
    throw new Error("Add token to .env: GITHUB_TOKEN or GitHubUsername");
  }

  const res = await fetch(GITHUB_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { login: username },
    }),
    next: { revalidate: 1800 },
  });

  if (!res.ok) {
    throw new Error(`GitHub API: ${res.status}`);
  }

  const json = (await res.json()) as GraphQLResponse;

  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }

  const calendar =
    json.data?.user?.contributionsCollection?.contributionCalendar;

  if (!calendar?.weeks?.length) {
    throw new Error(`User «${username}» not found`);
  }

  const contributions: ContributionDay[][] = calendar.weeks.map((week) =>
    week.contributionDays.map((day) => ({
      date: day.date,
      contributionCount: day.contributionCount,
      contributionLevel: toLevel(day.contributionLevel),
      color: "",
    })),
  );

  return {
    contributions,
    totalContributions: calendar.totalContributions,
    longestStreak: computeLongestStreak(contributions),
    source: "github",
  };
}
