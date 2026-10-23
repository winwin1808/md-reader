import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import * as Y from 'yjs';
import { FileDrop } from './FileDrop';
import { vi, describe, beforeEach, it, expect, afterEach } from 'vitest';

describe('FileDrop', () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = new Y.Doc();
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({ recentFiles: [] }),
          set: vi.fn().mockResolvedValue(undefined),
        }
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('drops a valid markdown file and updates Y.Doc', async () => {
    const { container } = render(
      <FileDrop doc={doc}>
        <div data-testid="child" />
      </FileDrop>
    );

    const dropzone = container.firstChild as Element;
    const file = new File(['# Hello'], 'test.md', { type: 'text/markdown' });

    let onloadHandler: any = null;
    const readAsTextMock = vi.fn();

    class MockFileReader {
      result = '# Hello';
      readAsText = readAsTextMock;
      set onload(handler: any) {
        onloadHandler = handler;
      }
    }

    vi.stubGlobal('FileReader', MockFileReader);

    fireEvent.dragOver(dropzone);
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(readAsTextMock).toHaveBeenCalled();
    
    // Simulate FileReader onload
    if (onloadHandler) {
      onloadHandler({ target: { result: '# Hello' } });
    }

    await waitFor(() => {
      expect(doc.getText('source').toString()).toBe('# Hello');
    });

    const meta = doc.getMap('meta');
    expect(meta.get('name')).toBe('test.md');
    expect(meta.get('size')).toBe(file.size);
  });

  it('keeps shared-prefix chars and sets originHash', async () => {
    const text = doc.getText('source');
    text.insert(0, '# Hello world');
    const before = (text as any)._start.id.client;
    const firstItem = (text as any)._start;
    const { container } = render(
      <FileDrop doc={doc}>
        <div />
      </FileDrop>
    );
    let onloadHandler: any = null;
    class MockFileReader {
      readAsText = vi.fn();
      set onload(h: any) {
        onloadHandler = h;
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);
    fireEvent.drop(container.firstChild as Element, {
      dataTransfer: { files: [new File(['x'], 'a.md')] },
    });
    await onloadHandler({ target: { result: '# Hello there' } });
    expect(text.toString()).toBe('# Hello there');
    expect((text as any)._start).toBe(firstItem);
    expect((text as any)._start.id.client).toBe(before);
    expect(typeof doc.getMap('meta').get('originHash')).toBe('string');
  });

  it('rejects invalid file extension', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { container } = render(
      <FileDrop doc={doc}>
        <div data-testid="child" />
      </FileDrop>
    );

    const dropzone = container.firstChild as Element;
    const file = new File(['bad'], 'test.bad', { type: 'text/plain' });

    fireEvent.dragOver(dropzone);
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(alertMock).toHaveBeenCalled();
    expect(doc.getText('source').toString()).toBe('');
  });
});
