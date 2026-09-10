// Fixture server for spike 1a.1 — CSP probe harness. No deps, node http only.
import http from 'node:http';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PORT = 8787;

const SAMPLE_MD = `# Spike heading

- item one
- item two

\`\`\`mermaid
graph TD; A-->B
\`\`\`
`;

function bodyFor(route) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>csp-spike ${route}</title></head>
<body>
<pre>${SAMPLE_MD}</pre>
</body>
</html>`;
}

export const ROUTES = {
  '/none': null,
  '/style-self': "default-src 'self'; style-src 'self'",
  '/locked': "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'none'; img-src 'none'",
  '/style-nonce': "style-src 'nonce-spike123'",
  '/style-inline': "default-src 'self'; style-src 'self' 'unsafe-inline'",
};

function selftest() {
  for (const [route, csp] of Object.entries(ROUTES)) {
    console.log(`${route} → ${csp === null ? '(no CSP header)' : csp}`);
  }
}

export function writeFileFixture(dir) {
  // Uses the /locked policy body as a stand-in for the file:/// manual check
  // (file:// responses cannot carry a CSP response header; the manual test
  // documented in README exercises the browser's default file:// CSP-less
  // behavior against the same DOM probe).
  const out = path.join(dir, 'fixture.html');
  writeFileSync(out, bodyFor('/none'), 'utf8');
  console.log(`wrote ${out}`);
}

const args = process.argv.slice(2);

if (args.includes('--selftest')) {
  selftest();
  process.exit(0);
}

if (args.includes('--write-fixture')) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  writeFileFixture(here);
  process.exit(0);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const csp = ROUTES[url.pathname];
  const headers = { 'Content-Type': 'text/html; charset=utf-8' };
  if (url.pathname in ROUTES) {
    if (csp !== null) headers['Content-Security-Policy'] = csp;
    res.writeHead(200, headers);
    res.end(bodyFor(url.pathname));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`spike csp-mermaid fixture server on http://localhost:${PORT}`);
});
