import fs from 'node:fs';
import zlib from 'node:zlib';

const content = fs.readFileSync('dist/content.js');
const compressed = zlib.gzipSync(content);
const size = compressed.length;

if (size > 61440) {
  throw new Error(`dist/content.js is too large: ${size} bytes (limit: 61440 bytes)`);
}

console.log(`dist/content.js is within limit: ${size} bytes`);
