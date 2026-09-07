import * as THREE from 'three';
import { CORE_VERT, RIBBON_FRAG, RIBBON_VERT } from './shaders';

const tmpC = new THREE.Color();

const RADIAL_VERT = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const RADIAL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uInner;
uniform float uAge;
uniform float uSlash;
varying vec2 vLocal;
void main() {
  float radius = length(vLocal);
  float band = clamp((radius - uInner) / (1.0 - uInner), 0.0, 1.0);
  float rim = pow(sin(band * 3.14159), 1.4);
  float angle = atan(-vLocal.y, vLocal.x);
  float flow = 0.82 + 0.18 * sin(angle * 32.0 - uAge * 24.0 + radius * 18.0);
  float tips = uSlash > 0.5 ? 1.0 - smoothstep(0.65, 1.13, abs(angle)) : 1.0;
  float core = pow(rim, 6.0);
  vec3 color = mix(uColor, vec3(1.7), core * 0.45);
  gl_FragColor = vec4(color, rim * tips * flow * uAlpha);
}
`;

function radialMaterial(inner: number, slash = false) {
  return new THREE.ShaderMaterial({
    vertexShader: RADIAL_VERT, fragmentShader: RADIAL_FRAG,
    uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 1 },
      uInner: { value: inner }, uAge: { value: 0 }, uSlash: { value: slash ? 1 : 0 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------------------
// Ribbon trail (fita de propulsor)
// ---------------------------------------------------------------------------
export class RibbonTrail {
  mesh: THREE.Mesh;
  private pts: Float32Array;
  private len: number;
  private width: number;
  private acc = 0;
  private posAttr: THREE.BufferAttribute;
  private alphaAttr: THREE.BufferAttribute;
  private initialized = false;
  private lastPerpX = 1;
  private lastPerpZ = 0;
  intensity = 1;

  constructor(scene: THREE.Scene, color: number, len = 26, width = 0.32) {
    this.len = len;
    this.width = width;
    this.pts = new Float32Array(len * 3);
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(len * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr = new THREE.BufferAttribute(new Float32Array(len * 2), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aAlpha', this.alphaAttr);
    geo.setAttribute('aSide', new THREE.BufferAttribute(Float32Array.from({ length: len * 2 }, (_, i) => i % 2 ? 1 : -1), 1));
    const idx: number[] = [];
    for (let i = 0; i < len - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      idx.push(a, b, c, b, d, c);
    }
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      vertexShader: RIBBON_VERT,
      fragmentShader: RIBBON_FRAG,
      uniforms: { uColor: { value: new THREE.Color(color) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    scene.add(this.mesh);
  }

  setColor(color: number) {
    ((this.mesh.material as THREE.ShaderMaterial).uniforms.uColor.value as THREE.Color).setHex(color);
  }

  reset(x: number, y: number, z: number) {
    for (let i = 0; i < this.len; i++) {
      this.pts[i * 3] = x; this.pts[i * 3 + 1] = y; this.pts[i * 3 + 2] = z;
    }
    this.initialized = true;
  }

  update(dt: number, x: number, y: number, z: number) {
    if (!this.initialized) this.reset(x, y, z);
    this.acc += dt;
    const step = 1 / 70;
    let shifts = 0;
    while (this.acc >= step && shifts < 6) {
      for (let i = this.len - 1; i >= 1; i--) {
        this.pts[i * 3] = this.pts[(i - 1) * 3];
        this.pts[i * 3 + 1] = this.pts[(i - 1) * 3 + 1];
        this.pts[i * 3 + 2] = this.pts[(i - 1) * 3 + 2];
      }
      this.acc -= step;
      shifts++;
    }
    this.pts[0] = x; this.pts[1] = y; this.pts[2] = z;
    const p = this.posAttr.array as Float32Array;
    const al = this.alphaAttr.array as Float32Array;
    const n = this.len;
    for (let i = 0; i < n; i++) {
      const px = this.pts[i * 3], py = this.pts[i * 3 + 1], pz = this.pts[i * 3 + 2];
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
      let dx = this.pts[i0 * 3] - this.pts[i1 * 3];
      let dz = this.pts[i0 * 3 + 2] - this.pts[i1 * 3 + 2];
      const l = Math.hypot(dx, dz);
      let perpX: number, perpZ: number;
      if (l > 1e-4) {
        dx /= l; dz /= l;
        perpX = -dz; perpZ = dx;
        this.lastPerpX = perpX; this.lastPerpZ = perpZ;
      } else {
        perpX = this.lastPerpX; perpZ = this.lastPerpZ;
      }
      const t = 1 - i / (n - 1);
      const w = this.width * Math.pow(t, 0.6) * this.intensity;
      p[i * 6] = px + perpX * w; p[i * 6 + 1] = py; p[i * 6 + 2] = pz + perpZ * w;
      p[i * 6 + 3] = px - perpX * w; p[i * 6 + 4] = py; p[i * 6 + 5] = pz - perpZ * w;
      al[i * 2] = t * t * this.intensity;
      al[i * 2 + 1] = t * t * this.intensity;
    }
    this.posAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

// ---------------------------------------------------------------------------
// Ondas de choque (anéis expansivos)
// ---------------------------------------------------------------------------
interface Shock {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  active: boolean;
  life: number;
  maxLife: number;
  startR: number;
  endR: number;
}

export class ShockwavePool {
  private pool: Shock[] = [];
  private thin: THREE.RingGeometry;
  private thick: THREE.RingGeometry;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.thin = new THREE.RingGeometry(0.93, 1, 72);
    this.thin.rotateX(-Math.PI / 2);
    this.thick = new THREE.RingGeometry(0.72, 1, 72);
    this.thick.rotateX(-Math.PI / 2);
    for (let i = 0; i < 24; i++) this.pool.push(this.create());
  }

  private create(): Shock {
    const mat = radialMaterial(0.93);
    const mesh = new THREE.Mesh(this.thin, mat);
    mesh.visible = false;
    mesh.renderOrder = 8;
    this.scene.add(mesh);
    return { mesh, mat, active: false, life: 0, maxLife: 1, startR: 0, endR: 1 };
  }

  spawn(x: number, z: number, color: number, o: { startR?: number; endR?: number; duration?: number; thick?: boolean; y?: number; intensity?: number } = {}) {
    let s = this.pool.find(p => !p.active);
    if (!s && this.pool.length < 64) { s = this.create(); this.pool.push(s); }
    if (!s) s = this.pool.reduce((a, b) => a.life / a.maxLife < b.life / b.maxLife ? a : b);
    s.active = true;
    s.mesh.visible = true;
    s.mesh.geometry = o.thick ? this.thick : this.thin;
    s.life = s.maxLife = o.duration ?? 0.6;
    s.startR = o.startR ?? 0.5;
    s.endR = o.endR ?? 12;
    s.mat.uniforms.uColor.value.setHex(color).multiplyScalar(o.intensity ?? 2.5);
    s.mat.uniforms.uAlpha.value = 1;
    s.mat.uniforms.uAge.value = 0;
    s.mat.uniforms.uInner.value = o.thick ? 0.72 : 0.93;
    s.mesh.position.set(x, o.y ?? 0.25, z);
    s.mesh.scale.setScalar(s.startR);
    return s;
  }

  update(dt: number) {
    for (const s of this.pool) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) { s.active = false; s.mesh.visible = false; continue; }
      const t = 1 - s.life / s.maxLife;
      const e = 1 - Math.pow(1 - t, 2.2);
      const r = s.startR + (s.endR - s.startR) * e;
      s.mesh.scale.setScalar(r);
      s.mat.uniforms.uAlpha.value = Math.pow(1 - t, 1.5);
      s.mat.uniforms.uAge.value = t;
    }
  }

  clear() {
    for (const s of this.pool) { s.active = false; s.mesh.visible = false; }
  }
}

// ---------------------------------------------------------------------------
// Fantasmas (afterimages) do Dash
// ---------------------------------------------------------------------------
interface Ghost { group: THREE.Group; mat: THREE.MeshBasicMaterial; life: number; active: boolean }

export class GhostPool {
  private pool: Ghost[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) { this.scene = scene; }

  build(source: THREE.Group, color: number, count = 6) {
    this.clearAll();
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: tmpC.setHex(color).multiplyScalar(1.6).clone(), transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const group = new THREE.Group();
      source.traverse(obj => {
        const m = obj as THREE.Mesh;
        if (m.isMesh) {
          const clone = new THREE.Mesh(m.geometry, mat);
          m.updateWorldMatrix(true, false);
          // posição relativa ao grupo fonte
          const rel = new THREE.Matrix4().copy(source.matrixWorld).invert().multiply(m.matrixWorld);
          rel.decompose(clone.position, clone.quaternion, clone.scale);
          group.add(clone);
        }
      });
      group.visible = false;
      this.scene.add(group);
      this.pool.push({ group, mat, life: 0, active: false });
    }
  }

  spawn(source: THREE.Group) {
    const g = this.pool.find(p => !p.active) ?? this.pool[0];
    if (!g) return;
    g.active = true;
    g.life = 0.4;
    g.group.visible = true;
    source.updateWorldMatrix(true, false);
    source.matrixWorld.decompose(g.group.position, g.group.quaternion, g.group.scale);
    g.mat.opacity = 0.75;
  }

  update(dt: number) {
    for (const g of this.pool) {
      if (!g.active) continue;
      g.life -= dt;
      if (g.life <= 0) { g.active = false; g.group.visible = false; continue; }
      const t = g.life / 0.4;
      g.mat.opacity = t * 0.75;
      g.group.scale.multiplyScalar(1 + dt * 0.8);
    }
  }

  clearAll() {
    for (const g of this.pool) {
      this.scene.remove(g.group);
      g.mat.dispose();
    }
    this.pool.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Pool de luzes dinâmicas
// ---------------------------------------------------------------------------
interface DynLight { light: THREE.PointLight; life: number; maxLife: number; peak: number; active: boolean }

export class LightPool {
  private pool: DynLight[] = [];
  private cursor = 0;

  constructor(scene: THREE.Scene, count = 6) {
    for (let i = 0; i < count; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 30, 1.8);
      light.position.set(0, 3, 0);
      scene.add(light);
      this.pool.push({ light, life: 0, maxLife: 1, peak: 0, active: false });
    }
  }

  flash(x: number, y: number, z: number, color: number, intensity = 400, duration = 0.4, distance = 30) {
    let l = this.pool.find(p => !p.active);
    if (!l) { l = this.pool[this.cursor]; this.cursor = (this.cursor + 1) % this.pool.length; }
    l.active = true;
    l.life = l.maxLife = duration;
    l.peak = Math.min(intensity * 0.06, 50);
    l.light.color.setHex(color);
    l.light.position.set(x, y, z);
    l.light.distance = distance;
    l.light.intensity = l.peak;
  }

  update(dt: number) {
    for (const l of this.pool) {
      if (!l.active) continue;
      l.life -= dt;
      if (l.life <= 0) { l.active = false; l.light.intensity = 0; continue; }
      const t = l.life / l.maxLife;
      l.light.intensity = l.peak * t * t;
    }
  }

  clear() { for (const l of this.pool) { l.active = false; l.light.intensity = 0; } }
}

// ---------------------------------------------------------------------------
// Feixes de laser (inimigos Beam / chefe)
// ---------------------------------------------------------------------------
export interface Beam {
  group: THREE.Group;
  outer: THREE.Mesh;
  inner: THREE.Mesh;
  outerMat: THREE.ShaderMaterial;
  innerMat: THREE.MeshBasicMaterial;
  active: boolean;
  set: (x: number, z: number, angle: number, len: number, width: number) => void;
  release: () => void;
}

export class BeamPool {
  private pool: Beam[] = [];
  private scene: THREE.Scene;
  private geo: THREE.CylinderGeometry;
  private time = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, true);
    this.geo.rotateX(Math.PI / 2);
    this.geo.translate(0, 0, 0.5);
    for (let i = 0; i < 10; i++) this.pool.push(this.create());
  }

  private create(): Beam {
    const outerMat = new THREE.ShaderMaterial({
      vertexShader: CORE_VERT,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vPos;
        void main() {
          float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 1.5);
          float flow = 0.6 + 0.4 * sin(vPos.z * 70.0 - uTime * 38.0);
          float ends = smoothstep(0.0, 0.025, vPos.z) * (1.0 - smoothstep(0.97, 1.0, vPos.z));
          gl_FragColor = vec4(uColor * (1.0 + flow * 0.4), (0.22 + rim * 0.3) * ends);
        }
      `,
      uniforms: { uColor: { value: new THREE.Color() }, uTime: { value: 0 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const innerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const outer = new THREE.Mesh(this.geo, outerMat);
    const inner = new THREE.Mesh(this.geo, innerMat);
    const group = new THREE.Group();
    group.add(outer, inner);
    group.visible = false;
    group.position.y = 1;
    this.scene.add(group);
    const beam: Beam = {
      group, outer, inner, outerMat, innerMat, active: false,
      set: (x, z, angle, len, width) => {
        group.position.set(x, 1, z);
        group.rotation.y = angle;
        outer.scale.set(width, width * 0.8, len);
        inner.scale.set(width * 0.35, width * 0.3, len);
      },
      release: () => { beam.active = false; group.visible = false; },
    };
    return beam;
  }

  acquire(color: number): Beam {
    let b = this.pool.find(p => !p.active);
    if (!b) { b = this.create(); this.pool.push(b); }
    b.active = true;
    b.group.visible = true;
    b.outerMat.uniforms.uColor.value.setHex(color).multiplyScalar(2.2);
    b.innerMat.color.setHex(color).lerp(new THREE.Color(1, 1, 1), 0.6).multiplyScalar(3);
    return b;
  }

  clear() { for (const b of this.pool) b.release(); }
  update(dt: number) {
    this.time += dt;
    for (const b of this.pool) if (b.active) b.outerMat.uniforms.uTime.value = this.time;
  }
}

