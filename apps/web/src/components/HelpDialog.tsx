import { useEffect } from 'react';
import { KIND_LABEL, RANKING_UNITS, fiveCardLadder, maxLoss, penaltyFor, type Rules } from '@rfp/capsa-engine';
import { formatChips } from '@rfp/shared';

interface Props {
  rules: Rules;
  stake: number;
  onClose: () => void;
}

/** Ringkasan cara main + tabel hasil sesuai aturan dan taruhan meja saat ini. */
export function HelpDialog({ rules, stake, onClose }: Props) {
  // tombol Esc menutup dialog (papan ketik di desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const ladder = fiveCardLadder(rules);
  const ranking = rules.scoring === 'ranking';
  const tiers = rules.penalty.split(',').map((s) => {
    const [n, m] = s.split('x');
    return `≥${n} kartu ×${m}`;
  });
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Cara main" onClick={onClose}>
      <div className="rules-dialog help-dialog" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>CARA MAIN</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">✕</button>
        </header>
        <div className="rules-grid">
          <section>
            <h4>Memilih kartu</h4>
            <ul>
              <li>Ketuk kartu untuk memilih, ketuk lagi untuk membatalkan.</li>
              <li><b>Geser jari</b> di atas kartu untuk memilih banyak kartu sekaligus (maksimal 5).</li>
              <li>Kartu yang meredup tidak bisa ikut kombinasi apa pun saat ini.</li>
              <li><b>SARAN</b> memilihkan langkah terkuat. <b>URUT</b> mengganti urutan angka atau suit.</li>
            </ul>
          </section>
          <section>
            <h4>Urutan kartu</h4>
            <p className="help-ranks">3 4 5 6 7 8 9 10 J Q K A <b>2</b></p>
            <p>Angka 2 paling tinggi. Suit dari tertinggi:{' '}
              {rules.suitOrder.map((s, i) => (
                <span key={s}>
                  <span className={s === '♥' || s === '♦' ? 'red' : ''}>{s}</span>
                  {i < 3 && <span className="gt"> › </span>}
                </span>
              ))}
            </p>
          </section>
          <section>
            <h4>Kombinasi</h4>
            <ul>
              <li>Single, Pair{rules.allowTriple ? ', Three of a Kind' : ''}.</li>
              <li>5 kartu, dari terlemah: {ladder.map((k) => KIND_LABEL[k]).join(' › ')}.</li>
              <li>Mainkan kombinasi yang mengalahkan kartu di meja dengan jumlah kartu sama, atau PASS.</li>
            </ul>
          </section>
          <section>
            <h4>Hasil dan taruhan</h4>
            {ranking ? (
              <ul>
                {RANKING_UNITS.map((u, i) => (
                  <li key={i}>Peringkat {i + 1}: <b className={u > 0 ? 'pos-d' : 'neg-d'}>{u > 0 ? '+' : '−'}{formatChips(Math.abs(u) * stake)}</b></li>
                ))}
              </ul>
            ) : (
              <ul>
                <li>Game selesai saat ada yang kartunya habis. Lawan membayar sisa kartu × taruhan × pengali ({tiers.join(', ')}).</li>
                <li>Contoh sisa 13 kartu: <b className="neg-d">−{formatChips(penaltyFor(13, rules, stake))}</b></li>
              </ul>
            )}
            <p>Syarat duduk: saldo minimal {formatChips(maxLoss(rules, stake))} (kekalahan terbesar di meja ini). Semua koin hanya virtual.</p>
          </section>
        </div>
        <footer>
          <span />
          <button className="btn btn-confirm" onClick={onClose}>Mengerti</button>
        </footer>
      </div>
    </div>
  );
}
