import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatChips } from '@rfp/shared';
import { CoinIcon } from './Icons';

/** Angka yang berhitung naik/turun mulus saat nilainya berubah. */
export function useCountUp(value: number, ms = 900, initial: number = value): number {
  const [shown, setShown] = useState(initial);
  const from = useRef(initial);
  const raf = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    if (a === value) return;
    const reduce = document.documentElement.classList.contains('reduce-motion');
    if (reduce) { from.current = value; setShown(value); return; }
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      const v = Math.round(a + (value - a) * e);
      from.current = v;
      setShown(v);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, ms]);
  return shown;
}

/** Saldo koin: berhitung mulus dan berkedip hijau/merah saat berubah. */
export function CoinPill({ balance, children }: { balance: number; children?: ReactNode }) {
  const shown = useCountUp(balance);
  const prev = useRef(balance);
  const [dir, setDir] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    if (balance === prev.current) return;
    setDir(balance > prev.current ? 'up' : 'down');
    prev.current = balance;
    const t = window.setTimeout(() => setDir(null), 1100);
    return () => window.clearTimeout(t);
  }, [balance]);
  return (
    <div className={`coin-pill ${dir ?? ''}`}>
      <CoinIcon />
      <b>{formatChips(shown)}</b>
      {children}
    </div>
  );
}
