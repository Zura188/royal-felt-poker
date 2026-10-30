import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type PointerEvent as ReactPointerEvent,
} from 'react';
import { CHAT_GAP_MS, CHAT_LINES, chipLabel, formatChips, formatDelta, STARTING_BALANCE, type Card } from '@rfp/shared';
import {
  abandonPenalty, chooseStrongMove, KIND_LABEL, legalMoves, maxLoss, newGame, pass, playCards, playStats, sortCards, STAKE_TIERS, strength, validatePlay,
  type GameState, type Rules,
} from '@rfp/capsa-engine';
import { Avatar } from '../components/Avatar';
import { CapsaCard } from '../components/CapsaCard';
import { Chip } from '../components/Chip';
import { CoinPill, useCountUp } from '../components/CoinPill';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dealer } from '../components/Dealer';
import { HelpDialog } from '../components/HelpDialog';
import { Icon } from '../components/Icons';
import { RulesDialog } from '../components/RulesDialog';
import { Stage } from '../components/Stage';
import { useToast } from '../components/Toast';
import { feel, fx } from '../fx/bus';
import { claimableCount } from '../state/missions';
import { disconnect, onlineApi, useOnline } from '../state/online';
import { useProfile } from '../state/ProfileContext';
import { go } from '../state/router';
import { hiRoller, resolveFelt, TIER_NAMES, tierIndex } from '../state/theme';
import { CARD_H, CARD_W, HAND_X, HAND_Y, MID_W, handLayout } from './handLayout';
import { BIG_WIN, CENTER, DEALER_AT, ORIGIN, SEATS, useTableFx } from './useTableFx';

const NAMES = ['Kamu', 'Avery', 'Morgan', 'Riley'];
const SHORT: Record<string, string> = {
  single: 'Single', pair: 'Pair', triple: 'Triple', straight: 'Straight', flush: 'Flush', fullhouse: 'Full House', quad: 'Four Kind', straightflush: 'Str. Flush',
};
const vars = (o: Record<string, string | number>): CSSProperties => o as CSSProperties;
const at = (p: { x: number; y: number }): CSSProperties => vars({ '--x': p.x, '--y': p.y });
const id = (c: Card) => c.r + c.s;
const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

/** Maksimal kartu dalam satu kombinasi. */
const MAX_SEL = 5;
/** Jarak geser (px) sebelum ketukan dianggap menyapu beberapa kartu. */
const SLOP_PX = 8;
/** Kemiringan dan turun-naik kecil kartu di meja agar terlihat ditaruh tangan, bukan disusun mesin. */
const TRICK_ROT = [-3, 2.5, -1.5, 3, -2.2];
const TRICK_DY = [0, 0.3, 0.1, 0.35, 0.05];

/** Bola lampu di tepi meja (meja tinggi). Koordinat dalam viewBox kain 740 x 310. */
const BULBS = Array.from({ length: 40 }, (_, i) => {
  const t = (i / 40) * Math.PI * 2;
  return { x: +(370 + 379 * Math.cos(t)).toFixed(1), y: +(155 + 164 * Math.sin(t)).toFixed(1) };
});

interface Gesture {
  id: number;
  x0: number;
  y0: number;
  idx0: number;
  last: number;
  swiping: boolean;
  warned: boolean;
  mode: 'select' | 'deselect';
}
/** Posisi kartu di tangan saat dimainkan (satuan u), supaya kartu di meja meluncur dari sana. */
interface Launch { at: number; cards: Record<string, { x: number; y: number; rot: number }> }
interface Ghost { key: string; cards: Card[]; by: number; kind: 'under' | 'sweep' }

const ruleSummary = (r: Rules) =>
  `${r.suitOrder.join('›')} · ${r.straightOrder.split('>')[0]} tertinggi · ${r.scoring === 'ranking' ? 'Pemeringkatan' : 'Menang pertama'} · Penalti ${r.penalty.replace(/,/g, ', ')}`;

