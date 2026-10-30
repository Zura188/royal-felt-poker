import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { WHEEL, pickWheel } from '@rfp/shared';
import { defaultProfile, loadProfile, saveProfile, type Profile, type Settings } from './storage';
import { MISSIONS, rollDay, missionViews, todayKey } from './missions';
import { fx } from '../fx/bus';

export interface GameSummary {
  result: string;
  delta: number;
  won: boolean;
  rank: number;
  stake: number;
  /** statistik kombinasi yang dimainkan pemain di game ini */
  pairs: number;
  fiveCards: number;
  bombs: number;
}

interface Ctx {
  profile: Profile;
  recordGame: (s: GameSummary) => void;
  claimMission: (id: string) => number;
  /** Putar Roda Keberuntungan (sekali per hari). Hadiah diundi sekarang tapi baru masuk saldo lewat claimWheel(). null = sudah dipakai hari ini. */
  spinWheel: () => { index: number; prize: number } | null;
  /** Masukkan hadiah roda yang tertunda ke saldo; mengembalikan jumlahnya (0 bila tidak ada). */
  claimWheel: () => number;
  updateSettings: (s: Partial<Settings>) => void;
  resetAll: () => void;
}

const ProfileCtx = createContext<Ctx | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(() => rollDay(loadProfile()));
  const ref = useRef(profile);
  ref.current = profile;
  useEffect(() => saveProfile(profile), [profile]);
  const st = profile.settings;
  useEffect(() => {
    fx.configure({ quality: st.quality, reduceMotion: st.reduceMotion, sound: st.sound, haptics: st.haptics });
  }, [st.quality, st.reduceMotion, st.sound, st.haptics]);
  // ganti hari saat game dibiarkan terbuka
  useEffect(() => {
    const t = window.setInterval(() => setProfile((p) => rollDay(p)), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const recordGame = useCallback((s: GameSummary) => {
    setProfile((prev) => {
      const p = rollDay(prev);
      const delta = Math.max(s.delta, -p.balance); // saldo tidak boleh negatif
      const balance = p.balance + delta;
      const c = p.missions.counters;
      return {
        ...p,
        balance,
        peak: Math.max(p.peak, balance),
        games: p.games + 1,
        wins: p.wins + (s.won ? 1 : 0),
        lifeBombs: p.lifeBombs + s.bombs,
        bestWin: Math.max(p.bestWin, delta),
        streak: s.won ? p.streak + 1 : 0,
        bestStreak: Math.max(p.bestStreak, s.won ? p.streak + 1 : 0),
        missions: {
          ...p.missions,
          counters: {
            games: c.games + 1,
            wins: c.wins + (s.won ? 1 : 0),
            pairs: c.pairs + s.pairs,
            fiveCards: c.fiveCards + s.fiveCards,
            bombs: c.bombs + s.bombs,
          },
        },
        history: [
          { id: `${Date.now()}-${p.games}`, at: Date.now(), result: s.result, delta, won: s.won, rank: s.rank, stake: s.stake },
          ...p.history,
        ].slice(0, 50),
      };
    });
  }, []);

  const claimMission = useCallback((id: string): number => {
    const def = MISSIONS.find((m) => m.id === id);
    const v = missionViews(rollDay(ref.current)).find((m) => m.def.id === id);
    if (!def || !v || !v.done || v.claimed) return 0;
    setProfile((prev) => {
      const p = rollDay(prev);
      if (p.missions.claimed.includes(id)) return p;
      const balance = p.balance + def.reward;
      return { ...p, balance, peak: Math.max(p.peak, balance), missions: { ...p.missions, claimed: [...p.missions.claimed, id] } };
    });
    return def.reward;
  }, []);

  const spinWheel = useCallback((): { index: number; prize: number } | null => {
    const p = rollDay(ref.current);
    if (p.wheel.last === todayKey() || p.wheel.pending > 0) return null;
    const index = pickWheel();
    const prize = WHEEL[index].prize;
    // dicatat sekarang juga (hari terpakai + hadiah tertunda) agar menutup aplikasi di tengah putaran tidak menghilangkan hadiah
    setProfile((prev) => (prev.wheel.pending > 0 || prev.wheel.last === todayKey() ? prev : { ...rollDay(prev), wheel: { last: todayKey(), pending: prize } }));
    return { index, prize };
  }, []);

  const claimWheel = useCallback((): number => {
    const pend = ref.current.wheel.pending;
    if (pend <= 0) return 0;
    setProfile((prev) => {
      if (prev.wheel.pending <= 0) return prev;
      const balance = prev.balance + prev.wheel.pending;
      return { ...prev, balance, peak: Math.max(prev.peak, balance), wheel: { ...prev.wheel, pending: 0 } };
    });
    return pend;
  }, []);
  // hadiah roda yang tertunda dari sesi sebelumnya (aplikasi ditutup saat roda berputar) langsung dimasukkan
  useEffect(() => { claimWheel(); }, [claimWheel]);

  const updateSettings = useCallback(
    (s: Partial<Settings>) => setProfile((p) => ({ ...p, settings: { ...p.settings, ...s } })),
    [],
  );

  // reset saldo & statistik; aturan, taruhan, dan preferensi tampilan tetap
  // (putaran roda harian tidak ikut di-reset supaya tidak bisa diulang)
  const resetAll = useCallback(() => setProfile((p) => ({ ...defaultProfile(), settings: p.settings, wheel: p.wheel })), []);

  const value = useMemo(
    () => ({ profile, recordGame, claimMission, spinWheel, claimWheel, updateSettings, resetAll }),
    [profile, recordGame, claimMission, spinWheel, claimWheel, updateSettings, resetAll],
  );
  return <ProfileCtx.Provider value={value}>{children}</ProfileCtx.Provider>;
}

export function useProfile(): Ctx {
  const c = useContext(ProfileCtx);
  if (!c) throw new Error('useProfile harus di dalam ProfileProvider');
  return c;
}
