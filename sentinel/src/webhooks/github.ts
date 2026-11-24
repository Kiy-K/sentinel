import { createHmac, timingSafeEqual } from "node:crypto";

export type Incident = {
  deliveryId: string;
  repo: string;
  sha: string;
  branch: string;
  workflow: string;
  runId: number;
  runUrl: string | undefined;
  conclusion: string;
};

export function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const actual = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export type ParseResult =
  | { kind: "incident"; incident: Incident }
  | { kind: "ignored"; reason: string };

type WorkflowRunPayload = {
  action?: string;
  workflow_run?: {
    id?: number;
    head_sha?: string;
    head_branch?: string;
    name?: string;
    html_url?: string;
    conclusion?: string | null;
    head_repository?: { full_name?: string; fork?: boolean };
  };
  repository?: { full_name?: string };
};

/** Parse a GitHub webhook delivery; only workflow_run failures become incidents. */
export function parseWorkflowRun(
  event: string | null,
  payload: unknown,
  deliveryId: string,
): ParseResult {
  if (event !== "workflow_run") {
    return { kind: "ignored", reason: `event ${event ?? "unknown"}` };
  }
  const p = payload as WorkflowRunPayload | null;
  if (p?.action !== "completed") {
    return { kind: "ignored", reason: `action ${p?.action}` };
  }
  const run = p.workflow_run;
  if (run?.conclusion !== "failure") {
    return { kind: "ignored", reason: `conclusion ${run?.conclusion}` };
  }
  // Fork PRs run with attacker-controlled code; never act on them.
  if (run.head_repository?.fork === true) {
    return { kind: "ignored", reason: "fork head repo" };
  }
  // Only repositories explicitly allowlisted for this Sprite (default: demo repo).
  const allowed = (process.env.SENTINEL_ALLOWED_REPOS ?? "Kiy-K/night-shift-demo")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const repo = p.repository?.full_name ?? "";
  if (!allowed.includes(repo)) {
    return { kind: "ignored", reason: `repo not allowlisted: ${repo || "unknown"}` };
  }
  return {
    kind: "incident",
    incident: {
      deliveryId,
      repo: p.repository?.full_name ?? "unknown",
      sha: run.head_sha ?? "unknown",
      branch: run.head_branch ?? "unknown",
      workflow: run.name ?? "workflow",
      runId: run.id ?? 0,
      runUrl: run.html_url,
      conclusion: run.conclusion,
    },
  };
}
