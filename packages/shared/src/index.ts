export const SUITS = ['♠', '♥', '♦', '♣'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
export type Rank = (typeof RANKS)[number];

export interface Card {
  r: Rank;
  s: Suit;
  /** nilai poker 2..14 (A = 14); urutan Capsa Banting dihitung di capsa-engine */
  v: number;
}

export const STARTING_BALANCE = 100_000;

export const formatChips = (n: number): string =>
  Math.max(0, Math.floor(n)).toLocaleString('id-ID');

export const formatDelta = (n: number): string =>
  `${n >= 0 ? '+' : '−'}${formatChips(Math.abs(n))}`;

export const isRed = (c: Card): boolean => c.s === '♥' || c.s === '♦';

/** Label ringkas untuk chip taruhan: 100, 2K, 500K, 1JT. */
export const chipLabel = (n: number): string => {
  const v = Math.max(0, Math.floor(n));
  const f = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',');
  if (v >= 1_000_000) return `${f(v / 1_000_000)}JT`;
  if (v >= 1_000) return `${f(v / 1_000)}K`;
  return String(v);
};

/**
 * Obrolan cepat di meja. Yang dikirim lewat jaringan hanya indeksnya, jadi urutan ini
 * jangan diubah dan jangan dikurangi (hanya boleh ditambah di belakang).
 */
export const CHAT_LINES = ['Mantap!', 'Ayo gas!', 'Wah, parah!', 'Sabar dulu~', 'GG!', 'Santai bro', 'Hehehe', 'Duh, sial!'] as const;
/** Jeda minimal antar obrolan dari satu pemain (ms). */
export const CHAT_GAP_MS = 1500;

/** Roda Keberuntungan: satu putaran gratis per hari. Urutan = searah jarum jam dari atas. */
export interface WheelSlice { prize: number; weight: number }
export const WHEEL: readonly WheelSlice[] = [
  { prize: 10_000, weight: 26 },
  { prize: 100_000, weight: 14 },
  { prize: 25_000, weight: 22 },
  { prize: 250_000, weight: 6 },
  { prize: 50_000, weight: 18 },
  { prize: 500_000, weight: 3 },
  { prize: 150_000, weight: 10 },
  { prize: 1_000_000, weight: 1 },
];
export const WHEEL_SLICE_DEG = 360 / WHEEL.length;

/** Pilih irisan hadiah menurut bobot. `rng` mengembalikan [0, 1). */
export function pickWheel(rng: () => number = Math.random): number {
  const total = WHEEL.reduce((a, s) => a + s.weight, 0);
  let r = Math.min(Math.max(rng(), 0), 0.999999999) * total;
  for (let i = 0; i < WHEEL.length; i++) {
    r -= WHEEL[i].weight;
    if (r < 0) return i;
  }
  return WHEEL.length - 1;
}

/** Sudut putar akhir (derajat, searah jarum jam) agar irisan `index` berhenti di bawah penunjuk di atas. `jitter` -1..1 menggeser di dalam irisan. */
export function wheelAngle(index: number, turns = 6, jitter = 0): number {
  const half = WHEEL_SLICE_DEG / 2;
  const j = Math.max(-1, Math.min(1, jitter)) * half * 0.8;
  return turns * 360 - (index * WHEEL_SLICE_DEG + half + j);
}

/** Irisan yang berada di bawah penunjuk untuk sudut putar tertentu. */
export function wheelIndexAt(angle: number): number {
  const a = (((-angle) % 360) + 360) % 360;
  return Math.floor(a / WHEEL_SLICE_DEG) % WHEEL.length;
}
