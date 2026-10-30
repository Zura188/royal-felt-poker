import type { Card } from '@rfp/shared';
import { cardId, newDeck, rankIdx, sameCard, shuffle } from './cards';
import { beats, compareCombos, evaluateCombo, STRAIGHT_WINDOWS, type Combo } from './combos';
import { legalMoves, PLAYERS, settle, type GameState } from './game';
import type { Rules } from './rules';

/* ---------- pembangkit kombinasi cepat (tanpa menguji 1287 subset) ---------- */

function subsets<T>(a: T[], k: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, cur: T[]) => {
    if (cur.length === k) { out.push([...cur]); return; }
    for (let i = start; i < a.length; i++) { cur.push(a[i]); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return out;
}

/** Sama dengan generateCombos, tetapi jauh lebih cepat dan bisa dibatasi per ukuran. */
export function fastCombos(hand: Card[], rules: Rules, size?: 1 | 2 | 3 | 5): Combo[] {
  const out: Combo[] = [];
  const want = (n: number) => size === undefined || size === n;
  const push = (cs: Card[]) => { const c = evaluateCombo(cs, rules); if (c) out.push(c); };
  const groups = new Map<number, Card[]>();
  for (const c of hand) { const k = rankIdx(c); (groups.get(k) ?? groups.set(k, []).get(k)!).push(c); }

  if (want(1)) hand.forEach((c) => push([c]));
  if (want(2)) for (const g of groups.values()) if (g.length >= 2) subsets(g, 2).forEach(push);
  if (want(3) && rules.allowTriple) for (const g of groups.values()) if (g.length >= 3) subsets(g, 3).forEach(push);

  if (want(5)) {
    const seen = new Set<string>();
    const add = (cs: Card[]) => {
      const c = evaluateCombo(cs, rules);
      if (!c) return;
      const k = c.cards.map(cardId).join();
      if (!seen.has(k)) { seen.add(k); out.push(c); }
    };
    const gl = [...groups.entries()];
    for (const [, g] of gl) {
      if (g.length === 4) for (const o of hand) if (!g.includes(o)) add([...g, o]);
    }
    for (const [ka, g] of gl) {
      if (g.length < 3) continue;
      for (const t of subsets(g, 3)) for (const [kb, h] of gl) if (kb !== ka && h.length >= 2) for (const p of subsets(h, 2)) add([...t, ...p]);
    }
    for (const w of STRAIGHT_WINDOWS) {
      const cols = w.map((i) => groups.get(i));
      if (cols.some((c) => !c)) continue;
      let acc: Card[][] = [[]];
      for (const col of cols as Card[][]) acc = acc.flatMap((a) => col.map((c) => [...a, c]));
      acc.forEach(add);
    }
    const suits = new Map<string, Card[]>();
    for (const c of hand) (suits.get(c.s) ?? suits.set(c.s, []).get(c.s)!).push(c);
    for (const g of suits.values()) if (g.length >= 5) subsets(g, 5).forEach(add);
  }
  return out;
}

/* ---------- simulasi ringan ---------- */

interface Light { hands: Card[][]; turn: number; combo: Combo | null; by: number | null; passed: boolean[]; finished: number[]; over: boolean }

const alive = (l: Light, i: number) => !l.finished.includes(i);
function nextAlive(l: Light, from: number): number { let i = from; do i = (i + 1) % PLAYERS; while (!alive(l, i)); return i; }

function advance(l: Light): void {
  const contenders = [0, 1, 2, 3].filter((i) => alive(l, i) && i !== l.by && !l.passed[i]);
  if (l.combo && contenders.length === 0) {
    const by = l.by as number;
    l.turn = alive(l, by) ? by : nextAlive(l, by);
    l.combo = null; l.by = null; l.passed = [false, false, false, false];
    return;
  }
  let i = l.turn;
  do i = (i + 1) % PLAYERS; while (!alive(l, i) || l.passed[i]);
  l.turn = i;
}

function apply(l: Light, p: number, combo: Combo | null, rules: Rules): void {
  if (!combo) { l.passed[p] = true; advance(l); return; }
  l.hands[p] = l.hands[p].filter((h) => !combo.cards.some((c) => sameCard(c, h)));
  l.combo = combo; l.by = p;
  if (l.hands[p].length === 0) l.finished.push(p);
  const done = rules.scoring === 'first' ? l.finished.length >= 1 : l.finished.length >= PLAYERS - 1;
  if (done) { l.over = true; return; }
  advance(l);
}

/** Kebijakan permainan cepat untuk simulasi (dan acuan bot dasar). */
function policy(l: Light, p: number, rules: Rules, rng: () => number): Combo | null {
  const hand = l.hands[p];
  const cur = l.combo;
  const size = cur ? (cur.cards.length as 1 | 2 | 3 | 5) : undefined;
  let moves = fastCombos(hand, rules, size);
  if (cur) moves = moves.filter((m) => beats(m, cur, rules));
  if (moves.length === 0) return null;
  const fin = moves.find((m) => m.cards.length === hand.length);
  if (fin) return fin;

  const opp = [0, 1, 2, 3].filter((i) => i !== p && alive(l, i));
  const minOpp = Math.min(...opp.map((i) => l.hands[i].length), 99);
  const counts = new Map<string, number>();
  hand.forEach((c) => counts.set(c.r, (counts.get(c.r) ?? 0) + 1));

  if (!cur) {
    const score = (m: Combo): number => {
      const avg = m.cards.reduce((a, c) => a + rankIdx(c), 0) / m.cards.length / 12;
      const twos = m.cards.filter((c) => c.r === '2').length;
      const breaks = m.cards.length < 4 && m.cards.some((c) => (counts.get(c.r) ?? 0) > m.cards.length) ? 0.7 : 0;
      let s = m.cards.length * 1.2 - avg * 4 - twos * 3 - breaks + rng() * 0.05;
      if (minOpp <= 2) s += m.cards.length === 1 ? -2 : 1;
      if (minOpp <= 1 && m.cards.length === 1) s += avg * 8; // lawan tinggal 1 kartu: single terbesar dulu
      return s;
    };
    return moves.reduce((b, m) => (score(m) > score(b) ? m : b));
  }
  moves.sort((a, b) => compareCombos(a, b, rules));
  if (cur.cards.length === 1 && minOpp <= 1) return moves[moves.length - 1];
  if (minOpp <= 2) return moves[0];
  const spends = moves[0].cards.some((c) => c.r === '2' || c.r === 'A');
  if (spends && hand.length > 6 && rng() < 0.5) return null;
  return moves[0];
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bot dasar (heuristik) — dipakai sebagai pembanding dan kebijakan simulasi. */
export function basicMove(state: GameState, player: number, rng: () => number = Math.random): Card[] | null {
  const l: Light = { hands: state.hands, turn: player, combo: state.trick.combo, by: state.trick.by, passed: state.trick.passed, finished: state.finished, over: false };
  if (state.mustInclude) {
    const m = legalMoves(state, player);
    if (m.length === 0) return null;
    return m.reduce((b, x) => (x.cards.length > b.cards.length ? x : b)).cards;
  }
  return policy(l, player, state.rules, rng)?.cards ?? null;
}

/* ---------- bot kuat: determinisasi Monte Carlo ---------- */

export interface StrongOptions {
  /** batas waktu berpikir (ms) */
  thinkMs?: number;
  /** jumlah dunia sampel maksimum */
  worlds?: number;
  minWorlds?: number;
  seed?: number;
}

export function chooseStrongMove(state: GameState, player: number, opts: StrongOptions = {}): Card[] | null {
  const rules = state.rules;
  const moves = legalMoves(state, player);
  if (moves.length === 0) return null;
  const hand = state.hands[player];
  const fin = moves.find((m) => m.cards.length === hand.length);
  if (fin) return fin.cards;
  const canPass = !!state.trick.combo && !state.mustInclude;
  if (moves.length === 1 && !canPass) return moves[0].cards;

  // kandidat: batasi agar waktu terpakai pada langkah yang masuk akal
  let cands: (Combo | null)[] = moves;
  if (moves.length > 14) {
    if (state.trick.combo) {
      const s = [...moves].sort((a, b) => compareCombos(a, b, rules));
      cands = [...s.slice(0, 9), ...s.slice(-2)];
    } else {
      const byKind = new Map<string, Combo[]>();
      const s = [...moves].sort((a, b) => compareCombos(a, b, rules));
      for (const m of s) { const k = m.kind; (byKind.get(k) ?? byKind.set(k, []).get(k)!).push(m); }
      cands = [];
      for (const list of byKind.values()) cands.push(...list.slice(0, 3)); // terendah tiap jenis
    }
  }
  if (canPass) cands = [...cands, null];

  // kartu yang belum terlihat
  const known = new Set<string>(hand.map(cardId));
  state.plays.forEach((r) => r.combo?.cards.forEach((c) => known.add(cardId(c))));
  const unseen = newDeck().filter((c) => !known.has(cardId(c)));
  const opp = [0, 1, 2, 3].filter((i) => i !== player);

  const total = new Array(cands.length).fill(0);
  const t0 = Date.now();
  const limit = opts.thinkMs ?? 350;
  const maxW = opts.worlds ?? 400;
  const minW = opts.minWorlds ?? 6;
  let w = 0;
  const seedBase = (opts.seed ?? 12345) + state.plays.length * 977 + player * 131;
  for (; w < maxW; w++) {
    if (w >= minW && Date.now() - t0 > limit) break;
    const wr = mulberry(seedBase + w * 7919);
    const pool = shuffle([...unseen], wr);
    const hands: Card[][] = [[], [], [], []];
    let k = 0;
    for (const i of opp) { const n = state.hands[i].length; hands[i] = pool.slice(k, k + n); k += n; }
    for (let ci = 0; ci < cands.length; ci++) {
      const l: Light = {
        hands: hands.map((h, i) => (i === player ? [...hand] : [...h])),
        turn: player, combo: state.trick.combo, by: state.trick.by, passed: [...state.trick.passed], finished: [...state.finished], over: false,
      };
      const rr = mulberry(seedBase + w * 104729 + 1);
      apply(l, player, cands[ci], rules);
      let guard = 0;
      while (!l.over && guard++ < 300) apply(l, l.turn, policy(l, l.turn, rules, rr), rules);
      const res = settle({ rules, stake: 1, hands: l.hands, finished: l.finished } as unknown as GameState);
      total[ci] += res.deltas[player];
    }
  }
  let best = 0;
  for (let i = 1; i < cands.length; i++) if (total[i] > total[best]) best = i;
  return cands[best]?.cards ?? null;
}
