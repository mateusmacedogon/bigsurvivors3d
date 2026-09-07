import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ARENA_RADIUS, clamp } from './config';
import type { Game } from './game';

export type PickupKind = 'xp' | 'coin' | 'shard' | 'heal' | 'magnet';
const KINDS: PickupKind[] = ['xp', 'coin', 'shard', 'heal', 'magnet'];

interface Pickup {
  active: boolean;
  kind: PickupKind;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  value: number;
  rot: number;
  magnet: boolean;
  speed: number;
  life: number;
  phase: number;
}

const tmpColor = new THREE.Color();

function mergeParts(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  for (const g of geos) {
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!merged) return new THREE.BoxGeometry(0.3, 0.3, 0.3);
  merged.computeVertexNormals();
  return merged;
}

/** Coletáveis 3D luminescentes com atração magnética suave. */
export class PickupSystem {
  private pool: Pickup[] = [];
  private meshes: Record<PickupKind, THREE.InstancedMesh>;
  private dummy = new THREE.Object3D();
  private time = 0;
  private caps: Record<PickupKind, number> = { xp: 700, coin: 200, shard: 60, heal: 20, magnet: 10 };
  private max = 1000;

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < this.max; i++) {
      this.pool.push({ active: false, kind: 'xp', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, value: 1, rot: 0, magnet: false, speed: 0, life: 0, phase: 0 });
    }
    const mk = (geo: THREE.BufferGeometry, count: number, color: number, emissiveMult = 1) => {
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: emissiveMult, metalness: 0.4, roughness: 0.2 });
      const m = new THREE.InstancedMesh(geo, mat, count);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      m.count = 0;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    };

    // 1. Gema Lapidada (Brilliant-cut diamond facetado para XP)
    const xpGeo = mergeParts([
      // Coroa superior facetada com mesa plana
      new THREE.CylinderGeometry(0.18, 0.36, 0.18, 8).translate(0, 0.09, 0),
      // Pavilhão cônico pontiagudo inferior
      new THREE.ConeGeometry(0.36, 0.42, 8).rotateX(Math.PI).translate(0, -0.21, 0),
      // Cinta do brilhante
      new THREE.CylinderGeometry(0.37, 0.37, 0.04, 8),
    ]);

    // 2. Moeda Ciberpunk Elegante (Medalhão coplanar com borda canelada, centro rebaixado e brasão em relevo)
    const coinGeo = mergeParts([
      // Aro toroidal externo canelado (plano XY)
      new THREE.TorusGeometry(0.32, 0.04, 8, 24),
      // Disco interno do medalhão alinhado ao plano XY
      new THREE.CylinderGeometry(0.30, 0.30, 0.05, 20).rotateX(Math.PI / 2),
      // Brasão estelar central lapidado em alto-relevo
      new THREE.OctahedronGeometry(0.14, 0).scale(1, 1, 0.6),
      // 4 dentes/ranhuras estéticas nas bordas
      new THREE.BoxGeometry(0.06, 0.08, 0.07).translate(0.33, 0, 0),
      new THREE.BoxGeometry(0.06, 0.08, 0.07).translate(-0.33, 0, 0),
      new THREE.BoxGeometry(0.08, 0.06, 0.07).translate(0, 0.33, 0),
      new THREE.BoxGeometry(0.08, 0.06, 0.07).translate(0, -0.33, 0),
    ]);

    // 3. Fragmento Cósmico Lapidado (Prisma alienígena assimétrico)
    const shardGeo = mergeParts([
      new THREE.OctahedronGeometry(0.42, 0).scale(0.55, 1.6, 0.68),
      new THREE.OctahedronGeometry(0.3, 0).scale(0.42, 1.1, 0.42).rotateZ(0.4).translate(0.14, -0.06, 0.05),
      new THREE.OctahedronGeometry(0.22, 0).scale(0.35, 0.8, 0.35).rotateX(-0.5).translate(-0.12, -0.15, -0.08),
    ]);

    // 4. Cápsula Nanite Médica (Cruz 3D volumétrica totalmente visível com núcleo e anel orbital)
    const healGeo = mergeParts([
      // Braço horizontal da cruz médica
      new THREE.BoxGeometry(0.52, 0.16, 0.22),
      // Braço vertical da cruz médica
      new THREE.BoxGeometry(0.16, 0.52, 0.22),
      // Núcleo esférico central proeminente
      new THREE.SphereGeometry(0.15, 10, 8),
      // Anel orbital de contenção horizontal
      new THREE.TorusGeometry(0.34, 0.035, 6, 20).rotateX(Math.PI / 2),
      // 4 cantos de proteção nanotecnológica
      new THREE.BoxGeometry(0.08, 0.08, 0.24).translate(0.22, 0.22, 0),
      new THREE.BoxGeometry(0.08, 0.08, 0.24).translate(-0.22, 0.22, 0),
      new THREE.BoxGeometry(0.08, 0.08, 0.24).translate(0.22, -0.22, 0),
      new THREE.BoxGeometry(0.08, 0.08, 0.24).translate(-0.22, -0.22, 0),
    ]);

    // 5. Atrator Quântico de Fluxo (Torus acelerador com pólos magnéticos)
    const magnetGeo = mergeParts([
      new THREE.TorusGeometry(0.34, 0.065, 8, 24),
      new THREE.BoxGeometry(0.18, 0.16, 0.14).translate(0.34, 0, 0),
      new THREE.BoxGeometry(0.18, 0.16, 0.14).translate(-0.34, 0, 0),
      new THREE.OctahedronGeometry(0.12, 0),
    ]);

    this.meshes = {
      xp: mk(xpGeo, this.caps.xp, 0x00e5ff, 1.6),
      coin: mk(coinGeo, this.caps.coin, 0xffb020, 1.4),
      shard: mk(shardGeo, this.caps.shard, 0xff3cf0, 2.0),
      heal: mk(healGeo, this.caps.heal, 0x33ff88, 1.6),
      magnet: mk(magnetGeo, this.caps.magnet, 0xffffff, 1.5),
    };
  }

  countKind(kind: PickupKind) {
    let n = 0;
    for (const p of this.pool) if (p.active && p.kind === kind) n++;
    return n;
  }

  spawn(kind: PickupKind, x: number, z: number, value = 1, pop = true) {
    // Fusão de gemas quando o limite é atingido (mantém draw calls baixas)
    let slot = this.pool.find(p => !p.active);
    if (!slot || (kind === 'xp' && this.countKind('xp') >= this.caps.xp - 5)) {
      if (kind === 'xp') {
        const cands = this.pool.filter(p => p.active && p.kind === 'xp');
        if (cands.length) {
          const t = cands[Math.floor(Math.random() * cands.length)];
          t.value += value;
          return;
        }
      }
      if (!slot) return;
    }
    const p = slot;
    p.active = true;
    p.kind = kind;
    p.x = x; p.z = z; p.y = 0.6;
    const a = Math.random() * Math.PI * 2;
    const s = pop ? 2 + Math.random() * 4 : 0;
    p.vx = Math.cos(a) * s; p.vz = Math.sin(a) * s; p.vy = pop ? 6 + Math.random() * 5 : 0;
    p.value = value;
    p.rot = Math.random() * Math.PI * 2;
    p.magnet = false;
    p.speed = 0;
    p.life = kind === 'xp' ? 90 : 120;
    p.phase = Math.random() * Math.PI * 2;
  }

  magnetAll() {
    for (const p of this.pool) if (p.active) p.magnet = true;
  }

  update(dt: number, game: Game) {
    this.time += dt;
    const pl = game.player;
    const mr = pl.stats.magnet;
    const mr2 = mr * mr;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.rot += dt * (p.kind === 'coin' ? 4 : 2.2);
      const dx = pl.x - p.x, dz = pl.z - p.z;
      const d2 = dx * dx + dz * dz;
      if (!p.magnet && pl.alive && (d2 < mr2 || (p.kind === 'magnet' || p.kind === 'heal') && d2 < 6)) p.magnet = true;
      if (p.magnet && pl.alive) {
        const d = Math.sqrt(d2) || 0.001;
        p.speed = Math.min(46, p.speed + dt * 70);
        const step = Math.min(d, p.speed * dt);
        p.x += dx / d * step;
        p.z += dz / d * step;
        p.y += (1.0 - p.y) * Math.min(1, dt * 8);
        if (d < 1.1) {
          p.active = false;
          game.collect(p.kind, p.value, p.x, p.z);
          continue;
        }
      } else {
        if (p.vy !== 0 || p.y > 0.6) {
          p.vy -= 24 * dt;
          p.y += p.vy * dt;
          p.x += p.vx * dt;
          p.z += p.vz * dt;
          p.vx *= 0.96; p.vz *= 0.96;
          if (p.y <= 0.6) { p.y = 0.6; p.vy = Math.abs(p.vy) > 2 ? -p.vy * 0.35 : 0; }
          const r = Math.hypot(p.x, p.z);
          if (r > ARENA_RADIUS - 1) { p.x *= (ARENA_RADIUS - 1) / r; p.z *= (ARENA_RADIUS - 1) / r; }
        }
      }
    }
    this.render();
  }

  private render() {
    const counts: Record<PickupKind, number> = { xp: 0, coin: 0, shard: 0, heal: 0, magnet: 0 };
    const d = this.dummy;
    for (const p of this.pool) {
      if (!p.active) continue;
      const mesh = this.meshes[p.kind];
      const i = counts[p.kind];
      if (i >= this.caps[p.kind]) continue;
      const bob = Math.sin(this.time * 3 + p.phase) * 0.12;
      const blink = p.life < 8 ? (Math.sin(this.time * 14) > 0 ? 1 : 0.3) : 1;
      d.position.set(p.x, p.y + bob + 0.15, p.z);
      let s = 1;
      if (p.kind === 'xp') s = p.value >= 20 ? 1.8 : p.value >= 8 ? 1.45 : p.value >= 3 ? 1.2 : 1;
      if (p.kind === 'coin') d.rotation.set(0.25, p.rot, 0);
      else if (p.kind === 'magnet') d.rotation.set(0.4, p.rot, Math.sin(p.rot) * 0.3);
      else d.rotation.set(0, p.rot, p.kind === 'shard' ? Math.sin(p.rot * 0.5) * 0.4 : 0);
      d.scale.setScalar(s * (p.magnet ? 0.85 : 1));
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      if (p.kind === 'xp') {
        if (p.value >= 20) tmpColor.setHex(0xffd040);
        else if (p.value >= 8) tmpColor.setHex(0xff3cf0);
        else if (p.value >= 3) tmpColor.setHex(0x4d6dff);
        else tmpColor.setHex(0x00e5ff);
      } else if (p.kind === 'coin') tmpColor.setHex(0xffc040);
      else if (p.kind === 'shard') tmpColor.setHex(0xff60ff);
      else if (p.kind === 'heal') tmpColor.setHex(0x40ff90);
      else tmpColor.setHex(0xffffff);
      const k = 1.6 * blink;
      mesh.instanceColor!.setXYZ(i, clamp(tmpColor.r * k, 0, 4), clamp(tmpColor.g * k, 0, 4), clamp(tmpColor.b * k, 0, 4));
      counts[p.kind]++;
    }
    for (const k of KINDS) {
      const m = this.meshes[k];
      m.count = counts[k];
      m.instanceMatrix.needsUpdate = true;
      m.instanceColor!.needsUpdate = true;
    }
  }

  clear() {
    for (const p of this.pool) p.active = false;
    for (const k of KINDS) this.meshes[k].count = 0;
  }
}
