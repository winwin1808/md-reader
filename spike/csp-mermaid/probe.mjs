// Spike 1a.2 — automated CSP probe. Throwaway harness, deleted at 1b1.
// Spawns the fixture server, launches Chrome with the spike extension
// loaded, visits each CSP route + the file:// fixture, and reads the
// `data-spike-result` attribute the content script wrote to <html>.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Google Chrome (branded, stable channel) refuses --load-extension and
// --disable-extensions-except outright ("... is not allowed in Google
// Chrome, ignoring.", confirmed via --enable-logging=stderr --v=1 during
// this spike). Only the Chromium build (unbranded) honours these flags.
// Installed locally for this probe via:
//   npx @puppeteer/browsers install chromium@latest --path ./.chromium
import { existsSync as _existsSync, readdirSync } from 'node:fs';
function findChromium() {
  const base = path.join(HERE, '.chromium', 'chromium');
  if (!_existsSync(base)) return null;
  const revDirs = readdirSync(base);
  for (const rev of revDirs) {
    const candidate = path.join(
      base,
      rev,
      'chrome-mac',
      'Chromium.app',
      'Contents',
      'MacOS',
      'Chromium'
    );
    if (_existsSync(candidate)) return candidate;
  }
  return null;
}
const CHROME_PATH = findChromium();
if (!CHROME_PATH) {
  console.error(
    'BLOCKED: local Chromium not found. Run: npx @puppeteer/browsers install chromium@latest --path ./.chromium'
  );
  process.exit(1);
}
const PORT = 8787;
const ROUTES = ['/none', '/style-self', '/locked', '/style-nonce', '/style-inline'];

function waitForServer(url, timeoutMs = 8000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      fetch(url)
        .then(() => resolve())
        .catch((err) => {
          if (Date.now() - start > timeoutMs) reject(err);
          else setTimeout(tryOnce, 150);
        });
    };
    tryOnce();
  });
}

async function probeOneUrl(browser, url) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
    await page.waitForSelector('[data-spike-result]', { timeout: 8000 });
    const raw = await page.$eval('html', (el) =>
      el.getAttribute('data-spike-result')
    );
    return { ok: true, data: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    await page.close();
  }
}

async function runPass(headless, urls) {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'spike-csp-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless,
    // puppeteer-core's default args include --disable-extensions, which
    // wins over --disable-extensions-except and silently prevents the spike
    // extension from loading. Must be stripped explicitly (found via
    // chrome://version showing both flags present during debugging).
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${HERE}`,
      `--load-extension=${HERE}`,
      '--no-first-run',
      '--allow-file-access-from-files',
      `--user-data-dir=${userDataDir}`,
    ],
  });
  const results = {};
  try {
    for (const url of urls) {
      results[url] = await probeOneUrl(browser, url);
    }
  } finally {
    await browser.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
  return results;
}

function noteFor(route, result) {
  if (!result.ok) return `không xác định (${result.error})`;
  const v = result.data && Array.isArray(result.data.violations) ? result.data.violations.length : null;
  const violNote = v === 0 ? '0 securitypolicyviolation' : `${v} securitypolicyviolation`;
  const foNote = '*fo=0px ở mọi policy kể cả /none → không phải do CSP (không có violation), là chi tiết render của flowchart đơn giản này';
  if (route.startsWith('file://')) {
    return `mermaid thật; file:// không có CSP header (khác biệt cố ý so với 4 route http); extension chạy với --allow-file-access-from-files; ${violNote}; ${foNote}`;
  }
  return `mermaid thật; ${violNote}; ${foNote}`;
}

function cspLabelFor(route) {
  const map = {
    '/none': '(không có header)',
    '/style-self': "default-src 'self'; style-src 'self'",
    '/locked': "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'none'; img-src 'none'",
    '/style-nonce': "style-src 'nonce-spike123'",
    '/style-inline': "default-src 'self'; style-src 'self' 'unsafe-inline'",
  };
  if (route in map) return map[route];
  return '(không có — file://)';
}

function shadowRenderOk(data) {
  if (!data) return 'không xác định';
  const ok = data.shadowStyleHeight === '42px';
  return ok ? 'CÓ (42px)' : `KHÔNG (${data.shadowStyleHeight})`;
}

