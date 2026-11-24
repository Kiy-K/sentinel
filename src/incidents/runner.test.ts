import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectInstallCommand, detectTestCommand, minimalEnv } from "./runner";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "runner-test-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("detectInstallCommand", () => {
  test("node project gets bun install --ignore-scripts", () => {
    writeFileSync(join(dir, "package.json"), "{}");
    expect(detectInstallCommand(dir)).toEqual(["bun", "install", "--ignore-scripts"]);
  });
  test("python project gets pip install", () => {
    writeFileSync(join(dir, "requirements.txt"), "pytest\n");
    expect(detectInstallCommand(dir)).toEqual(["python3", "-m", "pip", "install", "-q", "-r", "requirements.txt"]);
  });
  test("no manifest returns null", () => {
    expect(detectInstallCommand(dir)).toBeNull();
  });
});

describe("detectTestCommand", () => {
  test("package.json with a real test script wins", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: { test: "jest" } }));
    expect(detectTestCommand(dir)).toEqual(["bun", "run", "test"]);
  });
  test("placeholder test script falls back to bun test when bun.lock exists", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: { test: "echo \"Error: no test specified\" && exit 1" } }));
    writeFileSync(join(dir, "bun.lock"), "");
    expect(detectTestCommand(dir)).toEqual(["bun", "test"]);
  });
  test("python project gets pytest", () => {
    writeFileSync(join(dir, "pyproject.toml"), "[project]\nname='x'\n");
    expect(detectTestCommand(dir)).toEqual(["python3", "-m", "pytest", "-x", "-q"]);
  });
  test("empty dir defaults to bun test", () => {
    expect(detectTestCommand(dir)).toEqual(["bun", "test"]);
  });
});

describe("minimalEnv", () => {
  test("keeps PATH/HOME, sets CI, drops secrets", () => {
    process.env.OPENROUTER_API_KEY = "sk-test-secret";
    const env = minimalEnv();
    expect(env.PATH).toBe(process.env.PATH!);
    expect(env.CI).toBe("1");
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
    expect(env.WEBHOOK_SECRET).toBeUndefined();
    delete process.env.OPENROUTER_API_KEY;
  });
});
