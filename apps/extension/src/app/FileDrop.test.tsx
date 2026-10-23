import 'fake-indexeddb/auto';
import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { FileDrop } from './FileDrop';
import { listRecent, __resetForTests } from './doc-registry';
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

  it('rejects invalid file extension', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const navigate = vi.fn();
    const { container } = render(
      <FileDrop navigate={navigate}>
        <div />
      </FileDrop>
    );
    fireEvent.drop(container.firstChild as Element, {
      dataTransfer: { files: [new File(['bad'], 'test.bad')] },
    });
    expect(alertMock).toHaveBeenCalled();
    await waitFor(async () => expect(await listRecent()).toHaveLength(0));
    expect(navigate).not.toHaveBeenCalled();
  });
});
