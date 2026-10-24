import * as Y from 'yjs';
import WebSocket from 'ws';
import YProvider from 'y-partyserver/provider';

const a = process.argv.slice(2);
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const host = get('--host', 'localhost:8787');
const secure = a.includes('--secure');
const room = 'room-' + Date.now();

class WS extends WebSocket {
  constructor(url, protocols) {
    super(url, protocols, { headers: { 'x-mdr-role': 'view' } });
  }
}
const mk = () => {
  const doc = new Y.Doc();
  const p = new YProvider(host, room, doc, { connect: true, WebSocketPolyfill: WS, party: get('--party','doc-room'), protocol: secure ? 'wss' : 'ws' });
  return { doc, p };
};
const A = mk(), B = mk();
const sync = (c) => new Promise((r) => (c.p.synced ? r() : c.p.on('synced', (s) => s && r())));
await Promise.race([Promise.all([sync(A), sync(B)]), new Promise((_, j) => setTimeout(() => j(new Error('sync timeout')), 10000))]).catch((e) => { console.log('converged=false\nerror=' + e.message); process.exit(2); });
const t0 = performance.now();
A.doc.getText('source').insert(0, 'AAA');
B.doc.getText('source').insert(0, 'BBB');
let ok = false;
while (performance.now() - t0 < 10000) {
  const x = A.doc.getText('source').toString(), y = B.doc.getText('source').toString();
  if (x.length === 6 && x === y) { ok = true; break; }
  await new Promise((r) => setTimeout(r, 5));
}
console.log(`converged=${ok}`);
console.log(`ms=${Math.round(performance.now() - t0)}`);
console.log(`text=${A.doc.getText('source').toString()}`);
A.p.destroy(); B.p.destroy();
process.exit(ok ? 0 : 1);
