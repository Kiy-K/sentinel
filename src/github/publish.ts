// Publish a fix as a branch + pull request via the Sprites gateway.
// No GitHub credentials ever touch the Sprite: the gateway injects OAuth auth.
// Only repos on SENTINEL_ALLOWED_REPOS are touched — same allowlist the webhook enforces.

export type PublishInput = {
  repo: string; // owner/name
  branch: string; // branch to create/update, e.g. sentinel/fix-<id>
  baseBranch: string; // e.g. main
  files: { path: string; content: string }[];
  commitMessage: string;
  title: string;
  body: string;
};

export type PublishResult = {
  branch: string;
  commitSha: string;
  prUrl: string;
  prCreated: boolean;
};

export class PublishError extends Error {}

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function allowedRepos(): string[] {
  return (process.env.SENTINEL_ALLOWED_REPOS ?? "Kiy-K/sentinel-demo")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function gh(
  fetchImpl: typeof fetch,
  base: string,
  path: string,
  init: RequestInit = {},
): Promise<any> {
  const res = await fetchImpl(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new PublishError(`GitHub gateway ${res.status} on ${path}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

export async function publishFix(
  input: PublishInput,
  fetchImpl: typeof fetch = fetch,
): Promise<PublishResult> {
  const base = process.env.GITHUB_GATEWAY_URL;
  if (!base) throw new PublishError("GITHUB_GATEWAY_URL is not set");
  if (!REPO_RE.test(input.repo)) throw new PublishError(`invalid repo: ${input.repo}`);
  if (!allowedRepos().includes(input.repo)) {
    throw new PublishError(`repo not allowlisted: ${input.repo}`);
  }
  if (input.files.length === 0) throw new PublishError("no files to publish");
  for (const f of input.files) {
    if (f.path.startsWith("/") || f.path.split("/").includes("..")) {
      throw new PublishError(`unsafe path in publish set: ${f.path}`);
    }
  }

  const root = `/repos/${input.repo}`;
  const ref = await gh(fetchImpl, base, `${root}/git/ref/heads/${input.baseBranch}`);
  const baseSha: string = ref.object.sha;
  const baseCommit = await gh(fetchImpl, base, `${root}/git/commits/${baseSha}`);
  const baseTree: string = baseCommit.tree.sha;

  const tree: { path: string; mode: "100644"; type: "blob"; sha: string }[] = [];
  for (const f of input.files) {
    const blob = await gh(fetchImpl, base, `${root}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: Buffer.from(f.content, "utf8").toString("base64"), encoding: "base64" }),
    });
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const newTree = await gh(fetchImpl, base, `${root}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseTree, tree }),
  });
  const commit = await gh(fetchImpl, base, `${root}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: input.commitMessage,
      tree: newTree.sha,
      parents: [baseSha],
    }),
  });
  const commitSha: string = commit.sha;

  try {
    await gh(fetchImpl, base, `${root}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${input.branch}`, sha: commitSha }),
    });
  } catch (err) {
    if (err instanceof PublishError && err.message.includes("422")) {
      await gh(fetchImpl, base, `${root}/git/refs/heads/${input.branch}`, {
        method: "PATCH",
        body: JSON.stringify({ sha: commitSha, force: true }),
      });
    } else {
      throw err;
    }
  }

  let prUrl: string;
  let prCreated = true;
  try {
    const pr = await gh(fetchImpl, base, `${root}/pulls`, {
      method: "POST",
      body: JSON.stringify({ title: input.title, head: input.branch, base: input.baseBranch, body: input.body }),
    });
    prUrl = pr.html_url;
  } catch (err) {
    if (err instanceof PublishError && err.message.includes("422")) {
      const owner = input.repo.split("/")[0];
      const existing = await gh(fetchImpl, base, `${root}/pulls?head=${owner}:${input.branch}&base=${input.baseBranch}&state=open`);
      if (Array.isArray(existing) && existing[0]?.html_url) {
        prUrl = existing[0].html_url;
        prCreated = false;
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }
  return { branch: input.branch, commitSha, prUrl, prCreated };
}
