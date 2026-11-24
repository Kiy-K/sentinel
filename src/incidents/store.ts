import type { Database } from "bun:sqlite";

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
