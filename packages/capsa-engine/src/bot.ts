import type { Card } from '@rfp/shared';
import { rankIdx } from './cards';
import { compareCombos, generateCombos, type Combo } from './combos';
import { legalMoves, PLAYERS, type GameState } from './game';

const isHigh = (c: Card) => c.r === '2';

/**
 * Keputusan bot. Hanya memakai tangan bot sendiri dan informasi publik
 * (jumlah kartu lawan, kombinasi di meja). Mengembalikan kartu yang dimainkan, atau null untuk pass.
 */
export function chooseMove(state: GameState, player: number, rng: () => number = Math.random): Card[] | null {
  const hand = state.hands[player];
  const rules = state.rules;
  const moves = legalMoves(state, player);
  if (moves.length === 0) return null;

  // Bisa habis sekaligus? Langsung mainkan.
  const finisher = moves.find((m) => m.cards.length === hand.length);
  if (finisher) return finisher.cards;

  const opp = [0, 1, 2, 3].filter((i) => i !== player && !state.finished.includes(i));
  const minOpp = Math.min(...opp.map((i) => state.hands[i].length), 99);
  const counts = new Map<string, number>();
  hand.forEach((c) => counts.set(c.r, (counts.get(c.r) ?? 0) + 1));

  const cur = state.trick.combo;
  if (!cur) {
    // Membuka putaran: buang kartu rendah dalam kombinasi besar, simpan 2 dan pasangan.
    const score = (m: Combo): number => {
      const avg = m.cards.reduce((a, c) => a + rankIdx(c), 0) / m.cards.length / 12;
      const twos = m.cards.filter(isHigh).length;
      const breaks = m.cards.length < 4 && m.cards.some((c) => (counts.get(c.r) ?? 0) > m.cards.length) ? 0.7 : 0;
      let s = m.cards.length * 1.2 - avg * 4 - twos * 3 - breaks + rng() * 0.05;
      if (minOpp <= 2) s += m.cards.length === 1 ? -2 : 1;
      return s;
    };
    return moves.reduce((best, m) => (score(m) > score(best) ? m : best)).cards;
  }

  const sorted = [...moves].sort((a, b) => compareCombos(a, b, rules));
  // Lawan hampir habis dan meja single: tahan dengan kartu tertinggi.
  if (cur.cards.length === 1 && minOpp <= 1) return sorted[sorted.length - 1].cards;
  if (minOpp <= 2) return sorted[0].cards;

  const lowest = sorted[0];
  const spendsPower = lowest.cards.some((c) => isHigh(c) || c.r === 'A');
  if (spendsPower && hand.length > 6 && rng() < 0.5) return null;
  return lowest.cards;
}

export { PLAYERS, generateCombos };
