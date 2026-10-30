import type { Card } from '@rfp/shared';
import { newDeck, sameCard, shuffle, sortCards, THREE_DIAMONDS } from './cards';
import { beats, evaluateCombo, generateCombos, type Combo } from './combos';
import { DEFAULT_STAKE, maxLoss, penaltyFor, RANKING_UNITS, type Rules } from './rules';

export const PLAYERS = 4;

export interface Trick {
  combo: Combo | null;
  by: number | null;
  passed: boolean[];
}

export interface PlayRecord {
  player: number;
  /** null = pass */
  combo: Combo | null;
}

export interface GameResult {
  /** urutan pemain dari peringkat 1 ke 4 */
  order: number[];
  cardsLeft: number[];
  /** perubahan koin per pemain (jumlah = 0) */
  deltas: number[];
}

export interface GameState {
  rules: Rules;
  /** taruhan dasar per kartu sisa */
  stake: number;
  hands: Card[][];
  turn: number;
  trick: Trick;
  /** pemain yang sudah menghabiskan kartu, berurutan */
  finished: number[];
  phase: 'playing' | 'over';
  /** kartu yang wajib ada pada permainan pertama (3♦), null jika bebas */
  mustInclude: Card | null;
  starter: number;
  plays: PlayRecord[];
  result: GameResult | null;
}

export interface NewGameOptions {
  stake?: number;
  previousWinner?: number | null;
  rng?: () => number;
}

export function newGame(rules: Rules, opts: NewGameOptions = {}): GameState {
  const deck = shuffle(newDeck(), opts.rng);
  const hands: Card[][] = [0, 1, 2, 3].map((i) => sortCards(deck.slice(i * 13, i * 13 + 13), rules));
  const holder = hands.findIndex((h) => h.some((c) => sameCard(c, THREE_DIAMONDS)));
  const useWinner = rules.firstPlayer === 'winner' && opts.previousWinner != null;
  const starter = useWinner ? (opts.previousWinner as number) : holder;
  return {
    rules,
    stake: opts.stake ?? DEFAULT_STAKE,
    hands,
    turn: starter,
    trick: { combo: null, by: null, passed: [false, false, false, false] },
    finished: [],
    phase: 'playing',
    mustInclude: useWinner ? null : THREE_DIAMONDS,
    starter,
    plays: [],
    result: null,
  };
}

type Checked = { ok: true; combo: Combo } | { ok: false; error: string };

export function validatePlay(state: GameState, player: number, cards: Card[]): Checked {
  if (state.phase !== 'playing') return { ok: false, error: 'Game sudah selesai.' };
  if (state.turn !== player) return { ok: false, error: 'Bukan giliranmu.' };
  if (cards.length === 0) return { ok: false, error: 'Pilih kartu dulu.' };
  const hand = state.hands[player];
  const seen = new Set<string>();
  for (const c of cards) {
    const k = c.r + c.s;
    if (seen.has(k) || !hand.some((h) => sameCard(h, c))) return { ok: false, error: 'Kartu tidak ada di tanganmu.' };
    seen.add(k);
  }
  const combo = evaluateCombo(cards, state.rules);
  if (!combo) return { ok: false, error: 'Kombinasi tidak sah menurut aturan.' };
  if (state.mustInclude && !cards.some((c) => sameCard(c, state.mustInclude as Card))) {
    return { ok: false, error: 'Giliran pertama wajib memakai 3♦.' };
  }
  const cur = state.trick.combo;
  if (cur) {
    if (combo.cards.length !== cur.cards.length) return { ok: false, error: 'Harus jumlah kartu yang sama.' };
    if (!beats(combo, cur, state.rules)) return { ok: false, error: 'Kombinasi harus lebih tinggi.' };
  }
  return { ok: true, combo };
}

export function legalMoves(state: GameState, player: number): Combo[] {
  if (state.phase !== 'playing' || state.turn !== player) return [];
  return generateCombos(state.hands[player], state.rules).filter((c) => validatePlay(state, player, c.cards).ok);
}

const alive = (s: GameState, i: number) => !s.finished.includes(i);

function nextAlive(s: GameState, from: number): number {
  let i = from;
  do i = (i + 1) % PLAYERS;
  while (!alive(s, i));
  return i;
}

