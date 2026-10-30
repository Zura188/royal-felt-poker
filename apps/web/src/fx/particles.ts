/** Mesin partikel kanvas (koin, konfeti, percikan, debu emas). Koordinat dalam satuan panggung: 100 x 56,25. */
export const W_U = 100;
export const H_U = 56.25;

export type ParticleKind = 'coin' | 'confetti' | 'spark' | 'dust';

interface P {
  kind: ParticleKind;
  x: number; y: number; vx: number; vy: number;
  g: number; drag: number;
  rot: number; vr: number; spin: number; vs: number;
  size: number; life: number; age: number; hue: number; tw: number;
}

/** Koin yang terbang melengkung (kurva Bezier) dari satu titik ke titik lain, bukan terkena gravitasi. */
interface Flier { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number; delay: number; dur: number; age: number; size: number; spin: number; vs: number }

const CONFETTI = ['#ffd84a', '#ff5a7a', '#4fd6ff', '#7dff9a', '#c58bff', '#ffffff', '#ff9a3c'];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function makeCoinSprite(): HTMLCanvasElement {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const rg = g.createRadialGradient(s * 0.38, s * 0.36, 2, s / 2, s / 2, s / 2);
  rg.addColorStop(0, '#fff6b8'); rg.addColorStop(0.55, '#f3c64f'); rg.addColorStop(1, '#a5700f');
  g.fillStyle = rg; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 1.5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#7a4d07'; g.lineWidth = 3; g.stroke();
  g.strokeStyle = '#ffe9a0'; g.lineWidth = 2.5; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 9, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#9b6409'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('$', s / 2, s / 2 + 2);
  return c;
}

