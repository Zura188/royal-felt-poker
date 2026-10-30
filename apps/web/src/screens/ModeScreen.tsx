import { Chip } from '../components/Chip';
import { Icon } from '../components/Icons';
import { CoinPill } from '../components/CoinPill';
import { Stage } from '../components/Stage';
import { useProfile } from '../state/ProfileContext';
import { go } from '../state/router';

export function ModeScreen() {
  const { profile } = useProfile();
  return (
    <Stage className="select">
      <div className="topbar-game">
        <button className="round gbtn" onClick={() => go('')} aria-label="Kembali"><Icon name="back" /></button>
        <h2 className="screen-title">PILIH MODE</h2>
        <CoinPill balance={profile.balance} />
      </div>
      <div className="modes">
        <button className="mode-big off" onClick={() => go('mode')}>
          <div className="tier-art"><Chip value={500} stack={4} label="500" /></div>
          <strong>MAIN OFFLINE</strong>
          <span>Lawan 3 bot pintar. Tanpa internet, bisa kapan saja.</span>
          <i className="go">MAIN</i>
        </button>
        <button className="mode-big on" onClick={() => go('online')}>
          <div className="tier-art"><Icon name="globe" /></div>
          <strong>MABAR ONLINE</strong>
          <span>Buat room dan ajak teman pakai kode 4 huruf. Kursi kosong diisi bot.</span>
          <i className="go">MABAR</i>
        </button>
      </div>
      <p className="select-note">Mabar online butuh server mabar yang berjalan (lihat README). Koin tetap virtual.</p>
    </Stage>
  );
}
