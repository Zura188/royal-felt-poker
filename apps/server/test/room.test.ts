import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../src/server';

function client(port: number) {
  const ws = new WebSocket(`ws://localhost:${port}`);
  const q: any[] = []; let wake: (() => void) | null = null;
  ws.onmessage = (e) => { q.push(JSON.parse(String(e.data))); wake?.(); };
  const next = async (pred: (m: any) => boolean = () => true) => {
    for (;;) { const i = q.findIndex(pred); if (i >= 0) return q.splice(i, 1)[0]; await new Promise<void>((r) => { wake = r; setTimeout(r, 4000); }); if (q.findIndex(pred) < 0 && !q.length) throw new Error('timeout'); }
  };
  return { ws, next, send: (o: unknown) => ws.send(JSON.stringify(o)), open: new Promise<void>((r) => (ws.onopen = () => r())) };
}

test('dua pemain: buat room, gabung, mulai, main sampai selesai (bot mengisi kursi kosong)', async () => {
  const srv = await startServer(0);
  const a = client(srv.port), b = client(srv.port);
  await Promise.all([a.open, b.open]);
  a.send({ t: 'create', name: 'Ana' });
  const room = await a.next((m) => m.t === 'room');
  assert.match(room.code, /^[A-Z]{4}$/);
  b.send({ t: 'join', code: room.code.toLowerCase(), name: 'Budi' });
  const rb = await b.next((m) => m.t === 'room');
  assert.equal(rb.seats.filter(Boolean).length, 2);
  b.send({ t: 'start' }); assert.equal((await b.next((m) => m.t === 'error')).msg, 'Hanya host yang bisa memulai.');
  a.send({ t: 'start' });
  let over = false, guard = 0;
  const players = [a, b];
  while (!over && guard++ < 600) {
    for (const p of players) {
      const st = await p.next((m) => m.t === 'state');
      const v = st.view;
      assert.equal(v.hands[0].length > 0 || v.phase === 'over' || v.finished.includes(0), true);
      if (v.phase === 'over') { over = true; assert.equal(v.result.deltas.reduce((x: number, y: number) => x + y, 0), 0); continue; }
      if (v.turn === 0) {
        // mainkan kartu terendah satu per satu / pass sampai sah
        const hand: string[] = v.hands[0];
        if (v.trick.cards) p.send({ t: 'pass' });
        else p.send({ t: 'play', cards: v.mustInclude ? [v.mustInclude] : [hand[0]] });
      }
    }
  }
  assert.ok(over, 'game harus selesai');
  a.ws.close(); b.ws.close(); srv.close();
});

test('kode salah ditolak, kartu orang lain tidak bisa dimainkan', async () => {
  const srv = await startServer(0);
  const a = client(srv.port); await a.open;
  a.send({ t: 'join', code: 'ZZZZ' });
  assert.equal((await a.next((m) => m.t === 'error')).msg, 'Kode room tidak ditemukan.');
  a.send({ t: 'create' }); await a.next((m) => m.t === 'room');
  a.send({ t: 'start' });
  const st = await a.next((m) => m.t === 'state');
  assert.equal(typeof st.view.hands[1], 'number');
  a.send({ t: 'play', cards: ['2♠', '2♥', '2♣', '2♦', 'A♠'] });
  await a.next((m) => m.t === 'error');
  a.ws.close(); srv.close();
});
