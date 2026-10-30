import { formatChips } from '@rfp/shared';
import { useProfile } from '../state/ProfileContext';

export function HistoryPanel() {
  const { profile } = useProfile();
  if (profile.history.length === 0) return <p className="empty">Belum ada game yang selesai. Mainkan satu meja dulu.</p>;
  return (
    <ul className="hist">
      {profile.history.map((h) => (
        <li key={h.id}>
          <div>
            <strong>{h.result}</strong>
            <small>{new Date(h.at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} · taruhan {formatChips(h.stake)}</small>
          </div>
          <span className={h.delta >= 0 ? 'up' : 'down'}>{h.delta >= 0 ? '+' : '−'}{formatChips(Math.abs(h.delta))}</span>
        </li>
      ))}
    </ul>
  );
}
