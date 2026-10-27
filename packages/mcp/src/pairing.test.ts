import { describe, it, expect, vi } from 'vitest';
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
  it('parallel loadOrCreateIdentity on an empty path share one publicKey', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mdr-'));
    const p = join(dir, 'mcp.json');
    const ids = await Promise.all([1, 2, 3, 4].map(() => loadOrCreateIdentity(p)));
    expect(new Set(ids.map((i) => i.publicKey)).size).toBe(1);
    expect(JSON.parse(await readFile(p, 'utf8')).publicKey).toBe(ids[0]!.publicKey);
  });
  it('pinExtKey throws PINNED when the file already pins another key; memory unchanged', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mdr-'));
    const p = join(dir, 'mcp.json');
    const a = await loadOrCreateIdentity(p);
    const b = await loadOrCreateIdentity(p);
    await a.pinExtKey('KEY_A');
    await expect(b.pinExtKey('KEY_B')).rejects.toThrow('PINNED');
    expect(b.extKey).toBeNull();
    await b.pinExtKey('KEY_A');
    expect(b.extKey).toBe('KEY_A');
    expect(JSON.parse(await readFile(p, 'utf8')).extKey).toBe('KEY_A');
  });
  it('corrupt file is backed up and a stderr notice is written', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mdr-'));
    const p = join(dir, 'mcp.json');
    await writeFile(p, '{nope', { mode: 0o600 });
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      await loadOrCreateIdentity(p);
      const out = spy.mock.calls.map((c) => String(c[0])).join('');
      expect(out).toContain('le-sach-mcp: tạo khoá ghép cặp mới (file cũ:');
      expect(out).toContain('cần ghép cặp lại trong MD Reader');
    } finally {
      spy.mockRestore();
    }
    const baks = (await readdir(dir)).filter((f) => f.startsWith('mcp.json.bak-'));
    expect(baks.length).toBe(1);
    expect(await readFile(join(dir, baks[0]!), 'utf8')).toBe('{nope');
  });
});
