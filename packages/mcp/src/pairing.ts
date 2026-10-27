import { randomBytes, type webcrypto } from 'node:crypto';
import { chmod, link, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { exportPrivateJwk, exportPublicKey, generateBridgeKeyPair, importPrivateJwk } from '@md-reader/core';
import { dirname, join } from 'node:path';

export interface PairFile {
  pairKey: string;
}

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

export function newPairKey(): string {
  return randomBytes(32).toString('base64url');
}

function validKey(raw: string): string | null {
  try {
    const k = (JSON.parse(raw) as Partial<PairFile> | null)?.pairKey;
    return typeof k === 'string' && k.length >= 16 && k.length <= 200 ? k : null;
  } catch {
    return null;
  }
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

export async function loadOrCreatePairKey(path: string = defaultPairPath()): Promise<string> {
  let exists = false;
  try {
    const k = validKey(await readFile(path, 'utf8'));
    exists = true;
    if (k) {
      await tighten(path);
      return k;
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  const dir = dirname(path);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const key = newPairKey();
  const tmp = join(dir, `.mcp-${process.pid}-${randomBytes(4).toString('hex')}.tmp`);
  try {
    await writeFile(tmp, JSON.stringify({ pairKey: key } satisfies PairFile), { mode: 0o600 });
    if (exists) {
      await rename(tmp, path);
    } else {
      try {
        await link(tmp, path);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        const other = validKey(await readFile(path, 'utf8'));
        if (other) {
          await tighten(path);
          return other;
        }
        await rename(tmp, path);
      }
    }
  } finally {
    await rm(tmp, { force: true });
  }
  await tighten(path);
  return key;
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

export async function loadOrCreateIdentity(path: string = defaultPairPath()): Promise<ServerIdentity> {
  let file: PairFileV2 | null = null;
  try {
    file = parseV2(await readFile(path, 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  let privateKey: CryptoKey | null = null;
  if (file) {
    try {
      privateKey = await importPrivateJwk(file.privateKey);
    } catch {
      file = null;
    }
  }
  if (!file || !privateKey) {
    const pair = await generateBridgeKeyPair();
    privateKey = pair.privateKey;
    file = { version: 2, privateKey: await exportPrivateJwk(pair.privateKey), publicKey: await exportPublicKey(pair.publicKey) };
    await writeAtomic(path, file);
  } else {
    await tighten(path);
  }
  const current = file;
  const key = privateKey as CryptoKey;
  const identity: ServerIdentity = {
    privateKey: key,
    publicKey: current.publicKey,
    extKey: current.extKey ?? null,
    async pinExtKey(k: string) {
      current.extKey = k;
      await writeAtomic(path, current);
      identity.extKey = k;
    },
  };
  return identity;
}
