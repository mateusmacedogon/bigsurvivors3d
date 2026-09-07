import type { HeroId } from './config';

type MusicMode = 'none' | 'calm' | 'boss';

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/**
 * Motor de áudio 100% procedural (Web Audio API):
 * sintetizadores para lasers, explosões com ruído filtrado, coletas cristalinas
 * e um sequenciador synthwave de fundo (baixo, pad, arpejo, bateria).
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private noise!: AudioBuffer;
  private delay!: DelayNode;
  private lastHit = 0;
  private lastShoot = 0;
  private lastEnemyShot = 0;
  private lastExplosion = -1;
  private lastDeath = -1;
  private lastHeartHit = 0;
  muted = false;

  private masterVol = 0.8;
  private sfxVol = 0.7;
  private musicVol = 0.35;

  // música
  private mode: MusicMode = 'none';
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private tempo = 104;

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 20;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.masterVol;
    this.master.connect(comp);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxVol;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = this.musicVol;
    this.music.connect(this.master);
    this.delay = ctx.createDelay(1.0);
    this.delay.delayTime.value = 0.34;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const dl = ctx.createBiquadFilter();
    dl.type = 'lowpass';
    dl.frequency.value = 2400;
    this.delay.connect(dl);
    dl.connect(fb);
    fb.connect(this.delay);
    dl.connect(this.music);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMasterVolume(v: number) {
    this.masterVol = Math.max(0, Math.min(1, v));
    if (this.ctx && this.master && !this.muted) {
      this.master.gain.setTargetAtTime(this.masterVol, this.ctx.currentTime, 0.05);
    }
  }

  setMusicVolume(v: number) {
    this.musicVol = Math.max(0, Math.min(1, v));
    if (this.ctx && this.music) {
      this.music.gain.setTargetAtTime(this.musicVol, this.ctx.currentTime, 0.05);
    }
  }

  setSfxVolume(v: number) {
    this.sfxVol = Math.max(0, Math.min(1, v));
    if (this.ctx && this.sfx) {
      this.sfx.gain.setTargetAtTime(this.sfxVol, this.ctx.currentTime, 0.05);
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : this.masterVol, this.ctx.currentTime, 0.05);
    }
  }

  private get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ---------- primitivas ----------
  private osc(
    type: OscillatorType, f0: number, f1: number, t0: number, dur: number, vol: number,
    dest?: AudioNode, filterFreq?: number, attack = 0.005,
  ) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = o;
    if (filterFreq) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(dest ?? this.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return o;
  }

  private noiseBurst(
    t0: number, dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, q = 1, dest?: AudioNode, attack = 0.003,
  ) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest ?? this.sfx);
    s.start(t0);
    s.stop(t0 + dur + 0.05);
  }

  // ---------- SFX ----------
  shoot(hero: HeroId) {
    if (!this.ctx) return;
    const t = this.now;
    if (t - this.lastShoot < 0.045) return;
    this.lastShoot = t;
    switch (hero) {
      case 'big':
        this.osc('square', 1400, 320, t, 0.09, 0.12, undefined, 3000);
        this.osc('sine', 900, 200, t, 0.07, 0.08);
        break;
      case 'thiago':
        this.noiseBurst(t, 0.07, 0.07, 'bandpass', 2400, 900, 2);
        break;
      case 'pietro':
        this.osc('triangle', 320, 720, t, 0.16, 0.14);
        this.osc('sine', 640, 1440, t, 0.12, 0.05);
        break;
      case 'otton':
        this.slash();
        break;
      case 'carlinhos':
        this.osc('sine', 523, 261, t, 0.18, 0.14);
        this.osc('triangle', 784, 392, t, 0.14, 0.09);
        break;
      case 'macedo':
        this.osc('square', 1400, 600, t, 0.08, 0.09, undefined, 3500);
        this.osc('sawtooth', 700, 1500, t, 0.06, 0.07);
        break;
    }
  }

  slash() {
    if (!this.ctx) return;
    const t = this.now;
    this.noiseBurst(t, 0.18, 0.22, 'bandpass', 2600, 300, 1.5);
    this.osc('sawtooth', 220, 60, t, 0.16, 0.08, undefined, 800);
  }

  droneShot() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('square', 1800, 600, t, 0.05, 0.04, undefined, 2500);
  }

  explosion(size = 1) {
    if (!this.ctx) return;
    const t = this.now;
    const s = Math.min(3, Math.max(0.3, size));
    if (s < 1.4 && t - this.lastExplosion < 0.065) return;
    this.lastExplosion = t;
    this.noiseBurst(t, 0.055, 0.16 * Math.min(1.2, s), 'highpass', 4200, 1600, 0.6);
    this.noiseBurst(t, 0.35 * s, 0.5 * Math.min(1, s), 'lowpass', 3000 * s, 120, 0.7);
    this.osc('sine', 120 * Math.min(1.5, s), 28, t, 0.4 * s, 0.6 * Math.min(1.2, s));
    if (s > 1.4) {
      this.noiseBurst(t + 0.05, 1.2, 0.3, 'lowpass', 600, 60, 0.5);
      this.noiseBurst(t + 0.12, 0.45, 0.08, 'bandpass', 2400, 450, 2.5);
    }
  }

  hit() {
    if (!this.ctx) return;
    const t = this.now;
    if (t - this.lastHit < 0.04) return;
    this.lastHit = t;
    this.noiseBurst(t, 0.05, 0.12, 'highpass', 1200, 4000, 1);
    this.osc('square', 500 + Math.random() * 200, 150, t, 0.05, 0.05);
  }

  enemyDeath() {
    if (!this.ctx) return;
    const t = this.now;
    if (t - this.lastDeath < 0.045) return;
    this.lastDeath = t;
    this.noiseBurst(t, 0.22, 0.18, 'lowpass', 2500, 200, 1);
    this.osc('sawtooth', 300 + Math.random() * 100, 40, t, 0.2, 0.08, undefined, 1200);
  }

  pickup(kind: 'xp' | 'coin' | 'shard' | 'heal' | 'magnet') {
    if (!this.ctx) return;
    const t = this.now;
    switch (kind) {
      case 'xp':
        this.osc('sine', 1100 + Math.random() * 300, 1900, t, 0.09, 0.07);
        break;
      case 'coin':
        this.osc('square', 1320, 1320, t, 0.06, 0.05, undefined, 4000);
        this.osc('square', 1760, 1760, t + 0.06, 0.1, 0.05, undefined, 4000);
        break;
      case 'shard':
        [1046, 1318, 1568, 2093].forEach((f, i) => this.osc('triangle', f, f, t + i * 0.05, 0.16, 0.09));
        break;
      case 'heal':
        this.osc('sine', 520, 1040, t, 0.25, 0.12);
        this.osc('sine', 780, 1560, t + 0.08, 0.25, 0.08);
        break;
      case 'magnet':
        this.osc('sawtooth', 200, 2400, t, 0.4, 0.1, undefined, 3000);
        break;
    }
  }

  levelUp() {
    if (!this.ctx) return;
    const t = this.now;
    [523, 659, 784, 1046, 1318].forEach((f, i) => {
      this.osc('triangle', f, f, t + i * 0.07, 0.35, 0.12);
      this.osc('sine', f * 2, f * 2, t + i * 0.07, 0.25, 0.04);
    });
    this.noiseBurst(t, 0.5, 0.06, 'highpass', 4000, 9000, 1);
  }

  cardPick() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sine', 880, 1760, t, 0.15, 0.1);
    this.osc('triangle', 1320, 2640, t + 0.05, 0.2, 0.06);
  }

  dash() {
    if (!this.ctx) return;
    const t = this.now;
    this.noiseBurst(t, 0.25, 0.25, 'bandpass', 600, 3500, 1.2);
    this.osc('sine', 900, 200, t, 0.2, 0.12);
  }

  missileLaunch() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sawtooth', 700 + Math.random() * 120, 280, t, 0.18, 0.12, undefined, 2000);
    this.noiseBurst(t, 0.22, 0.1, 'bandpass', 1200, 500, 1);
  }

  orbitalSaw() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sawtooth', 880 + Math.random() * 80, 1100, t, 0.08, 0.08, undefined, 3000);
  }

  teslaArc() {
    if (!this.ctx) return;
    const t = this.now;
    this.noiseBurst(t, 0.14, 0.15, 'highpass', 3500, 9000, 2);
    this.osc('square', 1400 + Math.random() * 300, 400, t, 0.09, 0.09);
  }

  gravityImplosion() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sine', 140, 40, t, 0.45, 0.35);
    this.noiseBurst(t + 0.1, 0.4, 0.2, 'lowpass', 600, 80, 2);
  }

  speedBoost() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sine', 300, 1200, t, 0.3, 0.18);
    this.osc('triangle', 600, 2400, t + 0.05, 0.3, 0.12);
  }

  supplyPodDrop() {
    if (!this.ctx) return;
    const t = this.now;
    for (let i = 0; i < 2; i++) {
      this.osc('sawtooth', 880, 440, t + i * 0.2, 0.18, 0.14, undefined, 2500);
    }
    this.noiseBurst(t + 0.4, 0.5, 0.25, 'lowpass', 1500, 100, 1);
  }

  achievement() {
    if (!this.ctx) return;
    const t = this.now;
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => {
      this.osc('sine', f, f, t + i * 0.08, 0.4, 0.12);
      this.osc('triangle', f * 2, f * 2, t + i * 0.08, 0.3, 0.05);
    });
  }

  bossTaunt() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sawtooth', 85, 45, t, 0.9, 0.25, undefined, 650, 0.08);
    this.noiseBurst(t, 0.8, 0.18, 'bandpass', 300, 1400, 3);
  }

  capsuleRescue() {
    if (!this.ctx) return;
    const t = this.now;
    [440, 554, 659, 880].forEach((f, i) => {
      this.osc('sine', f, f * 1.5, t + i * 0.07, 0.25, 0.15);
    });
  }

  ultCharge() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sawtooth', 80, 900, t, 0.8, 0.14, undefined, 2500, 0.2);
    this.noiseBurst(t, 0.8, 0.12, 'bandpass', 300, 4000, 2, undefined, 0.3);
  }

  ult(hero: HeroId) {
    if (!this.ctx) return;
    const t = this.now;
    switch (hero) {
      case 'big':
        this.explosion(3);
        this.osc('sine', 60, 20, t, 1.2, 0.7);
        this.noiseBurst(t + 0.1, 1.6, 0.35, 'lowpass', 1200, 40, 0.5);
        break;
      case 'otton':
        for (let i = 0; i < 4; i++) this.osc('square', 600 - i * 80, 150, t + i * 0.28, 0.25, 0.14, undefined, 2000);
        this.noiseBurst(t, 1.2, 0.2, 'bandpass', 1500, 500, 1);
        break;
      case 'thiago':
        this.osc('sawtooth', 120, 40, t, 0.9, 0.35, undefined, 900);
        this.noiseBurst(t, 0.8, 0.3, 'lowpass', 4000, 200, 0.8);
        this.osc('sine', 300, 1200, t, 0.5, 0.15);
        break;
      case 'pietro':
        [220, 277, 330, 415].forEach((f, i) => {
          this.osc('sawtooth', f, f * 1.01, t + i * 0.12, 1.4, 0.12, undefined, 1400, 0.1);
          this.osc('sine', f * 4, f * 2, t + i * 0.12, 0.6, 0.06);
        });
        break;
      case 'carlinhos':
        [523, 659, 784, 1046, 1318].forEach((f, i) => {
          this.osc('sine', f, f, t + i * 0.09, 0.7, 0.16);
          this.osc('triangle', f * 0.5, f * 0.5, t + i * 0.09, 0.8, 0.1);
        });
        this.noiseBurst(t, 0.6, 0.14, 'lowpass', 1200, 200, 1.2);
        break;
      case 'macedo':
        this.osc('sawtooth', 2200, 80, t, 0.7, 0.35, undefined, 3200);
        this.noiseBurst(t, 0.8, 0.28, 'bandpass', 1800, 300, 2);
        for (let i = 0; i < 3; i++) {
          this.osc('square', 160 - i * 30, 60, t + i * 0.18, 0.3, 0.2);
        }
        break;
    }
  }

  enemyShot(kind: 'orb' | 'sniper' | 'mortar' | 'shotgun' | 'boss' = 'orb') {
    if (!this.ctx) return;
    const t = this.now;
    if (t - this.lastEnemyShot < 0.03) return;
    this.lastEnemyShot = t;
    switch (kind) {
      case 'orb':
        this.osc('square', 260, 110, t, 0.12, 0.07, undefined, 1500);
        break;
      case 'sniper':
        this.osc('sawtooth', 2400, 200, t, 0.2, 0.16, undefined, 5000);
        this.noiseBurst(t, 0.12, 0.12, 'highpass', 2000, 6000, 1);
        break;
      case 'mortar':
        this.osc('sine', 200, 700, t, 0.35, 0.12);
        this.noiseBurst(t, 0.15, 0.1, 'lowpass', 800, 300, 1);
        break;
      case 'shotgun':
        this.noiseBurst(t, 0.15, 0.22, 'lowpass', 2500, 300, 1);
        this.osc('square', 180, 70, t, 0.12, 0.1);
        break;
      case 'boss':
        this.osc('square', 180, 90, t, 0.1, 0.05, undefined, 1200);
        break;
    }
  }

  sniperLock() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('square', 1800, 1800, t, 0.05, 0.05);
    this.osc('square', 1800, 1800, t + 0.12, 0.05, 0.05);
  }

  beamStart() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sawtooth', 100, 500, t, 0.9, 0.12, undefined, 1500, 0.1);
    this.noiseBurst(t, 1.6, 0.14, 'bandpass', 800, 1800, 3, undefined, 0.2);
  }

  hurt() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sawtooth', 200, 50, t, 0.3, 0.25, undefined, 700);
    this.noiseBurst(t, 0.2, 0.2, 'lowpass', 1500, 200, 1);
  }

  shieldHit() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sine', 1200, 300, t, 0.2, 0.1);
    this.osc('triangle', 2400, 600, t, 0.15, 0.05);
  }

  freeze() {
    if (!this.ctx) return;
    const t = this.now;
    this.noiseBurst(t, 0.3, 0.08, 'highpass', 3000, 8000, 1);
    this.osc('sine', 2200, 3200, t, 0.2, 0.05);
  }

  warning() {
    if (!this.ctx) return;
    const t = this.now;
    for (let i = 0; i < 3; i++) {
      this.osc('square', 660, 660, t + i * 0.3, 0.12, 0.1, undefined, 2500);
      this.osc('square', 440, 440, t + i * 0.3 + 0.14, 0.12, 0.1, undefined, 2500);
    }
  }

  bossRoar() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sawtooth', 55, 40, t, 1.6, 0.4, undefined, 500, 0.15);
    this.osc('sawtooth', 82, 58, t, 1.6, 0.3, undefined, 600, 0.15);
    this.noiseBurst(t, 1.4, 0.25, 'lowpass', 900, 100, 0.8, undefined, 0.2);
    this.osc('square', 30, 30, t, 1.5, 0.2);
  }

  teleport() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sine', 300, 2500, t, 0.3, 0.15);
    this.osc('sine', 2500, 200, t + 0.3, 0.3, 0.15);
    this.noiseBurst(t, 0.5, 0.12, 'bandpass', 1000, 5000, 3);
  }

  shockwave() {
    if (!this.ctx) return;
    const t = this.now;
    this.noiseBurst(t, 0.6, 0.3, 'lowpass', 2500, 150, 0.7);
    this.osc('sine', 90, 35, t, 0.5, 0.4);
  }

  playerDeath() {
    if (!this.ctx) return;
    const t = this.now;
    this.explosion(2.5);
    this.osc('sawtooth', 400, 30, t, 1.8, 0.25, undefined, 1200);
  }

  victory() {
    if (!this.ctx) return;
    const t = this.now;
    [523, 659, 784, 1046, 784, 1046, 1318, 1568].forEach((f, i) => {
      this.osc('triangle', f, f, t + i * 0.13, 0.5, 0.14);
      this.osc('square', f / 2, f / 2, t + i * 0.13, 0.4, 0.05, undefined, 1500);
    });
  }

  juliaEasterEgg() {
    if (!this.ctx) return;
    const t = this.now;
    // Arpeggio melodioso doce e romântico em Cmaj9 / Fmaj7
    const freqs = [523.25, 659.25, 783.99, 987.77, 1046.50, 1174.66, 1318.51, 1567.98];
    freqs.forEach((f, i) => {
      this.osc('sine', f, f * 1.002, t + i * 0.07, 0.65, 0.16);
      this.osc('triangle', f * 2, f * 2, t + i * 0.07 + 0.015, 0.45, 0.07);
    });
    // Acorde apaixonado e caloroso de sustentação (C3 + G3 + E4)
    this.osc('sine', 130.81, 130.81, t, 1.6, 0.22);
    this.osc('triangle', 196.00, 196.00, t + 0.05, 1.4, 0.16);
    this.osc('sine', 329.63, 329.63, t + 0.1, 1.3, 0.12);
    // Brilho etéreo de poeira estelar cintilante
    this.noiseBurst(t, 0.8, 0.05, 'highpass', 6000, 12000, 2);
    this.noiseBurst(t + 0.35, 0.6, 0.04, 'bandpass', 4500, 8000, 1.5);
  }

  heartHit() {
    if (!this.ctx) return;
    const t = this.now;
    if (t - this.lastHeartHit < 0.045) return;
    this.lastHeartHit = t;
    this.osc('sine', 987.77, 1318.51, t, 0.18, 0.14);
    this.osc('triangle', 1567.98, 1975.53, t + 0.02, 0.16, 0.08);
    this.noiseBurst(t, 0.12, 0.06, 'highpass', 4500, 9500, 1.8);
  }

  bossPhase() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sawtooth', 60, 200, t, 1.0, 0.3, undefined, 800, 0.05);
    this.noiseBurst(t, 1.2, 0.3, 'bandpass', 200, 3000, 1.5, undefined, 0.3);
  }

  ui() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sine', 700, 1200, t, 0.08, 0.08);
  }

  // ---------- Música ----------
  startMusic(mode: MusicMode) {
    if (!this.ctx) return;
    if (this.mode === mode) return;
    this.mode = mode;
    this.tempo = mode === 'boss' ? 134 : 104;
    if (mode === 'none') {
      this.stopMusic();
      return;
    }
    if (this.timer === null) {
      this.nextTime = this.ctx.currentTime + 0.1;
      this.step = 0;
      this.timer = window.setInterval(() => this.scheduler(), 25);
    }
  }

  stopMusic() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.mode = 'none';
  }

  private scheduler() {
    if (!this.ctx || this.mode === 'none') return;
    const spStep = 60 / this.tempo / 4;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this.scheduleStep(this.step, this.nextTime, spStep);
      this.nextTime += spStep;
      this.step++;
    }
  }

  private scheduleStep(step: number, t: number, spStep: number) {
    const boss = this.mode === 'boss';
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    // progressão: calmo Am F C G / boss Am Ab Fm E
    const calm = [[45, 0], [41, 1], [48, 1], [43, 1]];
    const rage = [[45, 0], [44, 1], [41, 0], [40, 1]];
    const [root, major] = (boss ? rage : calm)[bar];
    const third = major ? 4 : 3;
    const chord = [root, root + third, root + 7];
    const music = this.music;

    // Baixo
    if (s % 2 === 0 || boss) {
      const oct = s % 4 === 0 ? 0 : 12;
      const f = midi(root + oct);
      const o = this.ctx!.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const fl = this.ctx!.createBiquadFilter();
      fl.type = 'lowpass';
      fl.Q.value = 6;
      fl.frequency.setValueAtTime(boss ? 1400 : 900, t);
      fl.frequency.exponentialRampToValueAtTime(180, t + spStep * 1.8);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + spStep * 1.9);
      o.connect(fl);
      fl.connect(g);
      g.connect(music);
      o.start(t);
      o.stop(t + spStep * 2);
    }
    // Pad
    if (s === 0) {
      const dur = spStep * 16;
      chord.forEach(n => {
        [-7, 7].forEach(det => {
          const o = this.ctx!.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = midi(n + 12);
          o.detune.value = det;
          const fl = this.ctx!.createBiquadFilter();
          fl.type = 'lowpass';
          fl.frequency.setValueAtTime(400, t);
          fl.frequency.linearRampToValueAtTime(boss ? 1600 : 1100, t + dur * 0.5);
          fl.frequency.linearRampToValueAtTime(500, t + dur);
          const g = this.ctx!.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.028, t + 0.4);
          g.gain.setValueAtTime(0.028, t + dur - 0.3);
          g.gain.linearRampToValueAtTime(0.0001, t + dur);
          o.connect(fl);
          fl.connect(g);
          g.connect(music);
          o.start(t);
          o.stop(t + dur + 0.05);
        });
      });
    }
    // Arpejo
    if (!boss || s % 2 === 0) {
      const seq = [0, 1, 2, 1, 0, 2, 1, 2];
      const n = chord[seq[s % 8] % 3] + 24 + (s % 16 >= 8 ? 12 : 0);
      this.osc(boss ? 'square' : 'triangle', midi(n), midi(n), t, spStep * 0.9, boss ? 0.045 : 0.06, this.delay, 3000, 0.01);
    }
    // Bateria
    if (s % 4 === 0 || (boss && s % 8 === 6)) {
      this.osc('sine', 160, 42, t, 0.22, 0.9, music);
      this.noiseBurst(t, 0.03, 0.2, 'lowpass', 2000, 500, 1, music);
    }
    if (s === 4 || s === 12) {
      this.noiseBurst(t, 0.18, 0.28, 'highpass', 1300, 3000, 1, music);
      this.osc('triangle', 220, 120, t, 0.12, 0.25, music);
    }
    if (s % 2 === 1 || boss) {
      this.noiseBurst(t, s % 4 === 2 ? 0.09 : 0.035, s % 4 === 2 ? 0.1 : 0.07, 'highpass', 7000, 9000, 1, music);
    }
  }
}
