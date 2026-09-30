export class Sfx {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }

  tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.5, slide = 0, delay = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  noise(dur: number, vol = 0.4, freq = 1200, delay = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  throw() { this.noise(0.16, 0.35, 2200); this.tone(500, 0.12, 'sine', 0.12, 300); }
  hit() { this.noise(0.22, 0.7, 900); this.tone(300, 0.2, 'square', 0.12, -180); this.tone(900, 0.1, 'triangle', 0.15, 0, 0.08); }
  catch() { this.tone(880, 0.1, 'triangle', 0.3); this.tone(1320, 0.18, 'triangle', 0.3, 0, 0.08); this.tone(1760, 0.2, 'sine', 0.2, 0, 0.16); }
  pickup() { this.tone(1100, 0.08, 'sine', 0.2, 400); }
  dash() { this.noise(0.18, 0.3, 700); }
  item() { this.tone(660, 0.08, 'square', 0.12); this.tone(990, 0.12, 'square', 0.12, 0, 0.07); }
  ufo() { this.tone(400, 0.6, 'sine', 0.2, 600); this.tone(800, 0.6, 'sine', 0.1, -300, 0.1); }
  missile() { this.noise(0.4, 0.3, 500); this.tone(200, 0.4, 'sawtooth', 0.08, 400); }
  boom() { this.noise(0.5, 0.8, 300); this.tone(120, 0.4, 'sine', 0.4, -70); }
  slip() { this.tone(900, 0.35, 'sine', 0.2, -700); }
  bump() { this.tone(220, 0.15, 'square', 0.15, -100); }
  splat() { this.noise(0.25, 0.4, 400); }
  alert() { this.tone(1500, 0.06, 'square', 0.08); }
  count() { this.tone(660, 0.18, 'square', 0.15); }
  start() { this.tone(990, 0.12, 'square', 0.18); this.tone(1320, 0.35, 'square', 0.18, 0, 0.1); }
  whistle() { this.tone(2000, 0.5, 'sine', 0.25, -200); }
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.25, 0, i * 0.14)); }
  lose() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.22, 0, i * 0.2)); }
  click() { this.tone(800, 0.05, 'triangle', 0.15); }
  freeze() { this.tone(1400, 0.3, 'sine', 0.25, -700); this.noise(0.18, 0.25, 3200); this.tone(2100, 0.12, 'triangle', 0.12, 0, 0.05); }
  thaw() { this.noise(0.22, 0.45, 2600); this.tone(660, 0.1, 'triangle', 0.25); this.tone(990, 0.12, 'triangle', 0.25, 0, 0.08); this.tone(1320, 0.22, 'sine', 0.22, 0, 0.16); }
  out() { [520, 440, 360, 250].forEach((f, i) => this.tone(f, 0.16, 'square', 0.14, -30, i * 0.12)); this.noise(0.25, 0.3, 700, 0.05); }
  tag() { this.tone(240, 0.14, 'square', 0.18, -100); this.noise(0.12, 0.35, 900); }
  step() { this.noise(0.05, 0.07, 320); }
}