// ---------------------------------------------------------------------------
// Domos / esferas expansivas
// ---------------------------------------------------------------------------
interface Dome { mesh: THREE.Mesh; wire: THREE.Mesh; mat: THREE.ShaderMaterial; wmat: THREE.MeshBasicMaterial; active: boolean; life: number; maxLife: number; endR: number }

export class DomePool {
  private pool: Dome[] = [];
  private scene: THREE.Scene;
  private geo = new THREE.SphereGeometry(1, 28, 18);
  private wgeo = new THREE.IcosahedronGeometry(1, 2);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    for (let i = 0; i < 8; i++) this.pool.push(this.create());
  }

  private create(): Dome {
    const mat = new THREE.ShaderMaterial({
      vertexShader: CORE_VERT,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uAge;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vPos;
        void main() {
          float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 2.4);
          float bands = pow(0.5 + 0.5 * sin(vPos.y * 36.0 - uAge * 25.0), 12.0);
          float alpha = (fresnel * 0.65 + bands * 0.07) * (1.0 - uAge);
          gl_FragColor = vec4(uColor * (1.0 + fresnel), alpha);
        }
      `,
      uniforms: { uColor: { value: new THREE.Color() }, uAge: { value: 0 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
    });
    const wmat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true });
    const mesh = new THREE.Mesh(this.geo, mat);
    const wire = new THREE.Mesh(this.wgeo, wmat);
    mesh.add(wire);
    mesh.visible = false;
    mesh.renderOrder = 9;
    this.scene.add(mesh);
    return { mesh, wire, mat, wmat, active: false, life: 0, maxLife: 1, endR: 10 };
  }

  spawn(x: number, y: number, z: number, color: number, endR: number, duration: number) {
    let d = this.pool.find(p => !p.active);
    if (!d && this.pool.length < 16) { d = this.create(); this.pool.push(d); }
    if (!d) d = this.pool.reduce((a, b) => a.life < b.life ? a : b);
    d.active = true;
    d.mesh.visible = true;
    d.life = d.maxLife = duration;
    d.endR = endR;
    d.mat.uniforms.uColor.value.setHex(color).multiplyScalar(1.6);
    d.mat.uniforms.uAge.value = 0;
    d.wmat.opacity = 0.3;
    d.wmat.color.setHex(color).multiplyScalar(2.5);
    d.mesh.position.set(x, y, z);
    d.mesh.scale.setScalar(0.1);
    return d;
  }

  update(dt: number) {
    for (const d of this.pool) {
      if (!d.active) continue;
      d.life -= dt;
      if (d.life <= 0) { d.active = false; d.mesh.visible = false; continue; }
      const t = 1 - d.life / d.maxLife;
      const e = 1 - Math.pow(1 - t, 3);
      d.mesh.scale.setScalar(Math.max(0.1, d.endR * e));
      d.mat.uniforms.uAge.value = t;
      d.wmat.opacity = 0.3 * (1 - t);
      d.wire.rotation.y += dt * 1.5;
    }
  }

  clear() { for (const d of this.pool) { d.active = false; d.mesh.visible = false; } }
}

// ---------------------------------------------------------------------------
// Arcos de plasma (Karatê do OTTON)
// ---------------------------------------------------------------------------
interface Slash { group: THREE.Group; mats: THREE.ShaderMaterial[]; active: boolean; life: number; maxLife: number; radius: number; flip: number }

export class SlashPool {
  private pool: Slash[] = [];
  private scene: THREE.Scene;
  private wide: THREE.RingGeometry;
  private thin: THREE.RingGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const theta = (130 * Math.PI) / 180;
    this.wide = new THREE.RingGeometry(0.55, 1, 40, 1, -theta / 2, theta);
    this.wide.rotateX(-Math.PI / 2);
    this.thin = new THREE.RingGeometry(0.9, 1, 40, 1, -theta / 2, theta);
    this.thin.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) this.pool.push(this.create());
  }

  private create(): Slash {
    const m1 = radialMaterial(0.55, true);
    const m2 = radialMaterial(0.9, true);
    const a = new THREE.Mesh(this.wide, m1);
    const b = new THREE.Mesh(this.thin, m2);
    b.position.y = 0.05;
    const group = new THREE.Group();
    group.add(a, b);
    group.visible = false;
    group.position.y = 0.9;
    group.renderOrder = 12;
    this.scene.add(group);
    return { group, mats: [m1, m2], active: false, life: 0, maxLife: 0.22, radius: 4, flip: 1 };
  }

  spawn(x: number, z: number, angle: number, radius: number, color: number, flip = 1) {
    let s = this.pool.find(p => !p.active);
    if (!s && this.pool.length < 24) { s = this.create(); this.pool.push(s); }
    if (!s) s = this.pool.reduce((a, b) => a.life < b.life ? a : b);
    s.active = true;
    s.group.visible = true;
    s.life = s.maxLife = 0.24;
    s.radius = radius;
    s.flip = flip;
    s.mats[0].uniforms.uColor.value.setHex(color).multiplyScalar(2);
    s.mats[1].uniforms.uColor.value.setHex(color).lerp(tmpC.setRGB(1, 1, 1), 0.7).multiplyScalar(3);
    for (const mat of s.mats) { mat.uniforms.uAlpha.value = 1; mat.uniforms.uAge.value = 0; }
    s.group.position.set(x, 0.9, z);
    s.group.rotation.set(0, angle - Math.PI / 2, 0);
    s.group.scale.set(radius * 0.7, 1, radius * 0.7 * flip);
  }

  update(dt: number) {
    for (const s of this.pool) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) { s.active = false; s.group.visible = false; continue; }
      const t = 1 - s.life / s.maxLife;
      const sc = s.radius * (0.7 + 0.45 * (1 - Math.pow(1 - t, 3)));
      s.group.scale.set(sc, 1, sc * s.flip);
      s.mats[0].uniforms.uAlpha.value = 0.65 * (1 - t);
      s.mats[1].uniforms.uAlpha.value = 1 - t * t;
      for (const mat of s.mats) mat.uniforms.uAge.value = t;
    }
  }

  clear() { for (const s of this.pool) { s.active = false; s.group.visible = false; } }
}

// ---------------------------------------------------------------------------
// Destroços (inimigos partidos ao meio)
// ---------------------------------------------------------------------------
export class DebrisPool {
  mesh: THREE.InstancedMesh;
  private max = 260;
  private count = 0;
  private data: Float32Array;
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const geo = new THREE.TetrahedronGeometry(0.4);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.4, emissive: 0x000000 });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    // x,y,z, vx,vy,vz, rx,ry,rz, wx,wy,wz, life, scale, r,g,b  => 17 floats
    this.data = new Float32Array(this.max * 17);
  }

  spawn(x: number, y: number, z: number, color: number, count = 3, speed = 7, scale = 1) {
    const c = tmpC.setHex(color);
    for (let k = 0; k < count; k++) {
      if (this.count >= this.max) return;
      const i = this.count++ * 17;
      const d = this.data;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.5 + Math.random());
      d[i] = x; d[i + 1] = y; d[i + 2] = z;
      d[i + 3] = Math.cos(a) * s; d[i + 4] = 4 + Math.random() * 6; d[i + 5] = Math.sin(a) * s;
      d[i + 6] = Math.random() * 6; d[i + 7] = Math.random() * 6; d[i + 8] = Math.random() * 6;
      d[i + 9] = (Math.random() - 0.5) * 12; d[i + 10] = (Math.random() - 0.5) * 12; d[i + 11] = (Math.random() - 0.5) * 12;
      d[i + 12] = 1.2 + Math.random() * 0.8;
      d[i + 13] = scale * (0.6 + Math.random() * 0.7);
      d[i + 14] = c.r; d[i + 15] = c.g; d[i + 16] = c.b;
    }
  }

  update(dt: number) {
    const d = this.data;
    let n = this.count;
    for (let k = 0; k < n; k++) {
      const i = k * 17;
      d[i + 12] -= dt;
      if (d[i + 12] <= 0) {
        n--;
        if (k !== n) d.copyWithin(i, n * 17, n * 17 + 17);
        k--;
        continue;
      }
      d[i + 4] -= 22 * dt;
      d[i] += d[i + 3] * dt; d[i + 1] += d[i + 4] * dt; d[i + 2] += d[i + 5] * dt;
      if (d[i + 1] < 0.2) { d[i + 1] = 0.2; d[i + 4] = -d[i + 4] * 0.4; d[i + 3] *= 0.7; d[i + 5] *= 0.7; d[i + 9] *= 0.5; d[i + 11] *= 0.5; }
      d[i + 6] += d[i + 9] * dt; d[i + 7] += d[i + 10] * dt; d[i + 8] += d[i + 11] * dt;
      const fade = Math.min(1, d[i + 12] * 2);
      this.dummy.position.set(d[i], d[i + 1], d[i + 2]);
      this.dummy.rotation.set(d[i + 6], d[i + 7], d[i + 8]);
      this.dummy.scale.setScalar(d[i + 13] * fade);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(k, this.dummy.matrix);
      this.mesh.instanceColor!.setXYZ(k, d[i + 14] * 1.5, d[i + 15] * 1.5, d[i + 16] * 1.5);
    }
    this.count = n;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }

  clear() { this.count = 0; this.mesh.count = 0; }
}
