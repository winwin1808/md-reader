import React, { useEffect, useState } from 'react';
import { listRecent } from './doc-registry';
import type { DocRecord } from './doc-registry';

export function RecentFiles(): React.JSX.Element {
  const [files, setFiles] = useState<DocRecord[]>([]);

  useEffect(() => {
    listRecent().then(setFiles).catch(console.error);
  }, []);

  const handleClick = (file: DocRecord) => {
    window.location.href = chrome.runtime.getURL('app.html') + '?doc=' + encodeURIComponent(file.docId);
  };

  if (files.length === 0) return <></>;

  return (
    <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '4px' }}>
      <h3>Recent Files</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {files.map((file) => (
          <li key={file.docId} onClick={() => handleClick(file)} style={{ cursor: 'pointer', marginBottom: '5px' }}>
            {file.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
