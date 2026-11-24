import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseWorkflowRun, verifySignature } from "./github";
import { DeliveryStore } from "./dedupe";

const secret = "test-secret";
const body = JSON.stringify({ action: "completed", workflow_run: { conclusion: "failure" } });
const sign = (b: string) =>
  `sha256=${createHmac("sha256", secret).update(b).digest("hex")}`;

describe("verifySignature", () => {
  test("accepts a valid signature", () => {
    expect(verifySignature(body, sign(body), secret)).toBe(true);
  });
  test("rejects a tampered body", () => {
    expect(verifySignature(body + " ", sign(body), secret)).toBe(false);
  });
  test("rejects a wrong secret and missing header", () => {
    expect(verifySignature(body, sign(body), "wrong")).toBe(false);
    expect(verifySignature(body, null, secret)).toBe(false);
  });
});

describe("parseWorkflowRun", () => {
  const payload = {
    action: "completed",
    workflow_run: {
      id: 42,
      head_sha: "abc123",
      head_branch: "main",
      name: "CI",
      html_url: "https://example.com/run/42",
      conclusion: "failure",
    },
    repository: { full_name: "Kiy-K/night-shift-demo" },
  };

  test("extracts an incident from a failed workflow_run", () => {
    const r = parseWorkflowRun("workflow_run", payload, "delivery-1");
    expect(r.kind).toBe("incident");
    if (r.kind === "incident") {
      expect(r.incident).toMatchObject({
        deliveryId: "delivery-1",
        repo: "Kiy-K/night-shift-demo",
        sha: "abc123",
        workflow: "CI",
        runId: 42,
      });
    }
  });

  test("ignores workflow runs whose head repo is a fork", () => {
    const forked = {
      ...payload,
      workflow_run: {
        ...payload.workflow_run,
        head_repository: { full_name: "attacker/night-shift-demo", fork: true },
      },
    };
    expect(parseWorkflowRun("workflow_run", forked, "d-fork").kind).toBe("ignored");
  });

  test("ignores repos outside the allowlist", () => {
    const foreign = { ...payload, repository: { full_name: "someone/else" } };
    expect(parseWorkflowRun("workflow_run", foreign, "d-repo").kind).toBe("ignored");
  });

  test("ignores non-failure conclusions and other events", () => {
    expect(
      parseWorkflowRun("workflow_run", { ...payload, workflow_run: { ...payload.workflow_run, conclusion: "success" } }, "d").kind,
    ).toBe("ignored");
    expect(parseWorkflowRun("push", payload, "d").kind).toBe("ignored");
    expect(parseWorkflowRun("workflow_run", { ...payload, action: "requested" }, "d").kind).toBe("ignored");
  });
});

describe("DeliveryStore", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sentinel-test-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("dedupes by delivery id across instances", () => {
    const first = new DeliveryStore(join(dir, "t.db"));
    expect(first.record("d1", "r", "sha")).toBe("inserted");
    expect(first.record("d1", "r", "sha")).toBe("duplicate");
    const reopened = new DeliveryStore(join(dir, "t.db"));
    expect(reopened.record("d1", "r", "sha")).toBe("duplicate");
    expect(reopened.record("d2", "r", "sha")).toBe("inserted");
  });
});
