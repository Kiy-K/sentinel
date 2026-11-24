/**
 * Path jail for agent tools: lexical + realpath containment, symlink-safe writes
 * with rollback. Shared by the fix agent's read/write/list tools.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

export function isInside(root: string, p: string): boolean {
  const r = root.endsWith(sep) ? root : root + sep;
  return p === root || p.startsWith(r);
}

/** Lexically resolve `rel` against `workDir` and reject anything outside it (incl. .git). */
export function resolveWithin(
  workDir: string,
  rel: string,
): { abs: string; rel: string } | null {
  const norm = rel.replace(/\\/g, "/");
  if (norm.startsWith("/") || /^[A-Za-z]:/.test(norm)) return null;
  const parts = norm.split("/").filter((p) => p && p !== ".");
  if (parts.includes("..") || parts.includes(".git")) return null;
  const root = resolve(workDir);
  const abs = resolve(root, parts.join("/"));
  if (abs === root || !isInside(root, abs)) return null;
  if (parts.length === 0) return null;
  return { abs, rel: parts.join("/") };
}

function deepestExistingReal(target: string): string {
  let cur = target;
  for (;;) {
    if (existsSync(cur)) return realpathSync(cur);
    const parent = dirname(cur);
    if (parent === cur) return cur;
    cur = parent;
  }
}

/** Symlink/realpath checks for the parent chain of `abs`; throws on escape. */
function assertParentsSafe(workDir: string, abs: string, rel: string): void {
  const rootReal = realpathSync(resolve(workDir));
  const dir = dirname(abs);
  const ancestorReal = deepestExistingReal(dir);
  if (!isInside(rootReal, ancestorReal)) {
    throw new Error(`path escapes workDir via symlink: ${rel}`);
  }
  const dirReal = existsSync(dir) ? realpathSync(dir) : ancestorReal;
  if (!isInside(rootReal, dirReal)) {
    throw new Error(`path escapes workDir via symlink: ${rel}`);
  }
  const relFromRoot = relative(rootReal, abs).split(sep).filter(Boolean);
  const relReal = relative(rootReal, dirReal).split(sep).filter(Boolean);
  if ([...relFromRoot, ...relReal].includes(".git")) {
    throw new Error(`refusing to write into .git: ${rel}`);
  }
}

/** Write `content` to workDir/rel with symlink checks and rollback of prior files. */
export function writeFileJailed(workDir: string, rel: string, content: string): { abs: string; rel: string } {
  const target = resolveWithin(workDir, rel);
  if (!target) throw new Error(`path rejected: ${rel}`);
  const { abs } = target;
  assertParentsSafe(workDir, abs, target.rel);
  const dir = dirname(abs);
  const backups: { abs: string; before: string | null }[] = [];
  try {
    mkdirSync(dir, { recursive: true });
    if (existsSync(abs) && lstatSync(abs).isSymbolicLink()) {
      throw new Error(`refusing to write through symlink: ${target.rel}`);
    }
    backups.push({ abs, before: existsSync(abs) ? readFileSync(abs, "utf8") : null });
    writeFileSync(abs, content);
    return target;
  } catch (err) {
    for (const b of backups.reverse()) {
      try {
        if (b.before === null) rmSync(b.abs, { force: true });
        else writeFileSync(b.abs, b.before);
      } catch {
        /* best effort */
      }
    }
    throw err;
  }
}