function advance(s: GameState): void {
  const contenders = [0, 1, 2, 3].filter((i) => alive(s, i) && i !== s.trick.by && !s.trick.passed[i]);
  if (s.trick.combo && contenders.length === 0) {
    const by = s.trick.by as number;
    const lead = alive(s, by) ? by : nextAlive(s, by);
    s.trick = { combo: null, by: null, passed: [false, false, false, false] };
    s.turn = lead;
    return;
  }
  let i = s.turn;
  do i = (i + 1) % PLAYERS;
  while (!alive(s, i) || s.trick.passed[i]);
  s.turn = i;
}

export function playCards(prev: GameState, player: number, cards: Card[]): { state: GameState; error?: string } {
  const check = validatePlay(prev, player, cards);
  if (!check.ok) return { state: prev, error: check.error };
  const s = structuredClone(prev) as GameState;
  s.hands[player] = s.hands[player].filter((h) => !cards.some((c) => sameCard(c, h)));
  s.trick.combo = check.combo;
  s.trick.by = player;
  s.mustInclude = null;
  s.plays.push({ player, combo: check.combo });
  if (s.hands[player].length === 0) s.finished.push(player);

  const done = s.rules.scoring === 'first' ? s.finished.length >= 1 : s.finished.length >= PLAYERS - 1;
  if (done) {
    s.phase = 'over';
    s.result = settle(s);
    return { state: s };
  }
  advance(s);
  return { state: s };
}

export function pass(prev: GameState, player: number): { state: GameState; error?: string } {
  if (prev.phase !== 'playing') return { state: prev, error: 'Game sudah selesai.' };
  if (prev.turn !== player) return { state: prev, error: 'Bukan giliranmu.' };
  if (!prev.trick.combo) return { state: prev, error: 'Kamu membuka putaran, tidak boleh pass.' };
  if (prev.mustInclude) return { state: prev, error: 'Giliran pertama wajib memakai 3♦.' };
  const s = structuredClone(prev) as GameState;
  s.trick.passed[player] = true;
  s.plays.push({ player, combo: null });
  advance(s);
  return { state: s };
}

/** Hitung hasil akhir dan perubahan koin. Dipanggil saat game selesai. */
export function settle(s: GameState): GameResult {
  const cardsLeft = s.hands.map((h) => h.length);
  const rest = [0, 1, 2, 3]
    .filter((i) => !s.finished.includes(i))
    .sort((a, b) => cardsLeft[a] - cardsLeft[b] || a - b);
  const order = [...s.finished, ...rest];
  const deltas = [0, 0, 0, 0];

  if (s.rules.scoring === 'ranking') {
    order.forEach((p, pos) => (deltas[p] = RANKING_UNITS[pos] * s.stake));
  } else {
    const winner = order[0];
    for (let i = 0; i < PLAYERS; i++) {
      if (i === winner) continue;
      const pay = penaltyFor(cardsLeft[i], s.rules, s.stake);
      deltas[i] -= pay;
      deltas[winner] += pay;
    }
  }
  return { order, cardsLeft, deltas };
}

/** Penalti untuk pemain yang meninggalkan meja di tengah game; tidak pernah melebihi "kalah maks." meja itu. */
export const abandonPenalty = (s: GameState, player: number): number =>
  Math.min(penaltyFor(s.hands[player].length, s.rules, s.stake), maxLoss(s.rules, s.stake));

export interface PlayStats {
  plays: number;
  pairs: number;
  triples: number;
  fiveCards: number;
  /** four of a kind atau straight flush */
  bombs: number;
}

/** Statistik kombinasi yang sudah dimainkan satu pemain (untuk misi). */
export function playStats(s: GameState, player: number): PlayStats {
  const st: PlayStats = { plays: 0, pairs: 0, triples: 0, fiveCards: 0, bombs: 0 };
  for (const r of s.plays) {
    if (r.player !== player || !r.combo) continue;
    st.plays++;
    if (r.combo.kind === 'pair') st.pairs++;
    if (r.combo.kind === 'triple') st.triples++;
    if (r.combo.cards.length === 5) st.fiveCards++;
    if (r.combo.kind === 'quad' || r.combo.kind === 'straightflush') st.bombs++;
  }
  return st;
}
