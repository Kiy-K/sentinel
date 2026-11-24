/**
 * Test/install command detection + minimal subprocess environment.
 * The incident pipeline executes code from an untrusted repo checkout, so
 * spawned commands get a scrubbed env, not the host's secrets.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Command = string[];

/** Env for spawned repo code: no OPENROUTER_API_KEY / tokens, just enough to build. */
export function minimalEnv(): Record<string, string> {
  const keep = ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TERM", "USER"];
  const env: Record<string, string> = {};
  for (const key of keep) {
    const v = process.env[key];
    if (v) env[key] = v;
  }
  env.CI = "1";
  return env;
}

const hasPyTestSignals = (dir: string): boolean =>
  ["pytest.ini", "pyproject.toml", "setup.cfg", "setup.py"].some((f) => existsSync(join(dir, f)));

/** Install command for a checkout, or null when nothing needs installing. */
export function detectInstallCommand(dir: string): Command | null {
  const pkg = join(dir, "package.json");
  if (existsSync(pkg)) {
    // bun handles npm deps fine; --ignore-scripts so postinstall scripts in
    // a hostile package can't run during dependency install.
    return ["bun", "install", "--ignore-scripts"];
  }
  if (existsSync(join(dir, "requirements.txt"))) {
    return ["python3", "-m", "pip", "install", "-q", "-r", "requirements.txt"];
  }
  return null;
}

/** Best-effort test command detection. Defaults to bun test (our canonical stack). */
export function detectTestCommand(dir: string): Command {
  const pkgPath = join(dir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const scripts = (JSON.parse(readFileSync(pkgPath, "utf8")) as { scripts?: Record<string, string> }).scripts;
      const t = scripts?.test;
      if (typeof t === "string" && t.trim() && !/no test specified/i.test(t)) {
        return ["bun", "run", "test"];
      }
    } catch {
      // Unparseable package.json: fall through to defaults.
    }
    if (existsSync(join(dir, "bun.lock")) || existsSync(join(dir, "bun.lockb"))) {
      return ["bun", "test"];
    }
    return ["bun", "run", "test"];
  }
  if (hasPyTestSignals(dir)) {
    return ["python3", "-m", "pytest", "-x", "-q"];
  }
  return ["bun", "test"];
}
