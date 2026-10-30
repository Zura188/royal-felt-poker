import { useState } from 'react';
import { STAKE_TIERS, maxLoss } from '@rfp/capsa-engine';
import { chipLabel, formatChips } from '@rfp/shared';
import { Chip } from '../components/Chip';
import { Icon } from '../components/Icons';
import { RulesDialog } from '../components/RulesDialog';
import { CoinPill } from '../components/CoinPill';
import { Stage } from '../components/Stage';
import { useProfile } from '../state/ProfileContext';
import { go } from '../state/router';
import { TIER_NAMES, hiRoller, resolveFelt } from '../state/theme';

export function TableSelect() {
  const { profile, updateSettings } = useProfile();
  const [rulesOpen, setRulesOpen] = useState(false);
  const rules = profile.settings.rules;
  const noneOpen = STAKE_TIERS.every((s) => maxLoss(rules, s) > profile.balance);
  return (
    <Stage className="select">
      <div className="topbar-game">
        <button className="round gbtn" onClick={() => go('')} aria-label="Kembali"><Icon name="back" /></button>
        <h2 className="screen-title">PILIH MEJA</h2>
        <CoinPill balance={profile.balance} />
        <button className="gbtn small" onClick={() => setRulesOpen(true)}><Icon name="cards" /> ATURAN</button>
      </div>

      <div className="tiers">
        {STAKE_TIERS.map((s, i) => {
          const need = maxLoss(rules, s);
          const locked = need > profile.balance;
          const sel = profile.settings.stake === s;
          const hi = hiRoller(s);
          const name = TIER_NAMES[i];
          return (
            <button
              key={s}
              className={`tier felt-sw t${i} hi-${hi} ${locked ? 'locked' : ''} ${sel && !locked ? 'sel' : ''}`}
              data-felt={resolveFelt(profile.settings.felt, s)}
              disabled={locked}
              aria-label={`Meja ${name}, taruhan ${formatChips(s)} per kartu${locked ? `, terkunci, butuh saldo ${formatChips(need)}` : ''}`}
              onClick={() => {
                updateSettings({ stake: s });
                go('meja');
              }}
            >
              <i className="tier-felt" aria-hidden="true" />
              {hi === 2 && <Icon name="crown" className="tier-crown" />}
              <div className="tier-art"><Chip value={s} stack={2 + (i >> 1)} label={chipLabel(s)} /></div>
              <strong>{name}</strong>
              <span className="stake">Taruhan <b>{formatChips(s)}</b> / kartu</span>
              <span className="need">{locked ? (<><Icon name="lock" /> Butuh {formatChips(need)}</>) : <>Kalah maks. {formatChips(need)}</>}</span>
              <span className="go">{locked ? 'TERKUNCI' : sel ? 'DIPILIH' : 'DUDUK'}</span>
            </button>
          );
        })}
      </div>
      <div className="select-foot">
        <p className="tier-note">
          {noneOpen
            ? 'Saldo kamu belum cukup untuk meja mana pun. Selesaikan misi atau putar Roda Hoki di lobi untuk dapat koin.'
            : 'Taruhan dikali jumlah kartu sisa saat game selesai (Mode Pemeringkatan: kelipatan tetap dari taruhan). Meja terbuka bila saldo cukup menutup kekalahan terbesarnya.'}
        </p>
        {noneOpen && <button className="gbtn gold small mission-cta" onClick={() => go('misi')}><Icon name="target" /> AMBIL KOIN DARI MISI</button>}
      </div>
      {rulesOpen && <RulesDialog rules={rules} onSave={(r) => updateSettings({ rules: r })} onClose={() => setRulesOpen(false)} />}
    </Stage>
  );
}
