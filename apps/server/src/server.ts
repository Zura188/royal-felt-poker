import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chooseStrongMove, DEFAULT_RULES, DEFAULT_STAKE, legalMoves, newGame, pass, playCards, sanitizeRules, STAKE_TIERS, validatePlay,
  type GameState, type Rules,
} from '@rfp/capsa-engine';
import { CHAT_GAP_MS, CHAT_LINES, type Card } from '@rfp/shared';
import { accept, type Socket } from './ws.js';

/**
 * Server mabar Royal Felt. Server memegang state game (otoritatif): klien hanya mengirim niat
 * (main / pass), server memvalidasi dengan mesin yang sama dan hanya mengirim kartu milik pemain itu sendiri.
 * Catatan: belum ada akun / saldo di server — koin virtual dihitung di perangkat dari hasil game.
 *
 * Ketahanan untuk hosting gratis / jaringan HP:
 *  - detak jantung: ping protokol dari server + ping/pong aplikasi dari klien; sambungan yang diam terlalu lama diputus
 *  - kursi ditahan `resumeMs` setelah sambungan putus tak sengaja; selama itu bot memainkan giliran dan
 *    pemain bisa kembali dengan pesan `resume` (kode room + token rahasia yang dikirim saat masuk)
 */

export interface ServerOptions {
  /** selang ping dari server (ms) */
  heartbeatMs?: number;
  /** sambungan tanpa data sebanyak ini dianggap mati (ms) */
  deadMs?: number;
  /** lama kursi ditahan setelah sambungan putus tak sengaja (ms) */
  resumeMs?: number;
  /** jeda minimal antar obrolan cepat dari satu pemain (ms) */
  emoteGapMs?: number;
}
const DEFAULTS = { heartbeatMs: 20_000, deadMs: 75_000, resumeMs: 120_000, emoteGapMs: CHAT_GAP_MS };
let cfg = { ...DEFAULTS };

interface Player { sock: Socket | null; name: string; token: string; expire: ReturnType<typeof setTimeout> | null; lastEmote: number }
type Seat = Player | 'bot' | null;
interface Room {
  code: string;
  seats: Seat[];
  host: number;
  rules: Rules;
  stake: number;
  game: GameState | null;
  lastWinner: number | null;
  timer: ReturnType<typeof setTimeout> | null;
}

const isPlayer = (s: Seat): s is Player => s !== null && s !== 'bot';
/** pemain manusia yang sedang tersambung */
const live = (s: Seat): s is Player & { sock: Socket } => isPlayer(s) && s.sock !== null;

const rooms = new Map<string, Room>();
const where = new WeakMap<Socket, { room: Room; seat: number }>();
const TURN_MS = 30_000;
const MAX_ROOMS = 300;
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

const code = () => {
  for (;;) {
    const c = Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
    if (!rooms.has(c)) return c;
  }
};
const cleanName = (n: unknown) => (typeof n === 'string' ? n.replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 14) : '') || 'Pemain';

function seatsInfo(r: Room, forSeat: number) {
  return r.seats.map((s, i) => (s === null ? null : { name: s === 'bot' ? `Bot ${i + 1}` : s.name, bot: s === 'bot', you: i === forSeat, host: i === r.host, away: isPlayer(s) && s.sock === null }));
}

function sendRoom(r: Room) {
  r.seats.forEach((s, i) => {
    if (live(s)) s.sock.send({ t: 'room', code: r.code, seats: seatsInfo(r, i), me: i, host: r.host, rules: r.rules, stake: r.stake, playing: !!r.game && r.game.phase === 'playing', token: s.token });
  });
}

const rot = (seat: number, me: number) => (seat - me + 4) % 4;
const idOf = (c: Card) => c.r + c.s;

