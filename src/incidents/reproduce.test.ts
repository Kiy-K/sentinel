import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reproduceFailure, type RunFn, type ReproduceIncident } from "./reproduce";
import { recordIncident } from "./store";

const incident: ReproduceIncident = {
  deliveryId: "delivery-1",
  repo: "octo/repo",
  sha: "deadbeef",
  branch: "main",
  workflow: "ci",
  runId: 7,
};

let dataDir: string;
let savedDataDir: string | undefined;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "reproduce-test-"));
  savedDataDir = process.env.SENTINEL_DATA_DIR;
  process.env.SENTINEL_DATA_DIR = dataDir;
});

afterEach(() => {
  if (savedDataDir === undefined) delete process.env.SENTINEL_DATA_DIR;
  else process.env.SENTINEL_DATA_DIR = savedDataDir;
  rmSync(dataDir, { recursive: true, force: true });
});

const fakeRun = (testExit: number, testOutput = ""): RunFn =>
  (cmd) => ({
    exitCode: cmd[1] === "test" ? testExit : 0,
    output: cmd[1] === "test" ? testOutput : "",
  });

describe("reproduceFailure", () => {
  test("rejects invalid repos without spawning", () => {
    const failRun: RunFn = () => {
      throw new Error("run must not be called");
    };
    for (const repo of ["../evil", "a;rm -rf /", "noslash"]) {
      const res = reproduceFailure({ ...incident, repo }, { run: failRun });
      expect(res.reproduced).toBe(false);
      expect(res.error).toBeDefined();
    }
  });

  test("rejects invalid sha without spawning", () => {
    const failRun: RunFn = () => {
      throw new Error("run must not be called");
    };
    for (const sha of ["unknown", "xyz", "g".repeat(40), "a".repeat(41)]) {
      const res = reproduceFailure({ ...incident, sha }, { run: failRun });
      expect(res.reproduced).toBe(false);
      expect(res.error).toContain("invalid sha");
    }
  });

  test("rejects invalid deliveryId without spawning", () => {
    const failRun: RunFn = () => {
      throw new Error("run must not be called");
    };
    const res = reproduceFailure({ ...incident, deliveryId: "../escape" }, { run: failRun });
    expect(res.reproduced).toBe(false);
    expect(res.error).toBeDefined();
  });

  test("failing tests reproduce", () => {
    const res = reproduceFailure(incident, { run: fakeRun(1, "FAIL src/x.test.ts") });
    expect(res.reproduced).toBe(true);
    expect(res.testExitCode).toBe(1);
    expect(res.installOk).toBe(true);
    expect(res.outputTail).toContain("FAIL src/x.test.ts");
    expect(res.error).toBeUndefined();
  });

  test("passing tests do not reproduce", () => {
    const res = reproduceFailure(incident, { run: fakeRun(0, "all green") });
    expect(res.reproduced).toBe(false);
    expect(res.testExitCode).toBe(0);
    expect(res.installOk).toBe(true);
  });

  test("clone failure returns error, never throws", () => {
    const run: RunFn = (cmd) =>
      cmd[1] === "fetch"
        ? { exitCode: 128, output: "fatal: couldn't find remote ref" }
        : { exitCode: 0, output: "" };
    const res = reproduceFailure(incident, { run });
    expect(res.reproduced).toBe(false);
    expect(res.error).toContain("clone failed");
    expect(res.outputTail).toContain("fatal");
  });

  test("install failure returns error, never throws", () => {
    const run: RunFn = (cmd) =>
      cmd[1] === "install" ? { exitCode: 1, output: "resolution error" } : { exitCode: 0, output: "" };
    const res = reproduceFailure(incident, { run, commands: { install: ["bun", "install"] } });
    expect(res.reproduced).toBe(false);
    expect(res.installOk).toBe(false);
    expect(res.error).toContain("install failed");
  });

  test("outputTail is truncated to the last 8000 chars", () => {
    const big = "x".repeat(9000);
    const res = reproduceFailure(incident, { run: fakeRun(1, big) });
    expect(res.outputTail).toHaveLength(8000);
    expect(res.outputTail).toBe(big.slice(-8000));
  });
});

describe("recordIncident", () => {
  test("round-trip insert and read back", () => {
    const db = new Database(join(dataDir, "sentinel.db"));
    recordIncident(db, {
      ...incident,
      reproduced: true,
      testExitCode: 1,
      outputTail: "tail-of-output",
    });
    const row = db
      .query("SELECT delivery_id, repo, sha, branch, workflow, run_id, reproduced, test_exit_code, output_tail, created_at FROM incidents WHERE delivery_id = ?")
      .get(incident.deliveryId) as Record<string, unknown>;
    expect(row.repo).toBe("octo/repo");
    expect(row.run_id).toBe(7);
    expect(row.reproduced).toBe(1);
    expect(row.test_exit_code).toBe(1);
    expect(row.output_tail).toBe("tail-of-output");
    expect(typeof row.created_at).toBe("string");
    db.close();
  });

  test("re-insert replaces the existing row", () => {
    const db = new Database(join(dataDir, "sentinel.db"));
    const base = { ...incident, reproduced: false, testExitCode: null as number | null, outputTail: "old" };
    recordIncident(db, base);
    recordIncident(db, { ...base, reproduced: true, testExitCode: 1, outputTail: "new" });
    const rows = db.query("SELECT reproduced, output_tail FROM incidents WHERE delivery_id = ?").all(incident.deliveryId) as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    const row = rows[0];
    if (!row) throw new Error("missing incident row");
    expect(row.output_tail).toBe("new");
    expect(row.reproduced).toBe(1);
    db.close();
  });
});
