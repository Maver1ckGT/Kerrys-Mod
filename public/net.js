// Browser-side adapter: gives the game the same `room` API it uses on claude.ai, backed by the WebSocket relay.
(function () {
  if (window.claude) return;
  const qs = new URLSearchParams(location.search);
  const url = qs.get('server') || ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  window.claude = { use: async n => {
    if (n !== 'room' || (location.protocol === 'file:' && !qs.get('server'))) return null;
    return new Promise(res => {
      let ws;
      const H = {}, P = {}, mine = {}, pcb = []; let id = '', q = 0, settled = false, retry = 0, closed = false;
      const tm = setTimeout(() => { if (!settled) { settled = true; res(null); } }, 6000);
      const notify = () => { if (q) return; q = 1; setTimeout(() => { q = 0;
        const l = [{ peer: id, presence: { ...mine }, isMe: true, sameTab: true }];
        for (const k in P) l.push({ peer: k, presence: P[k], isMe: false, sameTab: false });
        pcb.forEach(f => f({ peers: l })); }, 40); };
      const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
      const connect = () => {
        if (closed) return;
        try { ws = new WebSocket(url); } catch (e) { retry = Math.min(retry + 1, 6); return setTimeout(connect, 500 * 2 ** retry); }
        ws.onopen = () => { retry = 0; };
        ws.onmessage = onmessage;
        ws.onerror = () => {};
        ws.onclose = () => {
          for (const k in P) delete P[k]; notify();
          if (!closed) { retry = Math.min(retry + 1, 6); setTimeout(connect, 500 * 2 ** retry); }
        };
      };
      const room = {
        emit: async (t, d) => { send({ t: 'e', topic: t, data: d }); },
        on: (t, f) => { (H[t] = H[t] || []).push(f); },
        presence: async p => { for (const k in p) { if (p[k] === null) delete mine[k]; else mine[k] = p[k]; } send({ t: 'p', p }); notify(); },
        onPeers: f => { pcb.push(f); notify(); }
      };
      function onmessage(e) { let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'hello') { id = m.id; for (const x of m.peers) P[x.peer] = x.presence || {}; clearTimeout(tm); if (!settled) { settled = true; res(room); } notify(); }
        else if (m.t === 'p') { const o = P[m.peer] || (P[m.peer] = {}); for (const k in m.p) { if (m.p[k] === null) delete o[k]; else o[k] = m.p[k]; } notify(); }
        else if (m.t === 'left') { delete P[m.peer]; notify(); }
        else if (m.t === 'e') { const me = m.peer === id; (H[m.topic] || []).forEach(f => f({ data: m.data, peer: m.peer, isMe: me, sameTab: me })); } }
      connect();
    });
  } };
})();
