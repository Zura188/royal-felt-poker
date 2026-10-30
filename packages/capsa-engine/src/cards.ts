import { RANKS, SUITS, type Card } from '@rfp/shared';
import type { Rules } from './rules';

/** Urutan angka Capsa Banting: 3 terendah ... A, 2 tertinggi. */
export const ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'] as const;
const IDX = new Map<string, number>(ORDER.map((r, i) => [r, i]));

export const rankIdx = (c: Card): number => IDX.get(c.r) as number;
export const cardId = (c: Card): string => c.r + c.s;
export const sameCard = (a: Card, b: Card): boolean => a.r === b.r && a.s === b.s;

/** 0 (terendah) .. 3 (tertinggi) menurut aturan suit. */
export const suitRank = (c: Card, rules: Rules): number => 3 - rules.suitOrder.indexOf(c.s);
export const strength = (c: Card, rules: Rules): number => rankIdx(c) * 4 + suitRank(c, rules);

export const sortCards = (cards: Card[], rules: Rules): Card[] =>
  [...cards].sort((a, b) => strength(a, rules) - strength(b, rules));

export function newDeck(): Card[] {
  return SUITS.flatMap((s) => RANKS.map((r, i) => ({ r, s, v: i + 2 })));
}

export function shuffle<T>(a: T[], rng: () => number = Math.random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const THREE_DIAMONDS: Card = { r: '3', s: '♦', v: 3 };
