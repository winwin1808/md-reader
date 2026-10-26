import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
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

export async function loadOrCreatePairKey(path: string = defaultPairPath()): Promise<string> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<PairFile>;
    const k = parsed?.pairKey;
    if (typeof k === 'string' && k.length >= 16 && k.length <= 200) return k;
  } catch {
    // missing or corrupt: fall through and regenerate
  }
  const key = newPairKey();
  const dir = dirname(path);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const tmp = join(dir, `.mcp-${process.pid}-${randomBytes(4).toString('hex')}.tmp`);
  await writeFile(tmp, JSON.stringify({ pairKey: key } satisfies PairFile), { mode: 0o600 });
  await rename(tmp, path);
  return key;
}
