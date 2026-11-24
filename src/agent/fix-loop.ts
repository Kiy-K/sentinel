/**
 * Fix loop for CI failures: ask the LLM for full-file replacements, write them
 * inside workDir only, then re-run the test suite. Gives up after
 * maxIterations. Never throws for LLM or test failures — only programmer
 * error (bad arguments) may throw.
 */
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  realpathSync,
  lstatSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join, resolve, dirname, sep } from "node:path";
import type { ChatMessage } from "./llm";

export type FixLlm = {
  chatCompletion: (opts: {
    messages: ChatMessage[];
    maxTokens?: number;
    model?: string;
  }) => Promise<string>;
};

export type TestRunResult = { exitCode: number; output: string };
export type RunTestsFn = (cwd: string) => TestRunResult;

export type FixLoopResult = {
  status: "fixed" | "failed" | "llm_unavailable";
  iterations: number;
  filesChanged: string[];
  rationale?: string;
  lastOutput?: string;
};

export type FixLoopOptions = {
  workDir: string;
  failingOutput: string;
  llm: FixLlm;
  runTests?: RunTestsFn;
  maxIterations?: number;
};

const MAX_OUTPUT = 8000;
const MAX_SOURCE_BYTES = 40 * 1024;
const SKIP_DIRS = new Set(["node_modules", ".git"]);
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const TEST_TIMEOUT_MS = 300_000;

function tail(output: string): string {
  return output.length <= MAX_OUTPUT ? output : output.slice(-MAX_OUTPUT);
}

function defaultRunTests(cwd: string): TestRunResult {
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

function collectContext(workDir: string): string {
  const files: string[] = [];
  const walk = (dir: string, rel: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name), childRel);
        continue;
      }
      if (e.isFile() && SOURCE_EXT.test(e.name)) files.push(childRel);
    }
  };
  walk(workDir, "");

  const parts: string[] = [];
  let used = 0;
  for (const rel of files) {
    let content: string;
    try {
      content = readFileSync(join(workDir, rel), "utf8");
    } catch {
      continue;
    }
    const size = Buffer.byteLength(content);
    if (used + size > MAX_SOURCE_BYTES) continue;
    used += size;
    parts.push(`=== ${rel} ===\n${content}`);
  }
  return parts.join("\n\n");
}

type ParsedFix = {
  files: { path: string; content: string }[];
  rationale?: string;
};

