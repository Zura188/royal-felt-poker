import type { Card } from '@rfp/shared';
import { RANKS, SUITS } from '@rfp/shared';

/** "3♦ 4♣ 10♠" -> kartu */
export function cards(text: string): Card[] {
  return text.trim().split(/\s+/).map((t) => {
    const s = t.slice(-1);
    const r = t.slice(0, -1);
    if (!(SUITS as readonly string[]).includes(s) || !(RANKS as readonly string[]).includes(r)) throw new Error('kartu salah: ' + t);
    return { r, s, v: RANKS.indexOf(r as never) + 2 } as Card;
  });
}

/** RNG deterministik (mulberry32) */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
