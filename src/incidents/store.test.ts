import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { recordFix } from "./store";

const result = {
  status: "fixed" as const,
  iterations: 2,
  filesChanged: ["add.ts", "src/nested/mod.ts"],
  rationale: "return a + b",
  lastOutput: "1 pass",
};

describe("recordFix", () => {
  test("round-trip insert and read back", () => {
    const db = new Database(":memory:");
    recordFix(db, "delivery-1", result);
    const row = db
      .query(
        "SELECT delivery_id, status, iterations, files_changed, rationale, last_output_tail, created_at FROM fix_runs WHERE delivery_id = ?",
      )
      .get("delivery-1") as Record<string, unknown>;
    expect(row.delivery_id).toBe("delivery-1");
    expect(row.status).toBe("fixed");
    expect(row.iterations).toBe(2);
    expect(JSON.parse(String(row.files_changed))).toEqual(["add.ts", "src/nested/mod.ts"]);
    expect(row.rationale).toBe("return a + b");
    expect(row.last_output_tail).toBe("1 pass");
    expect(typeof row.created_at).toBe("string");
    db.close();
  });

  test("re-insert replaces the existing row (upsert)", () => {
    const db = new Database(":memory:");
    recordFix(db, "delivery-1", result);
    recordFix(db, "delivery-1", {
      ...result,
      status: "failed",
      iterations: 3,
      filesChanged: ["add.ts"],
      rationale: "still broken",
      lastOutput: "3 fail",
    });
    const rows = db
      .query("SELECT status, iterations, files_changed, rationale FROM fix_runs WHERE delivery_id = ?")
      .all("delivery-1") as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("failed");
    expect(rows[0]!.iterations).toBe(3);
    expect(JSON.parse(String(rows[0]!.files_changed))).toEqual(["add.ts"]);
    expect(rows[0]!.rationale).toBe("still broken");
    db.close();
  });
});
