import { useEffect, useState } from 'react';
import { go, useRoute } from './state/router';
import { tryAutoResume } from './state/online';
import { useProfile } from './state/ProfileContext';
import { LoadingScreen } from './screens/LoadingScreen';
import { Lobby } from './screens/Lobby';
import { TableSelect } from './screens/TableSelect';
import { TableScreen } from './screens/TableScreen';
import { ModeScreen } from './screens/ModeScreen';
import { OnlineScreen } from './screens/OnlineScreen';

export function App() {
  const route = useRoute();
  const { profile } = useProfile();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 900);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    void tryAutoResume().then((ok) => { if (ok) go('room'); });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', profile.settings.reduceMotion);
  }, [profile.settings.reduceMotion]);
  useEffect(() => {
    document.documentElement.classList.toggle('q-hemat', profile.settings.quality === 'hemat');
  }, [profile.settings.quality]);
  useEffect(() => {
    document.documentElement.dataset.back = profile.settings.cardBack;
  }, [profile.settings.cardBack]);

  if (!ready) return <LoadingScreen />;

  switch (route.name) {
    case 'main': return <ModeScreen />;
    case 'online': return <OnlineScreen />;
    case 'room': return <TableScreen online />;
    case 'mode': return <TableSelect />;
    case 'table': return <TableScreen />;
    case 'mission': return <Lobby panel="mission" />;
    case 'profile': return <Lobby panel="profile" />;
    case 'history': return <Lobby panel="history" />;
    case 'settings': return <Lobby panel="settings" />;
    case 'cosmetics': return <Lobby panel="cosmetics" />;
    case 'wheel': return <Lobby panel="wheel" />;
    case 'vip': return <Lobby panel="vip" />;
    case 'create-room': return <Lobby panel="create-room" />;
    case 'join-room': return <Lobby panel="join-room" />;
    case 'disconnected': return <Lobby panel="disconnected" />;
    default: return <Lobby panel={null} />;
  }
}