function parseFixResponse(raw: string): ParsedFix | null {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const tryParse = (t: string): Record<string, unknown> | null => {
    try {
      const v: unknown = JSON.parse(t);
      return v && typeof v === "object"
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };
  let parsed = tryParse(s);
  if (!parsed) {
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    if (a !== -1 && b > a) parsed = tryParse(s.slice(a, b + 1));
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (!Array.isArray(p.files)) return null;
  const files: { path: string; content: string }[] = [];
  for (const f of p.files) {
    if (
      !f ||
      typeof f !== "object" ||
      typeof (f as any).path !== "string" ||
      typeof (f as any).content !== "string"
    ) {
      return null;
    }
    files.push({ path: (f as any).path, content: (f as any).content });
  }
  return {
    files,
    rationale: typeof p.rationale === "string" ? p.rationale : undefined,
  };
}

function resolveWithin(
  workDir: string,
  rel: string,
): { abs: string; rel: string } | null {
  const norm = rel.replace(/\\/g, "/");
  if (norm.startsWith("/") || /^[A-Za-z]:/.test(norm)) return null;
  if (norm.split("/").includes(".git")) return null;
  const root = resolve(workDir);
  const abs = resolve(root, norm);
  if (abs === root || !abs.startsWith(root + sep)) return null;
  return { abs, rel: norm };
}

export async function runFixLoop(opts: FixLoopOptions): Promise<FixLoopResult> {
  const { workDir, failingOutput, llm } = opts;
  if (!workDir) throw new Error("runFixLoop: workDir is required");
  const maxIterations = opts.maxIterations ?? 3;
  const runTests = opts.runTests ?? defaultRunTests;

  const changed = new Set<string>();
  let lastOutput = tail(failingOutput);
  let rationale: string | undefined;

  for (let i = 0; i < maxIterations; i++) {
    const iteration = i + 1;
    const context = collectContext(workDir);
    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are an expert debugger. Respond with ONLY strict JSON of the form " +
          '{"files":[{"path":"<relative/path>","content":"<full new file content>"}],"rationale":"<one line>"}. ' +
          "No prose, no markdown fences. Paths must be relative to the repo root; give complete file contents, never diffs.",
      },
      {
        role: "user",
        content:
          `Failing test output:\n${lastOutput}\n\n` +
          (i > 0 ? `Previous fix did not make the tests pass. Try again.\n\n` : "") +
          `Source files:\n${context}\n\n` +
          "Return the JSON object now.",
      },
    ];

    let raw: string;
    try {
      raw = await llm.chatCompletion({ messages, maxTokens: 8192 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        status: "llm_unavailable",
        iterations: iteration,
        filesChanged: [...changed],
        rationale,
        lastOutput: tail(`${lastOutput}\n\nLLM error: ${msg}`),
      };
    }

    const parsed = parseFixResponse(raw);
    if (!parsed) {
      lastOutput = tail(
        `${lastOutput}\n\nIteration ${iteration}: could not parse LLM response as fix JSON. Raw: ${raw.slice(0, 2000)}`,
      );
      continue;
    }
    if (parsed.rationale) rationale = parsed.rationale;

    // Validate everything before writing anything.
    const resolved: { abs: string; rel: string; content: string }[] = [];
    let rejected = false;
    for (const f of parsed.files) {
      const r = resolveWithin(workDir, f.path);
      if (!r) {
        rejected = true;
        break;
      }
      resolved.push({ ...r, content: f.content });
    }
    if (rejected) {
      lastOutput = tail(
        `${lastOutput}\n\nIteration ${iteration}: rejected file path outside workDir; no files written.`,
      );
      continue;
    }

    // Write atomically-ish: snapshot existing files so a mid-write failure can be rolled back.
    // Also refuse to write through symlinks (norm path is lexical; the worktree may contain them).
    const backups: { abs: string; before: string | null }[] = [];
    let writeError: string | null = null;
    try {
      const rootReal = realpathSync(workDir);
      for (const f of resolved) {
        const dir = dirname(f.abs);
        mkdirSync(dir, { recursive: true });
        const dirReal = realpathSync(dir);
        if (dirReal !== rootReal && !dirReal.startsWith(rootReal + sep)) {
          throw new Error(`path escapes workDir via symlink: ${f.rel}`);
        }
        if (existsSync(f.abs) && lstatSync(f.abs).isSymbolicLink()) {
          throw new Error(`refusing to write through symlink: ${f.rel}`);
        }
        backups.push({ abs: f.abs, before: existsSync(f.abs) ? readFileSync(f.abs, "utf8") : null });
        writeFileSync(f.abs, f.content);
      }
    } catch (err) {
      for (const b of backups.reverse()) {
        try {
          if (b.before === null) rmSync(b.abs, { force: true });
          else writeFileSync(b.abs, b.before);
        } catch { /* best effort rollback */ }
      }
      writeError = err instanceof Error ? err.message : String(err);
    }
    if (writeError) {
      lastOutput = tail(`${lastOutput}\n\nIteration ${iteration}: write failed: ${writeError}`);
      continue;
    }
    for (const f of resolved) changed.add(f.rel);

    const result = runTests(workDir);
    lastOutput = tail(result.output);
    if (result.exitCode === 0) {
      return {
        status: "fixed",
        iterations: iteration,
        filesChanged: [...changed],
        rationale,
        lastOutput,
      };
    }
  }

  return {
    status: "failed",
    iterations: maxIterations,
    filesChanged: [...changed],
    rationale,
    lastOutput,
  };
}
