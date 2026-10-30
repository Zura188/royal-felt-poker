import type { Card } from '@rfp/shared';
import { rankIdx, sortCards, strength, suitRank } from './cards';
import type { Rules } from './rules';

export type Kind = 'single' | 'pair' | 'triple' | 'straight' | 'flush' | 'fullhouse' | 'quad' | 'straightflush';

export interface Combo {
  kind: Kind;
  /** terurut dari terendah ke tertinggi */
  cards: Card[];
  /** kunci pembanding dalam kategori yang sama (leksikografis) */
  key: number[];
}

export const KIND_LABEL: Record<Kind, string> = {
  single: 'Single',
  pair: 'Pair',
  triple: 'Three of a Kind',
  straight: 'Straight',
  flush: 'Flush',
  fullhouse: 'Full House',
  quad: 'Four of a Kind',
  straightflush: 'Straight Flush',
};

type StraightName = 'A2345' | '23456' | '10JQKA' | 'normal';
interface Window { name: StraightName; idx: number[]; high: number }

// indeks ORDER: 3=0 ... K=10, A=11, 2=12
const RAW_WINDOWS: Window[] = [
  ...[0, 1, 2, 3, 4, 5, 6].map((s): Window => ({ name: 'normal', idx: [s, s + 1, s + 2, s + 3, s + 4], high: s + 4 })),
  { name: '10JQKA', idx: [7, 8, 9, 10, 11], high: 11 },
  { name: 'A2345', idx: [0, 1, 2, 11, 12], high: 2 },
  { name: '23456', idx: [0, 1, 2, 3, 12], high: 3 },
];
const WINDOWS: Window[] = RAW_WINDOWS.map((w) => ({ ...w, idx: [...w.idx].sort((a, b) => a - b) }));

export const STRAIGHT_WINDOWS: number[][] = WINDOWS.map((w) => w.idx);

function straightScore(w: Window, rules: Rules): number {
  if (w.name === 'normal') return w.high; // 4..10, selalu di bawah tiga straight khusus
  const order = rules.straightOrder.split('>');
  return 103 - order.indexOf(w.name);
}

function matchWindow(sortedIdx: number[]): Window | null {
  return WINDOWS.find((w) => w.idx.every((v, i) => v === sortedIdx[i])) ?? null;
}

const FIVE_ORDER: Record<string, number> = { straight: 1, flush: 2, fullhouse: 3, quad: 4, straightflush: 5 };
function categoryOrder(kind: Kind, rules: Rules): number {
  if (kind === 'straight' && rules.straightBeatsFullHouse) return 3.5;
  return FIVE_ORDER[kind] ?? 0;
}

/** Urutan kombinasi 5 kartu dari terlemah ke terkuat menurut aturan (untuk panel bantuan). */
export function fiveCardLadder(rules: Rules): Kind[] {
  const kinds: Kind[] = ['straight', 'flush', 'fullhouse', 'quad', 'straightflush'];
  return kinds.filter((k) => k !== 'flush' || rules.allowFlush).sort((a, b) => categoryOrder(a, rules) - categoryOrder(b, rules));
}

/** Mengenali kombinasi yang sah menurut aturan, atau null. */
export function evaluateCombo(input: Card[], rules: Rules): Combo | null {
  const cards = sortCards(input, rules);
  const n = cards.length;
  if (new Set(cards.map((c) => c.s + c.r)).size !== n) return null; // kartu ganda
  if (n === 1) return { kind: 'single', cards, key: [strength(cards[0], rules)] };
  if (n === 2) {
    if (cards[0].r !== cards[1].r) return null;
    return { kind: 'pair', cards, key: [strength(cards[1], rules)] };
  }
  if (n === 3) {
    if (!rules.allowTriple) return null;
    if (!(cards[0].r === cards[1].r && cards[1].r === cards[2].r)) return null;
    return { kind: 'triple', cards, key: [rankIdx(cards[0])] };
  }
  if (n !== 5) return null;

  const idx = cards.map(rankIdx).sort((a, b) => a - b);
  const counts = new Map<number, number>();
  idx.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  const groups = [...counts.entries()].map(([v, c]) => ({ v, c })).sort((a, b) => b.c - a.c || b.v - a.v);
  const flush = cards.every((c) => c.s === cards[0].s);
  const win = groups.length === 5 ? matchWindow(idx) : null;

  if (win && flush) {
    const top = cards.find((c) => rankIdx(c) === win.high) as Card;
    return { kind: 'straightflush', cards, key: [straightScore(win, rules), suitRank(top, rules)] };
  }
  if (groups[0].c === 4) return { kind: 'quad', cards, key: [groups[0].v] };
  if (groups[0].c === 3 && groups[1]?.c === 2) return { kind: 'fullhouse', cards, key: [groups[0].v] };
  if (flush && rules.allowFlush) {
    const desc = [...idx].reverse();
    const s = suitRank(cards[0], rules);
    return { kind: 'flush', cards, key: rules.flushRank === 'suit' ? [s, ...desc] : [...desc, s] };
  }
  if (win) {
    const top = cards.find((c) => rankIdx(c) === win.high) as Card;
    return { kind: 'straight', cards, key: [straightScore(win, rules), suitRank(top, rules)] };
  }
  return null;
}

function lex(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** > 0 jika a lebih kuat dari b. Hanya bermakna untuk jumlah kartu yang sama. */
export function compareCombos(a: Combo, b: Combo, rules: Rules): number {
  if (a.cards.length === 5) {
    const d = categoryOrder(a.kind, rules) - categoryOrder(b.kind, rules);
    if (d !== 0) return d;
  }
  return lex(a.key, b.key);
}

export function beats(a: Combo, b: Combo, rules: Rules): boolean {
  return a.cards.length === b.cards.length && compareCombos(a, b, rules) > 0;
}

/** Semua kombinasi sah yang bisa dibentuk dari tangan. */
export function generateCombos(hand: Card[], rules: Rules): Combo[] {
  const out: Combo[] = [];
  const pick = (size: number, start: number, cur: Card[]) => {
    if (cur.length === size) {
      const c = evaluateCombo(cur, rules);
      if (c) out.push(c);
      return;
    }
    for (let i = start; i < hand.length; i++) {
      cur.push(hand[i]);
      pick(size, i + 1, cur);
      cur.pop();
    }
  };
  for (const size of [1, 2, 3, 5]) pick(size, 0, []);
  return out;
}
