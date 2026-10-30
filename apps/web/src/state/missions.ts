import type { Profile } from './storage';

/** Hitungan harian yang dipakai misi. */
export interface Counters {
  games: number;
  wins: number;
  pairs: number;
  fiveCards: number;
  bombs: number;
}
export const emptyCounters = (): Counters => ({ games: 0, wins: 0, pairs: 0, fiveCards: 0, bombs: 0 });

export interface MissionDef {
  id: string;
  kind: 'daily' | 'life';
  title: string;
  desc: string;
  target: number;
  reward: number;
  /** sumber progres */
  stat: keyof Counters | 'login' | 'peak' | 'lifeWins' | 'lifeBombs';
}

export const MISSIONS: MissionDef[] = [
  { id: 'd_login', kind: 'daily', title: 'Bonus Harian', desc: 'Buka game hari ini', target: 1, reward: 100_000, stat: 'login' },
  { id: 'd_play3', kind: 'daily', title: 'Pemain Setia', desc: 'Mainkan 3 game', target: 3, reward: 150_000, stat: 'games' },
  { id: 'd_win2', kind: 'daily', title: 'Juara Hari Ini', desc: 'Menangkan 2 game (peringkat 1)', target: 2, reward: 300_000, stat: 'wins' },
  { id: 'd_pair8', kind: 'daily', title: 'Kolektor Pasangan', desc: 'Mainkan 8 pair', target: 8, reward: 150_000, stat: 'pairs' },
  { id: 'd_five3', kind: 'daily', title: 'Tangan Besar', desc: 'Mainkan 3 kombinasi 5 kartu', target: 3, reward: 200_000, stat: 'fiveCards' },
  { id: 'd_bomb1', kind: 'daily', title: 'Bom!', desc: 'Mainkan Four of a Kind atau Straight Flush', target: 1, reward: 500_000, stat: 'bombs' },
  { id: 'l_win10', kind: 'life', title: 'Juara Meja', desc: 'Menangkan 10 game', target: 10, reward: 400_000, stat: 'lifeWins' },
  { id: 'l_bomb5', kind: 'life', title: 'Ahli Bom', desc: 'Mainkan 5 bom (seumur hidup)', target: 5, reward: 600_000, stat: 'lifeBombs' },
  { id: 'l_win50', kind: 'life', title: 'Raja Meja', desc: 'Menangkan 50 game', target: 50, reward: 1_000_000, stat: 'lifeWins' },
  { id: 'l_rich', kind: 'life', title: 'Orang Kaya', desc: 'Capai saldo 250.000 koin', target: 250_000, reward: 750_000, stat: 'peak' },
];

export const todayKey = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface MissionState {
  day: string;
  counters: Counters;
  /** id misi yang hadiahnya sudah diambil (harian: hanya hari ini) */
  claimed: string[];
}

export const freshMissionState = (day = todayKey()): MissionState => ({ day, counters: emptyCounters(), claimed: [] });

/** Reset bagian harian bila hari sudah berganti; misi seumur hidup tetap. */
export function rollDay(p: Profile, day = todayKey()): Profile {
  if (p.missions.day === day) return p;
  const lifeClaimed = p.missions.claimed.filter((id) => id.startsWith('l_'));
  return { ...p, missions: { day, counters: emptyCounters(), claimed: lifeClaimed } };
}

export function progressOf(p: Profile, m: MissionDef): number {
  const c = p.missions.counters;
  switch (m.stat) {
    case 'login': return 1;
    case 'peak': return Math.min(p.peak, m.target);
    case 'lifeWins': return Math.min(p.wins, m.target);
    case 'lifeBombs': return Math.min(p.lifeBombs, m.target);
    default: return Math.min(c[m.stat], m.target);
  }
}

export interface MissionView {
  def: MissionDef;
  progress: number;
  done: boolean;
  claimed: boolean;
}

export function missionViews(p: Profile): MissionView[] {
  return MISSIONS.map((def) => {
    const progress = progressOf(p, def);
    return { def, progress, done: progress >= def.target, claimed: p.missions.claimed.includes(def.id) };
  });
}

export const claimableCount = (p: Profile): number => missionViews(p).filter((m) => m.done && !m.claimed).length;
