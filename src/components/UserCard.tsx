"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { toPng } from "html-to-image";
import type { UserProfile } from "@/lib/types";
import { formatStat } from "@/lib/user-card-meta";

export interface UserCardHandle {
  exportPng: () => Promise<void>;
}

interface Props {
  profile: UserProfile;
  accentColor: string;
  cardBg: string;
  cardText: string;
}

function StatBlock({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="user-card__stat">
      <span className="user-card__stat-value" style={{ color: accent }}>
        {value}
      </span>
      <span className="user-card__stat-label">{label}</span>
    </div>
  );
}

function cardTheme(cardBg: string, cardText: string, accent: string) {
  return {
    "--card-bg": cardBg,
    "--card-text": cardText,
    "--card-accent": accent,
    "--card-footer": `color-mix(in srgb, ${cardBg} 72%, #000)`,
    "--card-muted": `color-mix(in srgb, ${cardText} 58%, ${cardBg})`,
    "--card-panel": `color-mix(in srgb, ${cardBg} 88%, ${cardText})`,
  } as React.CSSProperties;
}

export const UserCard = forwardRef<UserCardHandle, Props>(function UserCard(
  { profile, accentColor, cardBg, cardText },
  ref,
) {
  const cardRef = useRef<HTMLDivElement>(null);
  const theme = useMemo(
    () => cardTheme(cardBg, cardText, accentColor),
    [cardBg, cardText, accentColor],
  );

  useImperativeHandle(ref, () => ({
    async exportPng() {
      const node = cardRef.current;
      if (!node) return;
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: cardBg,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `${profile.login}-dev-card.png`;
      link.href = dataUrl;
      link.click();
    },
  }));

  const displayName = profile.name ?? profile.login;
  const topRepoShort = profile.topRepo?.split("/").pop() ?? null;

  return (
    <div className="user-card-wrap">
      <p className="pixel-label user-card-wrap__title">Dev card</p>
      <div className="user-card-shell">
        <div ref={cardRef} className="user-card" style={theme}>
          <div className="user-card__scanlines" aria-hidden />
          <div className="user-card__glow" aria-hidden />
          <header className="user-card__header">
            <span className="user-card__badge">DEV CARD</span>
            {profile.nightOwl && (
              <span className="user-card__chip">NIGHT OWL</span>
            )}
          </header>

          <div className="user-card__main">
            <div className="user-card__avatar-wrap">
              <img
                src={profile.avatarUrl}
                alt=""
                className="user-card__avatar"
                width={72}
                height={72}
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="user-card__identity">
              <p className="user-card__nick">@{profile.login}</p>
              <h3 className="user-card__name">{displayName}</h3>
              {profile.bio && (
                <p className="user-card__bio">{profile.bio.slice(0, 72)}</p>
              )}
            </div>
          </div>

          <div className="user-card__stats">
            <StatBlock
              label="PUBLIC REPOS"
              value={formatStat(profile.publicRepos)}
              accent={accentColor}
            />
            <StatBlock
              label="COMMITS (ALL TIME)"
              value={formatStat(profile.commitsAllTime)}
              accent={accentColor}
            />
            <StatBlock
              label="REPOS TOUCHED"
              value={formatStat(profile.uniqueRepos)}
              accent={accentColor}
            />
            <StatBlock
              label="FOLLOWERS"
              value={formatStat(profile.followers)}
              accent={accentColor}
            />
          </div>

          <footer className="user-card__footer">
            <p className="user-card__rank">{profile.rank}</p>
            <p className="user-card__tagline">{profile.tagline}</p>
            {profile.longestStreak > 0 && (
              <p className="user-card__extra">
                longest streak: {profile.longestStreak}d
              </p>
            )}
            {topRepoShort && (
              <p className="user-card__extra">fav repo: {topRepoShort}</p>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
});
