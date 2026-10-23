import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = (f) => fileURLToPath(new URL(`../public/icons/${f}`, import.meta.url));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [16, 32, 48, 128]) {
    const raw = readFileSync(dir(size === 16 ? 'logo-16.svg' : 'logo.svg'), 'utf8');
    const svg = raw.replace('<svg ', `<svg width="${size}" height="${size}" `);
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg}</body></html>`,
    );
    const path = dir(`icon-${size}.png`);
    await page.screenshot({
      path,
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    console.log(`wrote ${path}`);
  }
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