/** Pandangan game dari sudut pandang satu pemain (kartu lawan disembunyikan). */
function viewFor(g: GameState, me: number) {
  const hands = [0, 1, 2, 3].map((k) => {
    const seat = (me + k) % 4;
    return seat === me ? g.hands[seat].map(idOf) : g.hands[seat].length;
  });
  return {
    rules: g.rules, stake: g.stake, hands, turn: rot(g.turn, me), phase: g.phase, starter: rot(g.starter, me), mustInclude: g.mustInclude ? idOf(g.mustInclude) : null,
    trick: { cards: g.trick.combo ? g.trick.combo.cards.map(idOf) : null, by: g.trick.by === null ? null : rot(g.trick.by, me), passed: [0, 1, 2, 3].map((k) => g.trick.passed[(me + k) % 4]) },
    finished: g.finished.map((s) => rot(s, me)),
    plays: g.plays.map((p) => ({ player: rot(p.player, me), cards: p.combo ? p.combo.cards.map(idOf) : null })),
    result: g.result && {
      order: g.result.order.map((s) => rot(s, me)),
      cardsLeft: [0, 1, 2, 3].map((k) => g.result!.cardsLeft[(me + k) % 4]),
      deltas: [0, 1, 2, 3].map((k) => g.result!.deltas[(me + k) % 4]),
    },
  };
}

function sendState(r: Room) {
  if (!r.game) return;
  r.seats.forEach((s, i) => { if (live(s)) s.sock.send({ t: 'state', view: viewFor(r.game as GameState, i) }); });
}

function schedule(r: Room) {
  if (r.timer) clearTimeout(r.timer);
  r.timer = null;
  const g = r.game;
  if (!g || g.phase !== 'playing') return;
  // bot, kursi kosong, atau pemain yang sedang offline dimainkan otomatis dengan cepat
  const auto = !live(r.seats[g.turn]);
  r.timer = setTimeout(() => {
    const cur = r.game;
    if (!cur || cur.phase !== 'playing') return;
    const seat = cur.turn;
    let mv: Card[] | null;
    if (auto) mv = chooseStrongMove(cur, seat, { thinkMs: 250 });
    else { // pemain terlalu lama: main otomatis agar meja tidak macet
      const lm = legalMoves(cur, seat);
      mv = cur.trick.combo && !cur.mustInclude ? null : lm.length ? lm[0].cards : null;
    }
    apply(r, seat, mv);
  }, auto ? 900 : TURN_MS);
}

function apply(r: Room, seat: number, cards: Card[] | null) {
  const g = r.game as GameState;
  const res = cards ? playCards(g, seat, cards) : pass(g, seat);
  if (res.error) return res.error;
  r.game = res.state;
  if (r.game.phase === 'over' && r.game.result) r.lastWinner = r.game.result.order[0];
  sendState(r);
  schedule(r);
  return null;
}

/** Hapus pemain dari kursinya sekarang juga (keluar sengaja atau masa tunggu habis). */
function removeSeat(room: Room, seat: number) {
  const p = room.seats[seat];
  if (isPlayer(p) && p.expire) { clearTimeout(p.expire); p.expire = null; }
  const playing = room.game?.phase === 'playing';
  room.seats[seat] = playing ? 'bot' : null; // bot mengambil alih kursi yang ditinggalkan
  const humans = room.seats.map((s, i) => (isPlayer(s) ? i : -1)).filter((i) => i >= 0);
  if (humans.length === 0) { if (room.timer) clearTimeout(room.timer); rooms.delete(room.code); return; }
  if (room.host === seat) room.host = humans.find((i) => live(room.seats[i])) ?? humans[0];
  sendRoom(room);
  if (playing) schedule(room);
}

/** Soket terlepas. `intentional` = pemain menekan keluar; selain itu kursi ditahan sebentar agar bisa resume. */
function detach(sock: Socket, intentional: boolean) {
  const w = where.get(sock);
  if (!w) return;
  where.delete(sock);
  const { room, seat } = w;
  const p = room.seats[seat];
  if (!isPlayer(p) || p.sock !== sock) return; // kursi sudah diambil alih sambungan baru
  if (intentional) return removeSeat(room, seat);
  p.sock = null;
  p.expire = setTimeout(() => { if (room.seats[seat] === p) removeSeat(room, seat); }, cfg.resumeMs);
  sendRoom(room); // teman melihat tanda offline
  if (room.game?.phase === 'playing') schedule(room); // bot memainkan giliran selama pemain offline
}

