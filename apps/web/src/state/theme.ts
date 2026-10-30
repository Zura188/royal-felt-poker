import { STAKE_TIERS } from '@rfp/capsa-engine';
import type { FeltTheme } from './storage';

/** Nama tingkat meja, urut sama dengan STAKE_TIERS. */
export const TIER_NAMES = ['Pemula', 'Reguler', 'Tinggi', 'Elit', 'Sultan', 'Konglomerat', 'Raja', 'Legenda'] as const;

export const tierIndex = (stake: number): number => Math.max(0, (STAKE_TIERS as readonly number[]).indexOf(stake));

export type Felt = Exclude<FeltTheme, 'auto'>;

/** 'auto': warna kain mengikuti tingkat taruhan (makin tinggi makin "mahal"). */
export function resolveFelt(pref: FeltTheme, stake: number): Felt {
  if (pref !== 'auto') return pref;
  const i = tierIndex(stake);
  return i >= 7 ? 'hitam' : i >= 6 ? 'merah' : i >= 4 ? 'biru' : 'hijau';
}

/** 0 = meja biasa, 1 = meja tinggi (100K ke atas: bola lampu), 2 = meja tertinggi (1 juta: sorot lampu + mahkota). */
export function hiRoller(stake: number): 0 | 1 | 2 {
  const i = tierIndex(stake);
  return i >= 7 ? 2 : i >= 5 ? 1 : 0;
}

export const FELT_LABEL: Record<Felt, string> = { hijau: 'Hijau', biru: 'Biru', merah: 'Merah', hitam: 'Hitam', ungu: 'Ungu' };
export const BACK_LABEL: Record<'biru' | 'merah' | 'emas' | 'hitam', string> = { biru: 'Biru', merah: 'Merah', emas: 'Emas', hitam: 'Hitam' };
