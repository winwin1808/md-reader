import { describe, it, expect } from 'vitest';
import { chmod, mkdir, mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultPairPath, loadOrCreateIdentity } from './pairing';

describe('pairing', () => {
  it('defaultPairPath branches', () => {
    expect(defaultPairPath({ MDR_PAIR_FILE: '/x/y.json' }, 'linux', '/h')).toBe('/x/y.json');
    expect(defaultPairPath({ APPDATA: '/ad' }, 'win32', '/h')).toBe(join('/ad', 'md-reader', 'mcp.json'));
    expect(defaultPairPath({}, 'win32', '/h')).toBe(join('/h', 'AppData', 'Roaming', 'md-reader', 'mcp.json'));
    expect(defaultPairPath({ XDG_CONFIG_HOME: '/xdg' }, 'linux', '/h')).toBe(join('/xdg', 'md-reader', 'mcp.json'));
    expect(defaultPairPath({}, 'darwin', '/h')).toBe(join('/h', '.config', 'md-reader', 'mcp.json'));
  });
});

describe('identity v2', () => {
  it('creates v2 file, mode 0600, reloads same publicKey', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mdr-'));
    const p = join(dir, 'sub', 'mcp.json');
    const a = await loadOrCreateIdentity(p);
    const f = JSON.parse(await readFile(p, 'utf8'));
    expect(f.version).toBe(2);
    expect(f.privateKey).toBeTruthy();
    expect(f.publicKey).toBe(a.publicKey);
    expect(f.pairKey).toBeUndefined();
    expect(a.extKey).toBeNull();
    if (process.platform !== 'win32') expect((await stat(p)).mode & 0o777).toBe(0o600);
    const b = await loadOrCreateIdentity(p);
    expect(b.publicKey).toBe(a.publicKey);
  });
  it('replaces v1 file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mdr-'));
    const p = join(dir, 'mcp.json');
    await writeFile(p, JSON.stringify({ pairKey: 'a'.repeat(43) }));
    await loadOrCreateIdentity(p);
    const f = JSON.parse(await readFile(p, 'utf8'));
    expect(f.version).toBe(2);
    expect(f.pairKey).toBeUndefined();
  });
  it('pinExtKey persists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mdr-'));
    const p = join(dir, 'mcp.json');
    const a = await loadOrCreateIdentity(p);
    await a.pinExtKey('EXTKEY');
    expect(a.extKey).toBe('EXTKEY');
    const b = await loadOrCreateIdentity(p);
    expect(b.extKey).toBe('EXTKEY');
    expect(b.publicKey).toBe(a.publicKey);
    if (process.platform !== 'win32') expect((await stat(p)).mode & 0o777).toBe(0o600);
    expect((await readdir(dir)).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });
  it('corrupt JSON -> new identity', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mdr-'));
    const p = join(dir, 'mcp.json');
    await writeFile(p, '{nope');
    const a = await loadOrCreateIdentity(p);
    expect(JSON.parse(await readFile(p, 'utf8')).publicKey).toBe(a.publicKey);
  });
});
