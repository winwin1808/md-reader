import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRecord, deleteRecord, writeDocText } from './doc-registry';

interface FileDropProps {
  children: React.ReactNode;
  navigate?: (url: string) => void;
}

const defaultNavigate = (url: string): void => {
  location.assign(url);
};

export function FileDrop({ children, navigate = defaultNavigate }: FileDropProps): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const busyRef = useRef(false);

  const finish = useCallback(() => {
    busyRef.current = false;
    setBusy(false);
  }, []);

  const processDrop = useCallback(
    (e: globalThis.DragEvent) => {
      if (e.defaultPrevented) return;
      const t = e.target;
      if (t instanceof Element && t.closest('.cm-editor, input, textarea, [contenteditable]')) return;
      if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
      e.preventDefault();
      if (busyRef.current) return;
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;

      const validExtensions = ['.md', '.markdown', '.mdown', '.mkd', '.mdx', '.txt'];
      const isValid = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

      if (!isValid) {
        setNotice(true);
        return;
      }

      setError(null);
      setNotice(false);
      busyRef.current = true;
      setBusy(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        if (typeof content !== 'string') {
          finish();
          return;
        }
        let created: string | null = null;
        try {
          const record = await createRecord({ title: file.name, originKind: 'drop', originPath: null });
          created = record.docId;
          await writeDocText(record, content, 'replace');
          navigate('?doc=' + record.docId);
          finish();
        } catch (err) {
          console.error('Failed to import dropped file', err);
          if (created) {
            try {
              await deleteRecord(created);
            } catch {
              /* best effort */
            }
          }
          setError('Không mở được tệp: ' + (err instanceof Error ? err.message : String(err)));
          finish();
        }
      };
      reader.onerror = () => {
        setError('Không mở được tệp: không đọc được nội dung');
        finish();
      };
      reader.readAsText(file);
    },
    [navigate, finish]
  );

  useEffect(() => {
    const hasFiles = (e: globalThis.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const enter = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    };
    const over = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
    };
    const leave = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const drop = (e: globalThis.DragEvent) => {
      depth.current = 0;
      setDragging(false);
      processDrop(e);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [processDrop]);

  return (
    <div style={{ width: '100%' }}>
      {dragging && <div className="drop-overlay" data-testid="drop-overlay">Thả để mở</div>}
      {busy && <div role="status">Đang mở tệp…</div>}
      {notice && (
        <div className="notice notice--danger" role="alert">
          <span>Chỉ mở được file Markdown (.md, .markdown, .mdown, .mkd, .mdx) hoặc .txt.</span>
          <span className="notice__actions">
            <button type="button" onClick={() => setNotice(false)}>Đóng</button>
          </span>
        </div>
      )}
      {error && <div role="alert">{error}</div>}
      {children}
    </div>
  );
}
