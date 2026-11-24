import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runFixLoop, type FixLlm } from "./fix-loop";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "fix-loop-test-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

const seed = (rel: string, content: string) => {
  const abs = join(workDir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
};

const fixJson = (path: string, content: string, rationale = "fixed it") =>
  JSON.stringify({ files: [{ path, content }], rationale });

const llmReturning = (responses: string[]): FixLlm => {
  let i = 0;
  return {
    chatCompletion: async () => responses[Math.min(i++, responses.length - 1)] ?? "",
  };
};

const failingLlm = (message: string): FixLlm => ({
  chatCompletion: async () => {
    throw new Error(message);
  },
});

const BROKEN_ADD = "export const add = (a: number, b: number): number => a - b;\n";
const FIXED_ADD = "export const add = (a: number, b: number): number => a + b;\n";

describe("runFixLoop", () => {
  test("fixes on iteration 1", async () => {
    seed("add.ts", BROKEN_ADD);
    const llm = llmReturning([fixJson("add.ts", FIXED_ADD)]);
    const result = await runFixLoop({
      workDir,
      failingOutput: "1 fail",
      llm,
      runTests: () => ({ exitCode: 0, output: "all pass" }),
    });
    expect(result.status).toBe("fixed");
    expect(result.iterations).toBe(1);
    expect(result.filesChanged).toEqual(["add.ts"]);
    expect(result.rationale).toBe("fixed it");
    expect(readFileSync(join(workDir, "add.ts"), "utf8")).toBe(FIXED_ADD);
  });

  test("fixes on iteration 2 after the first fix still fails tests", async () => {
    seed("add.ts", BROKEN_ADD);
    const stillBroken = fixJson("add.ts", BROKEN_ADD, "not really fixed");
    const llm = llmReturning([stillBroken, fixJson("add.ts", FIXED_ADD)]);
    const testResults = [
      { exitCode: 1, output: "still failing" },
      { exitCode: 0, output: "all pass" },
    ];
    let call = 0;
    const result = await runFixLoop({
      workDir,
      failingOutput: "1 fail",
      llm,
      runTests: () => testResults[call++] ?? testResults[testResults.length - 1]!,
    });
    expect(result.status).toBe("fixed");
    expect(result.iterations).toBe(2);
    expect(result.filesChanged).toEqual(["add.ts"]);
  });

  test("gives up after maxIterations with status failed", async () => {
    seed("add.ts", BROKEN_ADD);
    const llm = llmReturning([fixJson("add.ts", BROKEN_ADD)]);
    const result = await runFixLoop({
      workDir,
      failingOutput: "1 fail",
      llm,
      maxIterations: 3,
      runTests: () => ({ exitCode: 1, output: "still failing" }),
    });
    expect(result.status).toBe("failed");
    expect(result.iterations).toBe(3);
    expect(result.filesChanged).toEqual(["add.ts"]);
  });

  test("path traversal is rejected before any write and no tests are run", async () => {
    seed("add.ts", BROKEN_ADD);
    let testsRun = 0;
    const escapePath = join(workDir, "..", `escape-${process.pid}.ts`);
    const llm = llmReturning([
      fixJson("../" + `escape-${process.pid}.ts`, "export const pwned = true;\n"),
    ]);
    const result = await runFixLoop({
      workDir,
      failingOutput: "1 fail",
      llm,
      maxIterations: 2,
      runTests: () => {
        testsRun++;
        return { exitCode: 0, output: "all pass" };
      },
    });
    expect(result.status).toBe("failed");
    expect(result.iterations).toBe(2);
    expect(result.filesChanged).toEqual([]);
    expect(testsRun).toBe(0);
    expect(existsSync(escapePath)).toBe(false);
    expect(readFileSync(join(workDir, "add.ts"), "utf8")).toBe(BROKEN_ADD);
  });

  test("absolute paths are rejected as well", async () => {
    seed("add.ts", BROKEN_ADD);
    const llm = llmReturning([fixJson("/tmp/escape-abs.ts", "x\n")]);
    const result = await runFixLoop({
      workDir,
      failingOutput: "1 fail",
      llm,
      maxIterations: 1,
      runTests: () => ({ exitCode: 0, output: "all pass" }),
    });
    expect(result.status).toBe("failed");
    expect(result.filesChanged).toEqual([]);
    expect(existsSync("/tmp/escape-abs.ts")).toBe(false);
  });

  test("malformed JSON counts as a failed iteration and writes nothing", async () => {
    seed("add.ts", BROKEN_ADD);
    let testsRun = 0;
    const llm = llmReturning(["this is not json"]);
    const result = await runFixLoop({
      workDir,
      failingOutput: "1 fail",
      llm,
      maxIterations: 2,
      runTests: () => {
        testsRun++;
        return { exitCode: 0, output: "all pass" };
      },
    });
    expect(result.status).toBe("failed");
    expect(result.iterations).toBe(2);
    expect(result.filesChanged).toEqual([]);
    expect(result.lastOutput).toContain("could not parse");
    expect(testsRun).toBe(0);
    expect(readFileSync(join(workDir, "add.ts"), "utf8")).toBe(BROKEN_ADD);
  });

  test("LLM failure yields llm_unavailable and never throws", async () => {
    seed("add.ts", BROKEN_ADD);
    const result = await runFixLoop({
      workDir,
      failingOutput: "1 fail",
      llm: failingLlm("gateway exploded"),
    });
    expect(result.status).toBe("llm_unavailable");
    expect(result.iterations).toBe(1);
    expect(result.filesChanged).toEqual([]);
    expect(result.lastOutput).toContain("gateway exploded");
  });

  test("integration: stubbed LLM fixes a broken repo with the real bun test runner", async () => {
    seed("add.ts", BROKEN_ADD);
    seed(
      "add.test.ts",
      [
        'import { expect, test } from "bun:test";',
        'import { add } from "./add";',
        'test("add(2, 3) is 5", () => {',
        "  expect(add(2, 3)).toBe(5);",
        "});",
        "",
      ].join("\n"),
    );
    const llm = llmReturning([fixJson("add.ts", FIXED_ADD)]);
    const result = await runFixLoop({
      workDir,
      failingOutput: "error: expect(received).toBe(expected) ... Expected: 5, Received: -1",
      llm,
    });
    expect(result.status).toBe("fixed");
    expect(result.iterations).toBe(1);
    expect(result.filesChanged).toEqual(["add.ts"]);
    expect(readFileSync(join(workDir, "add.ts"), "utf8")).toBe(FIXED_ADD);
  });
});
