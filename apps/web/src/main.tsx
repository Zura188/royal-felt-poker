import { createRoot } from 'react-dom/client';
import { App } from './App';
import { fx } from './fx/bus';
import { haptic } from './fx/haptics';
import { renderSfxStats, SFX_NAMES, sfx } from './fx/sound';
import { ProfileProvider } from './state/ProfileContext';
import './styles/app.css';
import './styles/capsa.css';

// Suara klik untuk semua tombol (kartu punya suara sendiri). Kunci audio dibuka pada ketukan pertama.
document.addEventListener(
  'pointerdown',
  (e) => {
    sfx.unlock();
    const el = e.target as Element | null;
    if (!el || typeof el.closest !== 'function') return;
    const b = el.closest('button, [role="button"], .tile-btn, .tier, .mode-big');
    if (!b || (b as HTMLButtonElement).disabled || b.closest('.cc') || b.classList.contains('dealer')) return;
    queueMicrotask(() => sfx.play('click'));
    haptic('tap');
  },
  true,
);

// Kait uji (hanya bila alamat memuat "debug"): dipakai tes otomatis untuk memicu efek dan mengukur suara.
if (/debug/.test(window.location.search + window.location.hash)) {
  (window as unknown as Record<string, unknown>).__rfp = { fx, sfx, renderSfxStats, SFX_NAMES };
}

// Catatan: sengaja tanpa <StrictMode>; TableScreen menyelesaikan hand pada unmount.
createRoot(document.getElementById('root') as HTMLElement).render(
  <ProfileProvider>
    <App />
  </ProfileProvider>,
);
