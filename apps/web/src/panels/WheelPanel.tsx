import { useCallback, useEffect, useRef, useState } from 'react';
import { WHEEL, WHEEL_SLICE_DEG, chipLabel, formatChips, wheelAngle } from '@rfp/shared';
import { CoinPill } from '../components/CoinPill';
import { CoinIcon } from '../components/Icons';
import { fx, feel, stagePoint } from '../fx/bus';
import { haptic } from '../fx/haptics';
import { sfx } from '../fx/sound';
import { todayKey } from '../state/missions';
import { useProfile } from '../state/ProfileContext';
import { go } from '../state/router';

/** Warna irisan, urut sama dengan WHEEL (tetangga selalu beda warna). */
const COLORS = ['#3b6fd8', '#1f9d6a', '#7c4dd1', '#e07a1f', '#2aa5c8', '#d8404f', '#b5459a', '#f2c04a'];
/** Posisi diam: tengah irisan pertama tepat di bawah penunjuk. */
const REST = -WHEEL_SLICE_DEG / 2;
const R = 92;
const SPIN_MS = 5200;
const WIND_MS = 340;
const BACK_DEG = 14;
const BIG_PRIZE = 250_000;

const polar = (deg: number, r: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
};
const slicePath = (i: number): string => {
  const [x1, y1] = polar(i * WHEEL_SLICE_DEG, R);
  const [x2, y2] = polar((i + 1) * WHEEL_SLICE_DEG, R);
  return `M0 0L${x1.toFixed(2)} ${y1.toFixed(2)}A${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}Z`;
};

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3.6);
/** Awal putaran dipercepat halus (±250 ms) supaya tidak terasa "menyentak". */
const ramp = (x: number) => { const k = Math.min(1, x / 0.05); return k * k * (3 - 2 * k); };

/** Sudut roda (derajat) pada milidetik ke-t: tarik mundur sedikit, lepas, lalu melambat sampai berhenti di `target`. */
export function wheelAngleAt(t: number, target: number): number {
  const base = REST - BACK_DEG;
  if (t < WIND_MS) return REST - BACK_DEG * easeInOut(t / WIND_MS);
  const x = Math.min(1, (t - WIND_MS) / (SPIN_MS - WIND_MS));
  return base + (target - base) * easeOut(x) * ramp(x);
}

