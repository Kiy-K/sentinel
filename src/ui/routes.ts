import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Database } from "bun:sqlite";
import type { Context } from "hono";
import { escapeHtml, layout } from "./html";
import { getIncident, listIncidents, type FixRunRow, type IncidentRow } from "./queries";
import { recentEvents, subscribe, type UiEvent } from "./events";

function dbPath(): string {
  return join(resolve(process.env.SENTINEL_DATA_DIR ?? "./data"), "sentinel.db");
}

// Opens the shared sentinel.db readonly; null when missing so routes degrade
// to empty states instead of creating or mutating it.
function openDb(): Database | null {
  const path = dbPath();
  if (!existsSync(path)) return null;
  try {
    return new Database(path, { readonly: true });
  } catch {
    return null;
  }
}

function withDb<T>(fn: (db: Database) => T, fallback: T): T {
  const db = openDb();
  if (!db) return fallback;
  try {
    return fn(db);
  } catch {
    return fallback;
  } finally {
    try {
      db.close();
    } catch {
      // already closed
    }
  }
}

// Only http(s) URLs may reach an href; anything else degrades to "#".
export function safeUrl(url: string | null | undefined): string {
  if (!url) return "#";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? escapeHtml(url) : "#";
  } catch {
    return "#";
  }
}

function badgeClass(status: string): string {
  return /^[a-z0-9_-]+$/i.test(status) ? status.toLowerCase() : "";
}

function shortSha(sha: string | null): string {
  return sha ? escapeHtml(sha.slice(0, 7)) : "—";
}

function statusOf(i: IncidentRow): string {
  return i.status ?? "running";
}

export function renderDashboard(incidents: IncidentRow[]): string {
  const rows = incidents
    .map((i) => {
      const status = statusOf(i);
      const pr = i.prUrl
        ? `<a href="${safeUrl(i.prUrl)}" rel="noreferrer noopener">PR</a>`
        : "—";
      return `<tr>
  <td><a href="/incidents/${encodeURIComponent(i.deliveryId)}">${escapeHtml(i.repo ?? "—")}</a></td>
  <td class="mono">${shortSha(i.sha)}</td>
  <td>${escapeHtml(i.branch ?? "—")}</td>
  <td><span class="badge ${badgeClass(status)}">${escapeHtml(status)}</span></td>
  <td>${i.reproduced ? "✓" : "✗"}</td>
  <td>${pr}</td>
  <td class="mono">${escapeHtml(i.createdAt ?? "—")}</td>
</tr>`;
    })
    .join("\n");

  const body =
    incidents.length === 0
      ? `<h1>Incidents</h1><p class="empty">No incidents recorded yet.</p>`
      : `<h1>Incidents</h1>
<table>
<thead><tr><th>Repo</th><th>SHA</th><th>Branch</th><th>Status</th><th>Repro</th><th>PR</th><th>Created</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<meta http-equiv="refresh" content="5">`;

  return layout("Dashboard", body);
}

