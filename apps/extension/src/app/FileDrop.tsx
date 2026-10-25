import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@md-reader/ui';
import { createRecord, deleteRecord, writeDocText, docParam } from './doc-registry';

interface FileDropProps {
  children: React.ReactNode;
  navigate?: (url: string) => void;
}

const defaultNavigate = (url: string): void => {
  location.assign(url);
};

export function FileDrop({ children, navigate = defaultNavigate }: FileDropProps): React.JSX.Element {
  const t = useT();
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
      const tgt = e.target;
      if (tgt instanceof Element && tgt.closest('.cm-editor, input, textarea, [contenteditable]')) return;
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
          navigate('?d=' + docParam(record));
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
          setError(t('ext.drop.openFailed', { reason: err instanceof Error ? err.message : String(err) }));
          finish();
        }
      };
      reader.onerror = () => {
        setError(t('ext.drop.openFailed', { reason: t('ext.drop.unreadable') }));
        finish();
      };
      reader.readAsText(file);
    },
    [navigate, finish, t]
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
      {dragging && <div className="drop-overlay" data-testid="drop-overlay">{t('ext.drop.release')}</div>}
      {busy && <div role="status">{t('ext.drop.opening')}</div>}
      {notice && (
        <div className="notice notice--danger" role="alert">
          <span>{t('ext.drop.unsupported')}</span>
          <span className="notice__actions">
            <button type="button" onClick={() => setNotice(false)}>{t('ext.close')}</button>
          </span>
        </div>
      )}
      {error && <div role="alert">{error}</div>}
      {children}
    </div>
  );
}
