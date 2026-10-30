/**
 * Efek suara hasil sintesis WebAudio (tanpa berkas audio): ringan, jalan offline, dan bisa dirender
 * ke OfflineAudioContext untuk diukur dalam tes.
 */
export type SfxName =
  | 'click' | 'select' | 'deselect' | 'deal' | 'shuffle' | 'play' | 'playSoft' | 'pass' | 'turn' | 'combo'
  | 'bomb' | 'win' | 'lose' | 'coin' | 'claim' | 'warn' | 'finish' | 'error' | 'tick' | 'pop' | 'jackpot';

export const SFX_NAMES: SfxName[] = [
  'click', 'select', 'deselect', 'deal', 'shuffle', 'play', 'playSoft', 'pass', 'turn', 'combo',
  'bomb', 'win', 'lose', 'coin', 'claim', 'warn', 'finish', 'error', 'tick', 'pop', 'jackpot',
];

interface ToneOpts { f: number; to?: number; dur: number; type?: OscillatorType; vol?: number; at?: number; attack?: number }
interface HissOpts { f: number; to?: number; dur: number; type?: BiquadFilterType; q?: number; vol?: number; at?: number; attack?: number }

export class SfxEngine {
  private noiseBuf: AudioBuffer | null = null;
  constructor(private ctx: BaseAudioContext, private out: AudioNode) {}

  private noise(): AudioBuffer {
    if (!this.noiseBuf) {
      const n = this.ctx.sampleRate;
      const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      let s = 12345;
      for (let i = 0; i < n; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
      this.noiseBuf = b;
    }
    return this.noiseBuf;
  }

  private env(g: GainNode, t: number, dur: number, vol: number, attack: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.01));
  }

  tone(o: ToneOpts, base: number) {
    const t = base + (o.at ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    this.env(g, t, o.dur, o.vol ?? 0.2, o.attack ?? 0.004);
    osc.connect(g).connect(this.out);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  hiss(o: HissOpts, base: number) {
    const t = base + (o.at ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise();
    src.loop = true;
    const flt = this.ctx.createBiquadFilter();
    flt.type = o.type ?? 'bandpass';
    flt.frequency.setValueAtTime(o.f, t);
    if (o.to) flt.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    flt.Q.value = o.q ?? 0.8;
    const g = this.ctx.createGain();
    this.env(g, t, o.dur, o.vol ?? 0.2, o.attack ?? 0.003);
    src.connect(flt).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.dur + 0.05);
  }

  play(name: SfxName, vol = 1, at = 0) {
    const t = this.ctx.currentTime + at;
    const T = (o: ToneOpts) => this.tone({ ...o, vol: (o.vol ?? 0.2) * vol }, t);
    const H = (o: HissOpts) => this.hiss({ ...o, vol: (o.vol ?? 0.2) * vol }, t);
    switch (name) {
      case 'click':
        T({ f: 1400, to: 900, dur: 0.05, vol: 0.5 });
        H({ f: 4500, type: 'highpass', dur: 0.025, vol: 0.14 });
        break;
      case 'select':
        T({ f: 880, to: 1180, dur: 0.06, type: 'triangle', vol: 0.55 });
        break;
      case 'deselect':
        T({ f: 760, to: 540, dur: 0.055, type: 'triangle', vol: 0.45 });
        break;
      case 'deal':
        H({ f: 1200, to: 3800, q: 1.2, dur: 0.09, vol: 0.6 });
        T({ f: 220, to: 110, dur: 0.055, vol: 0.2 });
        break;
      case 'shuffle':
        for (let i = 0; i < 9; i++) {
          H({ f: 1000 + (i % 3) * 500, to: 3500, q: 1.1, dur: 0.07, vol: 0.18, at: i * 0.05 });
        }
        break;
      case 'play':
      case 'playSoft': {
        const k = name === 'playSoft' ? 0.62 : 1;
        H({ f: 2200, to: 900, type: 'lowpass', q: 0.7, dur: 0.075, vol: 0.38 * k });
        T({ f: 170, to: 70, dur: 0.12, vol: 0.34 * k });
        H({ f: 3200, q: 1.0, dur: 0.03, vol: 0.12 * k });
        break;
      }
      case 'pass':
        T({ f: 330, to: 250, dur: 0.14, type: 'triangle', vol: 0.16 });
        T({ f: 247, to: 196, dur: 0.16, type: 'triangle', vol: 0.14, at: 0.09 });
        break;
      case 'turn':
        T({ f: 988, dur: 0.18, vol: 0.13 });
        T({ f: 1318, dur: 0.24, vol: 0.1, at: 0.07 });
        break;
      case 'combo':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => T({ f, dur: 0.2, type: 'triangle', vol: 0.17, at: i * 0.05 }));
        H({ f: 6500, type: 'highpass', dur: 0.28, vol: 0.05, at: 0.1 });
        break;
      case 'bomb':
        H({ f: 1800, q: 0.8, dur: 0.05, vol: 0.5 });
        T({ f: 110, to: 28, dur: 0.75, vol: 0.62 });
        H({ f: 600, to: 120, type: 'lowpass', q: 0.7, dur: 0.55, vol: 0.5 });
        H({ f: 3000, to: 800, type: 'highpass', dur: 0.38, vol: 0.22, at: 0.02 });
        T({ f: 62, dur: 0.9, type: 'sawtooth', vol: 0.1, attack: 0.02 });
        break;
      case 'win':
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
          T({ f, dur: 0.36, type: 'triangle', vol: 0.21, at: i * 0.11 });
          T({ f: f / 2, dur: 0.3, type: 'square', vol: 0.05, at: i * 0.11 });
        });
        [523.25, 659.25, 783.99, 1046.5].forEach((f) => T({ f, dur: 0.95, type: 'triangle', vol: 0.11, at: 0.6 }));
        H({ f: 7000, type: 'highpass', dur: 0.8, vol: 0.05, at: 0.6 });
        break;
      case 'lose':
        [392, 349.23, 311.13, 261.63].forEach((f, i) => T({ f, dur: 0.36, type: 'triangle', vol: 0.15, at: i * 0.2 }));
        break;
      case 'coin':
        T({ f: 1318.5, dur: 0.12, vol: 0.18 });
        T({ f: 1975.5, dur: 0.26, vol: 0.16, at: 0.06 });
        H({ f: 7000, type: 'highpass', dur: 0.05, vol: 0.04, at: 0.06 });
        break;
      case 'claim':
        for (let i = 0; i < 7; i++) {
          const f = 1200 + ((i * 337) % 600);
          T({ f, dur: 0.14, vol: 0.13, at: i * 0.07 });
          T({ f: f * 1.5, dur: 0.22, vol: 0.1, at: i * 0.07 + 0.05 });
        }
        [1046.5, 1318.5, 1568].forEach((f) => T({ f, dur: 0.5, type: 'triangle', vol: 0.1, at: 0.55 }));
        break;
      case 'warn':
        for (let i = 0; i < 3; i++) T({ f: 880, dur: 0.09, type: 'square', vol: 0.08, at: i * 0.13 });
        break;
      case 'finish':
        T({ f: 659.25, dur: 0.14, type: 'triangle', vol: 0.17 });
        T({ f: 880, dur: 0.22, type: 'triangle', vol: 0.17, at: 0.09 });
        break;
      case 'error':
        T({ f: 200, to: 150, dur: 0.15, type: 'square', vol: 0.2 });
        T({ f: 165, to: 120, dur: 0.18, type: 'square', vol: 0.2, at: 0.13 });
        break;
      case 'tick': // detak roda saat melewati sekat
        T({ f: 1900, to: 1400, dur: 0.055, type: 'triangle', vol: 0.5 });
        H({ f: 5200, type: 'highpass', dur: 0.03, vol: 0.12 });
        break;
      case 'pop': // obrolan cepat muncul
        T({ f: 520, to: 940, dur: 0.08, vol: 0.4 });
        T({ f: 1320, dur: 0.06, vol: 0.12, at: 0.05 });
        break;
      case 'jackpot':
        [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
          T({ f, dur: 0.5, type: 'triangle', vol: 0.2, at: i * 0.075 });
          T({ f: f / 2, dur: 0.4, type: 'square', vol: 0.04, at: i * 0.075 });
        });
        [1046.5, 1318.5, 1568, 2093].forEach((f) => T({ f, dur: 1.3, type: 'triangle', vol: 0.1, at: 0.6 }));
        H({ f: 7000, type: 'highpass', dur: 1.2, vol: 0.06, at: 0.55 });
        for (let i = 0; i < 8; i++) T({ f: 1500 + ((i * 411) % 900), dur: 0.12, vol: 0.09, at: 0.7 + i * 0.09 });
        break;
    }
  }
}

