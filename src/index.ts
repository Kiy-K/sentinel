const port = Number(process.env.PORT ?? 8080);
const startedAt = Date.now();

const server = Bun.serve({
  port,
  routes: {
    "/healthz": () =>
      Response.json({
        ok: true,
        service: "sentinel-night-shift",
        version: "0.1.0",
        uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      }),
  },
  fetch: () => new Response("not found", { status: 404 }),
});
console.log(`sentinel-night-shift listening on :${server.port}`);
