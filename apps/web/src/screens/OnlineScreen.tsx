import { useEffect, useState } from 'react';
import { Icon } from '../components/Icons';
import { Stage } from '../components/Stage';
import { connect, defaultServerUrl, disconnect, onlineApi, useOnline } from '../state/online';
import { go } from '../state/router';

export function OnlineScreen() {
  const on = useOnline();
  const [url, setUrl] = useState(defaultServerUrl());
  const [name, setName] = useState('Pemain');
  const [code, setCode] = useState('');
  const busy = on.status === 'connecting' || on.status === 'reconnecting';

  useEffect(() => { if (on.room) go('room'); }, [on.room]);

  const run = async (action: () => void) => {
    try {
      if (on.status !== 'open') await connect(url.trim());
      onlineApi.clearError();
      action();
    } catch { /* status error ditampilkan di bawah */ }
  };

  return (
    <Stage className="select">
      <div className="topbar-game">
        <button className="round gbtn" onClick={() => { disconnect(); go('main'); }} aria-label="Kembali"><Icon name="back" /></button>
        <h2 className="screen-title">MABAR ONLINE</h2>
      </div>
      <form className="online-card" onSubmit={(e) => e.preventDefault()}>
        <label>Alamat server
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ws://alamat-server:8787" inputMode="url" autoCapitalize="off" spellCheck={false} />
        </label>
        <label>Nama kamu
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={14} />
        </label>
        <div className="online-actions">
          <button className="gbtn green" disabled={busy} onClick={() => run(() => onlineApi.create(name))}>BUAT ROOM</button>
          <div className="join-row">
            <input className="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))} placeholder="KODE" aria-label="Kode room" />
            <button className="gbtn gold" disabled={busy || code.length < 4} onClick={() => run(() => onlineApi.join(code, name))}>GABUNG</button>
          </div>
        </div>
        {on.status === 'connecting' && !on.waking && <p className="online-msg">Menghubungkan…</p>}
        {on.status === 'connecting' && on.waking && (
          <p className="online-msg warm" role="status">Server gratis sedang bangun dari tidur… ini bisa sampai 1 menit. Tunggu sebentar, jangan ditutup.</p>
        )}
        {on.status === 'reconnecting' && <p className="online-msg" role="status">Menghubungkan kembali ke room kamu…</p>}
        {on.error && <p className="online-msg err" role="alert">{on.error}</p>}
        <p className="online-hint">Minta alamat server ke teman yang menjalankannya (contoh <code>wss://nama.onrender.com</code>). Cukup diisi sekali, alamatnya diingat.</p>
      </form>
    </Stage>
  );
}
