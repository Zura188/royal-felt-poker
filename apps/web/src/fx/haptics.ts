export type HapticKind = 'tap' | 'select' | 'play' | 'bomb' | 'win' | 'error' | 'claim' | 'tick' | 'jackpot';

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 6,
  select: 8,
  play: 16,
  bomb: [40, 30, 70],
  win: [30, 40, 30, 40, 90],
  error: [18, 30, 18],
  claim: [20, 30, 20, 30, 50],
  tick: 5,
  jackpot: [30, 30, 30, 30, 30, 30, 120],
};

let enabled = true;
export const setHapticsEnabled = (v: boolean) => { enabled = v; };

/** Getar singkat (Android/Chrome; diabaikan di perangkat yang tidak mendukung). */
export function haptic(kind: HapticKind): void {
  if (!enabled) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(PATTERNS[kind]);
  } catch { /* abaikan */ }
}
