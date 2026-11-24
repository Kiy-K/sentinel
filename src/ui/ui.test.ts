import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { escapeHtml, layout } from "./html";
import { getIncident, listIncidents, type IncidentRow } from "./queries";
import { publishEvent, recentEvents, subscribe } from "./events";
import { renderDashboard, renderIncident, safeUrl, uiRoutes } from "./routes";

describe("escapeHtml", () => {
  test("escapes all five special characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  test("leaves safe text alone", () => {
    expect(escapeHtml("hello world 123")).toBe("hello world 123");
  });
});

describe("safeUrl", () => {
  test("allows http and https", () => {
    expect(safeUrl("https://github.com/x/y/pull/1")).toBe("https://github.com/x/y/pull/1");
    expect(safeUrl("http://example.com")).toBe("http://example.com");
  });

  test("rejects javascript: and other schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("data:text/html,<script>")).toBe("#");
    expect(safeUrl("ftp://example.com")).toBe("#");
    expect(safeUrl("not a url")).toBe("#");
    expect(safeUrl(null)).toBe("#");
    expect(safeUrl(undefined)).toBe("#");
  });
});

function fixtureIncident(overrides: Partial<IncidentRow> = {}): IncidentRow {
  return {
    deliveryId: "d-1",
    repo: "Kiy-K/sentinel-demo",
    sha: "abc123def456",
    branch: "main",
    workflow: "CI",
    runId: 42,
    reproduced: true,
    testExitCode: 1,
    outputTail: "boom",
    createdAt: "2026-11-20T00:00:00.000Z",
    status: "succeeded",
    iterations: 2,
    filesChanged: ["src/a.ts"],
    rationale: "fixed the thing",
    lastOutputTail: "tail",
    fixCreatedAt: "2026-11-20T00:01:00.000Z",
    prUrl: "https://github.com/Kiy-K/sentinel-demo/pull/2",
    prBranch: "sentinel/fix-1",
    commitSha: "deadbeef",
    ...overrides,
  };
}

describe("rendering escapes user/DB data", () => {
  const xss = `<script>alert("pwned")</script>`;

  test("renderDashboard escapes injected markup", () => {
    const html = renderDashboard([
      fixtureIncident({ repo: xss, branch: xss, status: "running", prUrl: null }),
    ]);
    expect(html).not.toContain(xss);
    expect(html).toContain("&lt;script&gt;");
  });

  test("renderDashboard empty state", () => {
    expect(renderDashboard([])).toContain("No incidents recorded yet.");
  });

  test("renderIncident escapes injected markup", () => {
    const html = renderIncident(
      fixtureIncident({ repo: xss, rationale: xss, outputTail: xss }),
      null,
    );
    expect(html).not.toContain(xss);
    expect(html).toContain("&lt;script&gt;");
  });

  test("renderIncident never emits javascript: hrefs", () => {
    const html = renderIncident(fixtureIncident({ prUrl: "javascript:alert(1)" }), null);
    expect(html).not.toContain("javascript:alert(1)");
  });

  test("layout escapes the title", () => {
    expect(layout("<b>hi</b>", "body")).not.toContain("<title><b>hi</b></title>");
  });
});

const INCIDENTS_DDL = `CREATE TABLE incidents (
  delivery_id TEXT PRIMARY KEY, repo TEXT, sha TEXT, branch TEXT, workflow TEXT,
  run_id INTEGER, reproduced INTEGER, test_exit_code INTEGER, output_tail TEXT, created_at TEXT
)`;
const FIX_RUNS_DDL = `CREATE TABLE fix_runs (
  delivery_id TEXT PRIMARY KEY, status TEXT, iterations INTEGER, files_changed TEXT,
  rationale TEXT, last_output_tail TEXT, created_at TEXT
)`;

function seedDb(dir: string, withPrColumns: boolean): string {
  const path = join(dir, "sentinel.db");
  const db = new Database(path);
  db.run(INCIDENTS_DDL);
  db.run(FIX_RUNS_DDL);
  if (withPrColumns) {
    db.run("ALTER TABLE fix_runs ADD COLUMN pr_url TEXT");
    db.run("ALTER TABLE fix_runs ADD COLUMN pr_branch TEXT");
    db.run("ALTER TABLE fix_runs ADD COLUMN commit_sha TEXT");
  }
  db.run(
    `INSERT INTO incidents VALUES
     ('d-old', 'repo/old', 'sha-old', 'main', 'CI', 1, 1, 1, 'old output', '2026-11-01T00:00:00.000Z'),
     ('d-new', 'repo/new', 'sha-new', 'main', 'CI', 2, 0, 0, 'new output', '2026-11-20T00:00:00.000Z')`,
  );
  db.run(
    `INSERT INTO fix_runs (delivery_id, status, iterations, files_changed, rationale, last_output_tail, created_at)
     VALUES ('d-new', 'succeeded', 3, '["a.ts","b.ts"]', 'why', 'tail', '2026-11-20T00:01:00.000Z')`,
  );
  if (withPrColumns) {
    db.run(
      `UPDATE fix_runs SET pr_url = 'https://github.com/repo/new/pull/9', pr_branch = 'sentinel/x', commit_sha = 'cafe'
       WHERE delivery_id = 'd-new'`,
    );
  }
  db.close();
  return path;
}

