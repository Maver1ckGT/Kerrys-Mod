// Kerry's Mod - static file server + authoritative WebSocket relay.
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
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    r.end(d);
  });
});

const wss = new WebSocketServer({ server: srv, path: '/ws', maxPayload: 1 << 16 });
const peers = new Map();
const vehicles = new Map(); // room code -> Map(vehicle id -> authoritative state)
let n = 0, vehicleSeq = 0;

const send = (peer, obj) => { if (peer?.ws?.readyState === 1) peer.ws.send(JSON.stringify(obj)); };
const bc = (o, ex) => { const s = JSON.stringify(o); for (const x of peers.values()) if (x !== ex && x.ws.readyState === 1) x.ws.send(s); };
const roomOf = code => { if (!code) return null; let r = vehicles.get(code); if (!r) vehicles.set(code, r = new Map()); return r; };

function vehicleEvent(me, data) {
  const code = typeof data.c === 'string' ? data.c.slice(0, 32) : '';
  const id = typeof data.id === 'string' ? data.id.slice(0, 64) : '';
  const e = data.e;
  if (!code || !id || !['spawn','move','remove'].includes(e)) return;

  const room = roomOf(code);
  let state = room.get(id);

  if (e === 'spawn') {
    if (state && state.owner !== me.id) return;
    const x=Number(data.x), y=Number(data.y), z=Number(data.z), yaw=Number(data.yaw);
    if (![x,y,z,yaw].every(Number.isFinite) || typeof data.t !== 'string') return;
    state = { c:code, id, e:'spawn', t:data.t.slice(0,24), x,y,z,yaw, s:0, vx:0, vz:0, seq:++vehicleSeq, owner:me.id, ts:Date.now() };
    room.set(id,state);
    const out={...state}; delete out.owner; delete out.ts;
    bc({t:'e',topic:'vehicle',data:out,peer:me.id},me);
    return;
  }

  if (!state || state.owner !== me.id) return;

  if (e === 'move') {
    const x=Number(data.x), y=Number(data.y), z=Number(data.z), yaw=Number(data.yaw), s=Number(data.s);
    if (![x,y,z,yaw,s].every(Number.isFinite)) return;
    const ts=Date.now();
    const dt=Math.max(.016,Math.min(.25,(ts-state.ts)/1000));
    state.vx=(x-state.x)/dt; state.vz=(z-state.z)/dt;
    state.x=x;state.y=y;state.z=z;state.yaw=yaw;state.s=s;state.seq=++vehicleSeq;state.ts=ts;
    const out={c:code,e:'move',id,x,y,z,yaw,s,seq:state.seq,ts};
    bc({t:'e',topic:'vehicle',data:out,peer:me.id},me);
  } else {
    room.delete(id);
    bc({t:'e',topic:'vehicle',data:{c:code,e:'remove',id,seq:++vehicleSeq},peer:me.id},me);
    if (!room.size) vehicles.delete(code);
  }
}

wss.on('connection', ws => {
  const id = 'p' + (++n).toString(36) + Math.random().toString(36).slice(2, 6);
  const me = { ws, id, p: {}, cnt: 0, ts: Date.now() };
  peers.set(id, me);
  send(me,{ t:'hello', id, peers:[...peers.values()].filter(x=>x!==me).map(x=>({peer:x.id,presence:x.p})) });

  ws.on('message', raw => {
    const now = Date.now();
    if (now-me.ts>1000) { me.ts=now; me.cnt=0; }
    if (++me.cnt>600) return;
    let m; try { m=JSON.parse(raw); } catch { return; }

    if (m.t==='p' && m.p && typeof m.p==='object') {
      for (const k in m.p) {
        if (m.p[k]===null) delete me.p[k];
        else me.p[k]=m.p[k];
      }
      if (typeof m.p.code==='string' && m.p.code) {
        const room=vehicles.get(m.p.code);
        if (room) for (const state of room.values()) {
          const out={...state,e:'spawn'}; delete out.owner; delete out.ts;
          send(me,{t:'e',topic:'vehicle',data:out,peer:state.owner});
        }
      }
      bc({t:'p',peer:id,p:m.p},me);
    } else if (m.t==='e' && typeof m.topic==='string') {
      if (m.topic==='vehicle') { vehicleEvent(me,m.data&&typeof m.data==='object'?m.data:{}); return; }
      const code=m.data&&typeof m.data.c==='string'?m.data.c.slice(0,32):'';
      const msg=JSON.stringify({t:'e',topic:m.topic.slice(0,40),data:m.data,peer:id});
      for (const x of peers.values()) {
        if (x.ws.readyState!==1) continue;
        if (code && x!==me && x.p.code!==code) continue;
        x.ws.send(msg);
      }
    }
  });

  ws.on('close', () => {
    peers.delete(id);
    for (const [code,room] of vehicles) {
      for (const [vid,state] of room) {
        if (state.owner!==id) continue;
        room.delete(vid);
        bc({t:'e',topic:'vehicle',data:{c:code,e:'remove',id:vid,seq:++vehicleSeq},peer:id});
      }
      if (!room.size) vehicles.delete(code);
    }
    bc({t:'left',peer:id});
  });
  ws.on('error',()=>{});
});

setInterval(() => { for (const x of peers.values()) if (x.ws.readyState===1) x.ws.ping(); },25000);
srv.listen(PORT,'0.0.0.0',()=>console.log("Kerry's Mod listening on "+PORT));
const shutdown=()=>srv.close(()=>process.exit(0));
process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);
module.exports={srv,wss};
