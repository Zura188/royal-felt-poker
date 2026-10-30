import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, PlayRecord } from '@rfp/capsa-engine';
import type { DealerMode } from '../components/Dealer';
import { feel, fx, stagePoint } from '../fx/bus';
import { sfx } from '../fx/sound';

/** Posisi kursi pada panggung 100 x 56,25 (satuan u): kamu kiri (di atas tangan), lalu searah jarum jam. */
export const SEATS: Array<{ x: number; y: number }> = [
  { x: 8.6, y: 35.6 },
  { x: 9, y: 21 },
  { x: 50, y: 5.5 },
  { x: 91, y: 21 },
];
/** Dari mana kartu yang dimainkan "terbang" ke tengah meja (kamu: dari tangan). */
export const ORIGIN: Array<{ x: number; y: number }> = [{ x: 50, y: 49 }, SEATS[1], SEATS[2], SEATS[3]];
export const CENTER = { x: 50, y: 34.6 };
export const DEALER_AT = { x: 50, y: 19 };
/** Kartu butuh waktu terbang sebelum mendarat di meja; suara, percikan, dan seruan menunggu momen itu. */
export const LAND_MS = 300;

export interface Callout { id: number; text: string; tone: 'good' | 'hot' | 'bomb' | 'win' }

const CALL: Record<string, [string, Callout['tone']]> = {
  triple: ['TRIPLE', 'good'],
  straight: ['STRAIGHT', 'good'],
  flush: ['FLUSH', 'good'],
  fullhouse: ['FULL HOUSE', 'hot'],
  quad: ['BOM! FOUR OF A KIND', 'bomb'],
  straightflush: ['STRAIGHT FLUSH!', 'bomb'],
};

const LINES = {
  start: ['Kartu dibagikan. Selamat bermain!', 'Semoga beruntung!', 'Siap-siap, kartu datang!'],
  bomb: ['Wah, bom!', 'Kartu besar muncul!', 'Hati-hati, ada bom!'],
  win: ['Hebat! Juara satu!', 'Luar biasa, kamu menang!', 'Mantap! Koin masuk!'],
  big: ['Kemenangan raksasa!', 'Saldo meledak!', 'Sultan baru lahir!'],
  second: ['Bagus, peringkat dua!', 'Hampir juara!'],
  lose: ['Jangan menyerah, main lagi!', 'Sedikit lagi!', 'Kartunya kurang berpihak. Coba lagi!'],
};
const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const stillMode = () => typeof document !== 'undefined' && document.documentElement.classList.contains('reduce-motion');

/** Kemenangan sebesar ini (koin) dianggap "besar". */
export const BIG_WIN = 1_000_000;
export const MEGA_WIN = 5_000_000;

export interface TableFx {
  dealerMode: DealerMode;
  onDealerDone: () => void;
  /** kunci animasi bagi kartu (0 = tidak aktif) */
  dealing: number;
  /** jumlah pembagian kartu sejak layar dibuka; dipakai sebagai kunci tangan agar kartu dianimasikan ulang tiap game baru */
  deals: number;
  callout: Callout | null;
  /** teks singkat di atas avatar tiap kursi */
  says: Array<string | null>;
  /** pesan sementara dari bandar (menimpa petunjuk) */
  bubble: string | null;
  /** hasil game boleh ditampilkan (setelah kartu terakhir terlihat) */
  resultReady: boolean;
  /** naik tiap giliranmu dimulai; 0 = pita "GILIRANMU" tidak tampil */
  turnRibbon: number;
  /** tampilkan ucapan cepat di atas kursi p (setelah `delayMs` bila diberikan) */
  chat: (p: number, text: string, delayMs?: number) => void;
}

export interface TableFxOptions {
  /** bot sesekali berseloroh (hanya mode offline) */
  banter?: boolean;
}

