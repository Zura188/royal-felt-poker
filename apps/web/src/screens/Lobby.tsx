import { Avatar } from '../components/Avatar';
import { Chip } from '../components/Chip';
import { CoinPill } from '../components/CoinPill';
import { fx, stagePoint } from '../fx/bus';
import { sfx } from '../fx/sound';
import { Dealer, type DealerMode } from '../components/Dealer';
import { Icon } from '../components/Icons';
import { Panel } from '../components/Panel';
import { RulesDialog } from '../components/RulesDialog';
import { Stage } from '../components/Stage';
import { ComingSoonPanel, comingSoonTitle } from '../panels/ComingSoonPanel';
import { HistoryPanel } from '../panels/HistoryPanel';
import { MissionPanel } from '../panels/MissionPanel';
import { ProfilePanel } from '../panels/ProfilePanel';
import { CosmeticsPanel } from '../panels/CosmeticsPanel';
import { WheelPanel } from '../panels/WheelPanel';
import { SettingsPanel } from '../panels/SettingsPanel';
import { claimableCount, todayKey } from '../state/missions';
import { useProfile } from '../state/ProfileContext';
import { go } from '../state/router';
import { useEffect, useRef, useState } from 'react';

export type PanelKind = 'mission' | 'profile' | 'history' | 'settings' | 'cosmetics' | 'wheel' | 'vip' | 'create-room' | 'join-room' | 'disconnected' | null;

const TITLES: Record<string, string> = { mission: 'MISI', profile: 'PROFIL', history: 'RIWAYAT', settings: 'PENGATURAN', cosmetics: 'KOLEKSI', wheel: 'RODA HOKI' };

export function Lobby({ panel }: { panel: PanelKind }) {
  const { profile, updateSettings } = useProfile();
  const [rulesOpen, setRulesOpen] = useState(false);
  const claimable = claimableCount(profile);
  const wheelReady = profile.wheel.last !== todayKey() && profile.wheel.pending === 0;
  const close = () => go('');
  const [mode, setMode] = useState<DealerMode>('idle');
  const [greet, setGreet] = useState(0);
  const dealerRef = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const GREETINGS = ['Selamat datang di meja!', 'Siap menantang 3 bot pintar?', 'Ambil misi dulu, koinnya besar!', 'Ketuk aku untuk bersorak!'];

  // debu emas melayang di latar lobi
  useEffect(() => {
    fx.ambient(true);
    return () => fx.ambient(false);
  }, []);
  useEffect(() => {
    const t = window.setInterval(() => setGreet((n) => (n + 1) % GREETINGS.length), 5200);
    return () => { window.clearInterval(t); window.clearTimeout(timer.current); };
  }, [GREETINGS.length]);

  const cheer = () => {
    setGreet((n) => (n + 1) % GREETINGS.length); // bandar membalas dengan sapaan lain
    if (profile.settings.reduceMotion) return;
    sfx.unlock();
    sfx.play('coin');
    setMode('cheer');
    const pt = dealerRef.current ? stagePoint(dealerRef.current) : null;
    if (pt) fx.burst('coins', pt.x, pt.y - 4, { count: 10, power: 0.8 });
    fx.burst('sparks', pt?.x ?? 50, (pt?.y ?? 30) - 8, { count: 14, power: 0.7 });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMode('idle'), 1800);
  };

  return (
    <Stage className="lobby">
      <div className="topbar-game">
        <button className="me-chip" onClick={() => go('profil')} aria-label="Profil">
          <span className="avatar-ring small"><Avatar seed={0} /></span>
          <span className="me-text"><b>Pemain Tamu</b><small>Mode offline</small></span>
        </button>
        <CoinPill balance={profile.balance}>
          <button className="plus gbtn gold" onClick={() => go('misi')} aria-label="Dapatkan koin dari misi">
            <Icon name="plus" />
            {claimable > 0 && <i className="dot">{claimable}</i>}
          </button>
        </CoinPill>
        <button className="round gbtn" onClick={() => go('pengaturan')} aria-label="Pengaturan"><Icon name="gear" /></button>
      </div>

      <div className="rays" aria-hidden="true" />
      <div className="logo" aria-label="Capsa Banting">
        <span className="logo-top">ROYAL FELT</span>
        <h1>CAPSA<br />BANTING</h1>
      </div>

      <div className="lobby-table" aria-hidden="true">
        <div className="lt-felt" />
        <div className="lt-chips">
          <Chip value={500} stack={4} label="500" />
          <Chip value={2000} stack={3} label="2K" />
          <Chip value={100} stack={5} label="100" />
        </div>
      </div>
      <div ref={dealerRef} className="lobby-dealer-wrap">
        <Dealer className="lobby-dealer" animate={!profile.settings.reduceMotion} mode={mode} onClick={cheer} />
      </div>
      <div className="lobby-bubble" key={greet} role="status"><span>{GREETINGS[greet]}</span></div>
      <div className="lobby-table-front" aria-hidden="true" />

      <nav className="side-left" aria-label="Menu">
        <button className="tile-btn" onClick={() => go('profil')}><Icon name="user" /><span>Profil</span></button>
        <button className="tile-btn" onClick={() => go('riwayat')}><Icon name="history" /><span>Riwayat</span></button>
        <button className="tile-btn" onClick={() => go('online')}><Icon name="globe" /><span>Online</span></button>
        <button className="tile-btn" onClick={() => go('koleksi')}><Icon name="palette" /><span>Koleksi</span></button>
      </nav>

      <div className="side-right">
        <button className="gbtn green cta" onClick={() => go('main')}>MAIN SEKARANG<small>offline vs bot · atau mabar</small></button>
        <button className="gbtn gold wide" onClick={() => go('misi')}>
          <Icon name="target" /> MISI
          {claimable > 0 && <i className="dot">{claimable}</i>}
        </button>
        <button className="gbtn wide wheel-btn" onClick={() => go('roda')}>
          <Icon name="wheel" /> RODA HOKI
          {wheelReady && <i className="dot" aria-label="Siap diputar">!</i>}
        </button>
        <button className="gbtn wide" onClick={() => setRulesOpen(true)}><Icon name="cards" /> ATURAN</button>
      </div>

      {panel && (
        <Panel title={panel in TITLES ? TITLES[panel] : comingSoonTitle(panel).toUpperCase()} onClose={close}>
          {panel === 'mission' && <MissionPanel />}
          {panel === 'profile' && <ProfilePanel />}
          {panel === 'history' && <HistoryPanel />}
          {panel === 'settings' && <SettingsPanel />}
          {panel === 'cosmetics' && <CosmeticsPanel />}
          {panel === 'wheel' && <WheelPanel />}
          {panel !== 'mission' && panel !== 'profile' && panel !== 'history' && panel !== 'settings' && panel !== 'cosmetics' && panel !== 'wheel' && <ComingSoonPanel kind={panel} />}
        </Panel>
      )}
      {rulesOpen && (
        <RulesDialog rules={profile.settings.rules} onSave={(rules) => updateSettings({ rules })} onClose={() => setRulesOpen(false)} />
      )}
    </Stage>
  );
}
