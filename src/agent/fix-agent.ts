/**
 * Sentinel fix agent: a real Mastra Agent with sandboxed tools (read/write/run_tests),
 * per-repo memory, and a tests-green scorer. Replaces the old hand-rolled
 * prompt -> full-file-JSON loop. All file access stays inside the incident
 * work dir via the jail in ./jail.
 */
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { createScorer } from "@mastra/core/evals";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { z } from "zod";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveWithin, writeFileJailed } from "./jail";

const MAX_OUTPUT = 8000;
const MAX_FILE_BYTES = 64 * 1024;
const MAX_LIST_ENTRIES = 300;
const TEST_TIMEOUT_MS = 300_000;
const SKIP_DIRS = new Set(["node_modules", ".git"]);
const DEFAULT_MODEL = "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free";

export const tail = (s: string, n = MAX_OUTPUT): string =>
  s.length <= n ? s : s.slice(s.length - n);

function runTests(cwd: string): { exitCode: number; output: string } {
  try {
    const proc = Bun.spawnSync({
      cmd: ["bun", "test"],
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      timeout: TEST_TIMEOUT_MS,
    });
    return {
      exitCode: proc.exitCode ?? 1,
      output: tail(proc.stdout.toString() + proc.stderr.toString()),
    };
  } catch (err) {
    return { exitCode: 1, output: String(err) };
  }
}

function walkFiles(workDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    if (out.length >= MAX_LIST_ENTRIES) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (out.length >= MAX_LIST_ENTRIES) return;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name), childRel);
        continue;
      }
      if (e.isFile()) out.push(childRel);
    }
  };
  walk(workDir, "");
  return out;
}

export type FixAgentDeps = {
  /** Absolute path of the checked-out repo the agent may modify. */
  workDir: string;
  /** Directory for the memory database (typically SENTINEL_DATA_DIR). */
  dataDir: string;
  /** "owner/name" of the repo, used for per-repo memory threads. */
  repo: string;
  /** SENTINEL_MODEL override; defaults to the free Nemotron model. */
  model?: string;
};

export type FixAgentResult = {
  status: "fixed" | "failed";
  iterations: number;
  filesChanged: string[];
  rationale?: string;
  lastOutput: string;
};

export function createFixTools(workDir: string, written: Set<string>) {
  const root = resolve(workDir);
  const readFile = createTool({
    id: "read_file",
    description: "Read a UTF-8 file from the repository. Path must be relative to the repo root.",
    inputSchema: z.object({ path: z.string().describe("repo-relative path") }),
    outputSchema: z.object({ path: z.string().optional(), content: z.string().optional(), error: z.string().optional() }),
    execute: async ({ path }) => {
      const target = resolveWithin(root, path);
      if (!target) return { error: `path rejected: ${path}` };
      try {
        const content = readFileSync(target.abs, "utf8");
        const truncated = Buffer.byteLength(content) > MAX_FILE_BYTES;
        return { path: target.rel, content: truncated ? content.slice(0, MAX_FILE_BYTES) : content };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
  });

  const writeFile = createTool({
    id: "write_file",
    description:
      "Write a file (full contents) inside the repository. Path must be relative to the repo root. Parent directories are created. Symlinks and .git are refused.",
    inputSchema: z.object({
      path: z.string().describe("repo-relative path"),
      content: z.string().describe("complete file contents"),
    }),
    outputSchema: z.object({ ok: z.boolean(), path: z.string().optional(), error: z.string().optional() }),
    execute: async ({ path, content }) => {
      try {
        const target = writeFileJailed(root, path, content);
        written.add(target.rel);
        return { ok: true, path: target.rel };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  });

  const listFilesTool = createTool({
    id: "list_files",
    description: "List files in the repository (relative paths, skips node_modules and .git).",
    inputSchema: z.object({}),
    outputSchema: z.object({ files: z.array(z.string()) }),
    execute: async () => ({ files: walkFiles(root) }),
  });

  const runTestsTool = createTool({
    id: "run_tests",
    description: "Run the test suite (`bun test`) in the repo root. Returns exit code and combined output.",
    inputSchema: z.object({}),
    outputSchema: z.object({ exitCode: z.number(), output: z.string() }),
    execute: async () => runTests(root),
  });

  return { read_file: readFile, write_file: writeFile, list_files: listFilesTool, run_tests: runTestsTool };
}

const INSTRUCTIONS = `You are Sentinel, an autonomous CI-fix agent. You are given a failing CI run.
Work inside the given repository only. Rules:
1. Start by calling list_files, then read the failing test output and the relevant source/test files.
2. Make the minimal change that makes the suite green. Do not refactor, reformat, or touch unrelated files, CI config, or .git.
3. Prefer fixing source over weakening tests. Never delete or loosen assertions to make a failure disappear.
4. Call run_tests after every write. Stop when the suite is green.
5. If you are stuck after a few attempts, stop and say exactly what is blocked.
6. Finish with a one-paragraph rationale: root cause and what you changed.`;

export function createFixAgent(deps: FixAgentDeps) {
  const { workDir, dataDir, repo } = deps;
  const written = new Set<string>();
  const tools = createFixTools(workDir, written);

  const testsGreen = createScorer({
    id: "tests-green",
    name: "Tests green",
    description: "`bun test` exits 0 in the repo after the agent finishes.",
    type: "agent",
  }).generateScore(async () => (runTests(workDir).exitCode === 0 ? 1 : 0));

  const memory = new Memory({
    storage: new LibSQLStore({
      id: "sentinel-memory",
      url: `file:${join(dataDir, "memory.db")}`,
    }),
    options: { lastMessages: 10 },
  });

  const model = deps.model ?? process.env.SENTINEL_MODEL ?? DEFAULT_MODEL;
  const agent = new Agent({
    id: "ci-fixer",
    name: "CI Fixer",
    description: "Diagnoses failing CI and lands a minimal fix on a branch.",
    instructions: INSTRUCTIONS,
    model,
    tools,
    memory,
    scorers: { "tests-green": { scorer: testsGreen, sampling: { type: "ratio", rate: 1 } } },
  });

  return { agent, written, repo, workDir };
}

export async function runFixAgent(
  deps: FixAgentDeps & { deliveryId: string; failingOutput: string },
): Promise<FixAgentResult> {
  const { agent, written } = createFixAgent(deps);
  const prompt =
    `Repo: ${deps.repo} (delivery ${deps.deliveryId})\n\n` +
    `CI is failing. Failing output (tail):\n\n${tail(deps.failingOutput)}\n\n` +
    `Fix it using the tools. Finish by confirming run_tests passes.`;

  let text = "";
  let steps = 0;
  try {
    const result = await agent.generate(prompt, {
      maxSteps: 14,
      memory: { thread: `night-shift:${deps.repo}`, resource: "sentinel" },
    });
    text = typeof (result as { text?: unknown }).text === "string" ? (result as { text: string }).text : "";
    steps = Array.isArray((result as { steps?: unknown[] }).steps) ? (result as { steps: unknown[] }).steps.length : 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const finalTests = runTests(deps.workDir);
    return {
      status: finalTests.exitCode === 0 ? "fixed" : "failed",
      iterations: steps,
      filesChanged: [...written].sort(),
      rationale: `agent error: ${message}`,
      lastOutput: tail(finalTests.output),
    };
  }

  const finalTests = runTests(deps.workDir);
  return {
    status: finalTests.exitCode === 0 ? "fixed" : "failed",
    iterations: steps,
    filesChanged: [...written].sort(),
    rationale: text ? tail(text, 2000) : undefined,
    lastOutput: tail(finalTests.output),
  };
}
