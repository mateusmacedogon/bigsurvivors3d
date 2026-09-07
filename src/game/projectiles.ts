import * as THREE from 'three';
import { ARENA_RADIUS, clamp, rand } from './config';
import { GLYPH_FRAG, GLYPH_VERT } from './shaders';
import type { Telegraph } from './telegraphs';
import type { Game } from './game';
import type { Enemy } from './enemies';

export type ProjKind = 'laser' | 'drop' | 'rune' | 'orb' | 'ebullet' | 'ebomb' | 'missile' | 'saw' | 'vortex' | 'flame' | 'rail';
const KINDS: ProjKind[] = ['laser', 'drop', 'rune', 'orb', 'ebullet', 'ebomb', 'missile', 'saw', 'vortex', 'flame', 'rail'];

export interface Projectile {
  active: boolean;
  kind: ProjKind;
  enemy: boolean;
  x: number; y: number; z: number;
  vx: number; vz: number;
  dmg: number;
  life: number;
  radius: number;
  pierce: number;
  ricochet: number;
  hits: number[];
  rot: number;
  spin: number;
  scale: number;
  r: number; g: number; b: number;
  cell: number;
  sx: number; sz: number; tx: number; tz: number; t: number; dur: number; height: number; aoe: number;
  tele: Telegraph | null;
  trail: number;
  knock: number;
  fromDrone: boolean;
  weaponSource: string;
  homing: boolean;
  orbitRadius: number;
  orbitSpeed: number;
  orbitAngle: number;
  pullRadius: number;
  aoeRadius: number;
  hitTick: number;
  fxTime: number;
  fxX: number; fxY: number; fxZ: number;
}

export interface SpawnOpts {
  kind: ProjKind;
  enemy?: boolean;
  x: number; z: number; y?: number;
  vx: number; vz: number;
  dmg: number;
  life?: number;
  radius?: number;
  pierce?: number;
  ricochet?: number;
  color?: number;
  scale?: number;
  spin?: number;
  cell?: number;
  trail?: number;
  knock?: number;
  fromDrone?: boolean;
  weaponSource?: string;
  homing?: boolean;
  orbitRadius?: number;
  orbitSpeed?: number;
  orbitAngle?: number;
  pullRadius?: number;
  aoeRadius?: number;
}

export const GLYPHS = ['Ψ', 'Ω', 'Δ', '∞', '⊗'];

