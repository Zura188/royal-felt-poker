import { useEffect, useState } from 'react';

export type Route =
  | { name: 'lobby' }
  | { name: 'main' }
  | { name: 'mode' }
  | { name: 'online' }
  | { name: 'room' }
  | { name: 'table' }
  | { name: 'profile' }
  | { name: 'mission' }
  | { name: 'history' }
  | { name: 'settings' }
  | { name: 'cosmetics' }
  | { name: 'wheel' }
  | { name: 'vip' }
  | { name: 'create-room' }
  | { name: 'join-room' }
  | { name: 'disconnected' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  switch (path) {
    case 'main': return { name: 'main' };
    case 'mode': return { name: 'mode' };
    case 'online': return { name: 'online' };
    case 'room': return { name: 'room' };
    case 'meja': return { name: 'table' };
    case 'profil': return { name: 'profile' };
    case 'misi': return { name: 'mission' };
    case 'riwayat': return { name: 'history' };
    case 'pengaturan': return { name: 'settings' };
    case 'koleksi': return { name: 'cosmetics' };
    case 'roda': return { name: 'wheel' };
    case 'vip': return { name: 'vip' };
    case 'buat-room': return { name: 'create-room' };
    case 'gabung': return { name: 'join-room' };
    case 'terputus': return { name: 'disconnected' };
    default: return { name: 'lobby' };
  }
}

// Rute disimpan di memori dan dicerminkan ke hash URL bila tersedia
// (tombol back Android/Capacitor memakai hash; halaman tersemat boleh memblokirnya).
let current: Route = parseHash(typeof window !== 'undefined' ? window.location.hash : '');
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const go = (path: string) => {
  current = parseHash('#/' + path);
  try {
    window.location.hash = '#/' + path;
  } catch {
    /* diabaikan */
  }
  emit();
};

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(current);
  useEffect(() => {
    const sync = () => setRoute(current);
    const onHash = () => {
      current = parseHash(window.location.hash);
      emit();
    };
    listeners.add(sync);
    window.addEventListener('hashchange', onHash);
    return () => {
      listeners.delete(sync);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);
  return route;
}