/** Merender satu efek ke OfflineAudioContext dan mengukur puncak serta RMS (untuk tes). */
export async function renderSfxStats(name: SfxName, seconds = 2.5): Promise<{ peak: number; rms: number; activeMs: number }> {
  const sr = 44100;
  const ctx = new OfflineAudioContext(1, Math.floor(sr * seconds), sr);
  const comp = ctx.createDynamicsCompressor();
  comp.connect(ctx.destination);
  new SfxEngine(ctx, comp).play(name);
  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0);
  let peak = 0, sum = 0, active = 0;
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]);
    if (a > peak) peak = a;
    sum += d[i] * d[i];
    if (a > 0.003) active++;
  }
  return { peak, rms: Math.sqrt(sum / d.length), activeMs: (active / sr) * 1000 };
}

class SoundBus {
  private ctx: AudioContext | null = null;
  private engine: SfxEngine | null = null;
  private master: GainNode | null = null;
  enabled = true;
  volume = 0.8;

  /** Harus dipanggil dari gestur pengguna (ketuk/tekan tombol); aman dipanggil berulang. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const comp = this.ctx.createDynamicsCompressor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        comp.connect(this.master).connect(this.ctx.destination);
        this.engine = new SfxEngine(this.ctx, comp);
        document.addEventListener('visibilitychange', () => {
          if (!this.ctx) return;
          if (document.hidden) void this.ctx.suspend().catch(() => {});
          else void this.ctx.resume().catch(() => {});
        });
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    } catch { /* audio tidak tersedia: game tetap jalan tanpa suara */ }
  }

  get running(): boolean { return !!this.ctx && this.ctx.state === 'running'; }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  play(name: SfxName, vol = 1, at = 0): void {
    if (!this.enabled || !this.engine || !this.running) return;
    try { this.engine.play(name, vol, at); } catch { /* abaikan */ }
  }
}

export const sfx = new SoundBus();
