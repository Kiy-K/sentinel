import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFixTools, createFixAgent } from "./fix-agent";

function setup(): { root: string; written: Set<string>; tools: ReturnType<typeof createFixTools> } {
  const root = mkdtempSync(join(tmpdir(), "fix-agent-test-"));
  writeFileSync(join(root, "add.ts"), "export const add = (a: number, b: number) => a - b;\n");
  mkdirSync(join(root, "sub"));
  writeFileSync(join(root, "sub", "math.ts"), "export const mul = (a: number, b: number) => a * b;\n");
  const written = new Set<string>();
  return { root, written, tools: createFixTools(root, written) };
}

describe("fix agent tools", () => {
  test("list_files lists repo files, skipping .git and node_modules", async () => {
    const { root, tools } = setup();
    mkdirSync(join(root, ".git"));
    writeFileSync(join(root, ".git", "HEAD"), "ref: refs/heads/main");
    const out = (await tools.list_files!.execute!({}, {} as never)) as { files: string[] };
    expect(out.files).toContain("add.ts");
    expect(out.files).toContain("sub/math.ts");
    expect(out.files.some((f) => f.startsWith(".git"))).toBe(false);
  });

  test("read_file reads a file inside the jail", async () => {
    const { tools } = setup();
    const out = (await tools.read_file!.execute!({ path: "add.ts" }, {} as never)) as { content: string };
    expect(out.content).toContain("a - b");
  });

  test("read_file rejects traversal outside the jail", async () => {
    const { tools } = setup();
    const out = (await tools.read_file!.execute!({ path: "../escape.txt" }, {} as never)) as { error: string };
    expect(out.error).toBeTruthy();
  });

  test("write_file rejects absolute paths and escapes", async () => {
    const { tools } = setup();
    for (const bad of ["/tmp/evil.ts", "../evil.ts", ".git/config"]) {
      const out = (await tools.write_file!.execute!({ path: bad, content: "x" }, {} as never)) as { ok: boolean; error?: string };
      expect(out.ok).toBe(false);
    }
  });

  test("write_file rejects symlinked parent escape", async () => {
    const { root, tools } = setup();
    const outside = mkdtempSync(join(tmpdir(), "fix-agent-outside-"));
    symlinkSync(outside, join(root, "link"));
    const out = (await tools.write_file!.execute!({ path: "link/evil.ts", content: "x" }, {} as never)) as { ok: boolean; error?: string };
    expect(out.ok).toBe(false);
    rmSync(outside, { recursive: true, force: true });
  });

  test("write_file writes inside the jail and records the path", async () => {
    const { root, written, tools } = setup();
    const out = (await tools.write_file!.execute!({ path: "add.ts", content: "export const add = (a: number, b: number) => a + b;\n" }, {} as never)) as { ok: boolean };
    expect(out.ok).toBe(true);
    expect(written.has("add.ts")).toBe(true);
    expect(await Bun.file(join(root, "add.ts")).text()).toContain("a + b");
  });

  test("run_tests reports failing suite with output", async () => {
    const { root, tools } = setup();
    writeFileSync(join(root, "add.test.ts"), 'import { test, expect } from "bun:test";\ntest("add", () => { expect((a: any) => a).toBe(1); });\n');
    const out = (await tools.run_tests!.execute!({}, {} as never)) as { exitCode: number; output: string };
    expect(out.exitCode).toBe(1);
    expect(out.output.length).toBeGreaterThan(0);
  });
});

describe("createFixAgent", () => {
  test("constructs an agent with tools, memory, and scorer", () => {
    const root = mkdtempSync(join(tmpdir(), "fix-agent-agent-"));
    const dataDir = mkdtempSync(join(tmpdir(), "fix-agent-data-"));
    const { agent, written } = createFixAgent({ workDir: root, dataDir, repo: "o/r" });
    expect(agent).toBeTruthy();
    expect(written.size).toBe(0);
  });
});