export function TableScreen({ online = false }: { online?: boolean }) {
  const { profile, recordGame, updateSettings } = useProfile();
  const on = useOnline();
  const isHost = online && !!on.room && on.room.host === on.room.me;
  /** online: di ruang tunggu host memegang aturan & taruhan (dikirim ke room); semua orang lain melihat nilai dari room */
  const hostLocal = isHost && !on.room?.playing;
  const rules = online ? (hostLocal ? profile.settings.rules : (on.room?.rules ?? profile.settings.rules)) : profile.settings.rules;
  const stake = online ? (hostLocal ? profile.settings.stake : (on.room?.stake ?? profile.settings.stake)) : profile.settings.stake;
  const slow = !profile.settings.reduceMotion;
  const fast = profile.settings.speed === 'cepat';
  const toast = useToast();
  const need = maxLoss(rules, stake);
  const canSit = profile.balance >= need;
  /** Koin bot hanya tampilan; di meja tinggi dibuat cukup besar agar angkanya masuk akal. */
  const botBase = Math.max(STARTING_BALANCE, need * 4);
  const felt = resolveFelt(profile.settings.felt, stake);
  const hi = hiRoller(stake);

  const [localG, setG] = useState<GameState | null>(null);
  const g = online ? on.game : localG;
  const [selected, setSelected] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'angka' | 'suit'>('angka');
  const [botChips, setBotChips] = useState<number[]>(() => [0, botBase, botBase, botBase]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [ghost, setGhost] = useState<Ghost | null>(null);

  const settled = useRef(true);
  const gRef = useRef<GameState | null>(null);
  gRef.current = g;
  const lastWinner = useRef<number | null>(null);
  const balanceRef = useRef(profile.balance);
  balanceRef.current = profile.balance;
  const handRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<string[]>([]);
  const shownRef = useRef<Card[]>([]);
  const myTurnRef = useRef(false);
  const gesture = useRef<Gesture | null>(null);
  const launch = useRef<Launch | null>(null);
  const chatAt = useRef(0);
  const prevTrick = useRef<{ sig: string; cards: Card[]; by: number } | null>(null);
  const ghostTimer = useRef(0);
  const emoteSeen = useRef(on.emote?.n ?? 0);

  const tfx = useTableFx(g, { banter: !online });

  const room = on.room;
  const names = online
    ? [0, 1, 2, 3].map((k) => {
        const s = room?.seats[((room?.me ?? 0) + k) % 4];
        return s ? (s.away ? `${s.name} (off)` : s.name) : k === 0 ? 'Kamu' : 'Kursi kosong';
      })
    : NAMES;
  // kursi yang dipegang manusia (untuk cincin waktu giliran di mode online)
  const human = online ? [0, 1, 2, 3].map((k) => { const s = room?.seats[((room?.me ?? 0) + k) % 4]; return !!s && !s.bot; }) : [false, false, false, false];
  const goBackRoute = online ? 'main' : 'mode';
  useEffect(() => { if (online && !on.room) go('online'); }, [online, on.room]);
  // host: pengaturan terbaru langsung disiarkan ke room supaya teman melihat taruhan & aturan sebelum game dimulai
  useEffect(() => {
    if (online && hostLocal) onlineApi.config(profile.settings.rules, profile.settings.stake);
  }, [online, hostLocal, profile.settings.rules, profile.settings.stake]);
  const stepStake = (d: number) => {
    const i = Math.min(STAKE_TIERS.length - 1, Math.max(0, tierIndex(profile.settings.stake) + d));
    updateSettings({ stake: STAKE_TIERS[i] });
  };
  /** host online: pilih tingkat meja (taruhan) dengan panah; dipakai di ruang tunggu dan di layar hasil */
  const stakeStepper = (
    <div className="stake-step" role="group" aria-label="Taruhan room">
      <button className="gbtn small sq" disabled={tierIndex(stake) <= 0} aria-label="Taruhan lebih kecil" onClick={() => stepStake(-1)}>‹</button>
      <span className="stake-step-v" aria-live="polite">MEJA {TIER_NAMES[tierIndex(stake)].toUpperCase()}</span>
      <button className="gbtn small sq" disabled={tierIndex(stake) >= STAKE_TIERS.length - 1} aria-label="Taruhan lebih besar" onClick={() => stepStake(1)}>›</button>
    </div>
  );

  const setSel = (next: string[]) => { selRef.current = next; setSelected(next); };

  const start = useCallback(() => {
    if (balanceRef.current < maxLoss(rules, stake)) {
      toast.show('Saldo kurang untuk meja ini. Pilih taruhan lebih kecil atau ambil misi.');
      feel.error();
      return;
    }
    settled.current = false;
    selRef.current = [];
    setSelected([]);
    setGhost(null);
    // bot yang "bangkrut" diisi ulang agar angka di papan nama tetap masuk akal
    setBotChips((c) => c.map((v, i) => (i === 0 ? v : v < maxLoss(rules, stake) ? botBase : v)));
    if (online) onlineApi.start(profile.settings.rules, profile.settings.stake);
    else setG(newGame(rules, { previousWinner: lastWinner.current, stake }));
  }, [rules, stake, toast, online, profile.settings.rules, profile.settings.stake, botBase]);

  // giliran bot (offline). Jeda memberi waktu bagi kartu terbang dan titik "berpikir".
  useEffect(() => {
    if (online || !g || g.phase !== 'playing' || g.turn === 0) return;
    const wait = !slow ? 250 : g.plays.length === 0 ? (fast ? 1500 : 1900) : fast ? 520 : 950;
    const t = window.setTimeout(() => {
      setG((cur) => {
        if (!cur || cur.phase !== 'playing' || cur.turn === 0) return cur;
        const p = cur.turn;
        const mv = chooseStrongMove(cur, p, { thinkMs: 220 });
        return (mv ? playCards(cur, p, mv) : pass(cur, p)).state;
      });
    }, wait);
    return () => window.clearTimeout(t);
  }, [g, slow, fast, online]);

  // setiap game yang sedang berjalan wajib dicatat hasilnya sekali saat selesai; mode online: tamu tidak memanggil start(), jadi tandanya diatur di sini
  useEffect(() => {
    if (g && g.phase === 'playing') settled.current = false;
  }, [g]);

  // catat hasil sekali per game
  useEffect(() => {
    if (!g || g.phase !== 'over' || !g.result || settled.current) return;
    settled.current = true;
    const res = g.result;
    const rank = res.order.indexOf(0) + 1;
    const st = playStats(g, 0);
    lastWinner.current = res.order[0];
    setBotChips((c) => c.map((v, i) => (i === 0 ? v : Math.max(0, v + res.deltas[i]))));
    recordGame({
      result: rank === 1 ? 'Juara 1' : `Peringkat ${rank}`,
      delta: res.deltas[0],
      won: rank === 1,
      rank,
      stake: g.stake,
      pairs: st.pairs,
      fiveCards: st.fiveCards,
      bombs: st.bombs,
    });
  }, [g, recordGame]);

  // keluar saat game berjalan = kalah dengan penalti sisa kartu
  useEffect(
    () => () => {
      window.clearTimeout(ghostTimer.current);
      const cur = gRef.current;
      if (cur && cur.phase === 'playing' && !settled.current) {
        settled.current = true;
        const st = playStats(cur, 0);
        recordGame({
          result: 'Keluar dari meja', delta: -abandonPenalty(cur, 0), won: false, rank: 0, stake: cur.stake,
          pairs: st.pairs, fiveCards: st.fiveCards, bombs: st.bombs,
        });
      }
    },
    [recordGame],
  );

  const me = useMemo(() => g?.hands[0] ?? [], [g]);
  const netOk = !online || on.status === 'open';
  const myTurn = !!g && g.phase === 'playing' && g.turn === 0 && netOk;
  myTurnRef.current = myTurn;
  const trick = g?.trick;
  const canPass = myTurn && !!trick?.combo && !g?.mustInclude;
  const shown: Card[] = useMemo(
    () => (sortBy === 'angka' ? me : [...me].sort((a, b) => a.s.localeCompare(b.s) || strength(a, rules) - strength(b, rules))),
    [me, sortBy, rules],
  );
  shownRef.current = shown;
  const slots = useMemo(() => handLayout(shown.length), [shown.length]);
  const order = useMemo(() => new Map(shown.map((c, i) => [id(c), i] as const)), [shown]);

  // kartu yang tidak ikut kombinasi sah mana pun diredupkan (hanya milikmu sendiri, tidak membuka info lawan)
  const playable = useMemo(() => {
    if (!g || !myTurn) return null;
    const s = new Set<string>();
    legalMoves(g, 0).forEach((m) => m.cards.forEach((c) => s.add(id(c))));
    return s;
  }, [g, myTurn]);

  const selCards = useMemo(() => me.filter((c) => selected.includes(id(c))), [me, selected]);
  const check = useMemo(() => (g && myTurn && selCards.length > 0 ? validatePlay(g, 0, selCards) : null), [g, myTurn, selCards]);

  // buang pilihan yang sudah tidak ada di tangan (mis. setelah game baru) atau saat bukan giliranmu
  useEffect(() => {
    const cur = selRef.current;
    if (cur.length && (!myTurn || !cur.every((x) => me.some((c) => id(c) === x)))) setSel([]);
  }, [me, myTurn]);

  // ---------- memilih kartu: ketuk, geser, atau papan ketik ----------
  const applyCard = (cid: string, mode: 'select' | 'deselect', gst: Gesture | null, soft = false): boolean => {
    const cur = selRef.current;
    const has = cur.includes(cid);
    if (mode === 'select') {
      if (has) return false;
      if (cur.length >= MAX_SEL) {
        if (!gst || !gst.warned) { feel.error(); toast.show('Maksimal 5 kartu sekali main.'); }
        if (gst) gst.warned = true;
        return false;
      }
      if (soft) feel.tick(); else feel.select();
      setSel([...cur, cid]);
      return true;
    }
    if (!has) return false;
    if (soft) feel.tick(); else feel.deselect();
    setSel(cur.filter((x) => x !== cid));
    return true;
  };
  const applyIndex = (idx: number, gst: Gesture, soft: boolean) => {
    const c = shownRef.current[idx];
    if (c) applyCard(id(c), gst.mode, gst, soft);
  };
  const cardIndexAt = (x: number, y: number): number => {
    const el = document.elementFromPoint(x, y);
    const c = el && typeof el.closest === 'function' ? (el.closest('[data-ci]') as HTMLElement | null) : null;
    if (!c || !handRef.current || !handRef.current.contains(c)) return -1;
    const n = Number(c.dataset.ci);
    return Number.isInteger(n) ? n : -1;
  };
  const markPress = (idx: number, pressed: boolean) => {
    const el = handRef.current ? handRef.current.querySelector<HTMLElement>(`[data-ci="${idx}"]`) : null;
    if (!el) return;
    if (pressed) el.dataset.press = '1'; else delete el.dataset.press;
  };
  const onHandDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!myTurnRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const idx = cardIndexAt(e.clientX, e.clientY);
    const c = idx >= 0 ? shownRef.current[idx] : undefined;
    if (!c) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* tidak apa-apa tanpa capture */ }
    gesture.current = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, idx0: idx, last: idx, swiping: false, warned: false,
      mode: selRef.current.includes(id(c)) ? 'deselect' : 'select',
    };
    markPress(idx, true);
  };
  const onHandMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const gst = gesture.current;
    if (!gst || e.pointerId !== gst.id) return;
    if (!gst.swiping) {
      if (Math.hypot(e.clientX - gst.x0, e.clientY - gst.y0) < SLOP_PX) return;
      gst.swiping = true;
      markPress(gst.idx0, false);
      applyIndex(gst.idx0, gst, false);
    }
    const idx = cardIndexAt(e.clientX, e.clientY);
    if (idx < 0 || idx === gst.last) return;
    // jari bergerak cepat bisa melompati kartu: terapkan ke semua kartu di antaranya
    const dir = idx > gst.last ? 1 : -1;
    for (let k = gst.last + dir; k !== idx + dir; k += dir) applyIndex(k, gst, true);
    gst.last = idx;
  };
  const endGesture = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const gst = gesture.current;
    if (!gst || e.pointerId !== gst.id) return;
    gesture.current = null;
    markPress(gst.idx0, false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* sudah terlepas */ }
    if (!cancelled && !gst.swiping && myTurnRef.current) applyIndex(gst.idx0, gst, false); // ketukan biasa = ganti pilih/batal
  };

  /** Catat posisi kartu yang akan dimainkan supaya kartu di meja meluncur dari tangan. */
  const captureLaunch = (cards: Card[]) => {
    const root = handRef.current;
    const stage = root ? root.closest('.stage') : null;
    if (!root || !stage || fx.isStill()) { launch.current = null; return; }
    const sr = stage.getBoundingClientRect();
    const unit = sr.width / 100;
    const map: Launch['cards'] = {};
    for (const c of cards) {
      const i = shownRef.current.findIndex((x) => id(x) === id(c));
      const el = i >= 0 ? root.querySelector<HTMLElement>(`[data-ci="${i}"]`) : null;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      map[id(c)] = { x: (r.left + r.width / 2 - sr.left) / unit, y: (r.top + r.height / 2 - sr.top) / unit, rot: slots[i]?.rot ?? 0 };
    }
    launch.current = { at: performance.now(), cards: map };
  };

  const play = () => {
    if (!g || !myTurn) return;
    const cards = me.filter((c) => selRef.current.includes(id(c)));
    const r = playCards(g, 0, cards);
    if (r.error) { feel.error(); return toast.show(r.error); }
    captureLaunch(cards);
    if (online) onlineApi.play(cards.map(id)); else setG(r.state);
    setSel([]);
  };
  const doPass = () => {
    if (!g) return;
    const r = pass(g, 0);
    if (r.error) { feel.error(); return toast.show(r.error); }
    if (online) onlineApi.pass(); else setG(r.state);
    setSel([]);
  };
  const suggest = () => {
    if (!g) return;
    const mv = chooseStrongMove(g, 0, { thinkMs: 150 });
    if (!mv) { feel.error(); return toast.show('Tidak ada kartu yang bisa mengalahkan. Pass saja.'); }
    feel.select();
    setSel(mv.map(id));
  };
  const toggleSort = () => { feel.tick(); setSortBy((s) => (s === 'angka' ? 'suit' : 'angka')); };

  // ---------- obrolan cepat ----------
  const sendChat = (i: number) => {
    const now = Date.now();
    if (now - chatAt.current < CHAT_GAP_MS) { feel.error(); return; }
    chatAt.current = now;
    setChatOpen(false);
    tfx.chat(0, CHAT_LINES[i]);
    feel.pop();
    if (online) onlineApi.emote(i);
    else if (Math.random() < 0.65) {
      // bot membalas sesekali
      const others = CHAT_LINES.map((_, k) => k).filter((k) => k !== i);
      tfx.chat(1 + Math.floor(Math.random() * 3), CHAT_LINES[pick(others)], 900 + Math.random() * 900);
    }
  };
  useEffect(() => {
    if (!online || !on.emote || on.emote.n === emoteSeen.current) return;
    emoteSeen.current = on.emote.n;
    tfx.chat(on.emote.from, CHAT_LINES[on.emote.i] ?? '');
  }, [online, on.emote, tfx.chat]);

  // ---------- kartu di meja ----------
  const centerCards = useMemo(() => (trick?.combo ? sortCards(trick.combo.cards, rules) : []), [trick?.combo, rules]);
  const trickBy = trick?.by ?? null;
  const trickSig = centerCards.length > 0 && trickBy != null ? `${trickBy}:${centerCards.map(id).join(',')}` : '';

  // kartu lama tidak hilang mendadak: tenggelam di bawah kartu baru, atau disapu ke pemenang putaran
  useLayoutEffect(() => {
    const prev = prevTrick.current;
    prevTrick.current = trickSig && trickBy != null ? { sig: trickSig, cards: centerCards, by: trickBy } : null;
    if (!prev || prev.sig === trickSig || !g || fx.isStill()) return;
    if (g.phase === 'playing' && g.plays.length === 0) return; // game baru: tidak ada yang disapu
    window.clearTimeout(ghostTimer.current);
    setGhost({ key: `${prev.sig}>${trickSig}`, cards: prev.cards, by: prev.by, kind: trickSig ? 'under' : 'sweep' });
    ghostTimer.current = window.setTimeout(() => setGhost(null), 760);
  }, [trickSig]); // eslint-disable-line react-hooks/exhaustive-deps

  // kartu yang baru dimainkan meluncur dari tangan (atau dari kursi bot) dan mendarat dengan sedikit pantulan
  useLayoutEffect(() => {
    const root = centerRef.current;
    if (!trickSig || !root || fx.isStill() || typeof root.animate !== 'function') return;
    const stage = root.closest('.stage');
    if (!stage) return;
    const sr = stage.getBoundingClientRect();
    const unit = sr.width / 100;
    const L = launch.current;
    launch.current = null;
    const by = trickBy ?? 0;
    const mine = by === 0 && !!L && performance.now() - L.at < 6000;
    let end = 0;
    root.querySelectorAll<HTMLElement>('[data-tk]').forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const o = mine && L ? L.cards[el.dataset.tk ?? ''] : undefined;
      const src = o ?? ORIGIN[by];
      const dx = sr.left + src.x * unit - (r.left + r.width / 2);
      const dy = sr.top + src.y * unit - (r.top + r.height / 2);
      const dur = o ? 430 : 520;
      const delay = i * 42;
      end = Math.max(end, delay + dur);
      el.animate(
        [
          { translate: `${dx}px ${dy}px`, rotate: `${o ? o.rot : i % 2 ? 14 : -14}deg`, scale: String(o ? CARD_W / MID_W : 0.4), opacity: o ? 1 : 0, offset: 0 },
          { opacity: 1, offset: 0.22 },
        ],
        { duration: dur, delay, easing: 'cubic-bezier(.2,.9,.28,1.1)', fill: 'backwards' },
      );
    });
    root.animate([{ scale: 1 }, { scale: 1.035, offset: 0.45 }, { scale: 1 }], { duration: 280, delay: Math.max(0, end - 110), easing: 'ease-out' });
  }, [trickSig]); // eslint-disable-line react-hooks/exhaustive-deps

  const leaveTable = () => {
    if (online) disconnect();
    go(goBackRoute);
  };
  const back = () => (g && g.phase === 'playing' ? setLeaving(true) : leaveTable());
  const turnName = g && g.phase === 'playing' ? names[g.turn] : '';
  const hint = online && !netOk
    ? 'Menghubungkan ulang…'
    : !g
    ? canSit ? 'Siap? Tekan MULAI GAME.' : 'Saldo belum cukup untuk meja ini.'
    : g.phase === 'over'
      ? 'Game selesai!'
      : myTurn
        ? g.mustInclude
          ? 'Giliranmu. Buka dengan 3♦.'
          : trick?.combo
            ? `Giliranmu. Kalahkan ${KIND_LABEL[trick.combo.kind]}.`
            : 'Giliranmu. Buka putaran baru.'
        : `Menunggu ${turnName}…`;
  const claimable = claimableCount(profile);
  const timerKey = g ? `${g.plays.length}-${g.turn}` : '';
  const holder = g && g.phase === 'playing' && trick?.combo ? trick.by : null;
  const longStake = formatChips(stake).length > 7;
  const sweepTo = ghost ? ORIGIN[ghost.by] : CENTER;
  const ghostStyle = vars({
    '--gx': `calc(var(--u) * ${(sweepTo.x - CENTER.x).toFixed(2)})`,
    '--gy': `calc(var(--u) * ${(sweepTo.y - CENTER.y).toFixed(2)})`,
  });

  return (
    <Stage className={`table-stage hi-${hi}`} felt={felt}>
      {online && !netOk && <div className="net-banner" role="status">Koneksi terputus · menghubungkan ulang… kursimu ditahan, bot main sementara</div>}
      <div className="topbar-game">
        <button className="gbtn small" onClick={back} aria-label="Ganti meja"><Icon name="back" /> MEJA</button>
        <CoinPill balance={profile.balance} />
        <div className="top-right">
          <button className="gbtn small sq" onClick={() => setChatOpen((o) => !o)} aria-label="Obrolan cepat" aria-expanded={chatOpen}><Icon name="chat" /></button>
          <button className="gbtn small sq" onClick={() => setHelpOpen(true)} aria-label="Cara main"><Icon name="help" /></button>
          <button className="gbtn small" onClick={() => setRulesOpen(true)} aria-label="Aturan permainan"><Icon name="cards" /> ATURAN</button>
        </div>
      </div>
      {chatOpen && (
        <>
          <div className="chat-backdrop" onClick={() => setChatOpen(false)} />
          <div className="chat-pop" role="menu" aria-label="Obrolan cepat">
            {CHAT_LINES.map((t, i) => (
              <button key={t} className="chat-line" role="menuitem" onClick={() => sendChat(i)}>{t}</button>
            ))}
          </div>
        </>
      )}

      <div className="oval">
        <svg className="felt-art" viewBox="0 0 740 310" aria-hidden="true">
          <defs><path id="feltArc" d="M 95,168 A 275,118 0 0 0 645,168" /></defs>
          <ellipse cx="370" cy="155" rx="338" ry="137" fill="none" stroke="rgba(255,226,140,.38)" strokeWidth="2" />
          <ellipse cx="370" cy="155" rx="326" ry="128" fill="none" stroke="rgba(255,226,140,.16)" strokeWidth="1" strokeDasharray="3 7" />
          <text className="felt-text"><textPath href="#feltArc" startOffset="50%" textAnchor="middle">ROYAL FELT · CAPSA BANTING</textPath></text>
          {hi > 0 && (
            <g className="bulbs">
              {BULBS.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r="3.2" style={vars({ '--i': i })} />)}
            </g>
          )}
        </svg>
        <div className="felt-light" />
      </div>
      <div className="oval-mark left" aria-hidden="true">♠</div>
      <div className="oval-mark right" aria-hidden="true">♦</div>
      <div className="landing" aria-hidden="true" />
      {hi === 2 && <div className="spot" aria-hidden="true" />}

      <Dealer className="table-dealer" animate={slow} mode={tfx.dealerMode} onDone={tfx.onDealerDone} />

      <div className={`stake-badge ${longStake ? 'long' : ''}`} aria-label={`Taruhan ${formatChips(stake)} per kartu`}>
        <Chip value={stake} stack={3} label={chipLabel(stake)} />
        <span className="stake-txt"><small>TARUHAN</small><b>{formatChips(stake)}</b><small>per kartu sisa</small></span>
      </div>

      <div className="bubble" role="status" key={tfx.bubble ?? hint}><span>{tfx.bubble ?? hint}</span></div>

      {[1, 2, 3].map((p) => (
        <Seat key={p} p={p} g={g} chips={online ? null : botChips[p]} name={names[p]} say={tfx.says[p]} timer={human[p] ? timerKey : null} human={human[p]} crown={holder === p} />
      ))}
      <Seat p={0} g={g} chips={profile.balance} name={names[0]} say={tfx.says[0]} timer={human[0] ? timerKey : null} human={human[0]} crown={holder === 0} />

      {tfx.callout && <div className={`callout ${tfx.callout.tone}`} key={`call-${tfx.callout.id}`}><span>{tfx.callout.text}</span></div>}
      {tfx.turnRibbon > 0 && <div className="turn-ribbon" key={`ribbon-${tfx.turnRibbon}`} aria-hidden="true"><span>GILIRANMU</span></div>}
      {tfx.dealing > 0 && <DealFly key={`deal-${tfx.dealing}`} />}

      {/* kartu yang sedang ada di meja */}
      <div className="center">
        {g && centerCards.length > 0 && trick?.by != null && (
          <div className="center-label" key={`by${trick.by}`}>{names[trick.by]} · <b>{KIND_LABEL[trick.combo!.kind]}</b></div>
        )}
        {g && centerCards.length === 0 && g.phase === 'playing' && (
          <div className="center-label">Putaran baru · {names[g.turn]} membuka</div>
        )}
        <div className="center-stack">
          {ghost && (
            <div className={`ghost ${ghost.kind}`} key={ghost.key} style={ghostStyle} aria-hidden="true">
              {ghost.cards.map((c, i) => (
                <CapsaCard key={id(c)} card={c} size="mid" style={vars({ '--tr': `${TRICK_ROT[i % 5]}deg`, '--ty': TRICK_DY[i % 5], '--i': i })} />
              ))}
            </div>
          )}
          {centerCards.length > 0 && (
            <div className="center-cards" ref={centerRef} key={trickSig}>
              {centerCards.map((c, i) => (
                <CapsaCard key={id(c)} card={c} size="mid" tk={id(c)} style={vars({ '--tr': `${TRICK_ROT[i % 5]}deg`, '--ty': TRICK_DY[i % 5] })} />
              ))}
            </div>
          )}
        </div>
      </div>

      {!g && online && on.room && (
        <div className="room-code" aria-label="Kode room"><small>KODE ROOM</small><b>{on.room.code}</b>
          <span>{on.room.seats.filter((x) => x && !x.bot).length}/4 pemain · kursi kosong diisi bot</span></div>
      )}
      {hostLocal && !g && stakeStepper}

      {!g && (
        <div className="start-box">
          {(!online || isHost) ? (
            <button className="gbtn green big shine" onClick={start} disabled={!canSit}>MULAI GAME</button>
          ) : (
            <small>Menunggu host memulai game… Host yang mengatur taruhan dan aturan.</small>
          )}
          <button className="gbtn small" onClick={leaveTable}>{online ? 'KELUAR ROOM' : 'GANTI MEJA'}</button>
          <small>{ruleSummary(rules)}</small>
          {!canSit && <small className="warn">Butuh {formatChips(need)} koin untuk bermain di meja ini.</small>}
          {online && on.error && <small className="warn">{on.error}</small>}
        </div>
      )}

      {/* tangan pemain: kartu besar, ketuk atau geser jari untuk memilih */}
      <div className={`hand-glow ${myTurn ? 'on' : ''}`} aria-hidden="true" />
      <div
        className={`hand ${myTurn ? 'live' : ''} ${tfx.dealing > 0 ? 'dealing' : ''}`}
        key={`hand-${tfx.deals}`}
        ref={handRef}
        role="group"
        aria-label="Kartu di tanganmu"
        onPointerDown={onHandDown}
        onPointerMove={onHandMove}
        onPointerUp={(e) => endGesture(e, false)}
        onPointerCancel={(e) => endGesture(e, true)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {me.map((c) => {
          // urutan DOM tetap (urutan tangan dari mesin); urutan tampil hanya lewat --x/zIndex, jadi mengganti
          // urutan (angka/suit) membuat kartu meluncur mulus, bukan dipindah/dibuat ulang oleh React
          const i = order.get(id(c)) ?? 0;
          const s = slots[i];
          const cid = id(c);
          return (
            <CapsaCard
              key={cid}
              card={c}
              size="hand"
              index={i}
              selected={selected.includes(cid)}
              dim={!!g && g.phase === 'playing' && (!myTurn || (!!playable && !playable.has(cid)))}
              onClick={myTurn ? (e) => { if (e.detail === 0) applyCard(cid, selRef.current.includes(cid) ? 'deselect' : 'select', null); } : undefined}
              style={{
                ...vars({
                  '--x': s.x.toFixed(3),
                  '--y': s.y.toFixed(3),
                  '--rot': `${s.rot.toFixed(3)}deg`,
                  '--ox': (DEALER_AT.x - (HAND_X + s.x + CARD_W / 2)).toFixed(2),
                  '--oy': (DEALER_AT.y - (HAND_Y + s.y + CARD_H / 2)).toFixed(2),
                  '--dd': `${slow ? (0.45 + i * 0.065).toFixed(3) : 0}s`,
                }),
                zIndex: i + 1,
              }}
            />
          );
        })}
      </div>

      <div className="actions">
        <button className="gbtn small mini" onClick={toggleSort} disabled={!g} aria-label={`Urutkan kartu, sekarang: ${sortBy}`}>
          <Icon name="sort" /><span>URUT<small>{sortBy === 'angka' ? 'ANGKA' : 'SUIT'}</small></span>
        </button>
        <button className="gbtn small mini" onClick={suggest} disabled={!myTurn} aria-label="Saran langkah terbaik">
          <Icon name="bulb" /><span>SARAN</span>
        </button>
        <button className="gbtn red wide" onClick={doPass} disabled={!canPass}>PASS</button>
        <button
          className={`gbtn green big wide play-btn ${check?.ok ? 'ready' : check ? 'bad' : ''}`}
          onClick={play}
          disabled={!myTurn || selected.length === 0}
        >
          <span>MAINKAN</span>
          {selected.length > 0 && <small>{check?.ok ? SHORT[check.combo.kind] : 'belum sah'}</small>}
        </button>
      </div>

      {g?.phase === 'over' && g.result && tfx.resultReady && (
        <div className="overlay in-stage" role="dialog" aria-modal="true" aria-label="Hasil game">
          <div className={`result ${g.result.order[0] === 0 ? 'won' : ''} ${g.result.deltas[0] >= BIG_WIN ? 'big' : ''}`}>
            <h3>{g.result.order[0] === 0 ? (g.result.deltas[0] >= BIG_WIN ? 'MENANG BESAR!' : 'KAMU MENANG!') : 'GAME SELESAI'}</h3>
            <ol>
              {g.result.order.map((p, pos) => (
                <ResultRow key={p} pos={pos} me={p === 0} name={names[p]} left={g.result!.cardsLeft[p]} delta={g.result!.deltas[p]} />
              ))}
            </ol>
            {claimable > 0 && (
              <button className="mis-ready" onClick={() => go('misi')}><Icon name="target" /> {claimable} misi siap diambil · klaim koin</button>
            )}
            {online && isHost && stakeStepper}
            <div className="result-actions">
              <button className="gbtn" onClick={leaveTable}>{online ? 'KELUAR ROOM' : 'GANTI MEJA'}</button>
              {online && !isHost ? (
                <small>Menunggu host…</small>
              ) : profile.balance >= need ? (
                <button className="gbtn green" onClick={start}>MAIN LAGI</button>
              ) : (
                <button className="gbtn gold" onClick={() => go('misi')}>SALDO KURANG · AMBIL MISI</button>
              )}
            </div>
          </div>
        </div>
      )}

      {rulesOpen && (
        <RulesDialog rules={rules} readOnly={(!!g && g.phase === 'playing') || (online && !isHost)} onSave={(r) => updateSettings({ rules: r })} onClose={() => setRulesOpen(false)} />
      )}
      {helpOpen && <HelpDialog rules={rules} stake={stake} onClose={() => setHelpOpen(false)} />}
      {leaving && (
        <ConfirmDialog
          danger
          title="Tinggalkan meja?"
          message={`Game sedang berjalan. Jika keluar sekarang kamu dianggap kalah dan kena penalti${g && g.phase === 'playing' ? ` ${formatChips(abandonPenalty(g, 0))} koin` : ' sisa kartu'}.`}
          confirmLabel="Keluar"
          cancelLabel="Tetap main"
          onCancel={() => setLeaving(false)}
          onConfirm={() => {
            setLeaving(false);
            leaveTable();
          }}
        />
      )}
      {toast.node}
    </Stage>
  );
}

