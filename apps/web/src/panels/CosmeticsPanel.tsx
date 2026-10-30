import { useProfile } from '../state/ProfileContext';
import { BACKS, FELTS } from '../state/storage';
import { BACK_LABEL, FELT_LABEL, resolveFelt } from '../state/theme';

/** Koleksi: warna kain meja dan motif punggung kartu. Semua gratis dan hanya kosmetik. */
export function CosmeticsPanel() {
  const { profile, updateSettings } = useProfile();
  const { felt, cardBack, stake } = profile.settings;
  return (
    <>
      <div className="cos-prev" aria-hidden="true">
        <i className="felt-sw cos-oval" data-felt={resolveFelt(felt, stake)} />
        <span className="cos-fan"><i /><i /><i /></span>
      </div>

      <section className="cos-sec">
        <h3>Warna kain meja</h3>
        <p>“Otomatis” membuat meja makin mewah mengikuti taruhan: hijau, biru, merah, lalu hitam untuk meja tertinggi.</p>
        <div className="cos-grid felts" role="group" aria-label="Warna kain meja">
          {FELTS.map((f) => (
            <button key={f} className={`cos-opt ${felt === f ? 'on' : ''}`} aria-pressed={felt === f} onClick={() => updateSettings({ felt: f })}>
              <i className={`felt-sw cos-felt ${f === 'auto' ? 'auto' : ''}`} data-felt={f === 'auto' ? 'hijau' : f} />
              <span>{f === 'auto' ? 'Otomatis' : FELT_LABEL[f]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="cos-sec">
        <h3>Punggung kartu</h3>
        <div className="cos-grid backs" role="group" aria-label="Punggung kartu">
          {BACKS.map((b) => (
            <button key={b} className={`cos-opt ${cardBack === b ? 'on' : ''}`} aria-pressed={cardBack === b} onClick={() => updateSettings({ cardBack: b })}>
              <i className="back-sw cos-card" data-back={b} />
              <span>{BACK_LABEL[b]}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
