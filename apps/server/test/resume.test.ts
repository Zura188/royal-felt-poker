import test from 'node:test';
import assert from 'node:assert/strict';
import { connect as tcp } from 'node:net';
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
      await new Promise<void>((r) => { wake = r; setTimeout(r, 100); });
    }
  };
  return { ws, next, send: (o: unknown) => ws.send(JSON.stringify(o)), open: new Promise<void>((r) => (ws.onopen = () => r())) };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('ping aplikasi dibalas pong, juga sebelum masuk room', async () => {
  const srv = await startServer(0);
  const a = client(srv.port); await a.open;
  a.send({ t: 'ping' });
  assert.equal((await a.next((m) => m.t === 'pong')).t, 'pong');
  a.ws.close(); srv.close();
});

test('putus tak sengaja: kursi ditahan, teman melihat offline, lalu resume dengan token mengembalikan kursi', async () => {
  const srv = await startServer(0, { resumeMs: 700 });
  const a = client(srv.port), b = client(srv.port);
  await Promise.all([a.open, b.open]);
  a.send({ t: 'create', name: 'Ana' });
  const ra = await a.next((m) => m.t === 'room');
  assert.match(ra.token, /^[0-9a-f]{24}$/);
  b.send({ t: 'join', code: ra.code, name: 'Budi' });
  await b.next((m) => m.t === 'room');
  await a.next((m) => m.t === 'room' && m.seats[1]); // Ana melihat Budi masuk
  a.ws.close();
  const off = await b.next((m) => m.t === 'room' && m.seats[0]?.away === true);
  assert.equal(off.seats[0].name, 'Ana');
  // resume dari sambungan baru
  const a2 = client(srv.port); await a2.open;
  a2.send({ t: 'resume', code: ra.code, token: ra.token });
  const back = await a2.next((m) => m.t === 'room');
  assert.equal(back.me, 0); assert.equal(back.host, 0);
  assert.equal(back.seats[0].away, false);
  assert.equal((await b.next((m) => m.t === 'room' && m.seats[0]?.away === false)).seats[0].name, 'Ana');
  // game berjalan, putus lagi, lalu masa tunggu habis -> bot mengambil kursi permanen
  a2.send({ t: 'start' });
  const st = await a2.next((m) => m.t === 'state');
  assert.equal(st.view.hands[0].length, 13);
  a2.ws.close();
  const bot = await b.next((m) => m.t === 'room' && m.seats[0]?.bot === true, 3000);
  assert.equal(bot.seats[0].bot, true);
  // token lama sudah tidak berlaku
  const a3 = client(srv.port); await a3.open;
  a3.send({ t: 'resume', code: ra.code, token: ra.token });
  assert.equal((await a3.next((m) => m.t === 'resume_failed')).t, 'resume_failed');
  for (const c of [a3, b]) c.ws.close();
  srv.close();
});

test('resume mengambil alih sambungan lama yang belum terdeteksi mati dan melanjutkan game', async () => {
  const srv = await startServer(0, { resumeMs: 2000 });
  const a = client(srv.port), b = client(srv.port);
  await Promise.all([a.open, b.open]);
  a.send({ t: 'create', name: 'Ana' });
  const ra = await a.next((m) => m.t === 'room');
  b.send({ t: 'join', code: ra.code, name: 'Budi' });
  await b.next((m) => m.t === 'room');
  a.send({ t: 'start' });
  await a.next((m) => m.t === 'state');
  const a2 = client(srv.port); await a2.open;
  a2.send({ t: 'resume', code: ra.code, token: ra.token }); // sambungan `a` masih terbuka (hantu)
  await a2.next((m) => m.t === 'room');
  const st = await a2.next((m) => m.t === 'state');
  assert.equal(st.view.hands[0].length, 13);
  await sleep(100);
  assert.notEqual(a.ws.readyState, WebSocket.OPEN, 'sambungan lama harus ditutup server');
  for (const c of [a2, b]) c.ws.close();
  srv.close();
});

test('masa tunggu habis di lobi: kursi kosong lagi, room hilang bila tak ada manusia', async () => {
  const srv = await startServer(0, { resumeMs: 250 });
  const a = client(srv.port), b = client(srv.port);
  await Promise.all([a.open, b.open]);
  a.send({ t: 'create', name: 'Ana' });
  const ra = await a.next((m) => m.t === 'room');
  b.send({ t: 'join', code: ra.code, name: 'Budi' });
  await b.next((m) => m.t === 'room');
  a.ws.close(); // host putus -> host berpindah ke Budi setelah masa tunggu
  const moved = await b.next((m) => m.t === 'room' && m.seats[0] === null, 2000);
  assert.equal(moved.host, 1);
  b.ws.close();
  await sleep(500);
  const c = client(srv.port); await c.open;
  c.send({ t: 'join', code: ra.code });
  assert.equal((await c.next((m) => m.t === 'error')).msg, 'Kode room tidak ditemukan.');
  c.ws.close(); srv.close();
});

test('keluar sengaja (leave) langsung mengosongkan kursi tanpa masa tunggu', async () => {
  const srv = await startServer(0, { resumeMs: 60_000 });
  const a = client(srv.port), b = client(srv.port);
  await Promise.all([a.open, b.open]);
  a.send({ t: 'create', name: 'Ana' });
  const ra = await a.next((m) => m.t === 'room');
  b.send({ t: 'join', code: ra.code, name: 'Budi' });
  await b.next((m) => m.t === 'room');
  await a.next((m) => m.t === 'room' && m.seats[1]);
  b.send({ t: 'leave' });
  const upd = await a.next((m) => m.t === 'room' && m.seats[1] === null);
  assert.equal(upd.seats[1], null);
  for (const c of [a, b]) c.ws.close();
  srv.close();
});

test('klien yang diam (tanpa data) diputus server setelah batas deteksi; klien normal bertahan', async () => {
  const srv = await startServer(0, { heartbeatMs: 40, deadMs: 200 });
  // soket mentah: handshake lalu diam
  const raw = tcp(srv.port, '127.0.0.1');
  let closed = false;
  raw.on('close', () => { closed = true; });
  raw.on('error', () => {});
  raw.resume(); // tanpa membaca, 'end'/'close' tidak pernah terpicu
  raw.write('GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n');
  const ok = client(srv.port); await ok.open; // browser membalas pong otomatis
  try {
    await sleep(700);
    assert.equal(closed, true, 'soket yang diam harus diputus');
    assert.equal(ok.ws.readyState, WebSocket.OPEN, 'klien yang membalas ping harus tetap tersambung');
  } finally { ok.ws.close(); raw.destroy(); srv.close(); }
});

test('GET /healthz mengembalikan ok dan path aneh tidak membuat server crash', async () => {
  const srv = await startServer(0);
  const r = await fetch(`http://localhost:${srv.port}/healthz`);
  assert.equal(await r.text(), 'ok');
  const bad = await fetch(`http://localhost:${srv.port}/%E0%A4%A`);
  assert.equal(bad.status, 400);
  const home = await fetch(`http://localhost:${srv.port}/../../etc/passwd`);
  assert.equal(home.status, 200);
  assert.doesNotMatch(await home.text(), /root:/);
  srv.close();
});
