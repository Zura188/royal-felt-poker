import { STARTING_BALANCE, formatChips } from '@rfp/shared';
import { Avatar } from '../components/Avatar';
import { useProfile } from '../state/ProfileContext';

export function ProfilePanel() {
  const { profile } = useProfile();
  const rate = profile.games ? Math.round((profile.wins / profile.games) * 100) : 0;
  const net = profile.balance - STARTING_BALANCE;
  const tiles: Array<[string, string]> = [
    ['Game dimainkan', String(profile.games)],
    ['Juara 1', String(profile.wins)],
    ['Win rate', `${rate}%`],
    ['Saldo tertinggi', formatChips(profile.peak)],
    ['Bom dimainkan', String(profile.lifeBombs)],
    ['Selisih dari awal', `${net >= 0 ? '+' : '−'}${formatChips(Math.abs(net))}`],
    ['Kemenangan terbesar', profile.bestWin > 0 ? `+${formatChips(profile.bestWin)}` : '—'],
    ['Menang beruntun', String(profile.streak)],
    ['Rekor beruntun', String(profile.bestStreak)],
  ];
  return (
    <>
      <div className="prof-head">
        <div className="avatar-ring big"><Avatar seed={0} /></div>
        <div>
          <h3>Pemain Tamu</h3>
          <p>Profil lokal untuk mode offline. Akun online belum tersedia.</p>
        </div>
      </div>
      <div className="tiles">
        {tiles.map(([k, v]) => (
          <div key={k} className="tile"><small>{k}</small><strong>{v}</strong></div>
        ))}
      </div>
    </>
  );
}
