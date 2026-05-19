export function getGitHubToken(): string | undefined {
  const token =
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GitHubUsername?.trim();

  if (!token) return undefined;

  if (
    token.startsWith("ghp_") ||
    token.startsWith("github_pat_") ||
    token.startsWith("gho_")
  ) {
    return token;
  }

  return token;
}

export function hasGitHubToken(): boolean {
  return Boolean(getGitHubToken());
}