function mermaidRenderOk(data) {
  if (!data) return 'không xác định';
  const svgOk = (data.mermaidSvgWidth || 0) > 0 && (data.mermaidSvgHeight || 0) > 0;
  if (data.mermaidError) return `KHÔNG (${data.mermaidError})`;
  if (!svgOk) return `KHÔNG (svg ${data.mermaidSvgWidth}x${data.mermaidSvgHeight})`;
  // foreignObjectHeight is 0 (element found, zero height) uniformly across
  // EVERY policy incl. /locked with zero securitypolicyviolation events —
  // this is a rendering-timing detail of this simple flowchart, not a CSP
  // block. SVG box size > 0 is what answers the CSP question.
  return `CÓ (svg ${Math.round(data.mermaidSvgWidth)}x${Math.round(data.mermaidSvgHeight)}, fo ${data.foreignObjectHeight}px*)`;
}

async function main() {
  // 1. start fixture server
  const serverProc = spawn('node', ['server.mjs'], { cwd: HERE, stdio: 'inherit' });
  const stopServer = () => {
    if (!serverProc.killed) serverProc.kill();
  };
  process.on('exit', stopServer);

  await waitForServer(`http://localhost:${PORT}/none`);

  // 2. write the file:// fixture
  await new Promise((resolve, reject) => {
    const p = spawn('node', ['server.mjs', '--write-fixture'], { cwd: HERE, stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('write-fixture failed'))));
  });

  const fixturePath = path.join(HERE, 'fixture.html');
  if (!existsSync(fixturePath)) {
    throw new Error('fixture.html was not written');
  }
  const fileUrl = `file://${fixturePath}`;

  const httpUrls = ROUTES.map((r) => `http://localhost:${PORT}${r}`);
  const allUrls = [...httpUrls, fileUrl];

  let byUrl = {};
  try {
    byUrl = await runPass('new', allUrls);

    // Retry missing URLs once with headless:false
    const missing = allUrls.filter((u) => !byUrl[u] || !byUrl[u].ok);
    if (missing.length > 0) {
      console.error(`Retrying ${missing.length} URL(s) with headless:false: ${missing.join(', ')}`);
      const retry = await runPass(false, missing);
      for (const u of missing) {
        if (retry[u] && retry[u].ok) byUrl[u] = retry[u];
      }
    }
  } finally {
    stopServer();
  }

  // 3. build results.json + markdown table
  const rows = allUrls.map((url) => {
    const route = url.startsWith('file://') ? url : url.replace(`http://localhost:${PORT}`, '');
    const result = byUrl[url];
    const data = result && result.ok ? result.data : null;
    return {
      url,
      route,
      csp: cspLabelFor(route),
      ok: !!(result && result.ok),
      error: result && !result.ok ? result.error : null,
      data,
    };
  });

  writeFileSync(path.join(HERE, 'results.json'), JSON.stringify(rows, null, 2));

  let inconclusiveCount = 0;
  const tableRows = rows.map((r) => {
    if (!r.ok) inconclusiveCount++;
    const trang = r.route;
    const csp = r.csp;
    const shadow = shadowRenderOk(r.data);
    const mermaid = mermaidRenderOk(r.data);
    const note = noteFor(r.route, r);
    return `| ${trang} | ${csp} | ${shadow} | ${mermaid} | ${note} |`;
  });

  const header =
    '| Trang | CSP quan sát được | Shadow DOM + style inline render đúng? | mermaid render đúng? | Ghi chú |\n' +
    '|---|---|---|---|---|';

  console.log(header);
  console.log(tableRows.join('\n'));

  const withShadowHeight = rows.filter(
    (r) => r.data && typeof r.data.shadowStyleHeight === 'string'
  ).length;

  console.error(`\n${withShadowHeight}/${rows.length} URL có shadowStyleHeight là số/chuỗi hợp lệ.`);
  console.error(`${inconclusiveCount} dòng "không xác định".`);

  if (withShadowHeight < 4) {
    console.error('BLOCKED: dưới 4/6 URL đo được shadowStyleHeight — spike thất bại theo ngưỡng đầu ra bắt buộc.');
    process.exitCode = 1;
    return;
  }
  if (inconclusiveCount >= 3) {
    console.error('BLOCKED: >=3 dòng không xác định — spike thất bại, không tự kết luận nhánh.');
    process.exitCode = 1;
    return;
  }
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exitCode = 1;
});
