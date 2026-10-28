import { randomBytes, type webcrypto } from 'node:crypto';
import { chmod, link, mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { exportPrivateJwk, exportPublicKey, generateBridgeKeyPair, importPrivateJwk } from '@md-reader/core/bridge-auth';
import { dirname, join } from 'node:path';

export function defaultPairPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home: string = homedir(),
): string {
  if (env.MDR_PAIR_FILE) return env.MDR_PAIR_FILE;
  if (platform === 'win32') {
    return join(env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'md-reader', 'mcp.json');
  }
  return join(env.XDG_CONFIG_HOME ?? join(home, '.config'), 'md-reader', 'mcp.json');
}

async function tighten(path: string): Promise<void> {
  if (process.platform === 'win32') return;
  const dir = dirname(path);
  try {
    if (((await stat(dir)).mode & 0o777) & 0o077) await chmod(dir, 0o700);
  } catch {
    // ignore
  }
  if (((await stat(path)).mode & 0o777) !== 0o600) await chmod(path, 0o600);
}

type JsonWebKey = webcrypto.JsonWebKey;
type CryptoKey = webcrypto.CryptoKey;

export interface PairFileV2 {
  version: 2;
  privateKey: JsonWebKey;
  publicKey: string;
  extKey?: string;
}

export interface ServerIdentity {
  privateKey: CryptoKey;
  publicKey: string;
  extKey: string | null;
  pinExtKey(k: string): Promise<void>;
}

function parseV2(raw: string): PairFileV2 | null {
  try {
    const f = JSON.parse(raw) as Partial<PairFileV2> | null;
    if (!f || f.version !== 2) return null;
    if (!f.privateKey || typeof f.privateKey !== 'object') return null;
    if (typeof f.publicKey !== 'string' || !f.publicKey) return null;
    if (f.extKey !== undefined && typeof f.extKey !== 'string') return null;
    return f as PairFileV2;
  } catch {
    return null;
  }
}

async function writeAtomic(path: string, file: PairFileV2): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const tmp = join(dir, `.mcp-${process.pid}-${randomBytes(4).toString('hex')}.tmp`);
  try {
    await writeFile(tmp, JSON.stringify(file), { mode: 0o600 });
    await rename(tmp, path);
  } finally {
    await rm(tmp, { force: true });
  }
  await tighten(path);
}

async function createExclusive(path: string, file: PairFileV2): Promise<boolean> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const tmp = join(dir, `.mcp-${process.pid}-${randomBytes(4).toString('hex')}.tmp`);
  try {
    await writeFile(tmp, JSON.stringify(file), { mode: 0o600 });
    try {
      await link(tmp, path);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') return false;
      throw e;
    }
  } finally {
    await rm(tmp, { force: true });
  }
  await tighten(path);
  return true;
}

async function withLock<T>(path: string, fn: () => Promise<T>): Promise<T> {
  const lock = `${path}.lock`;
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + 2000;
  let delay = 10;
  for (;;) {
    try {
      const h = await open(lock, 'wx', 0o600);
      await h.close();
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      try {
        if (Date.now() - (await stat(lock)).mtimeMs > 30_000) {
          await rm(lock, { force: true });
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() > deadline) throw new Error('pairing file locked');
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 200);
    }
  }
  try {
    return await fn();
  } finally {
    await rm(lock, { force: true });
  }
}

async function readState(path: string): Promise<{ file: PairFileV2 | null; privateKey: CryptoKey | null; reason: string }> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { file: null, privateKey: null, reason: 'missing' };
    throw e;
  }
  const file = parseV2(raw);
  if (!file) return { file: null, privateKey: null, reason: 'v1 hoặc JSON hỏng' };
  try {
    return { file, privateKey: await importPrivateJwk(file.privateKey), reason: '' };
  } catch {
    return { file: null, privateKey: null, reason: 'khoá không import được' };
  }
}

export async function loadOrCreateIdentity(path: string = defaultPairPath()): Promise<ServerIdentity> {
  let file: PairFileV2 | null = null;
  let privateKey: CryptoKey | null = null;
  for (let attempt = 0; attempt < 3 && !file; attempt++) {
    const st = await readState(path);
    if (st.file && st.privateKey) {
      file = st.file;
      privateKey = st.privateKey;
      await tighten(path);
      break;
    }
    if (st.reason !== 'missing') {
      try {
        const bak = `${path}.bak-${Date.now()}`;
        await rename(path, bak);
        if (process.platform !== 'win32') await chmod(bak, 0o600);
        process.stderr.write(
          `le-sach-mcp: tạo khoá ghép cặp mới (file cũ: ${st.reason}) — cần ghép cặp lại trong MD Reader\n`,
        );
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
    }
    const pair = await generateBridgeKeyPair();
    const fresh: PairFileV2 = {
      version: 2,
      privateKey: await exportPrivateJwk(pair.privateKey),
      publicKey: await exportPublicKey(pair.publicKey),
    };
    if (await createExclusive(path, fresh)) {
      file = fresh;
      privateKey = pair.privateKey;
    }
    // else: another process created it first; loop re-reads and uses that identity
  }
  if (!file || !privateKey) throw new Error('cannot load or create pairing identity');
  const current = file;
  const identity: ServerIdentity = {
    privateKey,
    publicKey: current.publicKey,
    extKey: current.extKey ?? null,
    async pinExtKey(k: string) {
      await withLock(path, async () => {
        const st = await readState(path);
        if (!st.file) throw new Error('pairing file unreadable');
        if (st.file.extKey !== undefined && st.file.extKey !== k) throw new Error('PINNED');
        if (st.file.extKey !== k) await writeAtomic(path, { ...st.file, extKey: k });
      });
      identity.extKey = k;
    },
  };
  return identity;
}
