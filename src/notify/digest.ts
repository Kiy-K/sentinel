// Email digest for a finished CI-fix run (D7). Sends from the agent's own
// AgentMail inbox via the AgentMail HTTP API.
//
// ASSUMPTION (unverified): the send endpoint shape `POST /v0/inboxes/{from}/messages/send`
// with `Authorization: Bearer <key>` and body `{ to, subject, text, html? }` is inferred
// from the AgentMail docs, not verified live. Only `GET /v0/auth/me` has been verified
// against the real API (see docs/evidence/d2-spike.md). Keep AGENTMAIL_API_BASE
// env-overridable so the shape can be corrected without a code change.

export type DigestInput = {
  repo: string;
  sha: string;
  branch: string;
  workflow: string;
  runId: number;
  runUrl?: string;
  status: "fixed" | "failed" | "skipped";
  prUrl?: string;
  rationale?: string;
  outputTail?: string;
  deliveryId: string;
};

export type DigestResult = { sent: boolean; reason?: string };

const DEFAULT_FROM = "sentinelbot@agentmail.to";
const DEFAULT_API_BASE = "https://api.agentmail.to";
const MAX_OUTPUT_TAIL_LINES = 15;
const MAX_BODY_BYTES = 4096;

function subjectFor(input: DigestInput): string {
  if (input.status === "fixed") return `[Sentinel] Fixed ${input.repo} (${input.workflow}) — PR opened`;
  if (input.status === "failed") return `[Sentinel] Could not fix ${input.repo} (${input.workflow})`;
  return `[Sentinel] Skipped ${input.repo} (${input.workflow})`;
}

function bodyText(input: DigestInput): string {
  const shortSha = input.sha.slice(0, 7);
  const runLink = input.runUrl ?? `run ${input.runId}`;
  const lines = [
    `Repo: ${input.repo}`,
    `SHA: ${shortSha}`,
    `Branch: ${input.branch}`,
    `Workflow: ${input.workflow}`,
    `Run: ${runLink}`,
    `Status: ${input.status}`,
    input.rationale
      ? `${input.status === "fixed" ? "Rationale" : "Note"}: ${input.rationale}`
      : input.status === "fixed"
        ? "Rationale: (none provided)"
        : "Note: (none provided)",
  ];
  if (input.prUrl) lines.push(`PR: ${input.prUrl}`);
  lines.push(`Delivery: ${input.deliveryId}`);
  if (input.outputTail) {
    const tail = input.outputTail.split("\n").slice(-MAX_OUTPUT_TAIL_LINES).join("\n");
    lines.push("", "Last lines of output:", "```", tail, "```");
  }
  return lines.join("\n");
}

export async function sendDigest(
  input: DigestInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<DigestResult> {
  const to = env.DIGEST_TO;
  if (!to) {
    console.log("[digest] DIGEST_TO not set; skipping digest send");
    return { sent: false, reason: "DIGEST_TO not set" };
  }
  const key = env.AGENTMAIL_API_KEY;
  if (!key) {
    console.log("[digest] AGENTMAIL_API_KEY not set; skipping digest send");
    return { sent: false, reason: "AGENTMAIL_API_KEY not set" };
  }
  const from = env.AGENTMAIL_FROM ?? DEFAULT_FROM;
  const base = (env.AGENTMAIL_API_BASE ?? DEFAULT_API_BASE).replace(/\/+$/, "");

  const subject = subjectFor(input);
  let text = bodyText(input);
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    text = text.slice(0, MAX_BODY_BYTES) + "\n…[truncated]";
  }

  const url = `${base}/v0/inboxes/${encodeURIComponent(from)}/messages/send`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ to: [to], subject, text }),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`AgentMail send failed: ${res.status} ${body}`);
  }
  return { sent: true };
}
