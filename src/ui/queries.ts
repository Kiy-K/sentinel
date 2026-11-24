import type { Database } from "bun:sqlite";

export type IncidentRow = {
  deliveryId: string;
  repo: string | null;
  sha: string | null;
  branch: string | null;
  workflow: string | null;
  runId: number | null;
  reproduced: boolean;
  testExitCode: number | null;
  outputTail: string | null;
  createdAt: string | null;
  // joined fix_runs fields (null when no fix run exists)
  status: string | null;
  iterations: number | null;
  filesChanged: string[] | null;
  rationale: string | null;
  lastOutputTail: string | null;
  fixCreatedAt: string | null;
  prUrl: string | null;
  prBranch: string | null;
  commitSha: string | null;
};

export type FixRunRow = {
  deliveryId: string;
  status: string | null;
  iterations: number | null;
  filesChanged: string[] | null;
  rationale: string | null;
  lastOutputTail: string | null;
  createdAt: string | null;
  prUrl: string | null;
  prBranch: string | null;
  commitSha: string | null;
};

type RawRow = Record<string, unknown>;

// Column lists are compile-time constants, never user input. The full variant
// includes pr_* columns added by a later migration; the base variant is the
// fallback when that migration has not run.
const FIX_COLS_FULL =
  "delivery_id, status, iterations, files_changed, rationale, last_output_tail, created_at, pr_url, pr_branch, commit_sha";
const FIX_COLS_BASE =
  "delivery_id, status, iterations, files_changed, rationale, last_output_tail, created_at";

const LIST_FULL = `SELECT incidents.*, fix_runs.status AS status, fix_runs.iterations AS iterations,
  fix_runs.files_changed AS files_changed, fix_runs.rationale AS rationale,
  fix_runs.last_output_tail AS last_output_tail, fix_runs.created_at AS fix_created_at,
  fix_runs.pr_url AS pr_url, fix_runs.pr_branch AS pr_branch, fix_runs.commit_sha AS commit_sha
  FROM incidents LEFT JOIN fix_runs ON fix_runs.delivery_id = incidents.delivery_id
  ORDER BY incidents.created_at DESC LIMIT ?`;
const LIST_BASE = `SELECT incidents.*, fix_runs.status AS status, fix_runs.iterations AS iterations,
  fix_runs.files_changed AS files_changed, fix_runs.rationale AS rationale,
  fix_runs.last_output_tail AS last_output_tail, fix_runs.created_at AS fix_created_at
  FROM incidents LEFT JOIN fix_runs ON fix_runs.delivery_id = incidents.delivery_id
  ORDER BY incidents.created_at DESC LIMIT ?`;
const LIST_NO_FIX =
  "SELECT incidents.* FROM incidents ORDER BY incidents.created_at DESC LIMIT ?";
const SELECT_FIX_FULL = `SELECT ${FIX_COLS_FULL} FROM fix_runs WHERE delivery_id = ?`;
const SELECT_FIX_BASE = `SELECT ${FIX_COLS_BASE} FROM fix_runs WHERE delivery_id = ?`;

function parseFilesChanged(v: unknown): string[] | null {
  if (typeof v !== "string" || v.length === 0) return null;
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
}

function hasTable(db: Database, name: string): boolean {
  const row = db
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { name: string } | null;
  return row !== null;
}

function mapFixRun(row: RawRow): FixRunRow {
  return {
    deliveryId: String(row.delivery_id ?? ""),
    status: (row.status as string) ?? null,
    iterations: row.iterations == null ? null : Number(row.iterations),
    filesChanged: parseFilesChanged(row.files_changed),
    rationale: (row.rationale as string) ?? null,
    lastOutputTail: (row.last_output_tail as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    prUrl: (row.pr_url as string) ?? null,
    prBranch: (row.pr_branch as string) ?? null,
    commitSha: (row.commit_sha as string) ?? null,
  };
}

function mapIncident(row: RawRow): IncidentRow {
  return {
    deliveryId: String(row.delivery_id ?? ""),
    repo: (row.repo as string) ?? null,
    sha: (row.sha as string) ?? null,
    branch: (row.branch as string) ?? null,
    workflow: (row.workflow as string) ?? null,
    runId: row.run_id == null ? null : Number(row.run_id),
    reproduced: Number(row.reproduced ?? 0) === 1,
    testExitCode: row.test_exit_code == null ? null : Number(row.test_exit_code),
    outputTail: (row.output_tail as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    status: (row.status as string) ?? null,
    iterations: row.iterations == null ? null : Number(row.iterations),
    filesChanged: parseFilesChanged(row.files_changed),
    rationale: (row.rationale as string) ?? null,
    lastOutputTail: (row.last_output_tail as string) ?? null,
    fixCreatedAt: (row.fix_created_at as string) ?? null,
    prUrl: (row.pr_url as string) ?? null,
    prBranch: (row.pr_branch as string) ?? null,
    commitSha: (row.commit_sha as string) ?? null,
  };
}

function queryFixRun(db: Database, deliveryId: string): FixRunRow | null {
  try {
    const row = db.query(SELECT_FIX_FULL).get(deliveryId) as RawRow | null;
    return row ? mapFixRun(row) : null;
  } catch {
    const row = db.query(SELECT_FIX_BASE).get(deliveryId) as RawRow | null;
    return row ? mapFixRun(row) : null;
  }
}

export function listIncidents(db: Database, limit = 50): IncidentRow[] {
  if (!hasTable(db, "incidents")) return [];
  if (!hasTable(db, "fix_runs")) {
    return (db.query(LIST_NO_FIX).all(limit) as RawRow[]).map(mapIncident);
  }
  try {
    return (db.query(LIST_FULL).all(limit) as RawRow[]).map(mapIncident);
  } catch {
    return (db.query(LIST_BASE).all(limit) as RawRow[]).map(mapIncident);
  }
}

export function getIncident(
  db: Database,
  deliveryId: string,
): { incident: IncidentRow; fix: FixRunRow | null } | null {
  if (!hasTable(db, "incidents")) return null;
  const row = db.query("SELECT * FROM incidents WHERE delivery_id = ?").get(deliveryId) as
    | RawRow
    | null;
  if (!row) return null;

  const fix = hasTable(db, "fix_runs") ? queryFixRun(db, deliveryId) : null;
  const incident = mapIncident({
    ...row,
    ...(fix
      ? {
          status: fix.status,
          iterations: fix.iterations,
          files_changed: fix.filesChanged ? JSON.stringify(fix.filesChanged) : null,
          rationale: fix.rationale,
          last_output_tail: fix.lastOutputTail,
          fix_created_at: fix.createdAt,
          pr_url: fix.prUrl,
          pr_branch: fix.prBranch,
          commit_sha: fix.commitSha,
        }
      : {}),
  });
  return { incident, fix };
}