function handle(sock: Socket, raw: string) {
  let m: any;
  try { m = JSON.parse(raw); } catch { return; }
  if (!m || typeof m !== 'object') return;
  const err = (msg: string) => sock.send({ t: 'error', msg });
  if (m.t === 'ping') return sock.send({ t: 'pong' });
  if (m.t === 'create') {
    if (where.has(sock)) return err('Kamu sudah ada di room.');
    if (rooms.size >= MAX_ROOMS) return err('Server sedang penuh. Coba lagi nanti.');
    const r: Room = { code: code(), seats: [null, null, null, null], host: 0, rules: DEFAULT_RULES, stake: DEFAULT_STAKE, game: null, lastWinner: null, timer: null };
    r.seats[0] = { sock, name: cleanName(m.name), token: randomBytes(12).toString('hex'), expire: null, lastEmote: 0 };
    rooms.set(r.code, r);
    where.set(sock, { room: r, seat: 0 });
    return sendRoom(r);
  }
  if (m.t === 'join') {
    if (where.has(sock)) return err('Kamu sudah ada di room.');
    const r = rooms.get(String(m.code ?? '').toUpperCase().trim());
    if (!r) return err('Kode room tidak ditemukan.');
    if (r.game?.phase === 'playing') return err('Game di room ini sedang berjalan.');
    const i = r.seats.findIndex((s) => s === null || s === 'bot');
    if (i < 0) return err('Room penuh.');
    r.seats[i] = { sock, name: cleanName(m.name), token: randomBytes(12).toString('hex'), expire: null, lastEmote: 0 };
    where.set(sock, { room: r, seat: i });
    return sendRoom(r);
  }
  if (m.t === 'resume') {
    if (where.has(sock)) return err('Kamu sudah ada di room.');
    const r = rooms.get(String(m.code ?? '').toUpperCase().trim());
    const i = r && typeof m.token === 'string' ? r.seats.findIndex((s) => isPlayer(s) && s.token === m.token) : -1;
    const p = r && i >= 0 ? r.seats[i] : null;
    if (!r || !isPlayer(p)) return sock.send({ t: 'resume_failed' });
    if (p.expire) { clearTimeout(p.expire); p.expire = null; }
    const old = p.sock;
    p.sock = sock;
    where.set(sock, { room: r, seat: i });
    if (old) { where.delete(old); old.close(); } // sambungan lama yang belum terdeteksi mati
    sendRoom(r);
    sendState(r);
    if (r.game?.phase === 'playing') schedule(r); // kembali ke jam giliran manusia
    return;
  }
  const w = where.get(sock);
  if (!w) return err('Belum masuk room.');
  const { room: r, seat } = w;
  if (m.t === 'leave') return detach(sock, true);
  if (m.t === 'emote') {
    // obrolan cepat: hanya indeks baris yang valid, dibatasi jedanya, dan disiarkan ke pemain lain (pengirim menampilkannya sendiri)
    const i = m.i;
    const p = r.seats[seat];
    if (!Number.isInteger(i) || i < 0 || i >= CHAT_LINES.length || !isPlayer(p)) return;
    const now = Date.now();
    if (now - p.lastEmote < cfg.emoteGapMs) return;
    p.lastEmote = now;
    r.seats.forEach((s, k) => { if (k !== seat && live(s)) s.sock.send({ t: 'emote', from: rot(seat, k), i }); });
    return;
  }
  if (m.t === 'config') {
    // host mengatur aturan & taruhan di ruang tunggu; semua pemain langsung melihatnya lewat pesan `room`
    if (seat !== r.host) return err('Hanya host yang bisa mengubah pengaturan room.');
    if (r.game?.phase === 'playing') return;
    r.rules = sanitizeRules(m.rules ?? r.rules);
    r.stake = STAKE_TIERS.includes(m.stake) ? m.stake : r.stake;
    return sendRoom(r);
  }
  if (m.t === 'start') {
    if (seat !== r.host) return err('Hanya host yang bisa memulai.');
    if (r.game?.phase === 'playing') return;
    const rules = sanitizeRules(m.rules ?? r.rules);
    const stake = STAKE_TIERS.includes(m.stake) ? m.stake : r.stake;
    r.rules = rules; r.stake = stake;
    r.seats = r.seats.map((s) => s ?? 'bot');
    r.game = newGame(rules, { previousWinner: r.lastWinner, stake });
    sendRoom(r); sendState(r); schedule(r);
    return;
  }
  const g = r.game;
  if (!g || g.phase !== 'playing') return err('Game belum berjalan.');
  if (m.t === 'play') {
    const ids: unknown = m.cards;
    if (!Array.isArray(ids) || ids.length > 5) return err('Kartu tidak valid.');
    const cards = ids.map((id) => g.hands[seat].find((c) => idOf(c) === id)).filter(Boolean) as Card[];
    if (cards.length !== ids.length) return err('Kartu tidak ada di tanganmu.');
    const e = validatePlay(g, seat, cards);
    if (!e.ok) return err(e.error);
    apply(r, seat, cards);
    return;
  }
  if (m.t === 'pass') { const e = apply(r, seat, null); if (e) err(e); return; }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

export function startServer(port = Number(process.env.PORT ?? 8787), opts: ServerOptions = {}) {
  cfg = { ...DEFAULTS, ...opts };
  const here = dirname(fileURLToPath(import.meta.url));
  // Prioritaskan hasil build web terbaru (apps/web/dist); jika belum ada, pakai salinan di public/.
  const roots = [join(here, '..', '..', 'web', 'dist'), join(here, '..', 'public')];
  const pickRoot = () => roots.find((r) => existsSync(join(r, 'index.html'))) ?? roots[1];
  const sockets = new Set<Socket>();

  const http = createServer((req, res) => {
    let path: string;
    try { path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, ''); } catch { res.writeHead(400); return void res.end('Bad request'); }
    if (path === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return void res.end('ok'); }
    const root = pickRoot();
    let file = join(root, path === '/' || path === '\\' ? 'index.html' : path);
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) file = join(root, 'index.html');
    if (!existsSync(file)) { res.writeHead(200, { 'content-type': 'text/plain' }); return void res.end('Royal Felt server OK\n'); }
    const hashed = /[\\/]assets[\\/]/.test(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache' });
    res.end(readFileSync(file));
  });
  http.on('upgrade', (req, sock) => {
    const s = accept(req, sock);
    if (!s) return;
    sockets.add(s);
    s.onMessage = (t) => handle(s, t);
    s.onClose = () => { sockets.delete(s); detach(s, false); };
  });
  const beat = setInterval(() => {
    const now = Date.now();
    for (const s of [...sockets]) { if (now - s.lastRx > cfg.deadMs) s.terminate(); else s.ping(); }
  }, cfg.heartbeatMs);
  beat.unref();

  return new Promise<{ port: number; close: () => void }>((resolve) =>
    http.listen(port, () => resolve({
      port: (http.address() as { port: number }).port,
      close: () => {
        clearInterval(beat);
        for (const s of [...sockets]) s.terminate(); // memicu detach(): timer baru dibuat, jadi bersihkan sesudahnya
        for (const r of rooms.values()) {
          if (r.timer) clearTimeout(r.timer);
          for (const s of r.seats) if (isPlayer(s) && s.expire) clearTimeout(s.expire);
        }
        rooms.clear();
        http.close();
        cfg = { ...DEFAULTS };
      },
    })),
  );
}

if (process.argv[1]?.endsWith('server.ts')) startServer().then((s) => console.log('Royal Felt server di port', s.port));
