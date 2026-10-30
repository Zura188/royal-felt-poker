import { STARTING_BALANCE } from '@rfp/shared';
import { DEFAULT_RULES, DEFAULT_STAKE, STAKE_TIERS, sanitizeRules, type Rules } from '@rfp/capsa-engine';
import { emptyCounters, freshMissionState, todayKey, type Counters, type MissionState } from './missions';

export interface HistoryEntry {
  id: string;
  at: number;
  result: string;
  /** perubahan saldo pada game ini */
  delta: number;
  won: boolean;
  /** peringkat akhir 1..4, 0 = keluar di tengah game */
  rank: number;
  stake: number;
}

/** Warna kain meja. 'auto' = mengikuti tingkat taruhan. */
export type FeltTheme = 'auto' | 'hijau' | 'biru' | 'merah' | 'hitam' | 'ungu';
export const FELTS: readonly FeltTheme[] = ['auto', 'hijau', 'biru', 'merah', 'hitam', 'ungu'];
/** Motif punggung kartu. */
export type CardBack = 'biru' | 'merah' | 'emas' | 'hitam';
export const BACKS: readonly CardBack[] = ['biru', 'merah', 'emas', 'hitam'];
/** Kecepatan giliran bot (offline). */
export type Speed = 'normal' | 'cepat';

export interface Settings {
  reduceMotion: boolean;
  /** efek suara */
  sound: boolean;
  /** getar (HP) */
  haptics: boolean;
  /** 'hemat' = efek partikel dikurangi untuk HP kelas bawah */
  quality: 'tinggi' | 'hemat';
  rules: Rules;
  /** taruhan dasar terakhir yang dipilih */
  stake: number;
  felt: FeltTheme;
  cardBack: CardBack;
  speed: Speed;
}

/** Roda Keberuntungan harian: `last` = hari putaran terakhir, `pending` = hadiah yang sudah diundi tapi belum masuk saldo. */
export interface WheelState { last: string; pending: number }

export interface Profile {
  balance: number;
  games: number;
  wins: number;
  /** saldo tertinggi yang pernah dicapai */
  peak: number;
  lifeBombs: number;
  /** kemenangan terbesar dalam satu game */
  bestWin: number;
  /** menang beruntun saat ini dan rekor */
  streak: number;
  bestStreak: number;
  history: HistoryEntry[];
  missions: MissionState;
  wheel: WheelState;
  settings: Settings;
}

// Data ini HANYA saldo latihan offline. Saldo online kelak disimpan di server.
const KEY = 'royal-felt:capsa-offline-profile:v3';

/** Pengguna yang menyalakan "kurangi gerakan" di sistemnya mendapat bawaan yang sama di sini. */
const systemReducedMotion = (): boolean => {
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export const defaultProfile = (): Profile => ({
  balance: STARTING_BALANCE,
  games: 0,
  wins: 0,
  peak: STARTING_BALANCE,
  lifeBombs: 0,
  bestWin: 0,
  streak: 0,
  bestStreak: 0,
  history: [],
  missions: freshMissionState(),
  wheel: { last: '', pending: 0 },
  settings: {
    reduceMotion: systemReducedMotion(), sound: true, haptics: true, quality: 'tinggi', rules: DEFAULT_RULES, stake: DEFAULT_STAKE,
    felt: 'auto', cardBack: 'biru', speed: 'normal',
  },
});

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProfile();
    const p = JSON.parse(raw) as Partial<Profile>;
    const d = defaultProfile();
    const balance = Math.max(0, Math.floor(num(p.balance, d.balance)));
    const m = p.missions as Partial<MissionState> | undefined;
    const c = (m?.counters ?? {}) as Partial<Counters>;
    const base = emptyCounters();
    const counters = Object.fromEntries(Object.keys(base).map((k) => [k, num((c as Record<string, unknown>)[k], 0)])) as unknown as Counters;
    const stake = num(p.settings?.stake, d.settings.stake);
    return {
      balance,
      games: num(p.games, 0),
      wins: num(p.wins, 0),
      peak: Math.max(balance, num(p.peak, balance)),
      lifeBombs: num(p.lifeBombs, 0),
      bestWin: Math.max(0, Math.floor(num(p.bestWin, 0))),
      streak: Math.max(0, Math.floor(num(p.streak, 0))),
      bestStreak: Math.max(0, Math.floor(num(p.bestStreak, 0))),
      history: Array.isArray(p.history) ? p.history.slice(0, 50) : [],
      missions: {
        day: typeof m?.day === 'string' ? m.day : todayKey(),
        counters,
        claimed: Array.isArray(m?.claimed) ? m!.claimed!.filter((x) => typeof x === 'string') : [],
      },
      wheel: {
        last: typeof p.wheel?.last === 'string' ? p.wheel.last : '',
        pending: Math.max(0, Math.floor(num(p.wheel?.pending, 0))),
      },
      settings: {
        reduceMotion: typeof p.settings?.reduceMotion === 'boolean' ? p.settings.reduceMotion : d.settings.reduceMotion,
        sound: p.settings?.sound !== false,
        haptics: p.settings?.haptics !== false,
        quality: p.settings?.quality === 'hemat' ? 'hemat' : 'tinggi',
        rules: sanitizeRules(p.settings?.rules),
        stake: (STAKE_TIERS as readonly number[]).includes(stake) ? stake : DEFAULT_STAKE,
        felt: FELTS.includes(p.settings?.felt as FeltTheme) ? (p.settings!.felt as FeltTheme) : 'auto',
        cardBack: BACKS.includes(p.settings?.cardBack as CardBack) ? (p.settings!.cardBack as CardBack) : 'biru',
        speed: p.settings?.speed === 'cepat' ? 'cepat' : 'normal',
      },
    };
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* penyimpanan tidak tersedia (mode privat, dll.) — game tetap berjalan */
  }
}
