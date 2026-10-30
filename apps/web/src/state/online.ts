import { useSyncExternalStore } from 'react';
import { evaluateCombo, type GameState, type Rules } from '@rfp/capsa-engine';
import { CHAT_LINES, RANKS, type Card } from '@rfp/shared';

export interface RoomSeat { name: string; bot: boolean; you: boolean; host: boolean; away?: boolean }
export interface RoomInfo { code: string; seats: (RoomSeat | null)[]; me: number; host: number; rules: Rules; stake: number; playing: boolean; token?: string }
export interface OnlineState {
  status: 'idle' | 'connecting' | 'open' | 'reconnecting' | 'error';
  error: string | null;
  /** koneksi pertama lambat: server gratis kemungkinan sedang bangun dari tidur */
  waking: boolean;
  room: RoomInfo | null;
  game: GameState | null;
  /** obrolan cepat terakhir dari pemain lain (kursi sudah diputar: 1..3, 0 = kamu); `n` naik tiap pesan agar pesan yang sama bisa muncul lagi */
  emote: { from: number; i: number; n: number } | null;
}

const SERVER_KEY = 'royal-felt:server-url';
const SESSION_KEY = 'royal-felt:online-session';
const ATTEMPT_MS = 15_000; // batas satu percobaan membuka WebSocket
const PATIENCE_MS = 75_000; // total menunggu server gratis bangun saat pertama terhubung
const PATIENCE_LOCAL_MS = 8_000; // server di komputer/jaringan sendiri tidak "tidur": gagal cepat saja
const RESUME_MS = 110_000; // total mencoba kembali ke room (server menahan kursi 120 dtk)
const AUTO_RESUME_MS = 25_000; // percobaan kembali otomatis saat aplikasi baru dibuka
const PING_MS = 20_000;
const DEAD_MS = 55_000; // tak ada kabar dari server selama ini = sambungan dianggap mati

/** Alamat server bawaan yang ditanam saat build (VITE_DEFAULT_SERVER), mis. wss://nama.onrender.com */
const BUILD_DEFAULT: string = ((import.meta.env?.VITE_DEFAULT_SERVER as string | undefined) ?? '').trim();

