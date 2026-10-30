import { useEffect, useRef } from 'react';
import idleSheet from '../assets/dealer.webp';
import cheerSheet from '../assets/dealer_cheer.webp';
import dealSheet from '../assets/dealer_deal.webp';

export type DealerMode = 'idle' | 'cheer' | 'deal';

// Lembar sprite hasil render 3D (frame 300x330, 4 kolom).
const FW = 300, FH = 330, COLS = 4;
const SHEETS: Record<DealerMode, { src: string; n: number; loopMs: number; once?: boolean }> = {
  idle: { src: idleSheet, n: 12, loopMs: 3600 },
  cheer: { src: cheerSheet, n: 8, loopMs: 900 },
  deal: { src: dealSheet, n: 8, loopMs: 1500, once: true },
};

const cache = new Map<string, HTMLImageElement>();
function load(src: string): HTMLImageElement {
  let img = cache.get(src);
  if (!img) { img = new Image(); img.src = src; cache.set(src, img); }
  return img;
}

interface Props {
  /** false = diam (satu frame), dipakai saat "kurangi animasi" aktif */
  animate?: boolean;
  mode?: DealerMode;
  /** dipanggil saat mode sekali-putar (deal) selesai */
  onDone?: () => void;
  onClick?: () => void;
  className?: string;
}

/** Bandar 3D: frame di-crossfade di kanvas agar gerak terlihat halus. Mode: idle, sorak, bagi kartu. */
export function Dealer({ animate = true, mode = 'idle', onDone, onClick, className = '' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const eff: DealerMode = animate ? mode : 'idle';
    const cfg = SHEETS[eff];
    const img = load(cfg.src);
    let raf = 0;
    let alive = true;
    let t0 = 0;
    let fired = false;
    const frame = (i: number, alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, (i % COLS) * FW, Math.floor(i / COLS) * FH, FW, FH, 0, 0, FW, FH);
    };
    const draw = (now: number) => {
      if (!alive) return;
      if (!t0) t0 = now;
      ctx.clearRect(0, 0, FW, FH);
      let pos: number;
      if (!animate) pos = 0;
      else if (cfg.once) {
        const t = Math.min(1, (now - t0) / cfg.loopMs);
        pos = t * (cfg.n - 1);
        if (t >= 1 && !fired) { fired = true; window.setTimeout(() => done.current?.(), 0); }
      } else pos = (((now - t0) % cfg.loopMs) / cfg.loopMs) * cfg.n;
      const i = Math.floor(pos) % cfg.n;
      const f = pos - Math.floor(pos);
      frame(i, 1);
      if (f > 0.001) frame(cfg.once ? Math.min(cfg.n - 1, i + 1) : (i + 1) % cfg.n, f);
      ctx.globalAlpha = 1;
      if (animate && !(cfg.once && fired)) raf = requestAnimationFrame(draw);
    };
    const start = () => { if (alive) { t0 = 0; draw(performance.now()); } };
    if (img.complete && img.naturalWidth) start(); else img.addEventListener('load', start, { once: true });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      img.removeEventListener('load', start);
    };
  }, [animate, mode]);

  return (
    <canvas
      ref={ref}
      width={FW}
      height={FH}
      className={`dealer ${onClick ? 'tappable' : ''} ${className}`}
      role="img"
      aria-label="Bandar"
      onClick={onClick}
    />
  );
}
