"use server";

import { execSync } from "child_process";

export interface ChangelogEntry {
  hash: string;
  date: string;
  message: string;
}

export interface BuildInfo {
  hash: string;
  commitCount: string;
}

export async function getBuildInfo(): Promise<BuildInfo> {
  try {
    const hash = execSync("git rev-parse --short HEAD", { encoding: "utf-8", timeout: 5000 }).trim();
    const commitCount = execSync("git rev-list --count HEAD", { encoding: "utf-8", timeout: 5000 }).trim();
    return { hash, commitCount };
  } catch {
    return { hash: "unknown", commitCount: "0" };
  }
}

export async function getChangelog(): Promise<ChangelogEntry[]> {
  try {
    const raw = execSync(
      'git log --no-merges --format="%h|%ad|%s" --date=format:"%d %b %Y"',
      { encoding: "utf-8", timeout: 5000 }
    );

    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, date, ...rest] = line.split("|");
        return { hash, date, message: rest.join("|") };
      });
  } catch {
    return [];
  }
}
