import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultPairPath, loadOrCreatePairKey, newPairKey } from './pairing';

describe('pairing', () => {
  it('newPairKey is 43 chars base64url', () => {
    expect(newPairKey()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it('creates once, reuses, mode 0600', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mdr-'));
    const p = join(dir, 'sub', 'mcp.json');
    const a = await loadOrCreatePairKey(p);
    const b = await loadOrCreatePairKey(p);
    expect(a).toBe(b);
    if (process.platform !== 'win32') expect((await stat(p)).mode & 0o777).toBe(0o600);
  });
  it('replaces corrupt file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mdr-'));
    const p = join(dir, 'mcp.json');
    await writeFile(p, '{nope');
    const a = await loadOrCreatePairKey(p);
    expect(JSON.parse(await readFile(p, 'utf8')).pairKey).toBe(a);
    await writeFile(p, JSON.stringify({ pairKey: 'short' }));
    expect(await loadOrCreatePairKey(p)).not.toBe('short');
  });
  it('defaultPairPath branches', () => {
    expect(defaultPairPath({ MDR_PAIR_FILE: '/x/y.json' }, 'linux', '/h')).toBe('/x/y.json');
    expect(defaultPairPath({ APPDATA: '/ad' }, 'win32', '/h')).toBe(join('/ad', 'md-reader', 'mcp.json'));
    expect(defaultPairPath({}, 'win32', '/h')).toBe(join('/h', 'AppData', 'Roaming', 'md-reader', 'mcp.json'));
    expect(defaultPairPath({ XDG_CONFIG_HOME: '/xdg' }, 'linux', '/h')).toBe(join('/xdg', 'md-reader', 'mcp.json'));
    expect(defaultPairPath({}, 'darwin', '/h')).toBe(join('/h', '.config', 'md-reader', 'mcp.json'));
  });
});
