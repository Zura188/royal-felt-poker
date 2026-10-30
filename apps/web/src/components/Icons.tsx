// Ikon SVG sederhana (garis), warna mengikuti currentColor.
const P: Record<string, string> = {
  user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm-8 9a8 8 0 0 1 16 0',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5 1.9 1.1-1.5 2.6-2.1-.6a7.5 7.5 0 0 1-1.6.9l-.4 2.1h-3l-.4-2.1a7.5 7.5 0 0 1-1.6-.9l-2.1.6-1.5-2.6L6.6 12a7.5 7.5 0 0 1 0-1.8L4.7 9.1l1.5-2.6 2.1.6a7.5 7.5 0 0 1 1.6-.9l.4-2.1h3l.4 2.1a7.5 7.5 0 0 1 1.6.9l2.1-.6 1.5 2.6-1.9 1.1a7.5 7.5 0 0 1 0 1.8Z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  plus: 'M12 5v14M5 12h14',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6 6 18',
  cards: 'M7 4h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm4 5.5 2 2.5-2 2.5-2-2.5Z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4Zm0 2H4v2a3 3 0 0 0 3 3M16 6h4v2a3 3 0 0 1-3 3M12 13v4M8 20h8M10 17h4',
  chat: 'M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.4 9.6a2.6 2.6 0 1 1 3.7 2.3c-.7.4-1.1 1-1.1 1.8M12 17.2h.01',
  palette: 'M12 3a9 9 0 1 0 0 18c1.2 0 1.9-.9 1.6-1.9-.3-1.2.5-2.1 1.8-2.1H17a4 4 0 0 0 4-4c0-5-4-10-9-10ZM7.5 12.2h.01M9.4 7.6h.01M14.4 7.4h.01M17.2 11h.01',
  wheel: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4',
  crown: 'M3.5 18h17M4 17 3 7l5 4 4-6 4 6 5-4-1 10Z',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z',
  sort: 'M8 5v14M8 5 5 8M8 5l3 3M16 19V5M16 19l-3-3M16 19l3-3',
  send: 'M4 12 20 4l-4 16-4-6.5Z',
};

export function Icon({ name, className }: { name: keyof typeof P | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`ico ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] ?? ''} />
    </svg>
  );
}

/** Koin emas untuk saldo. */
export function CoinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={`ico coin ${className ?? ''}`} aria-hidden="true">
      <defs>
        <radialGradient id="coin-g" cx="40%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.55" stopColor="#f2bf3f" />
          <stop offset="1" stopColor="#b9801e" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="url(#coin-g)" stroke="#8a5d12" strokeWidth="2" />
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="#c98f1f" strokeWidth="1.5" />
      <path d="M16 9v14M12.5 12.5c0-1.5 1.5-2 3.5-2s3.5.8 3.5 2.4c0 3.2-7 1.6-7 5 0 1.6 1.6 2.6 3.5 2.6s3.5-.6 3.5-2.2" fill="none" stroke="#9a6a14" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
