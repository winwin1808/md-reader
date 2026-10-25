import React, { useEffect, useState } from 'react';
import { useT } from '@md-reader/ui';
import type { TFunction } from '@md-reader/ui';
import { listRecent, migrateLegacyRegistry, docQuery } from './doc-registry';
import type { DocRecord } from './doc-registry';

export function RecentFiles(): React.JSX.Element {
  const t = useT();
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

  const handleClick = async (file: DocRecord) => {
    window.location.href = chrome.runtime.getURL('app.html') + (await docQuery(file.docId));
  };

  if (files.length === 0) return <></>;

  return (
    <section className="recent">
      <h2 className="recent__heading">{t('ext.recent.heading')}</h2>
      <ul className="recent__list">
        {files.slice(0, 8).map((file) => (
          <li key={file.docId}>
            <button type="button" className="recent__item" onClick={() => handleClick(file)}>
              <span className="recent__title">{file.title}</span>
              <span className="recent__meta">{[originLabel(file, t), relativeTime(file.lastOpenedAt, t)].filter(Boolean).join(' · ')}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function originLabel(file: DocRecord, t: TFunction): string {
  if (file.originKind === 'drop') return t('ext.recent.dropped');
  if (file.originKind === 'file') return t('ext.recent.local');
  try {
    const u = new URL(file.originPath ?? '');
    const tail = u.pathname.split('/').filter(Boolean).slice(-2).join('/');
    return u.host + (tail ? '/' + tail : '');
  } catch {
    return file.originPath ?? '';
  }
}

function relativeTime(ts: number | undefined, t: TFunction): string {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return '';
  const diff = Date.now() - ts;
  const min = Math.max(0, Math.floor(diff / 60000));
  if (min < 1) return t('ext.recent.justNow');
  if (min < 60) return t('ext.recent.minAgo', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('ext.recent.hourAgo', { n: h });
  const d = Math.floor(h / 24);
  if (d === 1) return t('ext.recent.yesterday');
  if (d < 7) return t('ext.recent.dayAgo', { n: d });
  const dt = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return pad(dt.getDate()) + '/' + pad(dt.getMonth() + 1) + '/' + dt.getFullYear();
}
