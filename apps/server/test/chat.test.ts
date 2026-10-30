import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_LINES } from '@rfp/shared';
import { MAX_STAKE, STAKE_TIERS } from '@rfp/capsa-engine';
import { startServer } from '../src/server';

function client(port: number) {
  const ws = new WebSocket(`ws://localhost:${port}`);
  const q: any[] = []; let wake: (() => void) | null = null;
  ws.onmessage = (e) => { q.push(JSON.parse(String(e.data))); wake?.(); };
  const next = async (pred: (m: any) => boolean = () => true, ms = 3000) => {
    const end = Date.now() + ms;
    for (;;) {
      const i = q.findIndex(pred);
      if (i >= 0) return q.splice(i, 1)[0];
      if (Date.now() > end) throw new Error('timeout menunggu pesan');
      await new Promise<void>((r) => { wake = r; setTimeout(r, 50); });
    }
  };
  /** tidak ada pesan yang cocok dalam `ms` */
  const none = async (pred: (m: any) => boolean, ms = 250) => {
    await new Promise((r) => setTimeout(r, ms));
    return q.findIndex(pred) < 0;
  };
  return { ws, next, none, send: (o: unknown) => ws.send(JSON.stringify(o)), open: new Promise<void>((r) => (ws.onopen = () => r())) };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function twoPlayers(srv: { port: number }) {
  const a = client(srv.port), b = client(srv.port);
  await Promise.all([a.open, b.open]);
  a.send({ t: 'create', name: 'Ana' });
  const ra = await a.next((m) => m.t === 'room');
  b.send({ t: 'join', code: ra.code, name: 'Budi' });
  await b.next((m) => m.t === 'room');
  await a.next((m) => m.t === 'room' && m.seats[1]);
  return { a, b, code: ra.code as string };
}

test('obrolan cepat: pemain lain menerimanya dengan kursi yang sudah diputar, pengirim tidak', async () => {
  const srv = await startServer(0, { emoteGapMs: 120 });
  const { a, b } = await twoPlayers(srv);
  a.send({ t: 'emote', i: 2 });
  const m = await b.next((x) => x.t === 'emote');
  assert.equal(m.i, 2);
  assert.equal(m.from, 3); // Ana duduk di kursi 0, Budi di kursi 1 -> dari sudut pandang Budi Ana ada 3 kursi searah jarum jam
  assert.ok(await a.none((x) => x.t === 'emote'), 'pengirim tidak menerima gema');
  // arah sebaliknya
  await sleep(150);
  b.send({ t: 'emote', i: CHAT_LINES.length - 1 });
  const m2 = await a.next((x) => x.t === 'emote');
  assert.equal(m2.from, 1);
  assert.equal(m2.i, CHAT_LINES.length - 1);
  a.ws.close(); b.ws.close(); srv.close();
});

test('obrolan cepat: dibatasi jedanya, indeks tidak valid diabaikan, sambungan tetap sehat', async () => {
  const srv = await startServer(0, { emoteGapMs: 300 });
  const { a, b } = await twoPlayers(srv);
  a.send({ t: 'emote', i: 0 });
  await b.next((x) => x.t === 'emote');
  a.send({ t: 'emote', i: 1 }); a.send({ t: 'emote', i: 3 }); // terlalu cepat
  assert.ok(await b.none((x) => x.t === 'emote', 200), 'banjir pesan harus ditahan');
  await sleep(250);
  for (const bad of [-1, 99, 1.5, '1', null, undefined, {}, [0]]) a.send({ t: 'emote', i: bad });
  assert.ok(await b.none((x) => x.t === 'emote', 200), 'indeks tidak valid tidak disiarkan');
  a.send({ t: 'ping' });
  await a.next((x) => x.t === 'pong');
  a.send({ t: 'emote', i: 4 });
  assert.equal((await b.next((x) => x.t === 'emote')).i, 4);
  a.ws.close(); b.ws.close(); srv.close();
});

test('obrolan cepat sebelum masuk room ditolak seperti perintah lain', async () => {
  const srv = await startServer(0);
  const a = client(srv.port); await a.open;
  a.send({ t: 'emote', i: 0 });
  assert.equal((await a.next((m) => m.t === 'error')).msg, 'Belum masuk room.');
  a.ws.close(); srv.close();
});

test('taruhan 1.000.000 diterima server; nilai di luar daftar kembali ke taruhan room', async () => {
  const srv = await startServer(0);
  assert.equal(STAKE_TIERS[STAKE_TIERS.length - 1], MAX_STAKE);
  const a = client(srv.port); await a.open;
  a.send({ t: 'create', name: 'Ana' });
  const room = await a.next((m) => m.t === 'room');
  a.send({ t: 'start', stake: MAX_STAKE });
  const st = await a.next((m) => m.t === 'state');
  assert.equal(st.view.stake, 1_000_000);
  assert.equal((await a.next((m) => m.t === 'room' && m.stake === 1_000_000)).stake, 1_000_000);
  // game berikutnya (setelah selesai) tidak dibahas di sini; cukup pastikan nilai tak sah tidak lolos di room baru
  const b = client(srv.port); await b.open;
  b.send({ t: 'create', name: 'Budi' });
  await b.next((m) => m.t === 'room');
  b.send({ t: 'start', stake: 2_000_000 });
  assert.equal((await b.next((m) => m.t === 'state')).view.stake, room.stake);
  const c = client(srv.port); await c.open;
  c.send({ t: 'create', name: 'Cici' });
  await c.next((m) => m.t === 'room');
  c.send({ t: 'start', stake: 12345 });
  assert.equal((await c.next((m) => m.t === 'state')).view.stake, room.stake);
  a.ws.close(); b.ws.close(); c.ws.close(); srv.close();
});

test('host mengatur taruhan & aturan di ruang tunggu: semua pemain melihatnya; tamu ditolak; nilai tak sah diabaikan', async () => {
  const srv = await startServer(0);
  const { a, b } = await twoPlayers(srv);
  a.send({ t: 'config', stake: 1_000_000, rules: { scoring: 'first' } });
  const ra = await a.next((m) => m.t === 'room' && m.stake === 1_000_000);
  const rb = await b.next((m) => m.t === 'room' && m.stake === 1_000_000);
  assert.equal(ra.rules.scoring, 'first');
  assert.equal(rb.rules.scoring, 'first', 'tamu juga melihat aturan dari host');
  // tamu tidak boleh
  b.send({ t: 'config', stake: 100 });
  assert.equal((await b.next((m) => m.t === 'error')).msg, 'Hanya host yang bisa mengubah pengaturan room.');
  // nilai tak sah: taruhan tetap, aturan disaring
  a.send({ t: 'config', stake: 777, rules: 'bukan objek' });
  const again = await a.next((m) => m.t === 'room');
  assert.equal(again.stake, 1_000_000);
  assert.ok(['first', 'ranking'].includes(again.rules.scoring));
  // game memakai pengaturan room walau start tidak membawa apa-apa
  a.send({ t: 'start' });
  const st = await a.next((m) => m.t === 'state');
  assert.equal(st.view.stake, 1_000_000);
  // saat game berjalan, config diabaikan
  a.send({ t: 'config', stake: 100 });
  assert.ok(await a.none((m) => m.t === 'room' && m.stake === 100));
  a.ws.close(); b.ws.close(); srv.close();
});
