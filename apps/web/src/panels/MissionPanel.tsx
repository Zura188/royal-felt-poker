import { formatChips } from '@rfp/shared';
import { CoinIcon, Icon } from '../components/Icons';
import { useToast } from '../components/Toast';
import { feel, fx, stagePoint } from '../fx/bus';
import { missionViews } from '../state/missions';
import { useProfile } from '../state/ProfileContext';

export function MissionPanel() {
  const { profile, claimMission } = useProfile();
  const toast = useToast();
  const views = missionViews(profile);
  const claim = (id: string, el: HTMLElement) => {
    const g = claimMission(id);
    toast.show(g > 0 ? `+${formatChips(g)} koin masuk saldo` : 'Misi belum selesai');
    if (g > 0) {
      feel.claim();
      const pt = stagePoint(el);
      if (pt) {
        fx.burst('coins', pt.x, pt.y, { count: Math.min(36, 14 + Math.round(g / 60000)), power: 1.1 });
        fx.burst('sparks', pt.x, pt.y, { count: 12, power: 0.8 });
      }
    } else feel.error();
  };
  const group = (kind: 'daily' | 'life', title: string, note: string) => (
    <section className="mis-group">
      <h3>{title} <small>{note}</small></h3>
      <ul>
        {views.filter((v) => v.def.kind === kind).map((v) => {
          const pct = Math.round((v.progress / v.def.target) * 100);
          return (
            <li key={v.def.id} className={`mis ${v.claimed ? 'claimed' : v.done ? 'ready' : ''}`}>
              <div className="mis-text">
                <strong>{v.def.title}</strong>
                <span>{v.def.desc}</span>
                <div className="bar" aria-label={`${pct}%`}><i style={{ width: `${pct}%` }} /></div>
                <small>{formatChips(v.progress)} / {formatChips(v.def.target)}</small>
              </div>
              <div className="mis-reward">
                <span className="rw"><CoinIcon />{formatChips(v.def.reward)}</span>
                {v.claimed ? (
                  <span className="got"><Icon name="check" />Diambil</span>
                ) : (
                  <button className="gbtn green small" disabled={!v.done} onClick={(e) => claim(v.def.id, e.currentTarget)}>AMBIL</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
  return (
    <>
      {group('daily', 'Misi Harian', 'reset tengah malam')}
      {group('life', 'Pencapaian', 'sekali seumur hidup')}
      {toast.node}
    </>
  );
}
