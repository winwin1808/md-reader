// @ts-nocheck — script sinh fixture, chạy bằng node, không vào bundle.
// Chạy (từ packages/core; tsx không có sẵn): esbuild --bundle rồi node, xem lệnh ở docs/SESSION_HANDOVER hoặc:
//   pnpm exec esbuild src/doc/fixtures/make-v2-doc.ts --bundle --platform=node --format=esm --outfile=$TMPDIR/m.mjs && node $TMPDIR/m.mjs
import * as Y from 'yjs'
import { writeFileSync } from 'node:fs'
import { createDoc, getSource } from '../doc.js'
import { appendHistory } from '../history.js'
import { registerActor } from '../checkpoint.js'

const doc = createDoc({
  title: 'fixture.md',
  source: '# Tài liệu mẫu\n\nXin chào thế giới.\n\n- mục một\n- mục hai\n',
})
registerActor(doc, 'Fixture')
appendHistory(doc, { actor: 'Fixture', label: 'Bản đầu', clientIds: [doc.clientID], ts: 1700000000000 })

const update = Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64')
const out = new URL('file://' + process.cwd() + '/src/doc/fixtures/v2-doc.json')
writeFileSync(out, JSON.stringify({ update, source: getSource(doc).toString() }, null, 2) + '\n')
console.log('wrote', out.pathname)
