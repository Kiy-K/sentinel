import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { publishFix, PublishError } from "./publish";

const baseEnv = { GITHUB_GATEWAY_URL: "https://gw.test/gh" };

type Call = { url: string; method: string; body?: any };

const okJson = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

function mockFetch(handlers: Array<{ match: (url: string, method: string) => boolean; reply: () => Response }>) {
  const calls: Call[] = [];
  const fn = (async (input: any, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    for (const h of handlers) {
      if (h.match(url, method)) return h.reply();
    }
    return new Response("unmocked " + method + " " + url, { status: 500 });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe("publishFix", () => {
  const saved = { ...process.env };
  beforeEach(() => { Object.assign(process.env, baseEnv); delete process.env.SENTINEL_ALLOWED_REPOS; });
  afterEach(() => { process.env = { ...saved }; });

  const happyPath = () =>
    mockFetch([
      { match: (u, m) => m === "GET" && u.endsWith("/git/ref/heads/main"), reply: () => okJson({ object: { sha: "basecommit" } }) },
      { match: (u, m) => m === "GET" && u.includes("/git/commits/basecommit"), reply: () => okJson({ tree: { sha: "basetree" } }) },
      { match: (u, m) => m === "POST" && u.endsWith("/git/blobs"), reply: () => okJson({ sha: "blob1" }) },
      { match: (u, m) => m === "POST" && u.endsWith("/git/trees"), reply: () => okJson({ sha: "newtree" }) },
      { match: (u, m) => m === "POST" && u.endsWith("/git/commits"), reply: () => okJson({ sha: "newcommit" }) },
      { match: (u, m) => m === "POST" && u.endsWith("/git/refs"), reply: () => okJson({ ref: "refs/heads/sentinel/fix-1" }) },
      { match: (u, m) => m === "POST" && u.endsWith("/pulls"), reply: () => okJson({ html_url: "https://github.com/x/y/pull/7" }) },
    ]);

  test("happy path publishes branch and PR", async () => {
    const { fn, calls } = happyPath();
    const res = await publishFix(
      { repo: "Kiy-K/sentinel-demo", branch: "sentinel/fix-1", baseBranch: "main",
        files: [{ path: "src/add.ts", content: "fixed" }],
        commitMessage: "fix", title: "Fix the thing", body: "body" },
      fn,
    );
    expect(res.prUrl).toBe("https://github.com/x/y/pull/7");
    expect(res.commitSha).toBe("newcommit");
    expect(calls.map((c) => c.method + " " + c.url.replace("https://gw.test/gh", ""))).toEqual([
      "GET /repos/Kiy-K/sentinel-demo/git/ref/heads/main",
      "GET /repos/Kiy-K/sentinel-demo/git/commits/basecommit",
      "POST /repos/Kiy-K/sentinel-demo/git/blobs",
      "POST /repos/Kiy-K/sentinel-demo/git/trees",
      "POST /repos/Kiy-K/sentinel-demo/git/commits",
      "POST /repos/Kiy-K/sentinel-demo/git/refs",
      "POST /repos/Kiy-K/sentinel-demo/pulls",
    ]);
  });

  test("rejects repos outside the allowlist before any network call", async () => {
    const { fn, calls } = happyPath();
    await expect(
      publishFix({ repo: "evil/repo", branch: "b", baseBranch: "main", files: [{ path: "a", content: "b" }], commitMessage: "m", title: "t", body: "b" }, fn),
    ).rejects.toThrow(PublishError);
    expect(calls.length).toBe(0);
  });

  test("rejects path traversal in file paths", async () => {
    const { fn } = happyPath();
    await expect(
      publishFix({ repo: "Kiy-K/sentinel-demo", branch: "b", baseBranch: "main", files: [{ path: "../evil", content: "x" }], commitMessage: "m", title: "t", body: "b" }, fn),
    ).rejects.toThrow(/unsafe path/);
  });

  test("existing branch (422) falls back to force update", async () => {
    const { fn, calls } = mockFetch([
      { match: (u, m) => m === "GET" && u.includes("/git/ref/heads/main"), reply: () => okJson({ object: { sha: "basecommit" } }) },
      { match: (u, m) => m === "GET" && u.includes("/git/commits/basecommit"), reply: () => okJson({ tree: { sha: "basetree" } }) },
      { match: (u, m) => m === "POST" && u.endsWith("/git/blobs"), reply: () => okJson({ sha: "blob1" }) },
      { match: (u, m) => m === "POST" && u.endsWith("/git/trees"), reply: () => okJson({ sha: "newtree" }) },
      { match: (u, m) => m === "POST" && u.endsWith("/git/commits"), reply: () => okJson({ sha: "newcommit" }) },
      { match: (u, m) => m === "POST" && u.endsWith("/git/refs"), reply: () => okJson({ message: "Reference already exists" }, 422) },
      { match: (u, m) => m === "PATCH" && u.includes("/git/refs/heads/sentinel/fix-1"), reply: () => okJson({ ref: "refs/heads/sentinel/fix-1" }) },
      { match: (u, m) => m === "POST" && u.endsWith("/pulls"), reply: () => okJson({ html_url: "https://github.com/x/y/pull/7" }) },
    ]);
    const res = await publishFix(
      { repo: "Kiy-K/sentinel-demo", branch: "sentinel/fix-1", baseBranch: "main",
        files: [{ path: "src/add.ts", content: "fixed" }],
        commitMessage: "fix", title: "Fix the thing", body: "body" },
      fn,
    );
    expect(res.prUrl).toContain("/pull/7");
    expect(calls.some((c) => c.method === "PATCH")).toBe(true);
  });

  test("existing PR (422) returns the open PR url instead of failing", async () => {
    const { fn } = mockFetch([
      { match: (u, m) => m === "GET" && u.includes("/git/ref/heads/main"), reply: () => okJson({ object: { sha: "basecommit" } }) },
      { match: (u, m) => m === "GET" && u.includes("/git/commits/basecommit"), reply: () => okJson({ tree: { sha: "basetree" } }) },
      { match: (u, m) => m === "POST" && u.endsWith("/git/blobs"), reply: () => okJson({ sha: "blob1" }) },
      { match: (u, m) => m === "POST" && u.endsWith("/git/trees"), reply: () => okJson({ sha: "newtree" }) },
      { match: (u, m) => m === "POST" && u.endsWith("/git/commits"), reply: () => okJson({ sha: "newcommit" }) },
      { match: (u, m) => m === "POST" && u.endsWith("/git/refs"), reply: () => okJson({ ref: "refs/heads/sentinel/fix-1" }) },
      { match: (u, m) => m === "POST" && u.endsWith("/pulls"), reply: () => okJson({ message: "A pull request already exists" }, 422) },
      { match: (u, m) => m === "GET" && u.includes("/pulls?head="), reply: () => okJson([{ html_url: "https://github.com/x/y/pull/7" }]) },
    ]);
    const res = await publishFix(
      { repo: "Kiy-K/sentinel-demo", branch: "sentinel/fix-1", baseBranch: "main",
        files: [{ path: "src/add.ts", content: "fixed" }],
        commitMessage: "fix", title: "t", body: "b" },
      fn,
    );
    expect(res.prUrl).toBe("https://github.com/x/y/pull/7");
    expect(res.prCreated).toBe(false);
  });
});
