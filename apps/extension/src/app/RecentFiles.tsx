import React, { useEffect, useState } from 'react';
import { getRecentFiles } from './registry';

export function RecentFiles(): React.JSX.Element {
  const [files, setFiles] = useState<any[]>([]);

  useEffect(() => {
    const fetchFiles = () => {
      getRecentFiles().then(setFiles).catch(console.error);
    };
    fetchFiles();

    const listener = (changes: any, areaName: string) => {
      if (areaName === 'local' && changes.recentFiles) {
        fetchFiles();
      }
    };
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
  }, []);

  const handleClick = (file: any) => {
    console.log('TODO: Load file', file);
  };

  if (files.length === 0) return <></>;

  return (
    <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '4px' }}>
      <h3>Recent Files</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {files.map((file) => (
          <li key={file.id} onClick={() => handleClick(file)} style={{ cursor: 'pointer', marginBottom: '5px' }}>
            {file.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
