import { haptic, setHapticsEnabled } from './haptics';
import { sfx } from './sound';

export type FxQuality = 'tinggi' | 'hemat';

type Evt =
  | { t: 'burst'; kind: 'coins' | 'confetti' | 'sparks'; x: number; y: number; count?: number; power?: number; color?: 'gold' | 'red' | 'white' }
  | { t: 'rain'; kind: 'coins' | 'confetti'; ms: number; density?: number }
  | { t: 'fly'; from: { x: number; y: number }; to: { x: number; y: number }; count: number }
  | { t: 'ambient'; on: boolean }
  | { t: 'shake'; power: number }
  | { t: 'flash'; color: string; alpha: number }
  | { t: 'quality'; budget: number }
  | { t: 'clear' };

type Listener = (e: Evt) => void;
const listeners = new Set<Listener>();
const emit = (e: Evt) => listeners.forEach((l) => l(e));

let budget = 1;
let still = false; // reduceMotion: tidak ada gerak/partikel (suara tetap sesuai pengaturan)
let ambientWanted = false;

/** Titik di dalam panggung (satuan u) dari sebuah elemen DOM, atau null bila tidak berada di panggung. */
export function stagePoint(el: Element): { x: number; y: number } | null {
  const stage = el.closest('.stage');
  if (!stage) return null;
  const s = stage.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const u = s.width / 100;
  return { x: (r.left + r.width / 2 - s.left) / u, y: (r.top + r.height / 2 - s.top) / u };
}

export const fx = {
  /** pengali jumlah partikel saat ini (0 = nonaktif) */
  budget(): number { return budget; },
  isStill(): boolean { return still; },
  isAmbient(): boolean { return ambientWanted && !still; },
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
  burst(kind: 'coins' | 'confetti' | 'sparks', x: number, y: number, o: { count?: number; power?: number; color?: 'gold' | 'red' | 'white' } = {}) {
    if (!still) emit({ t: 'burst', kind, x, y, ...o });
  },
  rain(kind: 'coins' | 'confetti', ms: number, density?: number) { if (!still) emit({ t: 'rain', kind, ms, density }); },
  /** Koin terbang melengkung dari satu titik panggung ke titik lain (mis. dari meja ke kantong saldo). */
  fly(from: { x: number; y: number }, to: { x: number; y: number }, count = 14) { if (!still) emit({ t: 'fly', from, to, count }); },
  ambient(on: boolean) { ambientWanted = on; emit({ t: 'ambient', on: on && !still }); },
  shake(power = 1) { if (!still) emit({ t: 'shake', power }); },
  flash(color = '#ffffff', alpha = 0.45) { if (!still) emit({ t: 'flash', color, alpha }); },
  clear() { emit({ t: 'clear' }); },
  configure(o: { quality: FxQuality; reduceMotion: boolean; sound: boolean; haptics: boolean }) {
    still = o.reduceMotion;
    sfx.enabled = o.sound;
    setHapticsEnabled(o.haptics);
    budget = o.reduceMotion ? 0 : o.quality === 'hemat' ? 0.4 : 1;
    emit({ t: 'quality', budget });
    emit({ t: 'ambient', on: ambientWanted && !still });
    if (still) emit({ t: 'clear' });
  },
};

/** Suara + getar sekaligus untuk peristiwa permainan. */
export const feel = {
  select() { sfx.play('select'); haptic('select'); },
  deselect() { sfx.play('deselect'); },
  play(mine: boolean) { sfx.play(mine ? 'play' : 'playSoft'); if (mine) haptic('play'); },
  pass(mine: boolean) { sfx.play('pass', mine ? 1 : 0.6); },
  error() { sfx.play('error'); haptic('error'); },
  bomb() { sfx.play('bomb'); haptic('bomb'); fx.shake(1); fx.flash('#ffb04a', 0.5); },
  combo() { sfx.play('combo'); },
  win() { sfx.play('win'); haptic('win'); },
  lose() { sfx.play('lose'); },
  claim() { sfx.play('claim'); haptic('claim'); },
  tick() { sfx.play('tick'); haptic('tick'); },
  jackpot() { sfx.play('jackpot'); haptic('jackpot'); fx.shake(0.8); fx.flash('#ffe27a', 0.5); },
  pop() { sfx.play('pop'); },
};