const untilTomorrow = (): string => {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  const m = Math.max(1, Math.ceil((d.getTime() - Date.now()) / 60_000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} jam ${m % 60} menit` : `${m} menit`;
};

type Phase = 'idle' | 'spinning' | 'done';

export function WheelPanel() {
  const { profile, spinWheel, claimWheel } = useProfile();
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<{ index: number; prize: number } | null>(null);
  const [, tickClock] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef<HTMLDivElement>(null);
  const ptrRef = useRef<HTMLElement>(null);
  const raf = useRef(0);
  const still = profile.settings.reduceMotion;
  const canSpin = profile.wheel.last !== todayKey() && profile.wheel.pending === 0;

  // hitung mundur ke putaran berikutnya
  useEffect(() => {
    if (canSpin) return;
    const t = window.setInterval(() => tickClock((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [canSpin]);

  // menutup panel di tengah putaran tidak boleh menghilangkan hadiah: hadiah sudah diundi, jadi langsung dimasukkan
  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    claimWheel();
  }, [claimWheel]);

  const apply = (deg: number) => { if (rotRef.current) rotRef.current.style.transform = `rotate(${deg.toFixed(3)}deg)`; };

  const flick = useCallback(() => {
    const el = ptrRef.current;
    if (!el || typeof el.animate !== 'function') return;
    el.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-28deg)', offset: 0.3 }, { transform: 'rotate(0deg)' }],
      { duration: 150, easing: 'ease-out' },
    );
  }, []);

  const finish = useCallback((r: { index: number; prize: number }) => {
    setPhase('done');
    claimWheel();
    const pt = boxRef.current ? stagePoint(boxRef.current) : null;
    const x = pt?.x ?? 50;
    const y = pt?.y ?? 28;
    if (r.prize >= BIG_PRIZE) {
      feel.jackpot();
      fx.burst('confetti', x, y - 6, { count: 46, power: 1.1 });
      fx.burst('coins', x, y, { count: 26, power: 1 });
      fx.rain('coins', 1800, 0.9);
    } else {
      feel.claim();
      fx.burst('coins', x, y, { count: r.prize >= 100_000 ? 22 : 14, power: 0.9 });
      fx.burst('sparks', x, y, { count: 12 });
    }
  }, [claimWheel]);

  const spin = () => {
    if (phase !== 'idle' || !canSpin) return;
    sfx.unlock();
    const r = spinWheel();
    if (!r) return;
    setResult(r);
    setPhase('spinning');
    const target = wheelAngle(r.index, 5 + Math.floor(Math.random() * 2), (Math.random() * 2 - 1) * 0.9);
    if (still) { apply(target); finish(r); return; }
    const t0 = performance.now();
    let lastK = Math.floor(REST / WHEEL_SLICE_DEG);
    let lastSnd = 0;
    let lastHap = 0;
    const loop = (now: number) => {
      const t = now - t0;
      const a = t >= SPIN_MS ? target : wheelAngleAt(t, target);
      apply(a);
      const k = Math.floor(a / WHEEL_SLICE_DEG);
      if (k !== lastK) {
        lastK = k;
        flick();
        if (now - lastSnd > 34) { lastSnd = now; sfx.play('tick', 0.8); }
        if (now - lastHap > 120) { lastHap = now; haptic('tick'); }
      }
      if (t >= SPIN_MS) { finish(r); return; }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  const won = phase === 'done' ? result : null;
  return (
    <div className="wheel-wrap">
      <div ref={boxRef} className={`wheel ${phase === 'spinning' ? 'spin' : ''} ${won ? 'done' : ''}`} role="img" aria-label="Roda hoki dengan hadiah dari 10 ribu sampai 1 juta koin">
        <div ref={rotRef} className="wheel-rot">
          <svg viewBox="-100 -100 200 200" aria-hidden="true">
            {WHEEL.map((_w, i) => (
              <g key={`sl-${i}`}>
                <path d={slicePath(i)} fill={COLORS[i]} stroke="#0a0f2a" strokeWidth="1.2" />
                <path d={slicePath(i)} fill="url(#wheel-shade)" />
                {won?.index === i && <path className="win-glow" d={slicePath(i)} fill="#ffffff" />}
              </g>
            ))}
            {WHEEL.map((w, i) => (
              <g key={`lb-${i}`} transform={`rotate(${(i * WHEEL_SLICE_DEG + WHEEL_SLICE_DEG / 2).toFixed(2)})`}>
                <text className={`wheel-lbl ${w.prize >= 1_000_000 ? 'gold' : ''}`} y={-60} textAnchor="middle" dominantBaseline="middle">{chipLabel(w.prize)}</text>
              </g>
            ))}
            {WHEEL.map((_w, i) => {
              const [px, py] = polar(i * WHEEL_SLICE_DEG, 88);
              return <circle key={`pg-${i}`} cx={px.toFixed(2)} cy={py.toFixed(2)} r="2.6" fill="#fff6c8" stroke="#8a5d12" strokeWidth=".8" />;
            })}
            <defs>
              <radialGradient id="wheel-shade" cx="50%" cy="50%" r="50%">
                <stop offset="0" stopColor="#000" stopOpacity=".38" />
                <stop offset=".45" stopColor="#000" stopOpacity="0" />
                <stop offset="1" stopColor="#fff" stopOpacity=".16" />
              </radialGradient>
            </defs>
          </svg>
        </div>
        <svg className="wheel-rim" viewBox="-100 -100 200 200" aria-hidden="true">
          <circle r="95" fill="none" stroke="url(#wheel-rim-g)" strokeWidth="8" />
          <circle r="91" fill="none" stroke="#6e4a0a" strokeWidth="1" />
          <circle r="99" fill="none" stroke="#6e4a0a" strokeWidth="1" />
          {Array.from({ length: 16 }, (_, i) => {
            const [bx, by] = polar(i * 22.5, 95);
            return <circle key={`bu-${i}`} className="bulb" style={{ ['--i' as string]: i } as React.CSSProperties} cx={bx.toFixed(2)} cy={by.toFixed(2)} r="2.3" />;
          })}
          <defs>
            <linearGradient id="wheel-rim-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff2a8" />
              <stop offset=".5" stopColor="#e0a52c" />
              <stop offset="1" stopColor="#8a5d12" />
            </linearGradient>
            <radialGradient id="wheel-hub-g" cx="40%" cy="30%" r="80%">
              <stop offset="0" stopColor="#fff6c0" />
              <stop offset=".55" stopColor="#f2bf3f" />
              <stop offset="1" stopColor="#a8701d" />
            </radialGradient>
          </defs>
          <circle r="15" fill="url(#wheel-hub-g)" stroke="#6e4a0a" strokeWidth="2" />
          <circle r="7" fill="#fff6c0" fillOpacity=".55" />
        </svg>
        <i ref={ptrRef} className="wheel-ptr" aria-hidden="true" />
      </div>

      <div className="wheel-side">
        <CoinPill balance={profile.balance} />
        {won ? (
          <div className="wheel-win" role="status" aria-live="polite">
            <small>{won.prize >= BIG_PRIZE ? 'JACKPOT!' : 'Selamat!'}</small>
            <strong><CoinIcon /> +{formatChips(won.prize)}</strong>
            <span>koin masuk ke saldomu · putar lagi besok</span>
          </div>
        ) : canSpin ? (
          <p className="wheel-info">Putar sekali sehari, gratis! Hadiah dari 10.000 sampai <b>1.000.000</b> koin.</p>
        ) : (
          <p className="wheel-info" role="status">Roda sudah diputar hari ini. Putaran berikutnya dalam <b>{untilTomorrow()}</b>.</p>
        )}
        {canSpin && phase === 'idle' && <button className="gbtn gold big shine wheel-go" onClick={spin}>PUTAR RODA!</button>}
        {phase === 'spinning' && <button className="gbtn gold big wheel-go" disabled>MEMUTAR…</button>}
        {phase !== 'spinning' && !(canSpin && phase === 'idle') && <button className="gbtn wheel-go" onClick={() => go('')}>TUTUP</button>}
      </div>
    </div>
  );
}