/** Kartu-kartu terbang dari bandar ke kursi bot saat game dimulai (kartu milikmu terbang sendiri dari bandar ke tangan). */
function DealFly() {
  const order = [1, 2, 3];
  return (
    <div className="deal-fly" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => {
        const t = SEATS[order[i % 3]];
        return (
          <i
            key={i}
            style={vars({
              '--dx': `calc(var(--u) * ${t.x - DEALER_AT.x})`,
              '--dy': `calc(var(--u) * ${t.y - DEALER_AT.y})`,
              animationDelay: `${0.4 + i * 0.09}s`,
            })}
          />
        );
      })}
    </div>
  );
}

function ResultRow({ pos, me, name, left, delta }: { pos: number; me: boolean; name: string; left: number; delta: number }) {
  const shown = useCountUp(delta, 1100, 0);
  return (
    <li className={me ? 'me' : ''} style={{ animationDelay: `${pos * 0.09}s` }}>
      <span className={`medal m${pos + 1}`}>{pos + 1}</span>
      <span className="nm">{name}</span>
      <span className="left">{left} kartu sisa</span>
      <span className={delta >= 0 ? 'pos-d' : 'neg-d'}>{formatDelta(shown)}</span>
    </li>
  );
}

function Seat({ p, g, chips, name, say, timer, human, crown }: {
  p: number; g: GameState | null; chips: number | null; name: string; say: string | null; timer: string | null; human: boolean; crown: boolean;
}) {
  const count = g?.hands[p].length ?? 13;
  const playing = !!g && g.phase === 'playing';
  const turn = playing && g!.turn === p;
  const passed = !!g && g.trick.passed[p] && !g.finished.includes(p);
  const rank = g ? g.finished.indexOf(p) + 1 : 0;
  const isMe = p === 0;
  const low = playing && rank === 0 ? (count === 1 ? 'last1' : count === 2 ? 'last2' : '') : '';
  const thinking = turn && !isMe && !human;
  return (
    <div className={`seat s${p} ${turn ? 'turn' : ''} ${low}`} style={at(SEATS[p])}>
      <div className="avatar-wrap">
        {crown && rank === 0 && <div className="crown" aria-label="Kartu tertinggi di meja"><Icon name="crown" /></div>}
        <div className="avatar-ring"><Avatar seed={p} /></div>
        {turn && timer && (
          <svg className="ring" viewBox="0 0 100 100" aria-hidden="true" key={timer}>
            <circle cx="50" cy="50" r="47" pathLength="100" />
          </svg>
        )}
        {!isMe && g && <div className="count" aria-label={`${count} kartu`}><i />{count}</div>}
        {thinking && <div className="think" aria-label="Sedang berpikir"><i /><i /><i /></div>}
        {passed && <div className="tag-pass">PASS</div>}
        {rank > 0 && <div className="tag-done">#{rank}</div>}
        {say && <div className="say" key={say}>{say}</div>}
      </div>
      <div className="plate">
        <b>{name}</b>
        {!isMe && <span>{chips === null ? 'Online' : formatChips(chips)}</span>}
      </div>
    </div>
  );
}