export function makeGlyphAtlas(): THREE.CanvasTexture {
  const cell = 128;
  const canvas = document.createElement('canvas');
  canvas.width = cell * GLYPHS.length;
  canvas.height = cell;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 104px "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 6;
  for (let i = 0; i < GLYPHS.length; i++) ctx.fillText(GLYPHS[i], i * cell + cell / 2, cell / 2 + 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

const tmpColor = new THREE.Color();
const query: Enemy[] = [];

export class ProjectileSystem {
  pool: Projectile[] = [];
  private meshes: Record<ProjKind, THREE.InstancedMesh>;
  private shadow: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private time = 0;
  private hadronFissures: Array<{ x: number; z: number; timer: number; dmg: number }> = [];
  glyphAtlas: THREE.CanvasTexture;
  private glyphMat: THREE.ShaderMaterial;
  private cellAttr: THREE.InstancedBufferAttribute;
  private max: number;

  constructor(scene: THREE.Scene, max = 2600) {
    this.max = max;
    for (let i = 0; i < max; i++) this.pool.push(this.blank());
    this.glyphAtlas = makeGlyphAtlas();

    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, count: number) => {
      const m = new THREE.InstancedMesh(geo, mat, count);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      m.instanceColor.setUsage(THREE.DynamicDrawUsage);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    };
    const basic = () => new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });

    const laserGeo = new THREE.BoxGeometry(0.16, 0.16, 1.7);
    const dropGeo = new THREE.SphereGeometry(0.22, 7, 6);
    const orbGeo = new THREE.SphereGeometry(0.36, 10, 8);
    const ebGeo = new THREE.SphereGeometry(0.3, 10, 8);
    const bombGeo = new THREE.SphereGeometry(0.42, 10, 8);
    const missileGeo = new THREE.ConeGeometry(0.24, 1.1, 6);
    missileGeo.rotateX(Math.PI / 2);
    const sawGeo = new THREE.TorusGeometry(0.65, 0.16, 6, 16);
    sawGeo.rotateX(Math.PI / 2);
    const vortexGeo = new THREE.SphereGeometry(0.5, 10, 8);
    const flameGeo = new THREE.SphereGeometry(0.32, 6, 5);
    const railGeo = new THREE.BoxGeometry(0.24, 0.24, 4.0);
    const runeGeo = new THREE.PlaneGeometry(1.2, 1.2);
    runeGeo.rotateX(-Math.PI / 2);
    this.cellAttr = new THREE.InstancedBufferAttribute(new Float32Array(600), 1);
    this.cellAttr.setUsage(THREE.DynamicDrawUsage);
    runeGeo.setAttribute('aCell', this.cellAttr);
    this.glyphMat = new THREE.ShaderMaterial({
      vertexShader: GLYPH_VERT,
      fragmentShader: GLYPH_FRAG,
      uniforms: { uAtlas: { value: this.glyphAtlas }, uCells: { value: GLYPHS.length }, uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    this.meshes = {
      laser: mk(laserGeo, basic(), 700),
      drop: mk(dropGeo, basic(), 500),
      rune: mk(runeGeo, this.glyphMat, 600),
      orb: mk(orbGeo, basic(), 500),
      ebullet: mk(ebGeo, basic(), 1600),
      ebomb: mk(bombGeo, basic(), 120),
      missile: mk(missileGeo, basic(), 400),
      saw: mk(sawGeo, basic(), 200),
      vortex: mk(vortexGeo, basic(), 120),
      flame: mk(flameGeo, basic(), 600),
      rail: mk(railGeo, basic(), 250),
    };
    const shGeo = new THREE.CircleGeometry(0.6, 16);
    shGeo.rotateX(-Math.PI / 2);
    this.shadow = new THREE.InstancedMesh(shGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }), 120);
    this.shadow.count = 0;
    this.shadow.frustumCulled = false;
    this.shadow.renderOrder = 4;
    scene.add(this.shadow);
  }

  private blank(): Projectile {
    return {
      active: false, kind: 'laser', enemy: false, x: 0, y: 0.8, z: 0, vx: 0, vz: 0, dmg: 0, life: 0, radius: 0.3,
      pierce: 0, ricochet: 0, hits: [], rot: 0, spin: 0, scale: 1, r: 1, g: 1, b: 1, cell: 0,
      sx: 0, sz: 0, tx: 0, tz: 0, t: 0, dur: 1, height: 8, aoe: 3, tele: null, trail: 0, knock: 1, fromDrone: false,
      weaponSource: 'main', homing: false, orbitRadius: 0, orbitSpeed: 0, orbitAngle: 0, pullRadius: 0, aoeRadius: 0, hitTick: 0,
      fxTime: 0, fxX: 0, fxY: 0, fxZ: 0,
    };
  }

  private cursor = 0;
  spawn(o: SpawnOpts): Projectile | null {
    let p: Projectile | null = null;
    for (let i = 0; i < this.max; i++) {
      const c = this.pool[(this.cursor + i) % this.max];
      if (!c.active) { p = c; this.cursor = (this.cursor + i + 1) % this.max; break; }
    }
    if (!p) return null;
    p.active = true;
    p.kind = o.kind;
    p.enemy = !!o.enemy;
    p.x = o.x; p.z = o.z; p.y = o.y ?? 0.9;
    p.fxX = p.x; p.fxY = p.y; p.fxZ = p.z; p.fxTime = 0;
    p.vx = o.vx; p.vz = o.vz;
    p.dmg = o.dmg;
    p.life = o.life ?? 2.5;
    p.radius = o.radius ?? 0.35;
    p.pierce = o.pierce ?? 0;
    p.ricochet = o.ricochet ?? 0;
    p.hits.length = 0;
    p.rot = Math.atan2(o.vx, o.vz);
    p.spin = o.spin ?? 0;
    p.scale = o.scale ?? 1;
    tmpColor.setHex(o.color ?? 0xffffff);
    p.r = tmpColor.r; p.g = tmpColor.g; p.b = tmpColor.b;
    p.cell = o.cell ?? Math.floor(Math.random() * GLYPHS.length);
    p.tele = null;
    p.trail = o.trail ?? 0;
    p.knock = o.knock ?? 1;
    p.fromDrone = !!o.fromDrone;
    p.weaponSource = o.weaponSource ?? (o.fromDrone ? 'drone' : 'main');
    p.homing = !!o.homing;
    p.orbitRadius = o.orbitRadius ?? 0;
    p.orbitSpeed = o.orbitSpeed ?? 0;
    p.orbitAngle = o.orbitAngle ?? 0;
    p.pullRadius = o.pullRadius ?? 0;
    p.aoeRadius = o.aoeRadius ?? 0;
    p.hitTick = 0;
    p.t = 0;
    return p;
  }

  spawnBomb(sx: number, sz: number, tx: number, tz: number, dur: number, dmg: number, aoe: number, color: number, tele: Telegraph | null): Projectile | null {
    const p = this.spawn({ kind: 'ebomb', enemy: true, x: sx, z: sz, y: 1, vx: 0, vz: 0, dmg, life: dur + 1, radius: 0.4, color });
    if (!p) return null;
    p.sx = sx; p.sz = sz; p.tx = tx; p.tz = tz; p.dur = dur; p.aoe = aoe; p.t = 0;
    p.height = 6 + Math.hypot(tx - sx, tz - sz) * 0.35;
    p.tele = tele;
    return p;
  }

  clearEnemyInRadius(x: number, z: number, r: number, game: Game): number {
    let n = 0;
    for (const p of this.pool) {
      if (!p.active || !p.enemy || p.kind === 'ebomb') continue;
      if (Math.hypot(p.x - x, p.z - z) < r) {
        game.particles.burst(p.x, p.y, p.z, 3, 0xffffff, { speed: 4, life: 0.3, size: 0.2, gravity: 0 });
        p.active = false;
        n++;
      }
    }
    return n;
  }

  clearAll(enemyOnly = false) {
    for (const p of this.pool) {
      if (!p.active) continue;
      if (enemyOnly && !p.enemy) continue;
      if (p.tele) { p.tele.hold = false; p.tele.life = Math.min(p.tele.life, 0.01); p.tele = null; }
      p.active = false;
    }
  }

  update(dt: number, game: Game) {
    this.time += dt;
    this.glyphMat.uniforms.uTime.value = this.time;
    const player = game.player;
    const enemies = game.enemies;
    const boss = game.boss;
    const glyphs = player.glyphPositions;
    const limit = ARENA_RADIUS + 6;

    // Atualiza fissuras do Colisor de Hádrons
    for (let i = this.hadronFissures.length - 1; i >= 0; i--) {
      const f = this.hadronFissures[i];
      f.timer -= dt;
      if (Math.random() < 0.3) {
        game.particles.emit(f.x, 0.8, f.z, 0, rand(0.5, 2.0), 0, 0.2, 0.3, 0.2, 0.9, 1, 0, 0, 0, 1);
      }
      if (f.timer <= 0) {
        this.hadronFissures.splice(i, 1);
        game.audio.hadronCollider();
        game.shockwaves.spawn(f.x, f.z, 0x55ffff, { endR: 6.5, duration: 0.45, thick: true });
        game.particles.burst(f.x, 0.8, f.z, 30, 0x55ffff, { speed: 12, life: 0.5, size: 0.4 });
        query.length = 0;
        enemies.query(f.x, f.z, 6.5, query);
        for (const e of query) {
          if (!e.dead) {
            game.damageEnemy(e, f.dmg * 1.6, true, 'normal');
            e.stun = Math.max(e.stun, 0.45);
          }
        }
        if (boss && boss.hittable && Math.hypot(boss.x - f.x, boss.z - f.z) <= 6.5 + boss.radius) {
          game.hitBossDirect(f.dmg * 1.6, 'hadron_collider');
        }
      }
    }

    for (const p of this.pool) {
      if (!p.active) continue;

      if (p.kind === 'ebomb') {
        p.t += dt / p.dur;
        if (p.t >= 1) {
          p.active = false;
          if (p.tele) { p.tele.hold = false; p.tele.life = 0.01; p.tele = null; }
          game.explodeEnemy(p.tx, p.tz, p.aoe, p.dmg, 0xffa020);
          continue;
        }
        const e = p.t;
        p.x = p.sx + (p.tx - p.sx) * e;
        p.z = p.sz + (p.tz - p.sz) * e;
        p.y = 0.6 + Math.sin(e * Math.PI) * p.height;
        p.rot += dt * 6;
        this.updateTrail(p, dt, game);
        continue;
      }

      if (p.kind === 'saw') {
        p.life -= dt;
        if (p.life <= 0) { p.active = false; continue; }
        p.orbitAngle += p.orbitSpeed * dt;
        p.x = player.x + Math.cos(p.orbitAngle) * p.orbitRadius;
        p.z = player.z + Math.sin(p.orbitAngle) * p.orbitRadius;
        p.rot += dt * 14;
        p.hitTick -= dt;
        if (p.hitTick <= 0) {
          p.hitTick = 0.16;
          p.hits.length = 0;
        }
        if (Math.random() < 0.25) {
          game.particles.emit(p.x, p.y, p.z, rand(-0.6, 0.6), 0.3, rand(-0.6, 0.6), 0.2, 0.2, p.r, p.g, p.b, 0, 0, 0, 1);
        }
      } else if (p.kind === 'vortex') {
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          game.shockwaves.spawn(p.x, p.z, 0xa855f7, { endR: p.pullRadius || 8, duration: 0.5, thick: true });
          game.audio.gravityImplosion();
          game.vfx.explosion(p.x, p.y, p.z, 0xa855f7, (p.pullRadius || 8) * 0.6, 1.5);
          game.particles.burst(p.x, p.y, p.z, 45, 0xa855f7, { speed: 12, life: 0.6, size: 0.4 });
          query.length = 0;
          enemies.query(p.x, p.z, p.pullRadius || 8, query);
          for (const e of query) {
            if (!e.dead) game.hitEnemyDirect(e, p.dmg * 2.2, p.weaponSource, true);
          }
          continue;
        }
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        p.rot += p.spin * dt;
        query.length = 0;
        enemies.query(p.x, p.z, p.pullRadius || 8, query);
        for (const e of query) {
          if (e.dead) continue;
          const ex = p.x - e.x, ez = p.z - e.z;
          const ed = Math.hypot(ex, ez) || 1;
          const pull = (1 - ed / (p.pullRadius || 8)) * 14 * dt;
          e.x += (ex / ed) * pull;
          e.z += (ez / ed) * pull;
        }
        if (Math.random() < 0.4) {
          game.particles.implode(p.x, p.y, p.z, 2, 0xa855f7, p.pullRadius || 8, 0.25);
        }
      } else {
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          if (p.weaponSource === 'burning_passion') {
            game.particles.burst(p.x, 1.1, p.z, 10, 0xff69b4, { speed: 4.5, life: 0.35, size: 0.3 });
          }
          if (p.kind === 'drop' && !p.enemy && game.player.hero.id === 'thiago' && (game.player.upgrades.hero_thiago_caustic_puddle ?? 0) > 0) {
            if (Math.random() < 0.35) {
              const puddleLvl = game.player.upgrades.hero_thiago_caustic_puddle;
              game.groundHazards.spawn({
                x: p.x, z: p.z,
                radius: (2.2 + puddleLvl * 0.5) * game.player.stats.area,
                duration: 3.0 + puddleLvl * 1.0,
                dps: game.player.stats.damage * (1.2 + puddleLvl * 0.4),
                type: 'acid',
                color: 0x8cff2a,
                source: 'acid_puddle'
              });
            }
          }
          continue;
        }
        if (p.homing && !p.enemy) {
          const target = enemies.nearest(p.x, p.z, 36) ?? (boss && boss.hittable ? boss : null);
          if (target) {
            const tdx = target.x - p.x, tdz = target.z - p.z;
            const targetAngle = Math.atan2(tdx, tdz);
            const curAngle = Math.atan2(p.vx, p.vz);
            const diff = Math.atan2(Math.sin(targetAngle - curAngle), Math.cos(targetAngle - curAngle));
            const turnRate = p.kind === 'missile' ? 6.2 : 8.5;
            const turn = clamp(diff, -turnRate * dt, turnRate * dt);
            const newAngle = curAngle + turn;
            const sp = Math.hypot(p.vx, p.vz) || 28;
            p.vx = Math.sin(newAngle) * sp;
            p.vz = Math.cos(newAngle) * sp;
            p.rot = newAngle;
          }
          if (p.kind === 'missile') {
            if (Math.random() < 0.75) {
              game.particles.emit(p.x, p.y, p.z, -p.vx * 0.08 + rand(-0.4, 0.4), rand(0.2, 0.8), -p.vz * 0.08 + rand(-0.4, 0.4), 0.22, 0.22, 1, 0.45, 0.1, 0, 0, 0, 1);
            }
          } else if (Math.random() < 0.45) {
            game.particles.emit(p.x, p.y, p.z, rand(-0.2, 0.2), 0.2, rand(-0.2, 0.2), 0.2, 0.22, p.r, p.g, p.b, 0, 0, 0, 1);
          }
        }
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        p.rot += p.spin * dt;
      }
      const d2 = p.x * p.x + p.z * p.z;
      const arenaBorder = ARENA_RADIUS - 1.2;
      if (d2 > arenaBorder * arenaBorder) {
        if (p.ricochet > 0 && !p.enemy) {
          p.ricochet--;
          const dist = Math.sqrt(d2) || 1;
          const nx = -p.x / dist;
          const nz = -p.z / dist;
          const dot = p.vx * nx + p.vz * nz;
          p.vx = p.vx - 2 * dot * nx;
          p.vz = p.vz - 2 * dot * nz;
          p.rot = Math.atan2(p.vx, p.vz);
          p.x = -nx * (arenaBorder - 0.5);
          p.z = -nz * (arenaBorder - 0.5);
          p.life = Math.max(p.life, 1.2);
          p.hits.length = 0;
          if (p.weaponSource === 'burning_passion') {
            game.particles.burst(p.x, 1.1, p.z, 14, 0xff3c9a, { speed: 6, life: 0.45, size: 0.35 });
            game.shockwaves.spawn(p.x, p.z, 0xff3c9a, { startR: 0.5, endR: 3.5, duration: 0.3 });
          }
        } else if (d2 > limit * limit) {
          p.active = false;
          continue;
        }
      }
      this.updateTrail(p, dt, game);

      if (p.kind === 'flame') {
        p.scale += dt * 3.2;
        if (Math.random() < 0.45) {
          game.particles.emit(p.x, p.y, p.z, rand(-0.3, 0.3), rand(0.2, 0.8), rand(-0.3, 0.3), 0.2, 0.25 * p.scale, p.r, p.g, p.b, 0, 0, 0, 1);
        }
      } else if (p.kind === 'rail') {
        if (Math.random() < 0.75) {
          game.particles.emit(p.x, p.y, p.z, 0, 0.1, 0, 0.12, 0.35, p.r, p.g, p.b, 0, 0, 0, 1);
        }
      }

      if (p.trail > 0 && Math.random() < p.trail) {
        game.particles.emit(p.x, p.y, p.z, -p.vx * 0.05, 0.4, -p.vz * 0.05, 0.25, 0.28 * p.scale, p.r, p.g, p.b, 0, 0, 0, 1);
      }

      if (!p.enemy) {
        // ---- projéteis do jogador vs inimigos ----
        query.length = 0;
        enemies.query(p.x, p.z, p.radius + 3.2, query);
        let hitSomething = false;
        for (const e of query) {
          if (e.dead || p.hits.indexOf(e.id) >= 0) continue;
          const dx = e.x - p.x, dz = e.z - p.z;
          const rr = e.radius * e.size + p.radius * p.scale;
          if (dx * dx + dz * dz > rr * rr) continue;
          game.hitEnemyWithProjectile(e, p);
          p.hits.push(e.id);
          if (p.kind === 'flame') {
            const flameBurnDps = p.dmg * (p.weaponSource === 'solar_inferno' ? 1.4 : 0.8);
            const flameDur = p.weaponSource === 'solar_inferno' ? 5.5 : 3.2;
            const flameCol = p.weaponSource === 'solar_inferno' ? 0xff2200 : 0xff4500;
            game.enemies.applyBurn(e, flameBurnDps, flameDur, flameCol);
          }
          if (p.weaponSource === 'hadron_collider') {
            this.hadronFissures.push({ x: e.x, z: e.z, timer: 0.8, dmg: p.dmg });
          }
          if (p.aoeRadius > 0) {
            const blastCol = p.kind === 'missile' ? 0xff7020 : (p.r ? tmpColor.setRGB(p.r, p.g, p.b).getHex() : 0x00e5ff);
            game.vfx.explosion(p.x, p.y, p.z, blastCol, p.aoeRadius * 0.7, 1);
            game.shockwaves.spawn(p.x, p.z, blastCol, { endR: p.aoeRadius, duration: 0.35 });
            game.particles.burst(p.x, p.y, p.z, 20, blastCol, { speed: 9, life: 0.45, size: 0.3 });
            game.audio.explosion(0.85);
            query.length = 0;
            enemies.query(p.x, p.z, p.aoeRadius, query);
            for (const ne of query) {
              if (!ne.dead && ne.id !== e.id) {
                game.hitEnemyDirect(ne, p.dmg * 0.7, p.weaponSource);
              }
            }
          }
          if (p.kind === 'saw' || p.kind === 'rail' || p.kind === 'flame') {
            // continuam atravessando
          } else if (!this.afterHit(p, e.x, e.z, game)) break;
        }
        if (!p.active) continue;
        if (boss && boss.hittable && p.hits.indexOf(-1) < 0) {
          const dx = boss.x - p.x, dz = boss.z - p.z;
          const rr = boss.radius + p.radius;
          if (dx * dx + dz * dz < rr * rr) {
            game.hitBossWithProjectile(p);
            p.hits.push(-1);
            if (p.weaponSource === 'hadron_collider') {
              this.hadronFissures.push({ x: boss.x, z: boss.z, timer: 0.8, dmg: p.dmg });
            }
            if (p.aoeRadius > 0) {
              const blastCol = p.kind === 'missile' ? 0xff7020 : (p.r ? tmpColor.setRGB(p.r, p.g, p.b).getHex() : 0x00e5ff);
              game.vfx.explosion(p.x, p.y, p.z, blastCol, p.aoeRadius * 0.7, 1);
              game.shockwaves.spawn(p.x, p.z, blastCol, { endR: p.aoeRadius, duration: 0.35 });
              game.particles.burst(p.x, p.y, p.z, 24, blastCol, { speed: 10, life: 0.45, size: 0.3 });
              game.audio.explosion(0.85);
            }
            if (p.kind !== 'saw' && p.kind !== 'rail' && p.kind !== 'flame') this.afterHit(p, boss.x, boss.z, game);
          }
        }
        if (p.active && game.arenaProps && game.arenaProps.crystals.length > 0) {
          for (const c of game.arenaProps.crystals) {
            const dx = c.x - p.x, dz = c.z - p.z;
            const rr = c.radius + p.radius * p.scale;
            if (dx * dx + dz * dz <= rr * rr) {
              game.arenaProps.damageCrystal(c, p.dmg, game);
              if (p.kind === 'missile' && p.aoeRadius > 0) {
                game.vfx.explosion(p.x, p.y, p.z, 0xff7020, p.aoeRadius * 0.7, 1);
                game.shockwaves.spawn(p.x, p.z, 0xff7020, { endR: p.aoeRadius, duration: 0.35 });
                game.particles.burst(p.x, p.y, p.z, 20, 0xff7020, { speed: 9, life: 0.45, size: 0.3 });
                game.audio.explosion(0.85);
              }
              if (p.kind !== 'saw') this.afterHit(p, c.x, c.z, game);
              break;
            }
          }
        }
        void hitSomething;
      } else {
        // ---- projéteis inimigos vs glifos do Pietro ----
        if (glyphs.length) {
          let blocked = false;
          for (const g of glyphs) {
            const dx = g.x - p.x, dz = g.z - p.z;
            if (dx * dx + dz * dz < 2.6 * 2.6) { blocked = true; break; }
          }
          if (blocked) {
            game.particles.burst(p.x, p.y, p.z, 4, 0xc05cff, { speed: 5, life: 0.35, size: 0.22, gravity: 0 });
            p.active = false;
            continue;
          }
        }
        // ---- vs jogador ----
        if (player.alive && !player.invulnerable) {
          const dx = player.x - p.x, dz = player.z - p.z;
          const rr = player.radius + p.radius;
          if (dx * dx + dz * dz < rr * rr) {
            game.damagePlayer(p.dmg, p.x, p.z);
            game.particles.burst(p.x, p.y, p.z, 8, tmpColor.setRGB(p.r, p.g, p.b), { speed: 6, life: 0.4, size: 0.25 });
            p.active = false;
            continue;
          }
        }
      }
    }
    this.render();
  }

  /** Dispara arco elétrico em cascata da Bobina de Tesla */
  fireTeslaChain(startX: number, startZ: number, dmg: number, maxJumps: number, game: Game, evolved = false, source?: string) {
    const enemies = game.enemies;
    const hitIds = new Set<number>();
    let cx = startX, cz = startZ;
    let currentDmg = dmg;
    const weaponSrc = source ?? (evolved ? 'mjolnir_storm' : 'tesla_coil');
    game.audio.teslaArc();

    for (let jump = 0; jump < maxJumps; jump++) {
      query.length = 0;
      enemies.query(cx, cz, evolved ? 16 : 11, query);
      let best: Enemy | null = null;
      let bd = Infinity;
      for (const e of query) {
        if (e.dead || hitIds.has(e.id)) continue;
        const d = (e.x - cx) ** 2 + (e.z - cz) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) {
        const boss = game.boss;
        if (boss && boss.hittable && !hitIds.has(-1)) {
          const bd = (boss.x - cx) ** 2 + (boss.z - cz) ** 2;
          if (bd < (evolved ? 16 : 11) ** 2) {
            hitIds.add(-1);
            game.hitBossDirect(currentDmg, weaponSrc);
            this.drawLightningArc(cx, cz, boss.x, boss.z, game, evolved ? 0x93c5fd : 0x60a5fa);
          }
        }
        break;
      }
      hitIds.add(best.id);
      game.hitEnemyDirect(best, currentDmg, weaponSrc);
      best.stun = Math.max(best.stun, evolved ? 0.45 : 0.25);
      this.drawLightningArc(cx, cz, best.x, best.z, game, evolved ? 0x93c5fd : 0x60a5fa);
      cx = best.x;
      cz = best.z;
      currentDmg *= 0.86;
    }
  }

  private drawLightningArc(x0: number, z0: number, x1: number, z1: number, game: Game, color: number) {
    game.vfx.lightning(x0, z0, x1, z1, color);
  }

  private updateTrail(p: Projectile, dt: number, game: Game) {
    // Fixed emission cadence preserves trails at different frame rates.
    if (p.kind === 'ebullet' || p.kind === 'vortex') return;
    p.fxTime += dt;
    const interval = game.graphicsQuality === 'high' ? 1 / 45 : game.graphicsQuality === 'medium' ? 1 / 30 : 1 / 20;
    if (p.fxTime < interval) return;
    p.fxTime %= interval;
    const color = p.kind === 'missile' || p.kind === 'ebomb' ? 0xff8c30 : tmpColor.setRGB(p.r, p.g, p.b).getHex();
    game.vfx.trail(p.fxX, p.fxY, p.fxZ, p.x, p.y, p.z, color, p.scale, p.kind);
    p.fxX = p.x; p.fxY = p.y; p.fxZ = p.z;
  }

  /** Retorna true se o projétil continua ativo após o acerto. */
  private afterHit(p: Projectile, hx: number, hz: number, game: Game): boolean {
    if (p.kind === 'saw' || p.kind === 'rail' || p.kind === 'flame') return true;
    if (p.pierce > 0) { p.pierce--; return true; }
    if (p.ricochet > 0) {
      p.ricochet--;
      query.length = 0;
      game.enemies.query(hx, hz, 16, query);
      let best: Enemy | null = null;
      let bd = Infinity;
      for (const e of query) {
        if (e.dead || p.hits.indexOf(e.id) >= 0) continue;
        const d = (e.x - hx) ** 2 + (e.z - hz) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const sp = Math.hypot(p.vx, p.vz);
        const d = Math.sqrt(bd) || 1;
        p.vx = (best.x - hx) / d * sp;
        p.vz = (best.z - hz) / d * sp;
        p.rot = Math.atan2(p.vx, p.vz);
        p.life = Math.max(p.life, 1.2);
        return true;
      }
      if (game.boss && game.boss.hittable && p.hits.indexOf(-1) < 0) {
        const boss = game.boss;
        const bdx = (boss.x - hx) ** 2 + (boss.z - hz) ** 2;
        if (bdx < 18 * 18) {
          const sp = Math.hypot(p.vx, p.vz);
          const d = Math.sqrt(bdx) || 1;
          p.vx = (boss.x - hx) / d * sp;
          p.vz = (boss.z - hz) / d * sp;
          p.rot = Math.atan2(p.vx, p.vz);
          p.life = Math.max(p.life, 1.2);
          return true;
        }
      }
    }
    if (p.weaponSource === 'burning_passion') {
      game.particles.burst(hx, 1.1, hz, 12, 0xff69b4, { speed: 5, life: 0.35, size: 0.3 });
    }
    const hasPuddleUpgrade = (game.player.upgrades.hero_thiago_caustic_puddle ?? 0) > 0;
    const isAlchemist = game.player.ascensionPerk === 'thiago_caustic_alchemist';
    if (p.kind === 'drop' && !p.enemy && game.player.hero.id === 'thiago' && (hasPuddleUpgrade || isAlchemist)) {
      if (Math.random() < (isAlchemist ? 0.40 : 0.30)) {
        const puddleLvl = game.player.upgrades.hero_thiago_caustic_puddle ?? 1;
        const dur = (3.0 + puddleLvl * 1.0) * (isAlchemist ? 2.0 : 1.0);
        game.groundHazards.spawn({
          x: hx, z: hz,
          radius: (2.2 + puddleLvl * 0.5) * game.player.stats.area,
          duration: dur,
          dps: game.player.stats.damage * (1.2 + puddleLvl * 0.4),
          type: 'acid',
          color: 0x8cff2a,
          source: 'acid_puddle'
        });
      }
    }
    p.active = false;
    return false;
  }

  private render() {
    const counts: Record<ProjKind, number> = { laser: 0, drop: 0, rune: 0, orb: 0, ebullet: 0, ebomb: 0, missile: 0, saw: 0, vortex: 0, flame: 0, rail: 0 };
    let shadowCount = 0;
    const d = this.dummy;
    const pulse = 1 + Math.sin(this.time * 18) * 0.12;
    for (const p of this.pool) {
      if (!p.active) continue;
      const mesh = this.meshes[p.kind];
      const i = counts[p.kind];
      if (i >= mesh.instanceMatrix.count) continue;
      d.position.set(p.x, p.y, p.z);
      switch (p.kind) {
        case 'laser':
          d.rotation.set(0, p.rot, 0);
          d.scale.set(p.scale, p.scale, p.scale * 1.15);
          break;
        case 'rail':
          d.rotation.set(0, p.rot, 0);
          d.scale.set(p.scale, p.scale, p.scale * 1.6);
          break;
        case 'flame':
          d.rotation.set(0, p.rot, 0);
          d.scale.setScalar(p.scale);
          break;
        case 'rune':
          d.rotation.set(0, p.rot, 0);
          d.scale.setScalar(p.scale * 1.4);
          break;
        case 'ebullet':
          d.rotation.set(0, 0, 0);
          d.scale.setScalar(p.scale * pulse);
          break;
        case 'ebomb':
          d.rotation.set(p.rot, p.rot * 0.7, 0);
          d.scale.setScalar(p.scale);
          if (shadowCount < 120) {
            const h = Math.max(0, p.y - 0.6) / (p.height + 0.01);
            d.position.set(p.x, 0.05, p.z);
            d.rotation.set(0, 0, 0);
            const s = 1.4 - h * 0.9;
            d.scale.set(s, 1, s);
            d.updateMatrix();
            this.shadow.setMatrixAt(shadowCount++, d.matrix);
            d.position.set(p.x, p.y, p.z);
            d.rotation.set(p.rot, p.rot * 0.7, 0);
            d.scale.setScalar(p.scale);
          }
          break;
        case 'missile':
          d.rotation.set(0, p.rot, 0);
          d.scale.set(p.scale * 1.1, p.scale * 1.1, p.scale * 1.35);
          break;
        case 'saw':
          d.rotation.set(0, p.rot, 0);
          d.scale.setScalar(p.scale * 1.25);
          break;
        case 'vortex':
          d.rotation.set(0, p.rot, p.rot * 0.5);
          d.scale.setScalar(p.scale * (1 + Math.sin(this.time * 12) * 0.15));
          break;
        default:
          d.rotation.set(0, p.rot, 0);
          d.scale.setScalar(p.scale);
      }
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      const k = p.kind === 'rune' ? 1 : 2.6;
      mesh.instanceColor!.setXYZ(i, p.r * k, p.g * k, p.b * k);
      if (p.kind === 'rune') this.cellAttr.setX(i, p.cell);
      counts[p.kind]++;
    }
    for (const k of KINDS) {
      const m = this.meshes[k];
      m.count = counts[k];
      m.instanceMatrix.needsUpdate = true;
      m.instanceColor!.needsUpdate = true;
    }
    this.cellAttr.needsUpdate = true;
    this.shadow.count = shadowCount;
    this.shadow.instanceMatrix.needsUpdate = true;
  }

  fireRailgun(x: number, z: number, angle: number, dmg: number, evolved: boolean, game: Game) {
    const sp = 82;
    const p = this.spawn({
      kind: 'rail',
      x, z, y: 1.0,
      vx: Math.sin(angle) * sp,
      vz: Math.cos(angle) * sp,
      dmg,
      life: 1.6,
      radius: evolved ? 1.0 : 0.65,
      pierce: 999,
      color: evolved ? 0x55ffff : 0x00ffff,
      scale: evolved ? 1.8 : 1.25,
      trail: 1.0,
      weaponSource: evolved ? 'hadron_collider' : 'railgun',
    });
    if (p) {
      game.audio.railgun();
      game.shockwaves.spawn(x, z, evolved ? 0x55ffff : 0x00ffff, { endR: 3.8, duration: 0.25 });
    }
  }

  fireFlamethrower(x: number, z: number, baseAngle: number, dmg: number, evolved: boolean, game: Game, multishot = 0) {
    const sp = rand(22, 28);
    const count = evolved ? 12 : (2 + multishot);
    const spread = evolved ? (Math.PI * 2) : 0.45;
    const startAngle = evolved ? 0 : baseAngle - spread * 0.5;

    for (let i = 0; i < count; i++) {
      const a = evolved
        ? (i / count) * Math.PI * 2 + rand(-0.15, 0.15)
        : startAngle + (i / Math.max(1, count - 1)) * spread + rand(-0.08, 0.08);
      const speed = sp * rand(0.85, 1.15);
      this.spawn({
        kind: 'flame',
        x: x + Math.sin(a) * 0.8,
        z: z + Math.cos(a) * 0.8,
        y: 0.9,
        vx: Math.sin(a) * speed,
        vz: Math.cos(a) * speed,
        dmg,
        life: rand(0.32, 0.48),
        radius: evolved ? 0.85 : 0.55,
        pierce: 999,
        color: evolved ? 0xff2200 : 0xff4500,
        scale: evolved ? 1.4 : 0.9,
        trail: 0.8,
        weaponSource: evolved ? 'solar_inferno' : 'flamethrower',
      });
    }
    if (evolved) {
      game.audio.solarInferno();
    } else {
      game.audio.flamethrower();
    }
  }

  fireRefractionLasers(x: number, z: number, baseAngle: number, dmg: number, game: Game) {
    const sp = 38;
    game.audio.laser();
    const angles = [baseAngle - 0.32, baseAngle, baseAngle + 0.32];
    for (const a of angles) {
      this.spawn({
        kind: 'laser',
        x, z, y: 0.9,
        vx: Math.sin(a) * sp,
        vz: Math.cos(a) * sp,
        dmg: dmg * 0.65,
        life: 1.2,
        radius: 0.3,
        color: 0x38bdf8,
        scale: 0.85,
        trail: 0.5,
        weaponSource: 'refraction_prism',
      });
    }
  }

  spawnMicroVortex(x: number, z: number, dmg: number) {
    this.spawn({
      kind: 'vortex',
      x, z, y: 0.9,
      vx: 0, vz: 0,
      dmg: dmg * 0.6,
      life: 0.8,
      radius: 0.8,
      pullRadius: 6.5,
      color: 0xc084fc,
      scale: 0.9,
      spin: 10,
      weaponSource: 'vacuum_reactor',
    });
  }
}
