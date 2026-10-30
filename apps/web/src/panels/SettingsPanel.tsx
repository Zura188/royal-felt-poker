import { useState } from 'react';
import { STARTING_BALANCE, formatChips } from '@rfp/shared';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { useProfile } from '../state/ProfileContext';
import { sfx } from '../fx/sound';

export function SettingsPanel() {
  const { profile, updateSettings, resetAll } = useProfile();
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  return (
    <>
      <label className="set-row">
        <span>
          <strong>Efek suara</strong>
          <small>Suara kartu, koin, dan kemenangan (dibuat langsung oleh perangkat, tanpa unduhan).</small>
        </span>
        <input type="checkbox" checked={profile.settings.sound} onChange={(e) => { updateSettings({ sound: e.target.checked }); if (e.target.checked) { sfx.unlock(); sfx.enabled = true; sfx.play('coin'); } }} />
      </label>
      <label className="set-row">
        <span>
          <strong>Getar</strong>
          <small>Getaran singkat saat memainkan kartu, bom, dan menang (hanya di HP yang mendukung).</small>
        </span>
        <input type="checkbox" checked={profile.settings.haptics} onChange={(e) => updateSettings({ haptics: e.target.checked })} />
      </label>
      <div className="set-row">
        <span>
          <strong>Kualitas efek</strong>
          <small>Pilih Hemat jika HP terasa berat: partikel koin dan konfeti dikurangi.</small>
        </span>
        <span className="seg" role="group" aria-label="Kualitas efek">
          {(['tinggi', 'hemat'] as const).map((q) => (
            <button key={q} className={`seg-btn ${profile.settings.quality === q ? 'on' : ''}`} onClick={() => updateSettings({ quality: q })}>{q === 'tinggi' ? 'Tinggi' : 'Hemat'}</button>
          ))}
        </span>
      </div>
      <div className="set-row">
        <span>
          <strong>Kecepatan bot</strong>
          <small>Cepat: bot berpikir lebih singkat dan permainan lebih ringkas.</small>
        </span>
        <span className="seg" role="group" aria-label="Kecepatan bot">
          {(['normal', 'cepat'] as const).map((q) => (
            <button key={q} className={`seg-btn ${profile.settings.speed === q ? 'on' : ''}`} aria-pressed={profile.settings.speed === q} onClick={() => updateSettings({ speed: q })}>{q === 'normal' ? 'Normal' : 'Cepat'}</button>
          ))}
        </span>
      </div>
      <label className="set-row">
        <span>
          <strong>Kurangi animasi</strong>
          <small>Matikan gerak bandar, partikel, getar layar, dan animasi kartu.</small>
        </span>
        <input type="checkbox" checked={profile.settings.reduceMotion} onChange={(e) => updateSettings({ reduceMotion: e.target.checked })} />
      </label>
      <div className="set-row col">
        <span>
          <strong>Data latihan offline</strong>
          <small>Saldo, statistik, dan misi tersimpan di perangkat ini saja dan tidak berpindah ke saldo online.</small>
        </span>
        <button className="gbtn red small" onClick={() => setConfirm(true)}>RESET SALDO & STATISTIK</button>
      </div>
      {confirm && (
        <ConfirmDialog
          danger
          title="Reset data latihan?"
          message={`Saldo kembali ke ${formatChips(STARTING_BALANCE)} koin; statistik, riwayat, dan progres misi dihapus.`}
          confirmLabel="Reset"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            resetAll();
            setConfirm(false);
            toast.show('Data latihan direset.');
          }}
        />
      )}
      {toast.node}
    </>
  );
}
