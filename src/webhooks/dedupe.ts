import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export type DedupeResult = "inserted" | "duplicate";

/** File-backed delivery dedupe (GitHub delivery IDs). Survives restarts. */
export class DeliveryStore {
  private db: Database;

  constructor(path?: string) {
    const file = path ?? join(process.env.SENTINEL_DATA_DIR ?? "./data", "sentinel.db");
    mkdirSync(dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.run(
      `CREATE TABLE IF NOT EXISTS deliveries (
         delivery_id TEXT PRIMARY KEY,
         repo TEXT NOT NULL,
         sha TEXT NOT NULL,
         received_at TEXT NOT NULL
       )`,
    );
  }

  /** Returns "duplicate" when this delivery was already recorded. */
  record(deliveryId: string, repo: string, sha: string): DedupeResult {
    const res = this.db
      .query(
        "INSERT OR IGNORE INTO deliveries (delivery_id, repo, sha, received_at) VALUES (?, ?, ?, ?)",
      )
      .run(deliveryId, repo, sha, new Date().toISOString());
    return res.changes === 0 ? "duplicate" : "inserted";
  }
}
