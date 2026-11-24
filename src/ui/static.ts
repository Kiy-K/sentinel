/** Static file serving for the built web UI (web/dist), with SPA-style index fallback. */
import { readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";

export const WEB_DIST = resolve(process.env.SENTINEL_WEB_DIST ?? "web/dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

export type StaticResult =
  | { found: true; body: Uint8Array; contentType: string; cacheControl: string }
  | { found: false };

/** Map a URL path to a file inside WEB_DIST. Returns index.html for "/" and extensionless paths. */
export function resolveStatic(pathname: string): StaticResult {
  let rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.(\/|\\|$))+/, "").replace(/^[/\\]+/, "");
  if (rel === "." || rel === "") rel = "index.html";
  const abs = join(WEB_DIST, rel);
  if (abs !== WEB_DIST && !abs.startsWith(WEB_DIST + sep)) return { found: false };

  const tryFile = (p: string): StaticResult => {
    try {
      if (!statSync(p).isFile()) return { found: false };
      const body = readFileSync(p);
      const ext = extname(p).toLowerCase();
      const immutable = /[.-][0-9a-zA-Z_-]{8,}\./.test(p) || p.includes(`${sep}assets${sep}`);
      return {
        found: true,
        body,
        contentType: MIME[ext] ?? "application/octet-stream",
        cacheControl: immutable ? "public, max-age=31536000, immutable" : "no-cache",
      };
    } catch {
      return { found: false };
    }
  };

  const direct = tryFile(abs);
  if (direct.found) return direct;
  // SPA fallback: extensionless paths get the app shell.
  if (!extname(rel)) {
    const index = tryFile(join(WEB_DIST, "index.html"));
    if (index.found) return { ...index, cacheControl: "no-cache" };
  }
  return { found: false };
}
