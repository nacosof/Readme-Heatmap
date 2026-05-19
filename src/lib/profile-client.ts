import type { UserProfile } from "./types";

export async function fetchProfileClient(
  username: string,
): Promise<UserProfile> {
  const res = await fetch(
    `/api/profile/${encodeURIComponent(username)}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Error ${res.status}`);
  }

  return res.json() as Promise<UserProfile>;
}
