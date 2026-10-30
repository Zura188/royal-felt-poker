import { useRef, useState, type ReactNode } from 'react';
import { FxLayer } from './FxLayer';
import { go } from '../state/router';

let forcedPortrait = false; // pilihan "tetap main di portrait" bertahan antar layar

/** Panggung 16:9. `felt` memasang tema warna meja (data-felt) untuk layar meja. */
export function Stage({ children, className = '', felt }: { children: ReactNode; className?: string; felt?: string }) {
  const [force, setForce] = useState(forcedPortrait);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="scene">
      <div ref={ref} className={`stage ${force ? 'force' : ''} ${className}`} data-felt={felt}>
        {children}
        <FxLayer stageRef={ref} />
      </div>
      {!force && (
        <div className="rotate-hint" role="note">
          <div className="rot-icon" aria-hidden="true">⟳</div>
          <p>Putar HP ke mode <b>landscape</b> untuk bermain.</p>
          <button className="gbtn small" onClick={() => { forcedPortrait = true; setForce(true); }}>Tetap di portrait</button>
          <button className="gbtn gold small" onClick={() => go('')}>Ke lobi</button>
        </div>
      )}
    </div>
  );
}
