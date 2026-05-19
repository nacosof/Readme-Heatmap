import { NextRequest, NextResponse } from "next/server";
import { fetchContributions } from "@/lib/contributions";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const period = request.nextUrl.searchParams.get("period");
  try {
    const data = await fetchContributions(username, { period });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
