import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icons';

export function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  // Esc menutup panel (di komputer); di HP cukup ketuk di luar panel atau tombol tutup.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="panel-layer" onClick={onClose}>
      <section className="pnl" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="pnl-head">
          <h2>{title}</h2>
          <button className="pnl-x gbtn red" onClick={onClose} aria-label="Tutup"><Icon name="close" /></button>
        </header>
        <div className="pnl-body">{children}</div>
      </section>
    </div>
  );
}
