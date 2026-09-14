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