/** Memetakan perubahan state game menjadi suara, partikel, animasi bandar, dan seruan kombo. */
export function useTableFx(g: GameState | null, opts: TableFxOptions = {}): TableFx {
  const [dealerMode, setDealerMode] = useState<DealerMode>('idle');
  const [dealing, setDealing] = useState(0);
  const [deals, setDeals] = useState(0);
  const [callout, setCallout] = useState<Callout | null>(null);
  const [says, setSays] = useState<Array<string | null>>([null, null, null, null]);
  const [bubble, setBubble] = useState<string | null>(null);
  const [resultReady, setResultReady] = useState(false);
  const [turnRibbon, setTurnRibbon] = useState(0);
  const banter = !!opts.banter;

  const timers = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; }, []);

  const bubbleId = useRef(0);
  const say = useCallback((text: string, ms = 2600) => {
    const id = ++bubbleId.current;
    setBubble(text);
    later(() => { if (bubbleId.current === id) setBubble(null); }, ms);
  }, [later]);

  const seatSay = useCallback((p: number, text: string, ms = 1700) => {
    setSays((s) => s.map((v, i) => (i === p ? text : v)));
    later(() => setSays((s) => s.map((v, i) => (i === p && v === text ? null : v))), ms);
  }, [later]);

  const chat = useCallback((p: number, text: string, delayMs = 0) => {
    if (p < 0 || p > 3 || !text) return;
    const show = () => {
      seatSay(p, text, 2400);
      if (p !== 0) sfx.play('pop', 0.7);
    };
    if (delayMs > 0) later(show, delayMs); else show();
  }, [seatSay, later]);

  /** Seloroh bot: jarang (maks. sekali per 6 detik) supaya tidak mengganggu. */
  const lastBanter = useRef(0);
  const joke = useCallback((who: number, text: string, delay = 700) => {
    if (!banter || who < 1 || who > 3) return;
    const now = Date.now();
    if (now - lastBanter.current < 6000) return;
    lastBanter.current = now;
    later(() => { sfx.play('pop', 0.6); seatSay(who, text, 2200); }, delay);
  }, [banter, later, seatSay]);
  const someBot = (not: number) => pick([1, 2, 3].filter((x) => x !== not));

  const onPlay = useCallback((g: GameState, rec: PlayRecord, last: boolean) => {
    const p = rec.player;
    const mine = p === 0;
    if (!rec.combo) { feel.pass(mine); return; }
    const combo = rec.combo;
    const left = g.hands[p].length;
    // semua efek benturan menunggu kartu mendarat di meja, supaya suara dan gambar sejalan
    later(() => {
      feel.play(mine);
      const n = combo.cards.length;
      fx.burst('sparks', CENTER.x, CENTER.y, { count: n >= 5 ? 16 : 7, power: n >= 5 ? 0.9 : 0.55, color: 'white' });
      const info = CALL[combo.kind];
      if (info) {
        const id = Date.now() + Math.random();
        setCallout({ id, text: info[0], tone: info[1] });
        later(() => setCallout((c) => (c && c.id === id ? null : c)), 1600);
        if (info[1] === 'bomb') {
          feel.bomb();
          seatSay(p, 'Bom!');
          say(pick(LINES.bomb));
          if (Math.random() < 0.7) joke(someBot(p), 'Wah, parah!', 1100);
        } else feel.combo();
      }
      if (last) {
        if (left === 1) { sfx.play('warn'); seatSay(p, 'Satu lagi!'); }
        else if (left === 0) {
          sfx.play('finish');
          seatSay(p, 'Habis!');
          fx.burst('confetti', SEATS[p].x, SEATS[p].y, { count: 22, power: 0.8 });
          if (Math.random() < 0.6) { if (p >= 1) joke(p, 'Mantap!', 1300); else joke(someBot(0), 'GG!', 1300); }
        }
      }
    }, stillMode() ? 0 : LAND_MS);
  }, [later, say, seatSay, joke]);

  /** Koin terbang: menang = dari tengah meja ke kantong saldo; kalah = dari kantong saldo ke pemenang. */
  const flyCoins = useCallback((delta: number, winner: number) => {
    const el = document.querySelector('.stage .coin-pill .ico.coin');
    const pill = (el ? stagePoint(el) : null) ?? { x: 12, y: 3 };
    const n = Math.min(34, 12 + Math.round(Math.abs(delta) / 150_000));
    if (delta > 0) fx.fly({ x: CENTER.x, y: CENTER.y }, pill, n);
    else if (delta < 0) fx.fly(pill, SEATS[winner] ?? CENTER, Math.max(8, Math.round(n * 0.6)));
    const ticks = Math.min(8, Math.max(3, Math.round(n / 4)));
    for (let i = 0; i < ticks; i++) later(() => sfx.play('coin', 0.45), 600 + i * 110);
  }, [later]);

  const prev = useRef<{ sig: string; plays: number; phase: string; turn: number } | null>(null);
  useEffect(() => {
    if (!g) { prev.current = null; setResultReady(false); return; }
    const p = prev.current;
    const sig = g.hands[0].map((c) => c.r + c.s).join(',');
    const fresh = g.phase === 'playing' && g.plays.length === 0 && (!p || p.sig !== sig);

    if (fresh) {
      setDeals((n) => n + 1);
      setResultReady(false);
      setSays([null, null, null, null]);
      setCallout(null);
      setTurnRibbon(0);
      sfx.play('shuffle');
      say(pick(LINES.start));
      if (!stillMode()) {
        setDealerMode('deal');
        setDealing(Date.now());
        later(() => setDealing(0), 2300);
        for (let i = 0; i < 16; i++) later(() => sfx.play('deal', 0.7), 350 + i * 75);
      }
    } else if (p && g.plays.length > p.plays) {
      for (let i = p.plays; i < g.plays.length; i++) onPlay(g, g.plays[i], i === g.plays.length - 1);
    }

    if (g.phase === 'over' && (!p || p.phase !== 'over')) {
      const rank = g.result ? g.result.order.indexOf(0) + 1 : 0;
      const delta = g.result ? g.result.deltas[0] : 0;
      const winner = g.result ? g.result.order[0] : 0;
      setTurnRibbon(0);
      later(() => setResultReady(true), 950);
      later(() => {
        flyCoins(delta, winner);
        if (rank === 1) {
          const mega = delta >= MEGA_WIN;
          const big = delta >= BIG_WIN;
          if (big) {
            const id = Date.now() + Math.random();
            setCallout({ id, text: mega ? 'MEGA WIN!!' : 'BIG WIN!', tone: 'win' });
            later(() => setCallout((c) => (c && c.id === id ? null : c)), 2400);
            feel.jackpot();
            fx.rain('coins', mega ? 4200 : 3000, mega ? 40 : 26);
            say(pick(LINES.big), 3600);
          } else {
            feel.win();
            say(pick(LINES.win), 3200);
          }
          fx.rain('confetti', 2800, 36);
          fx.rain('coins', 2400, 18);
          fx.burst('confetti', 14, 52, { count: 40, power: 1.5 });
          fx.burst('confetti', 86, 52, { count: 40, power: 1.5 });
          [0, 220, 480, 760, 1050, 1400].forEach((d) => later(() => sfx.play('coin', 0.6), d));
          setDealerMode('cheer');
          later(() => setDealerMode('idle'), 3300);
          if (Math.random() < 0.7) joke(someBot(0), 'GG!', 1500);
        } else if (rank === 2) {
          sfx.play('finish');
          fx.burst('confetti', 50, 40, { count: 26, power: 1.1 });
          setDealerMode('cheer');
          say(pick(LINES.second), 2400);
          later(() => setDealerMode('idle'), 2000);
        } else {
          feel.lose();
          say(pick(LINES.lose), 3000);
          if (Math.random() < 0.5) joke(winner >= 1 ? winner : someBot(0), pick(['Santai bro', 'Hehehe']), 1500);
        }
      }, 650);
    } else if (g.phase === 'playing' && p && p.phase === 'playing' && g.turn === 0 && p.turn !== 0 && !fresh) {
      // giliranmu terasa setelah kartu lawan mendarat
      later(() => {
        sfx.play('turn');
        setTurnRibbon((n) => n + 1);
        later(() => setTurnRibbon(0), 1300);
      }, stillMode() ? 0 : LAND_MS + 140);
    }
    prev.current = { sig: fresh || !p ? sig : p.sig, plays: g.plays.length, phase: g.phase, turn: g.turn };
  }, [g, later, onPlay, say, flyCoins, joke]);

  const onDealerDone = useCallback(() => setDealerMode((m) => (m === 'deal' ? 'idle' : m)), []);
  return { dealerMode, onDealerDone, dealing, deals, callout, says, bubble, resultReady, turnRibbon, chat };
}
