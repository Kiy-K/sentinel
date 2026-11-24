import type { Database } from "bun:sqlite";
import type { FixLoopResult } from "../agent/fix-loop";

export type IncidentRecord = {
  deliveryId: string;
  repo: string;
  sha: string;
  branch: string;
  workflow: string;
  runId: number;
  reproduced: boolean;
  testExitCode: number | null;
  outputTail: string;
};

export function recordIncident(db: Database, record: IncidentRecord): void {
  db.run(
    `CREATE TABLE IF NOT EXISTS incidents (
      delivery_id TEXT PRIMARY KEY,
      repo TEXT,
      sha TEXT,
      branch TEXT,
      workflow TEXT,
      run_id INTEGER,
      reproduced INTEGER,
      test_exit_code INTEGER,
      output_tail TEXT,
      created_at TEXT
    )`,
  );
  db.run(
    `INSERT OR REPLACE INTO incidents
       (delivery_id, repo, sha, branch, workflow, run_id, reproduced, test_exit_code, output_tail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.deliveryId,
      record.repo,
      record.sha,
      record.branch,
      record.workflow,
      record.runId,
      record.reproduced ? 1 : 0,
      record.testExitCode,
      record.outputTail,
      new Date().toISOString(),
    ],
  );
}

export function recordFix(
  db: Database,
  deliveryId: string,
  result: FixLoopResult,
): void {
  db.run(
    `CREATE TABLE IF NOT EXISTS fix_runs (
      delivery_id TEXT PRIMARY KEY,
      status TEXT,
      iterations INTEGER,
      files_changed TEXT,
      rationale TEXT,
      last_output_tail TEXT,
      created_at TEXT
    )`,
  );
  db.run(
    `INSERT OR REPLACE INTO fix_runs
       (delivery_id, status, iterations, files_changed, rationale, last_output_tail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      deliveryId,
      result.status,
      result.iterations,
      JSON.stringify(result.filesChanged),
      result.rationale ?? null,
      result.lastOutput ?? null,
      new Date().toISOString(),
    ],
  );
}

export function recordPublish(
  db: Database,
  deliveryId: string,
  result: { prUrl: string; branch: string; commitSha: string },
): void {
  db.run(
    `CREATE TABLE IF NOT EXISTS fix_runs (
      delivery_id TEXT PRIMARY KEY,
      status TEXT,
      iterations INTEGER,
      files_changed TEXT,
      rationale TEXT,
      last_output_tail TEXT,
      created_at TEXT
    )`,
  );
  const cols = db.query("PRAGMA table_info(fix_runs)").all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  const migrations: Array<[string, string]> = [
    ["pr_url", "ALTER TABLE fix_runs ADD COLUMN pr_url TEXT"],
    ["pr_branch", "ALTER TABLE fix_runs ADD COLUMN pr_branch TEXT"],
    ["commit_sha", "ALTER TABLE fix_runs ADD COLUMN commit_sha TEXT"],
  ];
  for (const [name, ddl] of migrations) {
    if (!names.has(name)) db.run(ddl);
  }
  db.run(
    `UPDATE fix_runs SET pr_url = ?, pr_branch = ?, commit_sha = ? WHERE delivery_id = ?`,
    [result.prUrl, result.branch, result.commitSha, deliveryId],
  );
}
