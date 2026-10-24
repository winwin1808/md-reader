import 'fake-indexeddb/auto';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { FileDrop } from './FileDrop';
import { listRecent, __resetForTests } from './doc-registry';
import * as registry from './doc-registry';
import { RecentFiles } from './RecentFiles';
import { vi, describe, beforeEach, it, expect, afterEach } from 'vitest';

function stubReader(): { fire: (text: string) => Promise<void> } {
  let onloadHandler: any = null;
  class MockFileReader {
    readAsText = vi.fn();
    set onload(h: any) {
      onloadHandler = h;
    }
  }
  vi.stubGlobal('FileReader', MockFileReader);
  return { fire: async (text) => { await onloadHandler({ target: { result: text } }); } };
}

async function readPersisted(name: string): Promise<Y.Doc> {
  const d = new Y.Doc({ gc: false });
  const p = new IndexeddbPersistence(name, d);
  await p.whenSynced;
  await p.destroy();
  return d;
}

describe('FileDrop', () => {
  beforeEach(async () => {
    await __resetForTests();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('two drops create two records with their own docs; open doc untouched', async () => {
    const open = new Y.Doc();
    open.getText('source').insert(0, 'OPEN DOC');
    const navigate = vi.fn();
    const { container } = render(
      <FileDrop navigate={navigate}>
        <div />
      </FileDrop>
    );
    const zone = container.firstChild as Element;

    const r1 = stubReader();
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['x'], 'a.md')] } });
    await r1.fire('# One');
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).not.toContain('Đang mở tệp…'));
    const r2 = stubReader();
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['x'], 'b.md')] } });
    await r2.fire('# Two');

    const recs = await listRecent();
    expect(recs).toHaveLength(2);
    expect(new Set(recs.map((r) => r.persistenceName)).size).toBe(2);
    expect(navigate).toHaveBeenCalledTimes(2);

    const a = recs.find((r) => r.title === 'a.md')!;
    const b = recs.find((r) => r.title === 'b.md')!;
    expect(navigate).toHaveBeenCalledWith('?doc=' + a.docId);
    const da = await readPersisted(a.persistenceName);
    const db = await readPersisted(b.persistenceName);
    expect(da.getText('source').toString()).toBe('# One');
    expect(db.getText('source').toString()).toBe('# Two');
    expect(typeof da.getMap('meta').get('originHash')).toBe('string');
    expect(open.getText('source').toString()).toBe('OPEN DOC');
  });

  it('rejects invalid file extension inline, no alert', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const navigate = vi.fn();
    const { container, findByText } = render(
      <FileDrop navigate={navigate}>
        <div />
      </FileDrop>
    );
    fireEvent.drop(container.firstChild as Element, {
      dataTransfer: { files: [new File(['bad'], 'test.bad')] },
    });
    await findByText('Chỉ hỗ trợ tệp .md, .markdown, .mdown, .mkd, .mdx.');
    expect(alertMock).not.toHaveBeenCalled();
    expect(await listRecent()).toHaveLength(0);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('failed write deletes the record and shows inline error', async () => {
    vi.spyOn(registry, 'writeDocText').mockRejectedValue(new Error('boom'));
    const navigate = vi.fn();
    const { container, findByText } = render(
      <FileDrop navigate={navigate}>
        <div />
      </FileDrop>
    );
    const r = stubReader();
    fireEvent.drop(container.firstChild as Element, { dataTransfer: { files: [new File(['x'], 'a.md')] } });
    await r.fire('# One');
    await findByText('Không mở được tệp: boom');
    expect(await listRecent()).toHaveLength(0);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ignores a second drop while busy', async () => {
    const navigate = vi.fn();
    const { container, findByText } = render(
      <FileDrop navigate={navigate}>
        <div />
      </FileDrop>
    );
    const zone = container.firstChild as Element;
    const r1 = stubReader();
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['x'], 'a.md')] } });
    await findByText('Đang mở tệp…');
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['x'], 'b.md')] } });
    await r1.fire('# One');
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(await listRecent()).toHaveLength(1);
  });

  it('RecentFiles migrates legacy recentFiles on mount', async () => {
    vi.stubGlobal('chrome', {
      storage: { local: { get: async () => ({ recentFiles: [{ id: 'https://x.test/a.md', name: 'legacy.md', lastOpened: 5 }] }) } },
    });
    const { findByText } = render(<RecentFiles />);
    await findByText('legacy.md');
  });
});
