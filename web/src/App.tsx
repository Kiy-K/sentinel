import { useEffect, useMemo, useState, useCallback } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";

type Incident = {
  deliveryId: string;
  repo: string | null;
  sha: string | null;
  branch: string | null;
  workflow: string | null;
  runId: number | null;
  reproduced: boolean | null;
  testExitCode: number | null;
  outputTail: string | null;
  createdAt: string | null;
  status: string | null;
  iterations: number | null;
  filesChanged: string[] | null;
  rationale: string | null;
  prUrl: string | null;
  prBranch: string | null;
  commitSha: string | null;
};

const POLL_MS = 10_000;

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function statusClass(status: string | null, reproduced: boolean | null): string {
  const s = (status ?? "").toLowerCase();
  if (s.includes("fix") || s === "success" || s === "merged") return "ok";
  if (s.includes("fail") || s.includes("error")) return "bad";
  if (s.includes("skip") || s.includes("pending") || s.includes("progress") || s.includes("run")) return "warn";
  return reproduced ? "warn" : "idle";
}

function short(sha: string | null): string {
  return sha ? sha.slice(0, 7) : "—";
}

export default function App() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Incident | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/incidents.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Incident[];
      setIncidents(data);
      setLoadError(null);
      setOnline(true);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  // Auto-select the newest incident on first load.
  useEffect(() => {
    if (selectedId === null && incidents && incidents.length > 0) {
      setSelectedId(incidents[0]!.deliveryId);
    }
  }, [incidents, selectedId]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/incidents/${encodeURIComponent(selectedId)}.json`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Incident & { fix?: Partial<Incident> | null };
        if (!cancelled) setDetail({ ...data, ...(data.fix ?? {}) });
      } catch {
        if (!cancelled) setDetail(null);
      }
    };
    void load();
    const t = window.setInterval(load, POLL_MS);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [selectedId]);

  const stats = useMemo(() => {
    if (!incidents) return { total: 0, fixed: 0, open: 0 };
    const fixed = incidents.filter((i) => /fix|success|merged/i.test(i.status ?? "")).length;
    return { total: incidents.length, fixed, open: incidents.length - fixed };
  }, [incidents]);

  const selected = detail ?? incidents?.find((i) => i.deliveryId === selectedId) ?? null;

  return (
    <CopilotKit runtimeUrl="/copilotkit" agent="sentinel">
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">◠</span>
            <div>
              <div className="brand-name">Sentinel <span>Night Shift</span></div>
              <div className="brand-sub">CI failures in → reproduced, fixed, PR out</div>
            </div>
          </div>
          <div className="topbar-right">
            <div className="stat"><b>{stats.total}</b><span>incidents</span></div>
            <div className="stat"><b>{stats.fixed}</b><span>fixed</span></div>
            <div className="stat"><b>{stats.open}</b><span>open</span></div>
            <div className={`live ${online === false ? "live-off" : ""}`} title={online === false ? `Unreachable: ${loadError}` : "Live — polling every 10s"}>
              <span className="dot" />{online === false ? "offline" : "live"}
            </div>
          </div>
        </header>

        <main className="layout">
          <aside className="rail" aria-label="Incidents">
            <div className="rail-head">
              <h2>Incidents</h2>
              <button className="refresh" onClick={() => void refresh()} aria-label="Refresh">↻</button>
            </div>
            {incidents === null && <p className="muted pad">Loading…</p>}
            {incidents !== null && incidents.length === 0 && (
              <p className="muted pad">No incidents yet. The next red CI run on <code>main</code> will appear here.</p>
            )}
            <ul className="incident-list">
              {incidents?.map((inc) => (
                <li key={inc.deliveryId}>
                  <button
                    className={`incident-card${inc.deliveryId === selectedId ? " selected" : ""}`}
                    onClick={() => setSelectedId(inc.deliveryId)}
                  >
                    <span className="row">
                      <span className={`pill ${statusClass(inc.status, inc.reproduced)}`}>{inc.status ?? (inc.reproduced ? "reproduced" : "new")}</span>
                      <time>{timeAgo(inc.createdAt)}</time>
                    </span>
                    <span className="repo">{inc.repo ?? "unknown repo"}</span>
                    <span className="meta">{short(inc.sha)} · {inc.workflow ?? "ci"} · {inc.reproduced ? "reproduced" : "not reproduced"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="detail" aria-label="Incident detail">
            {selected ? (
              <>
                <div className="detail-head">
                  <h1>{selected.repo}</h1>
                  <span className={`pill big ${statusClass(selected.status, selected.reproduced)}`}>{selected.status ?? "pending"}</span>
                </div>
                <dl className="kv">
                  <div><dt>Commit</dt><dd><code>{short(selected.sha)}</code> on {selected.branch ?? "main"}</dd></div>
                  <div><dt>Workflow</dt><dd>{selected.workflow ?? "ci"}{selected.runId ? <> · run #{selected.runId}</> : null}</dd></div>
                  <div><dt>Reproduced</dt><dd>{selected.reproduced ? `yes (exit ${selected.testExitCode ?? "?"})` : "not reproduced"}</dd></div>
                  <div><dt>Delivery</dt><dd><code className="dim">{selected.deliveryId}</code></dd></div>
                </dl>
                {selected.rationale && (
                  <section className="panel">
                    <h3>Agent rationale</h3>
                    <p>{selected.rationale.replace(/\*\*/g, "")}</p>
                  </section>
                )}
                {selected.filesChanged && selected.filesChanged.length > 0 && (
                  <section className="panel">
                    <h3>Files changed ({selected.filesChanged.length})</h3>
                    <ul className="files">{selected.filesChanged.map((f) => <li key={f}><code>{f}</code></li>)}</ul>
                  </section>
                )}
                {selected.prUrl && (
                  <section className="panel pr-panel">
                    <h3>Pull request</h3>
                    <a className="pr-link" href={selected.prUrl} target="_blank" rel="noreferrer noopener">{selected.prUrl}</a>
                    {selected.prBranch && <p className="muted">branch <code>{selected.prBranch}</code>{selected.commitSha ? <> · <code>{short(selected.commitSha)}</code></> : null}</p>}
                  </section>
                )}
                {selected.outputTail && (
                  <section className="panel">
                    <h3>Failure output</h3>
                    <pre className="log">{selected.outputTail.slice(-3000)}</pre>
                  </section>
                )}
              </>
            ) : (
              <div className="empty-state">
                <h1>Sentinel Night Shift</h1>
                <p>Watching your CI. When a build goes red, Sentinel reproduces it in a sandbox, fixes it, and opens a PR — while you sleep.</p>
              </div>
            )}
          </section>

          <aside className="chat" aria-label="Ask Sentinel">
            <CopilotChat
              className="copilot"
              labels={{
                title: "Ask Sentinel",
                initial: [
                  "What broke last night?",
                  "Why did this incident happen?",
                  "Show me the PRs Sentinel opened",
                ],
              }}
            />
          </aside>
        </main>
      </div>
    </CopilotKit>
  );
}
