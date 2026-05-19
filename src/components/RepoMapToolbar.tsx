"use client";

import { useMemo } from "react";
import type { CommitRecord } from "@/lib/types";
import { listRepos, shortRepoName } from "@/lib/repo-filter";
import { PixelDropdown } from "@/components/PixelDropdown";

interface Props {
  commits: CommitRecord[];
  value: string;
  onChange: (repo: string) => void;
}

export function RepoMapToolbar({ commits, value, onChange }: Props) {
  const options = useMemo(() => listRepos(commits), [commits]);
  const total = commits.length;

  const dropdownOptions = useMemo(
    () => [
      { value: "", label: `All commits (${total})` },
      ...options.map(({ name, count }) => ({
        value: name,
        label: `${shortRepoName(name)} (${count})`,
      })),
    ],
    [total, options],
  );

  return (
    <div className="constellation-toolbar">
      <span className="constellation-toolbar__label">Repository</span>
      <PixelDropdown
        value={value}
        options={dropdownOptions}
        onChange={onChange}
        ariaLabel="Select repository"
      />
    </div>
  );
}
