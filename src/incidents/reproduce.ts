import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

export type ReproduceIncident = {
  deliveryId: string;
  repo: string;
  sha: string;
  branch: string;
  workflow: string;
  runId: number;
  runUrl?: string | undefined;
};

export type RunResult = { exitCode: number; output: string };
export type RunFn = (cmd: string[], cwd: string) => RunResult;

export type ReproduceResult = {
  reproduced: boolean;
  testExitCode: number | null;
  installOk: boolean;
  outputTail: string;
  error?: string;
};

export type ReproduceOptions = { run?: RunFn };

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const DELIVERY_ID_RE = /^[A-Za-z0-9-]+$/;
const MAX_OUTPUT = 8000;

function tail(output: string): string {
  return output.length <= MAX_OUTPUT ? output : output.slice(-MAX_OUTPUT);
}

function defaultRun(cmd: string[], cwd: string): RunResult {
  // brief pins run(cmd, cwd) with no timeout param; bun test gets 300s, everything else 120s
  const timeout = cmd[1] === "test" ? 300_000 : 120_000;
  const proc = Bun.spawnSync({ cmd, cwd, stdout: "pipe", stderr: "pipe", timeout });
  const output =
    proc.stdout.toString() +
    proc.stderr.toString() +
    (proc.exitedDueToTimeout ? `\n[timeout after ${timeout}ms]` : "");
  return { exitCode: proc.exitCode, output };
}

export function reproduceFailure(
  incident: ReproduceIncident,
  opts?: ReproduceOptions,
): ReproduceResult {
  const invalid = (error: string): ReproduceResult => ({
    reproduced: false,
    testExitCode: null,
    installOk: false,
    outputTail: "",
    error,
  });

  if (!REPO_RE.test(incident.repo)) {
    return invalid(`invalid repo: ${JSON.stringify(incident.repo)}`);
  }
  if (!DELIVERY_ID_RE.test(incident.deliveryId)) {
    return invalid(`invalid deliveryId: ${JSON.stringify(incident.deliveryId)}`);
  }

  const workDir = join(process.env.SENTINEL_DATA_DIR ?? "./data", "work", incident.deliveryId);
  const run = opts?.run ?? defaultRun;
  let output = "";

  try {
    rmSync(workDir, { recursive: true, force: true });
    mkdirSync(workDir, { recursive: true });

    const cloneSteps = [
      ["git", "init"],
      ["git", "remote", "add", "origin", `https://github.com/${incident.repo}.git`],
      ["git", "fetch", "--depth", "1", "origin", incident.sha],
      ["git", "checkout", "--detach", "FETCH_HEAD"],
    ];
    for (const cmd of cloneSteps) {
      const r = run(cmd, workDir);
      output += r.output;
      if (r.exitCode !== 0) {
        return {
          reproduced: false,
          testExitCode: null,
          installOk: false,
          outputTail: tail(output),
          error: `clone failed at: ${cmd.join(" ")} (exit ${r.exitCode})`,
        };
      }
    }

    const install = run(["bun", "install"], workDir);
    output += install.output;
    if (install.exitCode !== 0) {
      return {
        reproduced: false,
        testExitCode: null,
        installOk: false,
        outputTail: tail(output),
        error: `bun install failed (exit ${install.exitCode})`,
      };
    }

    const test = run(["bun", "test"], workDir);
    output += test.output;
    return {
      reproduced: test.exitCode !== 0,
      testExitCode: test.exitCode,
      installOk: true,
      outputTail: tail(output),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { reproduced: false, testExitCode: null, installOk: false, outputTail: tail(output), error };
  }
}
