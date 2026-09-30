// Kerry's Mod - static file server + WebSocket relay (one process, one port).
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 3000, ROOT = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.md': 'text/plain' };

const srv = http.createServer((q, r) => {
  let p;
  try { p = decodeURIComponent(q.url.split('?')[0]); }
  catch { r.writeHead(400); return r.end('bad request'); }
  if (p === '/health') { r.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); return r.end('ok'); }
  if (p === '/') p = '/index.html';
  const f = path.resolve(ROOT, '.' + path.normalize(p));
  const rel = path.relative(ROOT, f);
  if (rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { r.writeHead(404); return r.end('not found'); }
    let body = d;
    if (path.extname(f) === '.html') {
      const tags = '<script src="/gamemodes.js"></script><script src="/gamemodes-init.js"></script>';
      const html = d.toString('utf8');
      body = Buffer.from(html.includes('/gamemodes.js') ? html : html.replace(/<\/body>/i, tags + '</body>'));
    }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    r.end(body);
  });
});

const wss = new WebSocketServer({ server: srv, path: '/ws', maxPayload: 1 << 16 });
const peers = new Map(); let n = 0;
const bc = (o, ex) => { const s = JSON.stringify(o); for (const x of peers.values()) if (x !== ex && x.ws.readyState === 1) x.ws.send(s); };

wss.on('connection', ws => {
  const id = 'p' + (++n).toString(36) + Math.random().toString(36).slice(2, 6);
  const me = { ws, id, p: {}, cnt: 0, ts: Date.now() };
  peers.set(id, me);
  ws.send(JSON.stringify({ t: 'hello', id, peers: [...peers.values()].filter(x => x !== me).map(x => ({ peer: x.id, presence: x.p })) }));
  ws.on('message', raw => {
    const now = Date.now(); if (now - me.ts > 1000) { me.ts = now; me.cnt = 0; } if (++me.cnt > 400) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'p' && m.p && typeof m.p === 'object') {
      for (const k in m.p) { if (m.p[k] === null) delete me.p[k]; else me.p[k] = m.p[k]; }
      bc({ t: 'p', peer: id, p: m.p }, me);
    } else if (m.t === 'e' && typeof m.topic === 'string') {
      const code = m.data && m.data.c, msg = JSON.stringify({ t: 'e', topic: m.topic.slice(0, 40), data: m.data, peer: id });
      for (const x of peers.values()) { if (x.ws.readyState !== 1) continue; if (code && x !== me && x.p.code !== code) continue; x.ws.send(msg); }
    }
  });
  ws.on('close', () => { peers.delete(id); bc({ t: 'left', peer: id }); });
  ws.on('error', () => {});
});
setInterval(() => { for (const x of peers.values()) if (x.ws.readyState === 1) x.ws.ping(); }, 25000);
srv.listen(PORT, '0.0.0.0', () => console.log("Kerry's Mod listening on " + PORT));
const shutdown = () => srv.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
module.exports = { srv, wss };
