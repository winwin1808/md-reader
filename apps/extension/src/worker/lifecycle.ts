import type { ReleaseNote } from '../shared/release-notes';

export const LIFECYCLE_KEY = 'mdr:lifecycle';

export interface LifecycleState {
  v: 1;
  startedAt: number | null;
  lastSeenVersion: string | null;
  pendingWhatsNew: string | null;
  pendingWelcome: boolean;
  autoOpenWhatsNew: boolean;
  docOpens: number;
  review: 'idle' | 'dismissed' | 'accepted';
}

export type LifecycleEvent =
  | { type: 'installed'; reason: string; previousVersion?: string }
  | { type: 'startup' };

export type TabToOpen = 'welcome' | 'whatsnew';

export function parseLifecycleState(raw: unknown): LifecycleState {
  const r: Record<string, unknown> =
    raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const str = (x: unknown): string | null => (typeof x === 'string' ? x : null);
  return {
    v: 1,
    startedAt: num(r.startedAt),
    lastSeenVersion: str(r.lastSeenVersion),
    pendingWhatsNew: str(r.pendingWhatsNew),
    pendingWelcome: typeof r.pendingWelcome === 'boolean' ? r.pendingWelcome : false,
    autoOpenWhatsNew: typeof r.autoOpenWhatsNew === 'boolean' ? r.autoOpenWhatsNew : true,
    docOpens: num(r.docOpens) ?? 0,
    review: r.review === 'dismissed' || r.review === 'accepted' || r.review === 'idle' ? r.review : 'idle',
  };
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function pendingNote(
  notes: readonly ReleaseNote[],
  seen: string | null,
  current: string,
): ReleaseNote | null {
  let best: ReleaseNote | null = null;
  for (const n of notes) {
    if (!n.showOnUpdate) continue;
    if (seen !== null && compareVersions(n.version, seen) <= 0) continue;
    if (compareVersions(n.version, current) > 0) continue;
    if (best === null || compareVersions(n.version, best.version) > 0) best = n;
  }
  return best;
}

export function decideLifecycle(
  ev: LifecycleEvent,
  s: LifecycleState,
  notes: readonly ReleaseNote[],
  current: string,
  now: number,
): { next: LifecycleState; open: TabToOpen[] } {
  const next: LifecycleState = { ...s };
  if (ev.type === 'startup') {
    if (s.pendingWhatsNew !== null && s.autoOpenWhatsNew) {
      next.lastSeenVersion = s.pendingWhatsNew;
      next.pendingWhatsNew = null;
      return { next, open: ['whatsnew'] };
    }
    return { next, open: [] };
  }
  if (ev.reason === 'install') {
    next.startedAt = now;
    next.lastSeenVersion = current;
    next.pendingWelcome = true;
    return { next, open: ['welcome'] };
  }
  if (ev.reason === 'update') {
    if (s.lastSeenVersion === null) {
      next.lastSeenVersion = ev.previousVersion ?? null;
      next.startedAt = s.startedAt ?? now;
    }
    const note = pendingNote(notes, next.lastSeenVersion, current);
    if (note) next.pendingWhatsNew = note.version;
    return { next, open: [] };
  }
  return { next, open: [] };
}

export function markWhatsNewSeen(s: LifecycleState, version: string): LifecycleState {
  const lastSeenVersion =
    s.lastSeenVersion !== null && compareVersions(s.lastSeenVersion, version) > 0 ? s.lastSeenVersion : version;
  const pendingWhatsNew =
    s.pendingWhatsNew === null || compareVersions(s.pendingWhatsNew, version) <= 0 ? null : s.pendingWhatsNew;
  return { ...s, lastSeenVersion, pendingWhatsNew };
}

const NO_REDIRECT_PARAMS = ['doc', 'd', 'file', 'speaker', 'welcome', 'whatsnew', 'pair'];

export function shouldRedirectToWhatsNew(search: string, s: LifecycleState): string | null {
  if (s.pendingWhatsNew === null || s.autoOpenWhatsNew !== true) return null;
  const params = new URLSearchParams(search);
  if (NO_REDIRECT_PARAMS.some((k) => params.has(k))) return null;
  return 'app.html?whatsnew=1&v=' + encodeURIComponent(s.pendingWhatsNew);
}

export function uninstallUrl(version: string, uiLang: string): string {
  const lang = uiLang.startsWith('vi') ? 'vi' : 'en';
  return `https://winwin1808.github.io/md-reader/uninstall.html?v=${encodeURIComponent(version)}&lang=${lang}`;
}
