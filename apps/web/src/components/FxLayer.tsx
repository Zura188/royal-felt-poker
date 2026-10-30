import { useEffect, useRef, useState } from 'react';
import { fx } from '../fx/bus';
import { H_U, Particles, W_U } from '../fx/particles';

/** Lapisan efek di atas panggung: partikel kanvas, kilatan layar, dan getaran. Tidak menangkap ketukan. */
export function FxLayer({ stageRef }: { stageRef: React.RefObject<HTMLDivElement> }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const ps = useRef<Particles | null>(null);
  const [flash, setFlash] = useState<{ id: number; color: string; alpha: number } | null>(null);

  useEffect(() => {
    const canvas = cv.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const p = new Particles(canvas);
    ps.current = p;
    p.base = fx.budget();
    if (fx.isAmbient()) p.setAmbient(true);
    const fit = () => p.resize(stage.clientWidth, stage.clientHeight);
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(stage);
    let shaking: Animation | null = null;
    const off = fx.subscribe((e) => {
      switch (e.t) {
        case 'burst': p.burst(e.kind, e.x, e.y, e.count, e.power, e.color); break;
        case 'rain': p.rain(e.kind, e.ms, e.density); break;
        case 'fly': p.fly(e.from, e.to, e.count); break;
        case 'ambient': p.setAmbient(e.on); break;
        case 'quality': p.base = e.budget; break;
        case 'clear': p.clear(); break;
        case 'flash': setFlash({ id: Date.now() + Math.random(), color: e.color, alpha: e.alpha }); break;
        case 'shake': {
          // Web Animations API: properti `translate` terpisah dari `transform`/animasi CSS panggung, jadi tidak memicu ulang stageIn.
          if (typeof stage.animate !== 'function') break;
          const u = (stage.clientWidth / 100) * Math.max(0.3, Math.min(e.power, 2));
          const at = (x: number, y: number) => ({ translate: `${(x * u).toFixed(2)}px ${(y * u).toFixed(2)}px` });
          shaking?.cancel();
          shaking = stage.animate(
            [at(0, 0), at(-0.9, 0.5), at(0.8, -0.6), at(-0.6, -0.4), at(0.5, 0.4), at(-0.25, 0.2), at(0, 0)],
            { duration: 420, easing: 'ease-out' },
          );
          break;
        }
      }
    });
    return () => {
      off();
      ro?.disconnect();
      shaking?.cancel();
      p.stop();
      ps.current = null;
    };
  }, [stageRef]);

  return (
    <>
      <canvas ref={cv} className="fx-canvas" width={W_U * 10} height={H_U * 10} aria-hidden="true" />
      {flash && (
        <div
          key={flash.id}
          className="fx-flash"
          style={{ background: `radial-gradient(circle at 50% 45%, ${flash.color}, transparent 70%)`, ['--fa' as string]: flash.alpha }}
          onAnimationEnd={() => setFlash(null)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
