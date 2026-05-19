import { NextRequest, NextResponse } from "next/server";
import { fetchContributionsFromGitHub } from "@/lib/github-graphql";
import { fetchGitHubProfile } from "@/lib/github-profile";
import { hasGitHubToken } from "@/lib/github-token";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  try {
    let longestStreak = 0;
    if (hasGitHubToken()) {
      try {
        const base = await fetchContributionsFromGitHub(username);
        longestStreak = base.longestStreak ?? 0;
      } catch {
        longestStreak = 0;
      }
    }

    const profile = await fetchGitHubProfile(username, longestStreak);
    return NextResponse.json(profile, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
