import { NO_POSTER_REPORT_DELAY_MS } from "./animation/timing";
import type { ListReportSymptom } from "./movieTiles";

export interface ListGithubIssueContext {
  symptom: ListReportSymptom;
  country?: string;
  listUrl?: string;
  listSource: "letterboxd_url";
  /** Films on the last processed page (batch) */
  lastBatchFilmCount: number;
  totalPages: number;
  lastPage: number;
  /** Tiles currently in list tab state */
  tileCount: number;
  pageUrl: string;
  userAgent: string;
}

const DEFAULT_ISSUES_NEW_BASE =
  "https://github.com/DiegoFleitas/letterboxd-movie-justwatch/issues/new";

function getIssuesNewBaseUrl(): string {
  const raw = import.meta.env.VITE_GITHUB_ISSUES_NEW_BASE as string | undefined;
  if (raw?.trim()) return raw.trim().replace(/\/$/, "");
  return DEFAULT_ISSUES_NEW_BASE;
}

function issueTitle(symptom: ListReportSymptom): string {
  if (symptom === "no_tiles") return "[List] No tiles after search";
  return "[List] Posters still placeholders after search";
}

function symptomHumanLine(symptom: ListReportSymptom): string {
  if (symptom === "no_tiles") {
    return "**Detected:** No movie tiles in the list tab after the wait.";
  }
  return "**Detected:** Movie tiles are shown but every poster is still the placeholder image.";
}

function buildBody(ctx: ListGithubIssueContext): string {
  const lines: string[] = [
    `symptom: ${ctx.symptom}`,
    "",
    symptomHumanLine(ctx.symptom),
    "",
    "### Context",
    `- Check ran ${String(NO_POSTER_REPORT_DELAY_MS / 1000)}s after Letterboxd list search completed (last page batch).`,
    `- Page URL: ${ctx.pageUrl}`,
    `- Country: ${ctx.country ?? "(unknown)"}`,
    "- List source: Letterboxd URL",
  ];
  if (ctx.listUrl) lines.push(`- Letterboxd list URL: ${ctx.listUrl}`);
  lines.push(
    `- List pages (API): lastPage=${ctx.lastPage}, totalPages=${ctx.totalPages}`,
    `- Last batch film count: ${ctx.lastBatchFilmCount}`,
    `- Tile count in list tab (UI): ${ctx.tileCount}`,
    "",
    "### Environment",
    `\`\`\``,
    ctx.userAgent || "(unknown)",
    `\`\`\``,
  );
  return lines.join("\n");
}

export function buildListGithubIssueUrl(
  ctx: ListGithubIssueContext,
  options?: { issuesNewBase?: string },
): string {
  const base = (options?.issuesNewBase ?? getIssuesNewBaseUrl()).replace(/\/$/, "");
  const title = issueTitle(ctx.symptom);
  const body = buildBody(ctx);
  const u = new URL(`${base}`);
  u.searchParams.set("title", title);
  u.searchParams.set("body", body);
  return u.toString();
}

export function listReportToastCopy(symptom: ListReportSymptom): string {
  if (symptom === "no_tiles") return "Report: no tiles — open GitHub issue";
  return "Report: posters not loading — open GitHub issue";
}
