import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist/content.js');
const content = fs.readFileSync(distPath);
const compressed = zlib.gzipSync(content);
const size = compressed.length;

if (size > 61440) {
  throw new Error(`dist/content.js is too large: ${size} bytes (limit: 61440 bytes)`);
}

console.log(`dist/content.js is within limit: ${size} bytes`);
