export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Sentinel Night Shift</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #0d1117;
    color: #c9d1d9;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.5;
  }
  code, pre, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  header.top {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.75rem 1.25rem; border-bottom: 1px solid #21262d; background: #161b22;
  }
  header.top a.brand { color: #e6edf3; text-decoration: none; font-weight: 600; letter-spacing: 0.02em; }
  header.top a.brand span { color: #58a6ff; }
  main { max-width: 1100px; margin: 0 auto; padding: 1.25rem; }
  h1 { font-size: 1.25rem; color: #e6edf3; }
  h2 { font-size: 1rem; color: #e6edf3; border-bottom: 1px solid #21262d; padding-bottom: 0.35rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th, td { text-align: left; padding: 0.45rem 0.6rem; border-bottom: 1px solid #21262d; vertical-align: top; }
  th { color: #8b949e; font-weight: 600; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; }
  tr:hover td { background: #161b22; }
  a { color: #58a6ff; }
  .badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.75rem; font-family: ui-monospace, monospace; border: 1px solid #30363d; }
  .badge.ok, .badge.fixed, .badge.published { color: #3fb950; border-color: #3fb950; }
  .badge.failed, .badge.error { color: #f85149; border-color: #f85149; }
  .badge.running { color: #d29922; border-color: #d29922; }
  pre { background: #161b22; border: 1px solid #21262d; border-radius: 6px; padding: 0.75rem; overflow-x: auto; font-size: 0.8rem; }
  dl.fields { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; font-size: 0.875rem; }
  dl.fields dt { color: #8b949e; }
  dl.fields dd { margin: 0; }
  .empty { color: #8b949e; padding: 2rem 0; text-align: center; }
  footer { border-top: 1px solid #21262d; margin-top: 2rem; padding: 0.75rem 1.25rem; color: #8b949e; font-size: 0.8rem; }
  footer a { color: #58a6ff; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .skip { position: absolute; left: -9999px; top: 0; background: #1f6feb; color: #fff; padding: 0.4rem 0.8rem; z-index: 10; }
  .skip:focus { left: 0.5rem; top: 0.5rem; }
  :focus-visible { outline: 2px solid #58a6ff; outline-offset: 2px; }
  .badge.skipped { color: #d29922; border-color: #d29922; }
  .table-wrap { overflow-x: auto; }
  .tagline { color: #8b949e; font-size: 0.8rem; margin: -0.5rem 0 1rem; }
  table { caption-side: top; }
  caption { text-align: left; color: #8b949e; font-size: 0.8rem; padding-bottom: 0.4rem; }
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><a class="brand" href="/">Sentinel <span>Night Shift</span></a><span class="mono" style="color:#8b949e;font-size:0.8rem">ops</span></header>
<main id="main">
${body}
</main>
<footer>Sentinel Night Shift — CI failure → reproduce → fix → PR, unattended. Read-only <a href="/healthz">ops view</a>.</footer>
</body>
</html>`;
}
