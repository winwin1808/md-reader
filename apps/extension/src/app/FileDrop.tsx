import React, { useCallback } from 'react';
import type { DragEvent } from 'react';
import * as Y from 'yjs';
import { addRecentFile } from './registry';

interface FileDropProps {
  doc: Y.Doc;
  children: React.ReactNode;
}

export function FileDrop({ doc, children }: FileDropProps): React.JSX.Element {
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
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (typeof content === 'string') {
          const source = doc.getText('source');
          source.delete(0, source.length);
          source.insert(0, content);

          const meta = doc.getMap('meta');
          meta.set('name', file.name);
          meta.set('size', file.size);

          addRecentFile({
            id: file.name,
            name: file.name,
            lastOpened: Date.now(),
          }).catch(console.error);
        }
      };
      reader.readAsText(file);
    },
    [doc]
  );

  return (
    <div onDragOver={handleDragOver} onDrop={handleDrop} style={{ width: '100%', height: '100%' }}>
      {children}
    </div>
  );
}
