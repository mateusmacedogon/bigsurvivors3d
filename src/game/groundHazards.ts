import * as THREE from 'three';
import type { Game } from './game';
import type { Enemy } from './enemies';
import { rand } from './config';

export type GroundHazardType = 'fire' | 'acid' | 'holy';

export interface GroundHazardOpts {
  x: number;
  z: number;
  radius: number;
  duration: number;
  dps: number;
  type: GroundHazardType;
  color?: number;
  source?: string;
}

export interface GroundHazard {
  id: number;
  mesh: THREE.Mesh;
  borderMesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  borderMat: THREE.MeshBasicMaterial;
  x: number;
  z: number;
  radius: number;
  life: number;
  maxLife: number;
  dps: number;
  type: GroundHazardType;
  color: number;
  source: string;
  tickTimer: number;
  particleTimer: number;
}

const query: Enemy[] = [];

export class GroundHazardSystem {
  private hazards: GroundHazard[] = [];
  private nextId = 1;
  private scene: THREE.Scene;
  private circleGeo: THREE.CircleGeometry;
  private ringGeo: THREE.RingGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.circleGeo = new THREE.CircleGeometry(1, 32);
    this.circleGeo.rotateX(-Math.PI / 2);
    this.ringGeo = new THREE.RingGeometry(0.92, 1.0, 32);
    this.ringGeo.rotateX(-Math.PI / 2);
  }

  spawn(opts: GroundHazardOpts): GroundHazard {
    const color = opts.color ?? (opts.type === 'fire' ? 0xff4500 : opts.type === 'acid' ? 0x8cff2a : 0xffcc44);
    const source = opts.source ?? (opts.type === 'fire' ? 'garrafa_flamejante' : opts.type === 'acid' ? 'acid_puddle' : 'holy_grace');

    // Deduplicação / fusão de poças próximas do mesmo tipo para estabilidade de performance
    for (const h of this.hazards) {
      if (h.type === opts.type) {
        const dx = h.x - opts.x, dz = h.z - opts.z;
        if (dx * dx + dz * dz < (opts.radius * 0.45) ** 2) {
          h.life = Math.max(h.life, opts.duration);
          h.radius = Math.min(opts.radius * 1.5, Math.max(h.radius, opts.radius * 1.08));
          h.dps = Math.max(h.dps, opts.dps);
          return h;
        }
      }
    }

    // Limite máximo de perigos no solo na arena (evita degradação de FPS sob múltiplos disparos)
    if (this.hazards.length >= 32) {
      const oldest = this.hazards.shift()!;
      this.scene.remove(oldest.mesh);
      this.scene.remove(oldest.borderMesh);
      oldest.mat.dispose();
      oldest.borderMat.dispose();
    }

    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: opts.type === 'fire' ? 0.35 : 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.circleGeo, mat);
    mesh.position.set(opts.x, 0.06, opts.z);
    mesh.scale.set(opts.radius, 1, opts.radius);
    mesh.renderOrder = 4;
    this.scene.add(mesh);

    const borderMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const borderMesh = new THREE.Mesh(this.ringGeo, borderMat);
    borderMesh.position.set(opts.x, 0.08, opts.z);
    borderMesh.scale.set(opts.radius, 1, opts.radius);
    borderMesh.renderOrder = 5;
    this.scene.add(borderMesh);

    const hazard: GroundHazard = {
      id: this.nextId++,
      mesh,
      borderMesh,
      mat,
      borderMat,
      x: opts.x,
      z: opts.z,
      radius: opts.radius,
      life: opts.duration,
      maxLife: opts.duration,
      dps: opts.dps,
      type: opts.type,
      color,
      source,
      tickTimer: 0.1,
      particleTimer: 0.05,
    };

    this.hazards.push(hazard);
    return hazard;
  }

  update(dt: number, game: Game) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.life -= dt;
      if (h.life <= 0) {
        this.scene.remove(h.mesh);
        this.scene.remove(h.borderMesh);
        h.mat.dispose();
        h.borderMat.dispose();
        this.hazards.splice(i, 1);
        continue;
      }

      const frac = h.life / h.maxLife;
      const pulse = 1 + Math.sin((h.maxLife - h.life) * 8) * 0.05;
      h.mesh.scale.set(h.radius * pulse, 1, h.radius * pulse);
      h.borderMesh.scale.set(h.radius * pulse, 1, h.radius * pulse);
      h.borderMesh.rotation.y += dt * 0.5;

      const baseOpacity = h.type === 'fire' ? 0.35 : 0.28;
      h.mat.opacity = baseOpacity * Math.min(1, frac * 2);
      h.borderMat.opacity = 0.8 * Math.min(1, frac * 2);

      // Efeitos de partículas contínuos
      h.particleTimer -= dt;
      if (h.particleTimer <= 0) {
        h.particleTimer = 0.08;
        const count = h.type === 'fire' ? 4 : 2;
        for (let k = 0; k < count; k++) {
          const a = Math.random() * Math.PI * 2;
          const dist = Math.random() * h.radius * 0.88;
          const px = h.x + Math.cos(a) * dist;
          const pz = h.z + Math.sin(a) * dist;

          if (h.type === 'fire') {
            game.particles.emit(
              px, 0.2, pz,
              rand(-0.6, 0.6), 2.2 + rand(0, 2), rand(-0.6, 0.6),
              0.5, 0.35,
              1, 0.35 + Math.random() * 0.3, 0.05,
              -1.5, 0, 0, 1
            );
          } else if (h.type === 'acid') {
            game.particles.emit(
              px, 0.15, pz,
              rand(-0.3, 0.3), 1.2 + rand(0, 1), rand(-0.3, 0.3),
              0.6, 0.25,
              0.55, 1, 0.16,
              -1, 0, 0, 1
            );
          } else if (h.type === 'holy') {
            game.particles.emit(
              px, 0.3, pz,
              rand(-0.2, 0.2), 3 + rand(0, 3), rand(-0.2, 0.2),
              0.7, 0.35,
              1, 0.88, 0.3,
              0, 0, 0, 1
            );
          }
        }
      }

      // Aplicação de dano e status periódico
      h.tickTimer -= dt;
      if (h.tickTimer <= 0) {
        h.tickTimer = 0.25;
        const tickDamage = h.dps * 0.25;

        query.length = 0;
        game.enemies.query(h.x, h.z, h.radius + 1.2, query);

        for (const e of query) {
          if (e.dead || e.type === 'mine') continue;
          const dx = e.x - h.x, dz = e.z - h.z;
          if (dx * dx + dz * dz <= (h.radius + e.radius * e.size) ** 2) {
            if (h.type === 'fire') {
              game.damageEnemy(e, tickDamage, false, 'normal');
              game.enemies.applyBurn(e, h.dps * 0.7, 3.2, 0xff4500);
              game.recordDamage(tickDamage, h.source);
            } else if (h.type === 'acid') {
              game.damageEnemy(e, tickDamage, false, 'corrode');
              e.speed = Math.min(e.speed, e.def.speed * 0.65);
              game.enemies.applyBurn(e, h.dps * 0.5, 2.5, 0x8cff2a);
              game.recordDamage(tickDamage, h.source);
            } else if (h.type === 'holy') {
              game.damageEnemy(e, tickDamage, false, 'normal');
              e.stun = Math.max(e.stun, 0.35);
              game.recordDamage(tickDamage, h.source);
            }
          }
        }

        const boss = game.boss;
        if (boss && boss.hittable) {
          const dx = boss.x - h.x, dz = boss.z - h.z;
          if (dx * dx + dz * dz <= (h.radius + boss.radius) ** 2) {
            boss.hit(tickDamage, false, game);
            game.recordDamage(tickDamage, h.source);
          }
        }
      }
    }
  }

  clear() {
    for (const h of this.hazards) {
      this.scene.remove(h.mesh);
      this.scene.remove(h.borderMesh);
      h.mat.dispose();
      h.borderMat.dispose();
    }
    this.hazards = [];
  }

  dispose() {
    this.clear();
    this.circleGeo.dispose();
    this.ringGeo.dispose();
  }
}
