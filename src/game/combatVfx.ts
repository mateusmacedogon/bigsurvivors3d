import * as THREE from 'three';
import type { GraphicQuality } from './settings';

// Two bounded, instanced batches: luminous plasma/sparks and translucent smoke.
// All textures are procedural; no downloads or per-burst GPU allocations.
const VERT = /* glsl */ `
attribute vec3 aCenter;
attribute vec3 aTint;
attribute vec3 aDirection;
attribute vec4 aShape;
attribute vec2 aAge;
varying vec2 vUv;
varying vec3 vTint;
varying vec3 vFx;
void main() {
  vUv = uv;
  vTint = aTint;
  vFx = vec3(aAge, aShape.w);
  vec4 center = modelViewMatrix * vec4(aCenter, 1.0);
  vec2 direction = (modelViewMatrix * vec4(aDirection, 0.0)).xy;
  float projectedLength = length(direction);
  vec2 axis = projectedLength > 0.001 ? direction / projectedLength : vec2(cos(aShape.z), sin(aShape.z));
  if (aShape.w < 1.5 || (aShape.w > 2.5 && aShape.w < 3.5)) axis = vec2(cos(aShape.z), sin(aShape.z));
  float width = aShape.w > 3.5 ? projectedLength : aShape.x;
  center.xy += axis * position.x * width + vec2(-axis.y, axis.x) * position.y * aShape.y;
  gl_Position = projectionMatrix * center;
}
`;

const FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vTint;
varying vec3 vFx;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float age = vFx.x, seed = vFx.y, kind = vFx.z;
  float r = length(p);
  float fade = pow(1.0 - age, 1.4);
  vec3 color = vTint;
  float alpha;
  if (kind < 0.5) {
    float core = exp(-r * r * 24.0);
    float halo = exp(-r * r * 4.5) * (1.0 - smoothstep(0.65, 1.0, r));
    float rays = pow(max(0.0, 1.0 - abs(p.x * p.y) * 30.0), 5.0) * pow(max(0.0, 1.0 - r), 3.0);
    alpha = (core + halo * 0.18 + rays * 0.3) * fade * 0.7;
    color = mix(vTint * 1.3, vec3(1.7), core * 0.65);
  } else if (kind < 1.5) {
    float n = noise(p * 4.0 + seed + vec2(age * 2.0, -age * 3.0));
    n += noise(p * 9.0 - age * 4.0 + seed) * 0.35;
    float body = 1.0 - smoothstep(0.25, 0.95, r + (n - 0.6) * 0.32);
    float hot = (1.0 - smoothstep(0.05, 0.62, r)) * (1.0 - age);
    alpha = body * fade * 0.32;
    color = mix(vTint * (0.9 + n * 0.8), vec3(1.8, 1.4, 0.9), hot * 0.5);
  } else if (kind < 2.5 || kind > 3.5) {
    float edge = 1.0 - smoothstep(0.05, 1.0, abs(p.y));
    float tips = kind > 3.5 ? 1.0 : 1.0 - smoothstep(0.65, 1.0, abs(p.x));
    alpha = edge * edge * tips * fade;
    color = kind > 3.5 ? vTint * 1.3 : mix(vTint * 1.4, vec3(1.8), pow(edge, 8.0) * 0.55);
  } else {
    float n = noise(p * 3.5 + seed + age * 0.6);
    n += noise(p * 8.0 - age + seed) * 0.25;
    alpha = (1.0 - smoothstep(0.2, 1.0, r + (n - 0.5) * 0.3)) * sin(age * 3.14159) * 0.24;
    color = vTint * (0.65 + n * 0.4);
  }
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(color, alpha);
}
`;

interface Sprite {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  dx: number; dy: number; dz: number;
  r: number; g: number; b: number;
  life: number; duration: number; size: number; kind: number;
  angle: number; seed: number; gravity: number; drag: number;
}

class SpriteBatch {
  private mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private data: Sprite[];
  private count = 0;
  private center: THREE.InstancedBufferAttribute;
  private tint: THREE.InstancedBufferAttribute;
  private direction: THREE.InstancedBufferAttribute;
  private shape: THREE.InstancedBufferAttribute;
  private age: THREE.InstancedBufferAttribute;
  private births = 0;
  limit: number;
  birthLimit: number;

  constructor(private scene: THREE.Scene, capacity: number, smoke = false) {
    this.limit = capacity;
    this.birthLimit = smoke ? 32 : 320;
    this.data = Array.from({ length: capacity }, () => ({} as Sprite));
    const plane = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setIndex(plane.index!.clone());
    geo.setAttribute('position', plane.getAttribute('position').clone());
    geo.setAttribute('uv', plane.getAttribute('uv').clone());
    plane.dispose();
    const attr = (name: string, size: number) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, a);
      return a;
    };
    this.center = attr('aCenter', 3); this.tint = attr('aTint', 3);
    this.direction = attr('aDirection', 3); this.shape = attr('aShape', 4); this.age = attr('aAge', 2);
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = smoke ? 7 : 11;
    scene.add(this.mesh);
  }

  spawn(x: number, y: number, z: number, color: THREE.Color, kind: number, size: number, duration: number,
    vx = 0, vy = 0, vz = 0, dx = vx, dy = vy, dz = vz) {
    if (this.count >= this.limit || this.births >= this.birthLimit) return;
    this.births++;
    const p = this.data[this.count++];
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.dx = dx; p.dy = dy; p.dz = dz;
    p.r = color.r; p.g = color.g; p.b = color.b;
    p.kind = kind; p.size = size; p.life = p.duration = duration;
    p.angle = Math.random() * Math.PI * 2; p.seed = Math.random() * 100;
    p.gravity = kind === 2 ? 16 : kind === 3 ? -0.6 : 0;
    p.drag = kind === 2 ? 1.6 : kind === 1 ? 3 : 0.7;
  }

  update(dt: number) {
    this.births = 0;
    for (let i = 0; i < this.count; i++) {
      const p = this.data[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.data[i] = this.data[--this.count]; this.data[this.count] = p; i--; continue;
      }
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag; p.vy = p.vy * drag - p.gravity * dt; p.vz *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.kind === 2 && p.y < 0.12) { p.y = 0.12; p.vy = Math.abs(p.vy) * 0.4; }
      const t = 1 - p.life / p.duration;
      const size = p.size * (p.kind === 1 ? 0.5 + t * 1.6 : p.kind === 3 ? 0.65 + t * 1.5 : 1 + t * 0.3);
      this.center.setXYZ(i, p.x, p.y, p.z);
      this.tint.setXYZ(i, p.r, p.g, p.b);
      this.direction.setXYZ(i, p.kind === 2 ? p.vx : p.dx, p.kind === 2 ? p.vy : p.dy, p.kind === 2 ? p.vz : p.dz);
      this.shape.setXYZW(i, p.kind === 2 ? size * (2 + Math.hypot(p.vx, p.vy, p.vz) * 0.12) : size,
        p.kind === 2 ? size * 0.16 : size, p.angle + (p.kind === 3 ? t * 0.3 : 0), p.kind);
      this.age.setXY(i, t, p.seed);
    }
    for (const attr of [this.center, this.tint, this.direction, this.shape, this.age]) {
      attr.clearUpdateRanges();
      if (this.count) attr.addUpdateRange(0, this.count * attr.itemSize);
      attr.needsUpdate = true;
    }
    this.mesh.geometry.instanceCount = this.count;
  }

  clear() { this.count = 0; this.births = 0; this.mesh.geometry.instanceCount = 0; }
  dispose() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

export class CombatVfx {
  private glow: SpriteBatch;
  private smoke: SpriteBatch;
  private color = new THREE.Color();
  private smokeColor = new THREE.Color();
  private density = 1;

  constructor(scene: THREE.Scene) {
    this.glow = new SpriteBatch(scene, 1600);
    this.smoke = new SpriteBatch(scene, 180, true);
  }

  setQuality(quality: GraphicQuality) {
    this.density = quality === 'low' ? 0.35 : quality === 'medium' ? 0.65 : 1;
    this.glow.limit = Math.floor(1600 * this.density);
    this.smoke.limit = Math.floor(180 * this.density);
    this.glow.birthLimit = Math.floor(320 * this.density);
    this.smoke.birthLimit = Math.ceil(32 * this.density);
  }

  explosion(x: number, y: number, z: number, color: number, radius: number, power = 1) {
    const c = this.color.setHex(color);
    const r = Math.min(13, Math.max(1, radius));
    this.glow.spawn(x, y, z, c, 0, r * 1.6, 0.17);
    const lobes = Math.ceil((5 + power * 4) * this.density);
    for (let i = 0; i < lobes; i++) {
      const a = i / lobes * Math.PI * 2;
      const speed = r * (0.7 + Math.random() * 0.7);
      this.glow.spawn(x + Math.cos(a) * r * 0.18, y, z + Math.sin(a) * r * 0.18, c, 1, r * (0.5 + Math.random() * 0.35), 0.45 + Math.random() * 0.3,
        Math.cos(a) * speed, 1.2 + Math.random() * r * 0.4, Math.sin(a) * speed);
    }
    for (let i = 0; i < Math.ceil((16 + power * 18) * this.density); i++) {
      const a = Math.random() * Math.PI * 2, speed = (5 + r * 2) * (0.4 + Math.random());
      this.glow.spawn(x, y, z, c, 2, 0.18 + Math.random() * 0.18, 0.5 + Math.random() * 0.65,
        Math.cos(a) * speed, 2 + Math.random() * speed * 0.65, Math.sin(a) * speed);
    }
    this.smokeColor.copy(c).multiplyScalar(0.12).addScalar(0.035);
    for (let i = 0; i < Math.ceil((3 + power * 2) * this.density); i++) {
      const a = Math.random() * Math.PI * 2;
      this.smoke.spawn(x + Math.cos(a) * r * 0.2, y, z + Math.sin(a) * r * 0.2,
        this.smokeColor, 3, r * (0.9 + Math.random() * 0.5), 1.2 + Math.random() * 0.6,
        Math.cos(a) * r * 0.6, 1.5 + Math.random(), Math.sin(a) * r * 0.6);
    }
  }

  impact(x: number, y: number, z: number, color: number, vx: number, vz: number, crit = false) {
    const c = this.color.setHex(color);
    this.glow.spawn(x, y, z, c, 0, crit ? 3.4 : 1.65, crit ? 0.2 : 0.13);
    const angle = Math.atan2(vx, vz);
    for (let i = 0; i < Math.ceil((crit ? 12 : 5) * this.density); i++) {
      const a = angle + (Math.random() - 0.5) * 2.3, speed = 7 + Math.random() * 9;
      this.glow.spawn(x, y, z, c, 2, crit ? 0.28 : 0.18, 0.25 + Math.random() * 0.3,
        Math.sin(a) * speed, 1 + Math.random() * 5, Math.cos(a) * speed);
    }
  }

  muzzle(x: number, y: number, z: number, angle: number, color: number, scale = 1) {
    const c = this.color.setHex(color);
    this.glow.spawn(x, y, z, c, 0, 1.8 * scale, 0.095);
    this.segment(x, y, z, x + Math.sin(angle) * 1.5 * scale, y, z + Math.cos(angle) * 1.5 * scale, color, 0.24 * scale, 0.085);
  }

  segment(x: number, y: number, z: number, tx: number, ty: number, tz: number, color: number, width = 0.15, life = 0.14) {
    this.glow.spawn((x + tx) / 2, (y + ty) / 2, (z + tz) / 2, this.color.setHex(color), 4, width, life,
      0, 0, 0, tx - x, ty - y, tz - z);
  }

  trail(x: number, y: number, z: number, tx: number, ty: number, tz: number, color: number, scale: number, kind: string) {
    this.segment(x, y, z, tx, ty, tz, color, (kind === 'laser' ? 0.2 : 0.3) * scale, kind === 'rune' ? 0.23 : 0.13);
    if (kind === 'missile' || kind === 'drop' || kind === 'ebomb') {
      this.glow.spawn(x, y, z, this.color.setHex(color), 1, scale * 0.85, 0.22, 0, 0.5);
      if (kind !== 'drop' && this.density > 0.4) {
        this.smoke.spawn(x, y, z, this.smokeColor.setRGB(0.07, 0.08, 0.1), 3, scale * 0.9, 0.6, 0, 0.7);
      }
    }
  }

  lightning(x: number, z: number, tx: number, tz: number, color: number) {
    const dx = tx - x, dz = tz - z, len = Math.hypot(dx, dz) || 1;
    const steps = Math.max(5, Math.min(16, Math.ceil(len * 1.2)));
    let px = x, pz = z;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, offset = i === steps ? 0 : (Math.random() - 0.5) * 1.4;
      const nx = x + dx * t - dz / len * offset, nz = z + dz * t + dx / len * offset;
      this.segment(px, 1, pz, nx, 1, nz, color, 0.48, 0.22);
      this.segment(px, 1.01, pz, nx, 1.01, nz, 0xdaf4ff, 0.11, 0.16);
      if (i % 3 === 0 && i < steps && this.density > 0.4) {
        this.segment(nx, 1, nz, nx - dz / len * 1.5, 1.4, nz + dx / len * 1.5, color, 0.13, 0.14);
      }
      px = nx; pz = nz;
    }
    this.impact(tx, 1, tz, color, dx, dz);
  }

  update(dt: number) { this.smoke.update(dt); this.glow.update(dt); }
  clear() { this.smoke.clear(); this.glow.clear(); }
  dispose() { this.smoke.dispose(); this.glow.dispose(); }
}
