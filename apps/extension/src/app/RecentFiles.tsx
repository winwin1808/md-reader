import React, { useEffect, useState } from 'react';
import { listRecent, migrateLegacyRegistry } from './doc-registry';
import type { DocRecord } from './doc-registry';

export function RecentFiles(): React.JSX.Element {
  const [files, setFiles] = useState<DocRecord[]>([]);

  useEffect(() => {
    (async () => {
      try {
        await migrateLegacyRegistry();
      } catch (err) {
        console.error('Legacy registry migration failed', err);
      }
      setFiles(await listRecent());
    })().catch(console.error);
  }, []);

  const handleClick = (file: DocRecord) => {
    window.location.href = chrome.runtime.getURL('app.html') + '?doc=' + encodeURIComponent(file.docId);
  };

  if (files.length === 0) return <></>;

  return (
    <section className="recent">
      <h2 className="recent__heading">Mở gần đây</h2>
      <ul className="recent__list">
        {files.slice(0, 8).map((file) => (
          <li key={file.docId}>
            <button type="button" className="recent__item" onClick={() => handleClick(file)}>
              <span className="recent__title">{file.title}</span>
              <span className="recent__meta">{originLabel(file)} · {relativeTime(file.lastOpenedAt)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function originLabel(file: DocRecord): string {
  if (file.originKind === 'drop') return 'Kéo thả';
  if (file.originKind === 'file') return 'Trên máy';
  try {
    const u = new URL(file.originPath ?? '');
    const tail = u.pathname.split('/').filter(Boolean).slice(-2).join('/');
    return u.host + (tail ? '/' + tail : '');
  } catch {
    return file.originPath ?? '';
  }
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'vừa xong';
  if (min < 60) return min + ' phút trước';
  const h = Math.floor(min / 60);
  if (h < 24) return h + ' giờ trước';
  const d = Math.floor(h / 24);
  if (d === 1) return 'hôm qua';
  if (d < 7) return d + ' ngày trước';
  const dt = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return pad(dt.getDate()) + '/' + pad(dt.getMonth() + 1) + '/' + dt.getFullYear();
}