/** Rapikan alamat yang diketik orang: https:// -> wss://, tanpa skema -> wss:// (ws:// untuk jaringan lokal). null = tidak valid. */
export function normalizeServerUrl(input: string): string | null {
  let u = input.trim();
  if (!u) return null;
  if (/^https:\/\//i.test(u)) u = 'wss://' + u.slice(8);
  else if (/^http:\/\//i.test(u)) u = 'ws://' + u.slice(7);
  else if (!/^wss?:\/\//i.test(u)) {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) return null; // skema asing
    const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u);
    u = (local ? 'ws://' : 'wss://') + u;
  }
  try {
    const x = new URL(u);
    if (!x.hostname) return null;
    return `${x.protocol}//${x.host}${x.pathname === '/' ? '' : x.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

/** localhost / alamat jaringan lokal: tidak mungkin server gratis yang sedang tidur. */
const isLocalUrl = (url: string): boolean => /^wss?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(url);

/** Halaman https tidak boleh membuka ws:// (kecuali localhost). */
const blockedByMixedContent = (url: string): boolean =>
  typeof location !== 'undefined' && location.protocol === 'https:' && /^ws:\/\//i.test(url) && !/^ws:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);

export const defaultServerUrl = (): string => {
  let saved: string | null = null;
  try { saved = localStorage.getItem(SERVER_KEY); } catch { /* abaikan */ }
  if (saved) return saved;
  if (BUILD_DEFAULT) return normalizeServerUrl(BUILD_DEFAULT) ?? BUILD_DEFAULT;
  // dibuka dari server mabar sendiri -> pakai alamat yang sama (https -> wss); localhost = mode pengembangan
  if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && location.hostname && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
  }
  return 'ws://localhost:8787';
};

interface Session { url: string; code: string; token: string; at: number }
const readSession = (): Session | null => {
  try {
    const o = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    return o && typeof o.url === 'string' && typeof o.code === 'string' && typeof o.token === 'string' && typeof o.at === 'number' ? (o as Session) : null;
  } catch { return null; }
};
const writeSession = (s: Session) => { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* abaikan */ } };
const clearSession = () => { try { localStorage.removeItem(SESSION_KEY); } catch { /* abaikan */ } };

let state: OnlineState = { status: 'idle', error: null, waking: false, room: null, game: null, emote: null };
let ws: WebSocket | null = null;
const subs = new Set<() => void>();
const set = (p: Partial<OnlineState>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
export const getOnline = () => state;
export const useOnline = (): OnlineState => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state, () => state);

const DUMMY: Card = { r: '3', s: '♠', v: 3 };
const toCard = (id: string): Card => {
  const r = id.slice(0, -1);
  return { r, s: id.slice(-1), v: RANKS.indexOf(r as never) + 2 } as Card;
};

/** Ubah pandangan server (kamu = kursi 0) menjadi GameState untuk layar meja. */
function toGame(v: any): GameState {
  const rules: Rules = v.rules;
  const ev = (ids: string[] | null) => (ids ? evaluateCombo(ids.map(toCard), rules) : null);
  return {
    rules, stake: v.stake,
    hands: v.hands.map((h: string[] | number) => (Array.isArray(h) ? h.map(toCard) : Array.from({ length: h }, () => DUMMY))),
    turn: v.turn, phase: v.phase, starter: v.starter,
    mustInclude: v.mustInclude ? toCard(v.mustInclude) : null,
    trick: { combo: ev(v.trick.cards), by: v.trick.by, passed: v.trick.passed },
    finished: v.finished,
    plays: v.plays.map((p: any) => ({ player: p.player, combo: ev(p.cards) })),
    result: v.result,
  } as GameState;
}

function send(o: unknown) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

// ---------- koneksi ----------
let gen = 0; // naik setiap connect/resume/disconnect baru -> proses lama berhenti sendiri
let lastRx = 0;
let hb = 0;
let resumeWaiter: ((r: 'ok' | 'failed' | 'timeout') => void) | null = null;
let skipSleep: (() => void) | null = null;
let currentUrl = '';

const sleep = (ms: number) => new Promise<void>((res) => {
  const t = window.setTimeout(() => { skipSleep = null; res(); }, ms);
  skipSleep = () => { window.clearTimeout(t); skipSleep = null; res(); };
});

function openSocket(url: string, ms: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    let sock: WebSocket;
    try { sock = new WebSocket(url); } catch { reject(new Error('url')); return; }
    const clean = () => { sock.onopen = null; sock.onclose = null; sock.onerror = null; };
    const timer = window.setTimeout(() => { clean(); try { sock.close(); } catch { /* abaikan */ } reject(new Error('timeout')); }, ms);
    sock.onopen = () => { window.clearTimeout(timer); clean(); resolve(sock); };
    sock.onclose = () => { window.clearTimeout(timer); clean(); reject(new Error('closed')); };
    sock.onerror = () => { /* detail ada di onclose */ };
  });
}

function stopHeartbeat() { if (hb) { window.clearInterval(hb); hb = 0; } }
function detachSocket(sock: WebSocket) {
  sock.onopen = null; sock.onmessage = null; sock.onclose = null; sock.onerror = null;
  try { sock.close(); } catch { /* abaikan */ }
}

function attach(sock: WebSocket, myGen: number) {
  ws = sock;
  lastRx = Date.now();
  sock.onmessage = (e) => {
    if (ws !== sock) return;
    lastRx = Date.now();
    let m: any;
    try { m = JSON.parse(String(e.data)); } catch { return; }
    if (m.t === 'room') {
      set({ room: m });
      if (typeof m.token === 'string') writeSession({ url: currentUrl, code: m.code, token: m.token, at: Date.now() });
      resumeWaiter?.('ok');
    } else if (m.t === 'state') set({ game: toGame(m.view) });
    else if (m.t === 'error') set({ error: m.msg });
    else if (m.t === 'emote') {
      if (Number.isInteger(m.from) && m.from >= 1 && m.from <= 3 && Number.isInteger(m.i) && m.i >= 0 && m.i < CHAT_LINES.length) {
        set({ emote: { from: m.from, i: m.i, n: (state.emote?.n ?? 0) + 1 } });
      }
    } else if (m.t === 'resume_failed') resumeWaiter?.('failed');
  };
  sock.onerror = () => { /* detail ada di onclose */ };
  sock.onclose = () => {
    if (ws !== sock || gen !== myGen) return;
    if (resumeWaiter) { resumeWaiter('timeout'); return; }
    if (state.status === 'open') dropped();
  };
  stopHeartbeat();
  hb = window.setInterval(() => {
    if (ws !== sock || gen !== myGen) { stopHeartbeat(); return; }
    if (Date.now() - lastRx > DEAD_MS) { dropped(); return; }
    send({ t: 'ping' });
    const sess = readSession();
    if (sess) writeSession({ ...sess, at: Date.now() });
  }, PING_MS);
}

/** Sambungan yang sudah terbuka terputus tanpa disengaja. */
function dropped() {
  stopHeartbeat();
  const s = ws; ws = null;
  if (s) detachSocket(s);
  const sess = readSession();
  if (state.room && sess) void resume(sess, RESUME_MS);
  else set({ status: 'error', error: 'Koneksi terputus dari server.', room: null, game: null, emote: null });
}

/** Kembali ke kursi di room dengan token. Mengulang dengan jeda sampai berhasil, kursi sudah hilang, atau waktu habis. */
async function resume(sess: Session, patienceMs: number, silent = false): Promise<'ok' | 'failed' | 'cancelled'> {
  const myGen = ++gen;
  currentUrl = sess.url;
  set({ status: 'reconnecting', error: null, waking: false });
  const started = Date.now();
  for (let attempt = 0; gen === myGen && Date.now() - started < patienceMs; attempt++) {
    if (attempt > 0) await sleep(Math.min(1000 + attempt * 1000, 5000));
    if (gen !== myGen) break;
    let sock: WebSocket;
    try { sock = await openSocket(sess.url, 12_000); } catch { continue; }
    if (gen !== myGen) { detachSocket(sock); break; }
    attach(sock, myGen);
    const r = await new Promise<'ok' | 'failed' | 'timeout'>((res) => {
      const t = window.setTimeout(() => { resumeWaiter = null; res('timeout'); }, 10_000);
      resumeWaiter = (x) => { window.clearTimeout(t); resumeWaiter = null; res(x); };
      sock.send(JSON.stringify({ t: 'resume', code: sess.code, token: sess.token }));
    });
    if (gen !== myGen) return 'cancelled';
    if (r === 'ok') { set({ status: 'open' }); return 'ok'; }
    if (ws === sock) ws = null;
    detachSocket(sock);
    if (r === 'failed') break; // kursi sudah hilang di server: percuma mengulang
  }
  if (gen !== myGen) return 'cancelled';
  clearSession();
  set(silent
    ? { status: 'idle', error: null, room: null, game: null, emote: null }
    : { status: 'error', error: 'Kamu terputus terlalu lama, jadi keluar dari room.', room: null, game: null, emote: null });
  return 'failed';
}

/** Sambung ke server. Sabar menunggu server gratis yang sedang bangun (mengulang sampai ±75 detik). */
export async function connect(rawUrl: string): Promise<void> {
  disconnect();
  const myGen = ++gen;
  const url = normalizeServerUrl(rawUrl);
  if (!url) { set({ status: 'error', error: 'Alamat server tidak valid. Contoh: wss://nama-server.onrender.com' }); throw new Error('url'); }
  if (blockedByMixedContent(url)) {
    set({ status: 'error', error: 'Halaman ini dibuka lewat https, jadi alamat server harus diawali wss:// (bukan ws://).' });
    throw new Error('mixed');
  }
  try { localStorage.setItem(SERVER_KEY, url); } catch { /* abaikan */ }
  currentUrl = url;
  set({ status: 'connecting', error: null, waking: false, room: null, game: null, emote: null });
  const local = isLocalUrl(url);
  const patience = local ? PATIENCE_LOCAL_MS : PATIENCE_MS;
  const wakeTimer = local ? 0 : window.setTimeout(() => { if (gen === myGen && state.status === 'connecting') set({ waking: true }); }, 5000);
  const started = Date.now();
  try {
    for (let attempt = 0; ; attempt++) {
      if (attempt > 0) await sleep(Math.min(1000 + attempt * 1000, 4000));
      if (gen !== myGen) throw new Error('batal');
      try {
        const sock = await openSocket(url, ATTEMPT_MS);
        if (gen !== myGen) { detachSocket(sock); throw new Error('batal'); }
        attach(sock, myGen);
        set({ status: 'open', waking: false });
        return;
      } catch (e) {
        if (gen !== myGen) throw e;
        if (Date.now() - started > patience) break;
      }
    }
    set({
      status: 'error', waking: false,
      error: local
        ? 'Tidak bisa terhubung ke server. Pastikan server mabar berjalan dan alamatnya benar.'
        : 'Tidak bisa terhubung ke server. Periksa alamatnya, atau coba lagi sebentar (server gratis butuh sekitar 1 menit untuk bangun).',
    });
    throw new Error('gagal');
  } finally {
    window.clearTimeout(wakeTimer);
  }
}

/** Keluar dari room dan putuskan sambungan (sengaja: kursi langsung dilepas). */
export function disconnect() {
  gen++;
  stopHeartbeat();
  resumeWaiter = null;
  skipSleep?.();
  const s = ws; ws = null;
  if (s) {
    s.onmessage = null; s.onclose = null; s.onerror = null;
    try { if (s.readyState === 1) s.send(JSON.stringify({ t: 'leave' })); s.close(); } catch { /* abaikan */ }
  }
  clearSession();
  set({ status: 'idle', error: null, waking: false, room: null, game: null, emote: null });
}

/** Saat aplikasi baru dibuka: kembali ke room bila baru saja terputus. true = berhasil kembali. */
export async function tryAutoResume(): Promise<boolean> {
  const sess = readSession();
  if (!sess || state.status !== 'idle' || Date.now() - sess.at > 100_000) { if (sess && Date.now() - sess.at > 100_000) clearSession(); return false; }
  return (await resume(sess, AUTO_RESUME_MS, true)) === 'ok';
}

// Kembali ke aplikasi / jaringan pulih: periksa sambungan sekarang juga (WebView sering dibekukan di latar belakang).
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const wake = () => {
    if (document.visibilityState === 'hidden') return;
    if (state.status === 'reconnecting') { skipSleep?.(); return; }
    const sock = ws;
    if (state.status !== 'open' || !sock) return;
    const t0 = Date.now();
    send({ t: 'ping' });
    window.setTimeout(() => { if (ws === sock && lastRx < t0 && state.status === 'open') dropped(); }, 3500);
  };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);
}

export const onlineApi = {
  create: (name: string) => send({ t: 'create', name }),
  join: (code: string, name: string) => send({ t: 'join', code, name }),
  /** host: atur aturan & taruhan room di ruang tunggu (teman melihatnya sebelum game dimulai) */
  config: (rules: Rules, stake: number) => send({ t: 'config', rules, stake }),
  start: (rules: Rules, stake: number) => { set({ game: null }); send({ t: 'start', rules, stake }); },
  play: (ids: string[]) => send({ t: 'play', cards: ids }),
  pass: () => send({ t: 'pass' }),
  /** obrolan cepat: kirim indeks baris di CHAT_LINES (server menyiarkannya ke pemain lain) */
  emote: (i: number) => send({ t: 'emote', i }),
  clearError: () => set({ error: null }),
};
