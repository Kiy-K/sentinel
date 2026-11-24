import { Database } from "bun:sqlite";
import { sentinelDbPath } from "../webhooks/dedupe";
import { getIncident, listIncidents } from "./queries";
import { resolveStatic } from "./static";

// Opens the shared sentinel.db readonly; null when missing so routes degrade gracefully.
function openDb(): Database | null {
  try {
    return new Database(sentinelDbPath(), { readonly: true });
  } catch {
    return null;
  }
}

type Route = { path: string; method: "GET"; handler: (c: any) => any };

function incidentsJson(): Route {
  return {
    path: "/incidents.json",
    method: "GET",
    handler: (c: any) => {
      const db = openDb();
      if (!db) return c.json([]);
      try {
        return c.json(listIncidents(db, 50));
      } finally {
        db.close();
      }
    },
  };
}

function incidentJson(): Route {
  return {
    path: "/incidents/:id{[^/]+\\.json}",
    method: "GET",
    handler: (c: any) => {
      const id = (c.req.param("id") ?? "").replace(/\.json$/, "");
      const db = openDb();
      if (!db) return c.json({ error: "not found" }, 404);
      try {
        const found = getIncident(db, id);
        if (!found) return c.json({ error: "not found" }, 404);
        return c.json({ ...found.incident, fix: found.fix });
      } finally {
        db.close();
      }
    },
  };
}

function spa(): Route {
  return {
    path: "*",
    method: "GET",
    handler: (c: any) => {
      const path = new URL(c.req.url).pathname;
      const hit = resolveStatic(path);
      if (!hit.found) {
        return c.text("not found", 404);
      }
      return c.body(hit.body, 200, {
        "content-type": hit.contentType,
        "cache-control": hit.cacheControl,
      });
    },
  };
}

/** JSON API + static SPA catch-all. Mount these LAST in apiRoutes. */
export function uiRoutes(): Route[] {
  return [incidentsJson(), incidentJson(), spa()];
}
