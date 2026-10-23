import React, { useCallback } from 'react';
import type { DragEvent } from 'react';
import { createRecord, writeDocText } from './doc-registry';

interface FileDropProps {
  children: React.ReactNode;
  navigate?: (url: string) => void;
}

const defaultNavigate = (url: string): void => {
  location.assign(url);
};

export function FileDrop({ children, navigate = defaultNavigate }: FileDropProps): React.JSX.Element {
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      const validExtensions = ['.md', '.markdown', '.txt'];
      const isValid = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

      if (!isValid) {
        alert('Invalid file type');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        if (typeof content !== 'string') return;
        try {
          const record = await createRecord({ title: file.name, originKind: 'drop', originPath: null });
          await writeDocText(record, content, 'replace');
          navigate('?doc=' + record.docId);
        } catch (err) {
          console.error('Failed to import dropped file', err);
        }
      };
      reader.readAsText(file);
    },
    [navigate]
  );

  return (
    <div onDragOver={handleDragOver} onDrop={handleDrop} style={{ width: '100%', height: '100%' }}>
      {children}
    </div>
  );
}
