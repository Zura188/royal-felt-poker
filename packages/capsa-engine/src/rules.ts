import type { Suit } from '@rfp/shared';

/** Opsi aturan mengikuti layar "Pilih Aturan Permainan". Nilai bawaan = opsi yang aktif di layar itu. */
export type SuitOrder = readonly [Suit, Suit, Suit, Suit]; // dari TERTINGGI ke terendah
export type StraightOrder = 'A2345>23456>10JQKA' | '23456>10JQKA>A2345' | '10JQKA>23456>A2345';
export type PenaltyScheme = '10x2,13x3' | '8x2,10x3,13x4';

export interface Rules {
  suitOrder: SuitOrder;
  straightOrder: StraightOrder;
  allowTriple: boolean;
  allowFlush: boolean;
  /** pembanding antar flush: suit dulu atau angka dulu */
  flushRank: 'suit' | 'number';
  /** jika true, straight mengalahkan full house */
  straightBeatsFullHouse: boolean;
  /** siapa membuka game berikutnya: pemenang sebelumnya atau pemegang 3♦ */
  firstPlayer: 'winner' | 'lowest';
  /** first = game selesai saat ada yang habis; ranking = lanjut sampai 3 pemain habis */
  scoring: 'first' | 'ranking';
  penalty: PenaltyScheme;
}

export const SUIT_ORDERS: SuitOrder[] = [
  ['♠', '♥', '♣', '♦'],
  ['♠', '♥', '♦', '♣'],
  ['♦', '♥', '♠', '♣'],
];
export const STRAIGHT_ORDERS: StraightOrder[] = ['A2345>23456>10JQKA', '23456>10JQKA>A2345', '10JQKA>23456>A2345'];
export const PENALTY_SCHEMES: PenaltyScheme[] = ['10x2,13x3', '8x2,10x3,13x4'];

export const DEFAULT_RULES: Rules = {
  suitOrder: SUIT_ORDERS[0],
  straightOrder: STRAIGHT_ORDERS[0],
  allowTriple: true,
  allowFlush: true,
  flushRank: 'number',
  straightBeatsFullHouse: false,
  firstPlayer: 'winner',
  scoring: 'ranking',
  penalty: '10x2,13x3',
};

/** Taruhan dasar per kartu sisa (koin virtual) yang bisa dipilih per meja. Maksimal 1.000.000. */
export const STAKE_TIERS = [100, 500, 2_000, 10_000, 50_000, 100_000, 500_000, 1_000_000] as const;
export const MAX_STAKE = 1_000_000;
export const DEFAULT_STAKE = 500;
/** Pembayaran mode peringkat per posisi 1..4, dalam kelipatan taruhan (jumlah = 0). */
export const RANKING_UNITS = [8, 2, -4, -6] as const;

/** Pengali penalti menurut jumlah kartu yang tersisa. */
export function penaltyMultiplier(cardsLeft: number, scheme: PenaltyScheme): number {
  if (scheme === '10x2,13x3') return cardsLeft >= 13 ? 3 : cardsLeft >= 10 ? 2 : 1;
  return cardsLeft >= 13 ? 4 : cardsLeft >= 10 ? 3 : cardsLeft >= 8 ? 2 : 1;
}

export const penaltyFor = (cardsLeft: number, rules: Rules, stake: number): number =>
  stake * cardsLeft * penaltyMultiplier(cardsLeft, rules.penalty);

/** Kekalahan terbesar yang mungkin dalam satu game; saldo minimal untuk duduk di meja. */
export function maxLoss(rules: Rules, stake: number): number {
  return rules.scoring === 'ranking' ? 6 * stake : penaltyFor(13, rules, stake);
}

/** Gabungkan data tersimpan (mungkin lama/rusak) dengan nilai bawaan. */
export function sanitizeRules(input: Partial<Rules> | undefined): Rules {
  const r = { ...DEFAULT_RULES, ...(input ?? {}) } as Rules;
  const okSuit = SUIT_ORDERS.some((o) => o.join('') === r.suitOrder?.join?.(''));
  return {
    suitOrder: okSuit ? r.suitOrder : DEFAULT_RULES.suitOrder,
    straightOrder: STRAIGHT_ORDERS.includes(r.straightOrder) ? r.straightOrder : DEFAULT_RULES.straightOrder,
    allowTriple: !!r.allowTriple,
    allowFlush: !!r.allowFlush,
    flushRank: r.flushRank === 'suit' ? 'suit' : 'number',
    straightBeatsFullHouse: !!r.straightBeatsFullHouse,
    firstPlayer: r.firstPlayer === 'lowest' ? 'lowest' : 'winner',
    scoring: r.scoring === 'first' ? 'first' : 'ranking',
    penalty: PENALTY_SCHEMES.includes(r.penalty) ? r.penalty : DEFAULT_RULES.penalty,
  };
}
