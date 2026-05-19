"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ContributionsResponse, HeatmapConfig } from "@/lib/types";
import { fetchContributionsClient } from "@/lib/contributions";
import {
  ConstellationCanvas,
  type ConstellationCanvasHandle,
} from "@/components/ConstellationCanvas";
import { RepoMapToolbar } from "@/components/RepoMapToolbar";
import { BuiltBy } from "@/components/BuiltBy";
import { UserCard, type UserCardHandle } from "@/components/UserCard";
import { fetchProfileClient } from "@/lib/profile-client";
import type { UserProfile } from "@/lib/types";
import { filterCommitsByRepo } from "@/lib/repo-filter";
import { DEFAULT_ACCENT } from "@/lib/colors";
import { PixelColorPicker } from "@/components/PixelColorPicker";
import {
  buildShareUrl,
  configFromSearchParams,
  DEFAULT_BG,
  DEFAULT_CARD_BG,
  DEFAULT_CARD_TEXT,
} from "@/lib/url-params";
import {
  defaultPeriod,
  filterCommitsByPeriod,
  formatPeriodLabel,
} from "@/lib/date-range";
import type { PeriodPreset } from "@/lib/types";

const PERIOD_PRESETS: {
  label: string;
  period: PeriodPreset;
  wide?: boolean;
}[] = [
  { label: "1 mo", period: "30" },
  { label: "3 mo", period: "90" },
  { label: "6 mo", period: "180" },
  { label: "1 yr", period: "365" },
  { label: "All time", period: "all", wide: true },
];

