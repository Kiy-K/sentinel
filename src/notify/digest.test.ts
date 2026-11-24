import { afterEach, describe, expect, test } from "bun:test";
import { sendDigest, type DigestInput } from "./digest";

const baseInput: DigestInput = {
  repo: "Kiy-K/sentinel-demo",
  sha: "abc1234567890",
  branch: "sentinel/fix-1",
  workflow: "ci",
  runId: 123,
  runUrl: "https://github.com/Kiy-K/sentinel-demo/actions/runs/123",
  status: "fixed",
  prUrl: "https://github.com/Kiy-K/sentinel-demo/pull/2",
  rationale: "off by one in parser",
  outputTail: "line1\nline2\ntests pass",
  deliveryId: "delivery-abc",
};

const env = {
  AGENTMAIL_API_KEY: "test-key",
  DIGEST_TO: "human@example.com",
} as NodeJS.ProcessEnv;

const originalFetch = globalThis.fetch;

function mockFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    return impl(String(url), init);
  }) as typeof fetch;
  return calls;
}

const okResponse = () => new Response(JSON.stringify({ message_id: "m1" }), { status: 200 });

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("sendDigest", () => {
  test("sends to AgentMail with bearer auth and correct body", async () => {
    const calls = mockFetch(async () => okResponse());
    const result = await sendDigest(baseInput, env);
    expect(result).toEqual({ sent: true });
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(url).toBe(
      "https://api.agentmail.to/v0/inboxes/sentinelbot%40agentmail.to/messages/send",
    );
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer test-key");
    const body = JSON.parse(String(init.body));
    expect(body.to).toEqual(["human@example.com"]);
    expect(body.subject).toContain("Kiy-K/sentinel-demo");
    expect(body.text).toContain("abc1234");
    expect(body.text).toContain("https://github.com/Kiy-K/sentinel-demo/pull/2");
    expect(body.text).toContain("off by one in parser");
    expect(body.text).toContain("delivery-abc");
  });

  test("failed status uses failure subject", async () => {
    const calls = mockFetch(async () => okResponse());
    await sendDigest({ ...baseInput, status: "failed", prUrl: undefined }, env);
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.subject).toBe("[Sentinel] Could not fix Kiy-K/sentinel-demo (ci)");
  });

  test("skips when DIGEST_TO is unset", async () => {
    const calls = mockFetch(async () => okResponse());
    const result = await sendDigest(baseInput, { AGENTMAIL_API_KEY: "k" } as NodeJS.ProcessEnv);
    expect(result).toEqual({ sent: false, reason: "DIGEST_TO not set" });
    expect(calls).toHaveLength(0);
  });

  test("skips when AGENTMAIL_API_KEY is unset", async () => {
    const calls = mockFetch(async () => okResponse());
    const result = await sendDigest(baseInput, { DIGEST_TO: "human@example.com" } as NodeJS.ProcessEnv);
    expect(result).toEqual({ sent: false, reason: "AGENTMAIL_API_KEY not set" });
    expect(calls).toHaveLength(0);
  });

  test("throws on non-2xx response", async () => {
    mockFetch(async () => new Response("boom", { status: 422 }));
    await expect(sendDigest(baseInput, env)).rejects.toThrow("422");
  });

  test("throws on network error", async () => {
    mockFetch(async () => {
      throw new Error("socket hang up");
    });
    await expect(sendDigest(baseInput, env)).rejects.toThrow("socket hang up");
  });
});
