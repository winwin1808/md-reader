import { describe, expect, it } from 'vitest';
import { RELEASE_NOTES, type ReleaseNote } from '../shared/release-notes';
import {
  LIFECYCLE_KEY,
  REVIEW_MIN_AGE_MS,
  REVIEW_MIN_OPENS,
  bumpDocOpens,
  setReview,
  shouldAskReview,
  compareVersions,
  decideLifecycle,
  markWhatsNewSeen,
  shouldRedirectToWhatsNew,
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

  it('markWhatsNewSeen clears pending and advances lastSeen', () => {
    const s: LifecycleState = { ...def, pendingWhatsNew: '1.5.0' };
    const r = markWhatsNewSeen(s, '1.5.0');
    expect(r.lastSeenVersion).toBe('1.5.0');
    expect(r.pendingWhatsNew).toBeNull();
    expect(s.pendingWhatsNew).toBe('1.5.0');
    expect(s.lastSeenVersion).toBeNull();
    expect(r).not.toBe(s);
  });

  it('markWhatsNewSeen never goes backwards', () => {
    const a = markWhatsNewSeen({ ...def, lastSeenVersion: '1.6.0' }, '1.5.0');
    expect(a.lastSeenVersion).toBe('1.6.0');
    const b = markWhatsNewSeen({ ...def, pendingWhatsNew: '1.6.0' }, '1.5.0');
    expect(b.pendingWhatsNew).toBe('1.6.0');
  });

  it('shouldRedirectToWhatsNew', () => {
    const s: LifecycleState = { ...def, pendingWhatsNew: '1.5.0', autoOpenWhatsNew: true };
    expect(shouldRedirectToWhatsNew('', s)).toBe('app.html?whatsnew=1&v=1.5.0');
    for (const q of ['?d=abc', '?file=x', '?speaker=true', '?whatsnew=1', '?doc=1', '?welcome=1', '?pair=1'])
      expect(shouldRedirectToWhatsNew(q, s)).toBeNull();
    expect(shouldRedirectToWhatsNew('', { ...s, autoOpenWhatsNew: false })).toBeNull();
    expect(shouldRedirectToWhatsNew('', { ...s, pendingWhatsNew: null })).toBeNull();
  });

  it('RELEASE_NOTES vi/en same length', () => {
    expect(RELEASE_NOTES.length).toBeGreaterThan(0);
    for (const n of RELEASE_NOTES) expect(n.items.vi.length).toBe(n.items.en.length);
  });
});

describe('review prompt', () => {
  const base: LifecycleState = { ...def, startedAt: 0, docOpens: 10 };
  const day = 86_400_000;
  it('constants', () => {
    expect(REVIEW_MIN_OPENS).toBe(10);
    expect(REVIEW_MIN_AGE_MS).toBe(7 * day);
  });
  it('9 opens -> false', () => expect(shouldAskReview({ ...base, docOpens: 9 }, 7 * day)).toBe(false));
  it('10 opens + 7 days -> true', () => expect(shouldAskReview(base, 7 * day)).toBe(true));
  it('10 opens + 6d23h -> false', () => expect(shouldAskReview(base, 7 * day - 3_600_000)).toBe(false));
  it('startedAt null -> false', () => expect(shouldAskReview({ ...base, startedAt: null }, 99 * day)).toBe(false));
  it('dismissed/accepted -> false', () => {
    expect(shouldAskReview({ ...base, review: 'dismissed' }, 7 * day)).toBe(false);
    expect(shouldAskReview({ ...base, review: 'accepted' }, 7 * day)).toBe(false);
  });
  it('bumpDocOpens increments, clamps, is pure', () => {
    const s = { ...base, docOpens: 3 };
    const n = bumpDocOpens(s);
    expect(n.docOpens).toBe(4);
    expect(s.docOpens).toBe(3);
    expect(n).toEqual({ ...s, docOpens: 4 });
    expect(bumpDocOpens({ ...s, docOpens: 1000 }).docOpens).toBe(1000);
  });
  it('setReview', () => {
    expect(setReview(base, 'dismissed').review).toBe('dismissed');
    expect(setReview(base, 'accepted').review).toBe('accepted');
    expect(base.review).toBe('idle');
  });
});
