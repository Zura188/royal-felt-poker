import { useState } from 'react';
import {
  DEFAULT_RULES, PENALTY_SCHEMES, STRAIGHT_ORDERS, SUIT_ORDERS, type Rules,
} from '@rfp/capsa-engine';

interface Props {
  rules: Rules;
  readOnly?: boolean;
  onSave: (r: Rules) => void;
  onClose: () => void;
}

const isRed = (s: string) => s === '♥' || s === '♦';

function Opt({ on, onClick, disabled, children, wide }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode; wide?: boolean }) {
  return (
    <button className={`opt ${on ? 'on' : ''} ${wide ? 'wide' : ''}`} onClick={onClick} disabled={disabled} aria-pressed={on}>
      {children}
    </button>
  );
}

export function RulesDialog({ rules, readOnly, onSave, onClose }: Props) {
  const [r, setR] = useState<Rules>(rules);
  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => setR((x) => ({ ...x, [k]: v }));
  const yn = (k: 'allowTriple' | 'allowFlush' | 'straightBeatsFullHouse') => (
    <div className="opt-row">
      <Opt on={r[k]} disabled={readOnly} onClick={() => set(k, true)}>Mengizinkan</Opt>
      <Opt on={!r[k]} disabled={readOnly} onClick={() => set(k, false)}>Tidak Izinkan</Opt>
    </div>
  );
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Pilih Aturan Permainan">
      <div className="rules-dialog">
        <header>
          <h3>PILIH ATURAN PERMAINAN</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">✕</button>
        </header>
        {readOnly && <p className="note">Aturan hanya bisa diubah sebelum game dimulai atau setelah game selesai.</p>}
        <div className="rules-grid">
          <section>
            <h4>Suit Rank:</h4>
            <div className="opt-col">
              {SUIT_ORDERS.map((o) => (
                <Opt key={o.join('')} on={r.suitOrder.join('') === o.join('')} disabled={readOnly} onClick={() => set('suitOrder', o)}>
                  {o.map((s, i) => (
                    <span key={s}>
                      <span className={isRed(s) ? 'red' : ''}>{s}</span>
                      {i < 3 && <span className="gt"> › </span>}
                    </span>
                  ))}
                </Opt>
              ))}
            </div>
          </section>
          <section>
            <h4>Straight Rank:</h4>
            <div className="opt-col">
              {STRAIGHT_ORDERS.map((o) => (
                <Opt key={o} on={r.straightOrder === o} disabled={readOnly} onClick={() => set('straightOrder', o)}>
                  {o.split('>').join(' > ')}
                </Opt>
              ))}
            </div>
          </section>
          <section><h4>Three of A Kind:</h4>{yn('allowTriple')}</section>
          <section><h4>Flush:</h4>{yn('allowFlush')}</section>
          <section>
            <h4>Flush Rank:</h4>
            <div className="opt-row">
              <Opt on={r.flushRank === 'suit'} disabled={readOnly} onClick={() => set('flushRank', 'suit')}>Suit Pertama</Opt>
              <Opt on={r.flushRank === 'number'} disabled={readOnly} onClick={() => set('flushRank', 'number')}>Nomor Pertama</Opt>
            </div>
          </section>
          <section><h4>Straight &gt; Full House:</h4>{yn('straightBeatsFullHouse')}</section>
          <section>
            <h4>Permainan Pertama:</h4>
            <div className="opt-row">
              <Opt on={r.firstPlayer === 'winner'} disabled={readOnly} onClick={() => set('firstPlayer', 'winner')}>Pemenang</Opt>
              <Opt on={r.firstPlayer === 'lowest'} disabled={readOnly} onClick={() => set('firstPlayer', 'lowest')}>Terkecil 3♦</Opt>
            </div>
          </section>
          <section>
            <h4>Scoring:</h4>
            <div className="opt-row">
              <Opt on={r.scoring === 'first'} disabled={readOnly} onClick={() => set('scoring', 'first')}>Menang pertama</Opt>
              <Opt on={r.scoring === 'ranking'} disabled={readOnly} onClick={() => set('scoring', 'ranking')}>Pemeringkatan</Opt>
            </div>
          </section>
          <section>
            <h4>Penalti:</h4>
            <div className="opt-row">
              {PENALTY_SCHEMES.map((p) => (
                <Opt key={p} on={r.penalty === p} disabled={readOnly} onClick={() => set('penalty', p)}>{p.replace(/,/g, ', ')}</Opt>
              ))}
            </div>
          </section>
        </div>
        <footer>
          <button className="btn btn-gold btn-small" disabled={readOnly} onClick={() => setR(DEFAULT_RULES)}>Reset ke bawaan</button>
          <button className="btn btn-confirm" disabled={readOnly} onClick={() => { onSave(r); onClose(); }}>Konfirmasi</button>
        </footer>
      </div>
    </div>
  );
}