describe("queries against a temp sqlite db", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sentinel-ui-test-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("listIncidents orders newest first and left-joins fix_runs", () => {
    const db = new Database(seedDb(dir, false), { readonly: true });
    const rows = listIncidents(db);
    db.close();
    expect(rows.map((r) => r.deliveryId)).toEqual(["d-new", "d-old"]);
    expect(rows[0]!.status).toBe("succeeded");
    expect(rows[0]!.filesChanged).toEqual(["a.ts", "b.ts"]);
    expect(rows[0]!.reproduced).toBe(false);
    expect(rows[1]!.status).toBeNull();
    expect(rows[1]!.reproduced).toBe(true);
  });

  test("listIncidents works with pr_* migration columns present", () => {
    const db = new Database(seedDb(dir, true), { readonly: true });
    const rows = listIncidents(db);
    db.close();
    expect(rows[0]!.prUrl).toBe("https://github.com/repo/new/pull/9");
    expect(rows[0]!.prBranch).toBe("sentinel/x");
    expect(rows[0]!.commitSha).toBe("cafe");
  });

  test("listIncidents honors limit", () => {
    const db = new Database(seedDb(dir, false), { readonly: true });
    expect(listIncidents(db, 1).map((r) => r.deliveryId)).toEqual(["d-new"]);
    db.close();
  });

  test("getIncident returns incident and fix, or null fix, or null row", () => {
    const db = new Database(seedDb(dir, true), { readonly: true });
    const withFix = getIncident(db, "d-new");
    expect(withFix?.incident.deliveryId).toBe("d-new");
    expect(withFix?.fix?.status).toBe("succeeded");
    expect(withFix?.fix?.prUrl).toBe("https://github.com/repo/new/pull/9");
    expect(withFix?.incident.prUrl).toBe("https://github.com/repo/new/pull/9");

    const noFix = getIncident(db, "d-old");
    expect(noFix?.fix).toBeNull();
    expect(noFix?.incident.status).toBeNull();

    expect(getIncident(db, "nope")).toBeNull();
    db.close();
  });

  test("missing tables degrade to empty results", () => {
    const path = join(dir, "sentinel.db");
    new Database(path).close();
    const db = new Database(path, { readonly: true });
    expect(listIncidents(db)).toEqual([]);
    expect(getIncident(db, "x")).toBeNull();
    db.close();
  });
});

describe("events ring buffer", () => {
  test("caps at 300 events", () => {
    const id = `cap-${Date.now()}`;
    for (let i = 0; i < 310; i++) {
      publishEvent({ deliveryId: id, kind: "test", message: `m${i}` });
    }
    const events = recentEvents(id, 1000);
    expect(events).toHaveLength(300);
    expect(events[events.length - 1]!.message).toBe("m309");
  });

  test("recentEvents filters by deliveryId and respects limit", () => {
    const id = `filter-${Date.now()}`;
    publishEvent({ deliveryId: id, kind: "a", message: "one" });
    publishEvent({ deliveryId: `${id}-other`, kind: "a", message: "two" });
    publishEvent({ deliveryId: id, kind: "a", message: "three" });
    const events = recentEvents(id, 10);
    expect(events.map((e) => e.message)).toEqual(["one", "three"]);
    expect(recentEvents(id, 1).map((e) => e.message)).toEqual(["three"]);
  });

  test("subscribe receives events until unsubscribed", () => {
    const id = `sub-${Date.now()}`;
    const seen: string[] = [];
    const unsubscribe = subscribe((e) => {
      if (e.deliveryId === id) seen.push(e.message);
    });
    publishEvent({ deliveryId: id, kind: "a", message: "before" });
    unsubscribe();
    publishEvent({ deliveryId: id, kind: "a", message: "after" });
    expect(seen).toEqual(["before"]);
  });
});

describe("uiRoutes handlers (minimal fake context)", () => {
  let dir: string;
  let savedDataDir: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sentinel-ui-routes-"));
    savedDataDir = process.env.SENTINEL_DATA_DIR;
    process.env.SENTINEL_DATA_DIR = dir; // empty dir → no sentinel.db
  });
  afterEach(() => {
    if (savedDataDir === undefined) delete process.env.SENTINEL_DATA_DIR;
    else process.env.SENTINEL_DATA_DIR = savedDataDir;
    rmSync(dir, { recursive: true, force: true });
  });

  function fakeContext(params: Record<string, string> = {}) {
    return {
      req: {
        param: (name: string) => params[name],
        raw: new Request("http://localhost/"),
      },
      html: (body: string, status = 200) => new Response(body, { status }),
      json: (body: unknown, status = 200) => Response.json(body, { status }),
    } as never;
  }

  function route(path: string) {
    const r = uiRoutes().find((r) => r.path === path);
    if (!r) throw new Error(`route ${path} not registered`);
    return r;
  }

  test("GET / returns dashboard HTML with empty state when no DB", async () => {
    const res = (await route("/").handler(fakeContext())) as Response;
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("No incidents recorded yet.");
  });

  test("GET /incidents.json returns empty array when no DB", async () => {
    const res = (await route("/incidents.json").handler(fakeContext())) as Response;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("GET /incidents/:id with a .json suffix returns 404 JSON when missing", async () => {
    const res = (await route("/incidents/:id").handler(
      fakeContext({ id: "nope.json" }),
    )) as Response;
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
  });

  test("GET /incidents/:id returns 404 HTML when missing", async () => {
    const res = (await route("/incidents/:id").handler(
      fakeContext({ id: "nope" }),
    )) as Response;
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("404");
  });

  test("GET /incidents/:id/events streams buffered events as SSE", async () => {
    const id = `sse-${Date.now()}`;
    publishEvent({ deliveryId: id, kind: "test", message: "hello-sse" });
    const res = (await route("/incidents/:id/events").handler(
      fakeContext({ id }),
    )) as Response;
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("data: ");
    expect(text).toContain("hello-sse");
    await reader.cancel();
  });
});