export function HeatmapEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const constellationRef = useRef<ConstellationCanvasHandle>(null);
  const userCardRef = useRef<UserCardHandle>(null);
  const [devCardExporting, setDevCardExporting] = useState(false);

  const [config, setConfig] = useState<HeatmapConfig>(() =>
    configFromSearchParams(new URLSearchParams(searchParams.toString())),
  );
  const [data, setData] = useState<ContributionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const next = configFromSearchParams(
      new URLSearchParams(searchParams.toString()),
    );
    setConfig((prev) => ({ ...prev, ...next }));
  }, [searchParams]);

  const skipUrlSync = useRef(true);
  const skipPeriodReload = useRef(true);

  const update = useCallback((patch: Partial<HeatmapConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    if (skipUrlSync.current) {
      skipUrlSync.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (config.username) params.set("user", config.username);
    if (config.accentColor !== DEFAULT_ACCENT) {
      params.set("accent", config.accentColor.replace("#", ""));
    }
    if (config.caption) params.set("caption", config.caption);
    if (config.bg !== DEFAULT_BG) params.set("bg", config.bg.replace("#", ""));
    if (config.cardBg !== DEFAULT_CARD_BG) {
      params.set("cardBg", config.cardBg.replace("#", ""));
    }
    if (config.cardText !== DEFAULT_CARD_TEXT) {
      params.set("cardText", config.cardText.replace("#", ""));
    }
    if (config.period !== defaultPeriod()) params.set("period", config.period);
    if (config.repo) params.set("repo", config.repo);
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }, [config, router]);

  const loadUser = useCallback(async () => {
    const user = config.username.trim();
    if (!user) {
      setError("Enter a GitHub username");
      return;
    }
    setLoading(true);
    setError(null);
    setProfile(null);
    try {
      const result = await fetchContributionsClient(user, config.period);
      setData(result);
      setConfig((prev) => ({ ...prev, repo: "" }));
      setProfileLoading(true);
      void fetchProfileClient(user)
        .then(setProfile)
        .catch(() => setProfile(null))
        .finally(() => setProfileLoading(false));
      if (result.commits?.length) {
        setError(null);
      } else {
        setError(
          `No commits ${formatPeriodLabel(config.period)} for «${user}».`,
        );
      }
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [config.username, config.period]);

  useEffect(() => {
    const user = config.username.trim();
    if (user && searchParams.get("user")) {
      void loadUser();
    }
  }, []);

  useEffect(() => {
    if (skipPeriodReload.current) {
      skipPeriodReload.current = false;
      return;
    }
    if (!config.username.trim() || !data) return;
    void loadUser();
  }, [config.period]);

  const handleExportConstellation = () => {
    if (!hasFilteredCommits) return;
    constellationRef.current?.exportPng(
      `constellation-${config.username || "user"}.png`,
    );
  };

  const handleExportDevCard = async () => {
    if (!profile || !userCardRef.current) return;
    setDevCardExporting(true);
    try {
      await userCardRef.current.exportPng();
    } finally {
      setDevCardExporting(false);
    }
  };

  const shareUrl = origin ? buildShareUrl(config, origin) : "";

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const periodCommits = useMemo(() => {
    const commits = data?.commits ?? [];
    return filterCommitsByPeriod(commits, config.period);
  }, [data?.commits, config.period]);
  const hasCommits = periodCommits.length > 0;
  const filteredCommits = useMemo(
    () => filterCommitsByRepo(periodCommits, config.repo || null),
    [periodCommits, config.repo],
  );
  const hasFilteredCommits = filteredCommits.length > 0;

  return (
    <div className="page-shell">
      <header className="site-header mb-6 text-center sm:mb-10">
        <p
          className="mb-2 text-[7px] uppercase tracking-widest text-[var(--accent)] sm:text-[10px]"
          style={{ fontFamily: "var(--font-press-start)" }}
        >
          GitHub Readme Heatmap
        </p>
        <h1 className="text-[var(--text)]">Commit constellation</h1>
      </header>

      <div className="editor-layout">
        <aside className="controls-stack order-1 lg:order-2">
          <div className="pixel-border pixel-panel bg-[var(--bg-panel)]">
            <label className="pixel-label">GitHub username</label>
            <input
              className="pixel-input mb-3"
              placeholder="octocat"
              value={config.username}
              onChange={(e) => update({ username: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && void loadUser()}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="pixel-btn pixel-btn-primary w-full"
              onClick={() => void loadUser()}
              disabled={loading}
            >
              {loading ? "..." : "Load"}
            </button>
            {shareUrl && (
              <button
                type="button"
                className="pixel-btn pixel-btn-secondary mt-2 w-full"
                onClick={() => void copyLink()}
              >
                {linkCopied ? "Copied!" : "Copy link"}
              </button>
            )}
          </div>

          <div className="pixel-border pixel-panel bg-[var(--bg-panel)]">
            <label className="pixel-label">Commit period</label>
            <div className="date-range-presets">
              {PERIOD_PRESETS.map(({ label, period, wide }) => (
                <button
                  key={period}
                  type="button"
                  aria-pressed={config.period === period}
                  className={`pixel-btn pixel-btn-secondary date-range-preset${wide ? " date-range-preset--wide" : ""}${config.period === period ? " active" : ""}`}
                  onClick={() => update({ period })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="pixel-border pixel-panel bg-[var(--bg-panel)]">
            <label className="pixel-label">Caption</label>
            <input
              className="pixel-input"
              placeholder="coded like crazy"
              maxLength={48}
              value={config.caption}
              onChange={(e) => update({ caption: e.target.value })}
            />
          </div>

          <div className="pixel-border pixel-panel bg-[var(--bg-panel)]">
            <PixelColorPicker
              label="Node color"
              value={config.accentColor}
              onChange={(accentColor) => update({ accentColor })}
            />
          </div>

          <div className="pixel-border pixel-panel bg-[var(--bg-panel)]">
            <PixelColorPicker
              label="Background"
              value={config.bg}
              onChange={(bg) => update({ bg })}
            />
          </div>

          {profile && (
            <div className="pixel-border pixel-panel bg-[var(--bg-panel)]">
              <label className="pixel-label mb-3 block">Dev card colors</label>
              <div className="grid gap-3">
                <PixelColorPicker
                  label="Card background"
                  value={config.cardBg}
                  onChange={(cardBg) => update({ cardBg })}
                />
                <PixelColorPicker
                  label="Card text"
                  value={config.cardText}
                  onChange={(cardText) => update({ cardText })}
                />
              </div>
            </div>
          )}

          <div className="actions-row actions-row--pair">
            <button
              type="button"
              className="pixel-btn pixel-btn-primary w-full"
              onClick={() => void handleExportDevCard()}
              disabled={!profile || devCardExporting}
            >
              {devCardExporting ? "..." : "Download dev card"}
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn-primary w-full"
              onClick={handleExportConstellation}
              disabled={!hasFilteredCommits}
            >
              Download constellation
            </button>
          </div>
        </aside>

        <section className="order-2 min-w-0 lg:order-1">
          <div className="pixel-border pixel-panel bg-[var(--bg-panel)]">
            <div className="canvas-wrap constellation-wrap">
              <div className="constellation-stage">
                {periodCommits.length > 0 && (
                  <RepoMapToolbar
                    commits={periodCommits}
                    value={config.repo}
                    onChange={(repo) => update({ repo })}
                  />
                )}
                {loading && (
                  <p className="animate-pulse py-16 text-center text-sm text-[var(--text-muted)]">
                    Loading commits…
                  </p>
                )}
                {!loading && error && !hasCommits && (
                  <p className="px-4 py-12 text-center text-sm text-[var(--danger)]">
                    {error}
                  </p>
                )}
                {!loading && !error && !data && (
                  <p className="px-4 py-12 text-center text-sm text-[var(--text-muted)]">
                    Enter username and click Load
                  </p>
                )}
                {!loading && data && !periodCommits.length && !error && (
                  <p className="px-4 py-12 text-center text-sm text-[var(--text-muted)]">
                    No commits {formatPeriodLabel(config.period)}
                  </p>
                )}
                {periodCommits.length > 0 &&
                  !hasFilteredCommits &&
                  !loading && (
                    <p className="px-4 py-12 text-center text-sm text-[var(--text-muted)]">
                      No commits in this repo for the selected period
                    </p>
                  )}
                {hasFilteredCommits && data && (
                  <ConstellationCanvas
                    key={config.repo || "__all__"}
                    ref={constellationRef}
                    commits={filteredCommits}
                    commitsTotal={config.repo ? undefined : data.commitsTotal}
                    config={config}
                  />
                )}
              </div>
            </div>
            {profileLoading && config.username && data && (
              <p className="user-card-loading">Loading dev card…</p>
            )}
            {profile && !profileLoading && (
              <UserCard
                ref={userCardRef}
                profile={profile}
                accentColor={config.accentColor}
                cardBg={config.cardBg}
                cardText={config.cardText}
              />
            )}
          </div>
        </section>
      </div>

      <BuiltBy />
    </div>
  );
}