export class Particles {
  private list: P[] = [];
  private fliers: Flier[] = [];
  private ctx: CanvasRenderingContext2D;
  private coin: HTMLCanvasElement | null = null;
  private raf = 0;
  private last = 0;
  private pxPerU = 10;
  private ema = 16;
  private slow = 0;
  /** 0..1 pengali jumlah partikel baru (kualitas + penjaga FPS) */
  base = 1;
  ambient = false;
  private rainJobs: Array<{ kind: 'coin' | 'confetti'; until: number; density: number; acc: number }> = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  }

  get budget(): number { return this.base * this.adapt; }
  private adapt = 1;

  resize(cssW: number, cssH: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.pxPerU = this.canvas.width / W_U;
  }

  get active(): number { return this.list.length + this.fliers.length; }

  private kick() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private spawn(p: Partial<P> & { kind: ParticleKind }) {
    if (this.list.length > 420) return;
    this.list.push({
      x: 50, y: 28, vx: 0, vy: 0, g: 0, drag: 0, rot: 0, vr: 0, spin: 0, vs: 0, size: 1, life: 2, age: 0, hue: 0, tw: 0, ...p,
    });
    this.kick();
  }

  burst(kind: 'coins' | 'confetti' | 'sparks', x: number, y: number, count = 24, power = 1, color: 'gold' | 'red' | 'white' = 'gold') {
    const n = Math.max(1, Math.round(count * this.budget));
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rnd(-0.9, 0.9);
      if (kind === 'coins') {
        const sp = rnd(16, 38) * power;
        this.spawn({ kind: 'coin', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 72, drag: 0.15, size: rnd(2.2, 3.4), life: 3.2, spin: rnd(0, 6), vs: rnd(5, 12), rot: rnd(-0.4, 0.4) });
      } else if (kind === 'confetti') {
        const sp = rnd(14, 40) * power;
        this.spawn({ kind: 'confetti', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 38, drag: 0.9, size: rnd(0.9, 1.7), life: rnd(2.4, 3.6), hue: Math.floor(rnd(0, CONFETTI.length)), rot: rnd(0, 6), vr: rnd(-8, 8), spin: rnd(0, 6), vs: rnd(4, 10) });
      } else {
        const aa = rnd(0, Math.PI * 2);
        const sp = rnd(10, 46) * power;
        this.spawn({ kind: 'spark', x, y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, g: 14, drag: 2.6, size: rnd(0.8, 1.8), life: rnd(0.35, 0.8), hue: color === 'red' ? 1 : color === 'white' ? 2 : 0 });
      }
    }
  }

  rain(kind: 'coins' | 'confetti', ms: number, density = 30) {
    this.rainJobs.push({ kind: kind === 'coins' ? 'coin' : 'confetti', until: performance.now() + ms, density, acc: 0 });
    this.kick();
  }

  /** Banyak koin berangkat bergantian dari `from` menuju `to` (titik panggung dalam satuan u). */
  fly(from: { x: number; y: number }, to: { x: number; y: number }, count = 14) {
    const n = Math.max(1, Math.round(count * this.budget));
    const mx = (from.x + to.x) / 2;
    const my = Math.min(from.y, to.y);
    for (let i = 0; i < n; i++) {
      this.fliers.push({
        x0: from.x + rnd(-2.5, 2.5), y0: from.y + rnd(-1.5, 1.5),
        cx: mx + rnd(-12, 12), cy: my - rnd(8, 20),
        x1: to.x + rnd(-0.8, 0.8), y1: to.y + rnd(-0.5, 0.5),
        delay: i * 0.045 + rnd(0, 0.12), dur: rnd(0.75, 1.1), age: 0, size: rnd(2, 3), spin: rnd(0, 6), vs: rnd(8, 14),
      });
    }
    this.kick();
  }

  clear() { this.list = []; this.fliers = []; this.rainJobs = []; this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  setAmbient(on: boolean) {
    this.ambient = on;
    if (on) this.kick();
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    // penjaga FPS: jika rata-rata frame lambat, kurangi partikel baru
    this.ema = this.ema * 0.9 + dt * 1000 * 0.1;
    if (this.ema > 27) this.slow++; else this.slow = Math.max(0, this.slow - 1);
    if (this.slow > 25) { this.adapt = Math.max(0.25, this.adapt * 0.7); this.slow = 0; }

    for (const j of this.rainJobs) {
      if (now > j.until) continue;
      j.acc += dt * j.density * this.budget;
      while (j.acc >= 1) {
        j.acc -= 1;
        if (j.kind === 'coin') this.spawn({ kind: 'coin', x: rnd(2, 98), y: -4, vx: rnd(-3, 3), vy: rnd(8, 20), g: 16, drag: 0.05, size: rnd(2, 3.2), life: 6, spin: rnd(0, 6), vs: rnd(4, 10), rot: rnd(-0.3, 0.3) });
        else this.spawn({ kind: 'confetti', x: rnd(0, 100), y: -3, vx: rnd(-4, 4), vy: rnd(6, 16), g: 10, drag: 0.5, size: rnd(0.9, 1.7), life: 7, hue: Math.floor(rnd(0, CONFETTI.length)), rot: rnd(0, 6), vr: rnd(-6, 6), spin: rnd(0, 6), vs: rnd(3, 8) });
      }
    }
    this.rainJobs = this.rainJobs.filter((j) => now <= j.until);

    if (this.ambient) {
      const want = Math.round(26 * this.budget);
      const have = this.list.filter((p) => p.kind === 'dust').length;
      for (let i = have; i < want; i++) {
        this.spawn({ kind: 'dust', x: rnd(0, 100), y: rnd(20, 62), vx: rnd(-0.8, 0.8), vy: rnd(-3.5, -1.2), size: rnd(0.25, 0.7), life: rnd(5, 10), tw: rnd(0, 6) });
      }
    }

    const ctx = this.ctx;
    const k = this.pxPerU;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const next: P[] = [];
    for (const p of this.list) {
      p.age += dt;
      if (p.age >= p.life || p.y > H_U + 8) continue;
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp; p.vy = p.vy * damp + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt; p.spin += p.vs * dt;
      next.push(p);
      const fade = Math.min(1, (p.life - p.age) / Math.min(0.6, p.life * 0.4));
      ctx.save();
      ctx.translate(p.x * k, p.y * k);
      if (p.kind === 'coin') {
        if (!this.coin) this.coin = makeCoinSprite();
        ctx.globalAlpha = fade;
        ctx.rotate(p.rot);
        const sx = Math.max(0.12, Math.abs(Math.cos(p.spin)));
        const s = p.size * k;
        ctx.drawImage(this.coin, (-s / 2) * sx, -s / 2, s * sx, s);
      } else if (p.kind === 'confetti') {
        ctx.globalAlpha = fade;
        ctx.rotate(p.rot);
        ctx.scale(1, Math.max(0.15, Math.abs(Math.cos(p.spin))));
        ctx.fillStyle = CONFETTI[p.hue % CONFETTI.length];
        const s = p.size * k;
        ctx.fillRect(-s / 2, -s * 0.3, s, s * 0.6);
      } else if (p.kind === 'spark') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = fade;
        ctx.strokeStyle = p.hue === 1 ? '#ff7a4a' : p.hue === 2 ? '#ffffff' : '#ffd86a';
        ctx.lineWidth = Math.max(1, p.size * k * 0.35);
        ctx.lineCap = 'round';
        const L = Math.min(3.5, Math.hypot(p.vx, p.vy) * 0.05) * k;
        const a = Math.atan2(p.vy, p.vx);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-Math.cos(a) * L, -Math.sin(a) * L); ctx.stroke();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        const tw = 0.5 + 0.5 * Math.sin(p.tw + p.age * 2.2);
        ctx.globalAlpha = Math.min(1, p.age * 1.5) * fade * (0.25 + 0.55 * tw);
        const r = p.size * k;
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3);
        gr.addColorStop(0, 'rgba(255,238,170,1)'); gr.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(0, 0, r * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    this.list = next;

    const keep: Flier[] = [];
    for (const f of this.fliers) {
      f.age += dt;
      f.spin += f.vs * dt;
      const t = (f.age - f.delay) / f.dur;
      if (t >= 1) continue; // sudah tiba di tujuan
      keep.push(f);
      if (t < 0) continue; // belum berangkat
      if (!this.coin) this.coin = makeCoinSprite();
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const w = 1 - e;
      const x = w * w * f.x0 + 2 * w * e * f.cx + e * e * f.x1;
      const y = w * w * f.y0 + 2 * w * e * f.cy + e * e * f.y1;
      ctx.save();
      ctx.translate(x * k, y * k);
      ctx.globalAlpha = Math.min(1, t * 8) * Math.min(1, (1 - t) * 6 + 0.25);
      const sx = Math.max(0.15, Math.abs(Math.cos(f.spin)));
      const s = f.size * k * (1 - 0.25 * t);
      ctx.drawImage(this.coin, (-s / 2) * sx, -s / 2, s * sx, s);
      ctx.restore();
    }
    this.fliers = keep;

    const busy = this.list.length > 0 || this.rainJobs.length > 0 || this.fliers.length > 0 || this.ambient;
    if (busy) this.raf = requestAnimationFrame(this.frame);
    else ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  };
}