export function renderIncident(
  incident: IncidentRow,
  fix: FixRunRow | null,
): string {
  const id = incident.deliveryId;
  const status = statusOf(incident);
  const files = (fix?.filesChanged ?? incident.filesChanged ?? [])
    .map((f) => `<li><code>${escapeHtml(f)}</code></li>`)
    .join("");
  const prUrl = fix?.prUrl ?? incident.prUrl;
  const prButton = prUrl
    ? `<p><a class="badge ok" href="${safeUrl(prUrl)}" rel="noreferrer noopener">View PR</a></p>`
    : "";
  const lastTail = fix?.lastOutputTail ?? incident.lastOutputTail;
  const rationale = fix?.rationale ?? incident.rationale;
  const iterations = fix?.iterations ?? incident.iterations;

  const body = `<p><a href="/">← back</a></p>
<h1>Incident <code>${escapeHtml(id)}</code></h1>
<dl class="fields">
  <dt>Repo</dt><dd>${escapeHtml(incident.repo ?? "—")}</dd>
  <dt>SHA</dt><dd class="mono">${escapeHtml(incident.sha ?? "—")}</dd>
  <dt>Branch</dt><dd>${escapeHtml(incident.branch ?? "—")}</dd>
  <dt>Workflow</dt><dd>${escapeHtml(incident.workflow ?? "—")}</dd>
  <dt>Run ID</dt><dd class="mono">${incident.runId ?? "—"}</dd>
  <dt>Reproduced</dt><dd>${incident.reproduced ? "✓ yes" : "✗ no"}</dd>
  <dt>Test exit code</dt><dd class="mono">${incident.testExitCode ?? "—"}</dd>
  <dt>Created</dt><dd class="mono">${escapeHtml(incident.createdAt ?? "—")}</dd>
  <dt>Status</dt><dd><span class="badge ${badgeClass(status)}">${escapeHtml(status)}</span></dd>
  <dt>Iterations</dt><dd class="mono">${iterations ?? "—"}</dd>
</dl>
${prButton}
<h2>Rationale</h2>
<pre>${escapeHtml(rationale ?? "—")}</pre>
<h2>Files changed</h2>
${files ? `<ul>${files}</ul>` : "<p>—</p>"}
<h2>Output tail</h2>
<pre>${escapeHtml(incident.outputTail ?? "—")}</pre>
${
  lastTail
    ? `<details><summary>Last fix output tail</summary><pre>${escapeHtml(lastTail)}</pre></details>`
    : ""
}
<h2>Live events</h2>
<pre id="log"></pre>
<script>
(function () {
  var log = document.getElementById("log");
  var es = new EventSource("/incidents/${encodeURIComponent(id)}/events");
  es.onmessage = function (ev) {
    try {
      var e = JSON.parse(ev.data);
      var line = "[" + (e.ts || "") + "] " + (e.kind || "event") + ": " + (e.message || "") + "\\n";
      log.appendChild(document.createTextNode(line));
    } catch (err) { /* ignore malformed event */ }
  };
})();
</script>`;

  return layout(`Incident ${id.slice(0, 12)}`, body);
}

function sseResponse(c: Context, deliveryId: string): Response {
  const encoder = new TextEncoder();
  let cleanup: () => void = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const sendEvent = (e: UiEvent) => send(`data: ${JSON.stringify(e)}\n\n`);

      for (const e of recentEvents(deliveryId, 100)) sendEvent(e);

      const unsubscribe = subscribe((e) => {
        if (e.deliveryId === deliveryId) sendEvent(e);
      });
      const heartbeat = setInterval(() => send(": ping\n\n"), 15000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      c.req.raw.signal?.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}

type Route = { path: string; method: "GET"; handler: (c: Context) => unknown };

export function uiRoutes(): Route[] {
  return [
    {
      path: "/",
      method: "GET",
      handler: (c: Context) => {
        const incidents = withDb((db) => listIncidents(db), [] as IncidentRow[]);
        return c.html(renderDashboard(incidents));
      },
    },
    {
      path: "/incidents.json",
      method: "GET",
      handler: (c: Context) => {
        const incidents = withDb((db) => listIncidents(db), [] as IncidentRow[]);
        return c.json(incidents);
      },
    },
    {
      path: "/incidents/:id.json",
      method: "GET",
      handler: (c: Context) => {
        const id = c.req.param("id") ?? "";
        const result = withDb(
          (db) => getIncident(db, id),
          null as ReturnType<typeof getIncident>,
        );
        if (!result) return c.json({ error: "not found" }, 404);
        return c.json(result);
      },
    },
    {
      path: "/incidents/:id/events",
      method: "GET",
      handler: (c: Context) => sseResponse(c, c.req.param("id") ?? ""),
    },
    {
      path: "/incidents/:id",
      method: "GET",
      handler: (c: Context) => {
        const id = c.req.param("id") ?? "";
        // Hono route priority between "/incidents/:id" and "/incidents/:id.json"
        // is registration-order dependent; serve JSON here if .json slipped through.
        if (id.endsWith(".json")) {
          const jsonId = id.slice(0, -".json".length);
          const result = withDb(
            (db) => getIncident(db, jsonId),
            null as ReturnType<typeof getIncident>,
          );
          if (!result) return c.json({ error: "not found" }, 404);
          return c.json(result);
        }
        const result = withDb(
          (db) => getIncident(db, id),
          null as ReturnType<typeof getIncident>,
        );
        if (!result) return c.html(layout("Not found", `<h1>404</h1><p>No incident <code>${escapeHtml(id)}</code>.</p><p><a href="/">← back</a></p>`), 404);
        return c.html(renderIncident(result.incident, result.fix));
      },
    },
  ];
}
