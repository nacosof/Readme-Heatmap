export type ContributionLevel =
  | "NONE"
  | "FIRST_QUARTILE"
  | "SECOND_QUARTILE"
  | "THIRD_QUARTILE"
  | "FOURTH_QUARTILE";

export interface ContributionDay {
  date: string;
  contributionCount: number;
  contributionLevel: ContributionLevel;
  color: string;
}

export interface CommitRecord {
  oid: string;
  message: string;
  headline: string;
  date: string;
  url: string;
  repo: string;
}

export interface UserProfile {
  login: string;
  name: string | null;
  avatarUrl: string;
  publicRepos: number;
  followers: number;
  bio: string | null;
  commitsAllTime: number;
  uniqueRepos: number;
  longestStreak: number;
  rank: string;
  tagline: string;
  nightOwl: boolean;
  topRepo: string | null;
}

export interface ContributionsResponse {
  contributions: ContributionDay[][];
  totalContributions: number;
  longestStreak?: number;
  source?: "github" | "fallback";
  commits?: CommitRecord[];
  commitsTotal?: number;
  profile?: UserProfile;
}

export type ColorScheme =
  | "green"
  | "purple"
  | "blue"
  | "orange"
  | "pink"
  | "cyan";

export type VizStyle = "constellation";

export interface DateRange {
  from: string;
  to: string;
}

export type PeriodPreset = "30" | "90" | "180" | "365" | "all";

export interface HeatmapConfig {
  username: string;
  accentColor: string;
  viz: VizStyle;
  caption: string;
  bg: string;
  cardBg: string;
  cardText: string;
  period: PeriodPreset;
  repo: string;
}
