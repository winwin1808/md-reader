import React, { useCallback, useRef, useState } from 'react';
import type { DragEvent } from 'react';
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
  const busyRef = useRef(false);

  const finish = useCallback(() => {
    busyRef.current = false;
    setBusy(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (busyRef.current) return;
      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      const validExtensions = ['.md', '.markdown', '.mdown', '.mkd', '.mdx'];
      const isValid = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

      if (!isValid) {
        setError('Chỉ hỗ trợ tệp .md, .markdown, .mdown, .mkd, .mdx.');
        return;
      }

      setError(null);
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

  return (
    <div onDragOver={handleDragOver} onDrop={handleDrop} style={{ width: '100%', height: '100%' }}>
      {busy && <div role="status">Đang mở tệp…</div>}
      {error && <div role="alert">{error}</div>}
      {children}
    </div>
  );
}
