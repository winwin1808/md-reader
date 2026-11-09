import { describe, expect, it } from 'vitest';
import { RELEASE_NOTES, type ReleaseNote } from '../shared/release-notes';
import {
  LIFECYCLE_KEY,
  compareVersions,
  decideLifecycle,
  parseLifecycleState,
  pendingNote,
  uninstallUrl,
  type LifecycleState,
} from './lifecycle';

const def = parseLifecycleState(null);
const note = (version: string, showOnUpdate = true): ReleaseNote => ({
  version,
  showOnUpdate,
  title: { vi: 'v', en: 'e' },
  items: { vi: ['a'], en: ['a'] },
});

describe('lifecycle', () => {
  it('key', () => expect(LIFECYCLE_KEY).toBe('mdr:lifecycle'));

  it('install opens welcome', () => {
    const { next, open } = decideLifecycle({ type: 'installed', reason: 'install' }, def, [], '1.5.0', 100);
    expect(open).toEqual(['welcome']);
    expect(next).toMatchObject({ startedAt: 100, lastSeenVersion: '1.5.0', pendingWelcome: true });
  });

  it('update 1.4.0 -> 1.5.0 sets pending without opening', () => {
    const { next, open } = decideLifecycle(
      { type: 'installed', reason: 'update', previousVersion: '1.4.0' },
      def,
      [note('1.5.0')],
      '1.5.0',
      100,
    );
    expect(open).toEqual([]);
    expect(next.pendingWhatsNew).toBe('1.5.0');
    expect(next.pendingWelcome).toBe(false);
    expect(next.lastSeenVersion).toBe('1.4.0');
    expect(next.startedAt).toBe(100);
  });

  it('update with all flags off -> no pending', () => {
    const { next } = decideLifecycle(
      { type: 'installed', reason: 'update', previousVersion: '1.4.0' },
      def,
      [note('1.5.0', false)],
      '1.5.0',
      1,
    );
    expect(next.pendingWhatsNew).toBeNull();
  });

  it('skips versions: picks 1.3.0', () => {
    const n = pendingNote([note('1.4.0', false), note('1.3.0')], '1.2.0', '1.5.0');
    expect(n?.version).toBe('1.3.0');
  });

  it('ignores notes newer than current and already seen', () => {
    expect(pendingNote([note('1.6.0')], '1.4.0', '1.5.0')).toBeNull();
    expect(pendingNote([note('1.5.0')], '1.5.0', '1.5.0')).toBeNull();
    expect(pendingNote([note('1.0.0')], null, '1.5.0')?.version).toBe('1.0.0');
  });

  it('picks newest by version not array order', () => {
    expect(pendingNote([note('1.3.0'), note('1.4.0')], '1.2.0', '1.5.0')?.version).toBe('1.4.0');
  });

  it('chrome_update leaves state unchanged', () => {
    const s: LifecycleState = { ...def, docOpens: 3 };
    const { next, open } = decideLifecycle({ type: 'installed', reason: 'chrome_update' }, s, [note('1.5.0')], '1.5.0', 1);
    expect(next).toEqual(s);
    expect(open).toEqual([]);
  });

  it('startup opens whatsnew once', () => {
    const s: LifecycleState = { ...def, pendingWhatsNew: '1.5.0' };
    const a = decideLifecycle({ type: 'startup' }, s, [], '1.5.0', 1);
    expect(a.open).toEqual(['whatsnew']);
    expect(a.next.pendingWhatsNew).toBeNull();
    expect(a.next.lastSeenVersion).toBe('1.5.0');
    expect(s.pendingWhatsNew).toBe('1.5.0');
    const b = decideLifecycle({ type: 'startup' }, a.next, [], '1.5.0', 2);
    expect(b.open).toEqual([]);
  });

  it('autoOpenWhatsNew false keeps pending', () => {
    const s: LifecycleState = { ...def, pendingWhatsNew: '1.5.0', autoOpenWhatsNew: false };
    const r = decideLifecycle({ type: 'startup' }, s, [], '1.5.0', 1);
    expect(r.open).toEqual([]);
    expect(r.next).toEqual(s);
  });

  it('compareVersions', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.5', '1.5.0')).toBe(0);
    expect(compareVersions('1.4.0', '1.5.0')).toBeLessThan(0);
  });

  it('parseLifecycleState defaults', () => {
    expect(def).toEqual({
      v: 1,
      startedAt: null,
      lastSeenVersion: null,
      pendingWhatsNew: null,
      pendingWelcome: false,
      autoOpenWhatsNew: true,
      docOpens: 0,
      review: 'idle',
    });
    expect(parseLifecycleState('x')).toEqual(def);
    expect(parseLifecycleState({ startedAt: 'a', pendingWelcome: 1, review: 'zzz', docOpens: '2' })).toEqual(def);
    expect(parseLifecycleState({ startedAt: 5, review: 'accepted' })).toMatchObject({ startedAt: 5, review: 'accepted' });
  });

  it('uninstallUrl only has v and lang', () => {
    const u = new URL(uninstallUrl('1.5.0', 'vi-VN'));
    expect([...u.searchParams.keys()].sort()).toEqual(['lang', 'v']);
    expect(u.searchParams.get('lang')).toBe('vi');
    expect(u.searchParams.get('v')).toBe('1.5.0');
    expect(u.origin + u.pathname).toBe('https://winwin1808.github.io/md-reader/uninstall.html');
    expect(new URL(uninstallUrl('1.5.0', 'fr')).searchParams.get('lang')).toBe('en');
  });

  it('RELEASE_NOTES vi/en same length', () => {
    expect(RELEASE_NOTES.length).toBeGreaterThan(0);
    for (const n of RELEASE_NOTES) expect(n.items.vi.length).toBe(n.items.en.length);
  });
});
