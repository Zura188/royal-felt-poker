/**
 * Geometri tangan pemain pada panggung 100 x 56,25 (satuan u). Dipakai TableScreen dan CSS (.hand).
 * Kartu diposisikan mutlak: tiap kartu punya --x/--y/--rot sendiri sehingga saat jumlah kartu berubah
 * (kartu dimainkan, urutan diganti) kartu meluncur mulus ke tempat barunya, bukan melompat.
 */
export const CARD_W = 9.2;
export const CARD_H = CARD_W * 1.4;
/** Pojok kiri-atas area tangan dan lebarnya. Kartu paling kiri/kanan menempel pada tepi area ini. */
export const HAND_X = 2.4;
export const HAND_W = 83.6;
export const HAND_Y = 41.1;
/** Jarak maksimal antar kartu: tangan yang tinggal sedikit tidak melebar terlalu jauh. */
export const MAX_STEP = CARD_W * 0.82;
/** Kelengkungan kipas: kartu tepi lebih rendah (u per kuadrat jarak dari tengah). */
export const ARCH = 0.05;
/** Lebar kartu di meja (kombinasi yang sedang dimainkan). */
export const MID_W = 6.8;

export interface Slot {
  /** pojok kiri-atas relatif ke area tangan (u) */
  x: number;
  y: number;
  /** kemiringan (derajat), searah lengkung kipas */
  rot: number;
}

export function handLayout(n: number): Slot[] {
  if (n <= 0) return [];
  const step = n === 1 ? 0 : Math.min(MAX_STEP, (HAND_W - CARD_W) / (n - 1));
  const mid = (n - 1) / 2;
  const left = (HAND_W - (CARD_W + step * (n - 1))) / 2;
  return Array.from({ length: n }, (_, i) => {
    const off = i - mid;
    const slope = step > 0 ? (2 * ARCH * off) / step : 0;
    return { x: left + i * step, y: ARCH * off * off, rot: (Math.atan(slope) * 180) / Math.PI };
  });
}
