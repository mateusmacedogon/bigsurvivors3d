import * as THREE from 'three';
import { PARTICLE_FRAG, PARTICLE_VERT } from './shaders';

export interface BurstOpts {
  speed?: number;
  life?: number;
  size?: number;
  gravity?: number;
  drag?: number;
  bounce?: number;
  up?: number;
  spread?: number;
  shrink?: boolean;
}

const tmpColor = new THREE.Color();

/** Sistema de partículas em Points com buffers dinâmicos (aditivo, HDR para Bloom). */
export class ParticleSystem {
  points: THREE.Points;
  private max: number;
  count = 0;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private size0: Float32Array;
  private alpha: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private bounce: Float32Array;
  private shrink: Uint8Array;
  private posAttr: THREE.BufferAttribute;
  private colAttr: THREE.BufferAttribute;
  private sizeAttr: THREE.BufferAttribute;
  private alphaAttr: THREE.BufferAttribute;

  constructor(scene: THREE.Scene, max = 7000) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.bounce = new Float32Array(max);
    this.shrink = new Uint8Array(max);
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aColor', this.colAttr);
    geo.setAttribute('aSize', this.sizeAttr);
    geo.setAttribute('aAlpha', this.alphaAttr);
    geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 20;
    scene.add(this.points);
  }

  emit(
    x: number, y: number, z: number, vx: number, vy: number, vz: number,
    life: number, size: number, r: number, g: number, b: number,
    gravity = 0, drag = 0, bounce = 0, shrink = 1,
  ) {
    if (this.count >= this.max) return;
    const i = this.count++;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.size[i] = size; this.size0[i] = size;
    this.alpha[i] = 1;
    this.life[i] = life; this.maxLife[i] = life;
    this.grav[i] = gravity; this.drag[i] = drag; this.bounce[i] = bounce; this.shrink[i] = shrink;
  }

  burst(x: number, y: number, z: number, count: number, color: number | THREE.Color, o: BurstOpts = {}) {
    const c = typeof color === 'number' ? tmpColor.setHex(color) : color;
    const speed = o.speed ?? 8;
    const life = o.life ?? 0.8;
    const size = o.size ?? 0.35;
    const gravity = o.gravity ?? 18;
    const drag = o.drag ?? 2.5;
    const bounce = o.bounce ?? 0.45;
    const up = o.up ?? 0.5;
    const spread = o.spread ?? 1;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.9) * spread;
      const vy = (Math.random() * up + up * 0.3) * speed;
      const k = 0.7 + Math.random() * 0.6;
      this.emit(
        x, y, z, Math.cos(a) * s, vy, Math.sin(a) * s,
        life * (0.6 + Math.random() * 0.8), size * (0.6 + Math.random() * 0.8),
        c.r * k, c.g * k, c.b * k, gravity, drag, bounce, o.shrink === false ? 0 : 1,
      );
    }
  }

  ring(x: number, y: number, z: number, count: number, color: number | THREE.Color, radius: number, speed: number, life = 0.7, size = 0.35) {
    const c = typeof color === 'number' ? tmpColor.setHex(color) : color;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.1;
      this.emit(
        x + Math.cos(a) * radius, y, z + Math.sin(a) * radius,
        Math.cos(a) * speed, 1.5 + Math.random() * 2, Math.sin(a) * speed,
        life, size, c.r, c.g, c.b, 4, 1.5, 0.3, 1,
      );
    }
  }

  implode(x: number, y: number, z: number, count: number, color: number | THREE.Color, radius: number, life = 1.0) {
    const c = typeof color === 'number' ? tmpColor.setHex(color) : color;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const el = (Math.random() - 0.5) * Math.PI;
      const r = radius * (0.6 + Math.random() * 0.5);
      const px = x + Math.cos(a) * Math.cos(el) * r;
      const py = y + Math.sin(el) * r * 0.6;
      const pz = z + Math.sin(a) * Math.cos(el) * r;
      const sp = r / life;
      this.emit(px, py, pz, (x - px) / r * sp, (y - py) / r * sp, (z - pz) / r * sp, life, 0.4, c.r, c.g, c.b, 0, 0, 0, 0);
    }
  }

  update(dt: number) {
    const pos = this.pos, vel = this.vel;
    let n = this.count;
    for (let i = 0; i < n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const last = --n;
        if (i !== last) this.copy(last, i);
        i--;
        continue;
      }
      const i3 = i * 3;
      const d = this.drag[i];
      if (d > 0) {
        const f = Math.max(0, 1 - d * dt);
        vel[i3] *= f; vel[i3 + 1] *= f; vel[i3 + 2] *= f;
      }
      vel[i3 + 1] -= this.grav[i] * dt;
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
      if (pos[i3 + 1] < 0.05 && this.bounce[i] > 0) {
        pos[i3 + 1] = 0.05;
        vel[i3 + 1] = -vel[i3 + 1] * this.bounce[i];
        vel[i3] *= 0.8; vel[i3 + 2] *= 0.8;
      }
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 2.2);
      this.size[i] = this.shrink[i] ? this.size0[i] * (0.35 + 0.65 * t) : this.size0[i];
    }
    this.count = n;
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.points.geometry.setDrawRange(0, n);
  }

  private copy(from: number, to: number) {
    const f3 = from * 3, t3 = to * 3;
    for (let k = 0; k < 3; k++) {
      this.pos[t3 + k] = this.pos[f3 + k];
      this.vel[t3 + k] = this.vel[f3 + k];
      this.col[t3 + k] = this.col[f3 + k];
    }
    this.size[to] = this.size[from];
    this.size0[to] = this.size0[from];
    this.alpha[to] = this.alpha[from];
    this.life[to] = this.life[from];
    this.maxLife[to] = this.maxLife[from];
    this.grav[to] = this.grav[from];
    this.drag[to] = this.drag[from];
    this.bounce[to] = this.bounce[from];
    this.shrink[to] = this.shrink[from];
  }

  clear() {
    this.count = 0;
    this.points.geometry.setDrawRange(0, 0);
  }
}
