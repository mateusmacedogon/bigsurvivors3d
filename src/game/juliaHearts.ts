import * as THREE from 'three';
import { ARENA_RADIUS, clamp, rand } from './config';
import type { Game } from './game';
import type { Enemy } from './enemies';

export interface JuliaHeart {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  time: number;
  life: number;
  maxLife: number;
  pierce: number;
  baseScale: number;
  burstTimer: number;
  orbitAngle: number;
  hitCooldowns: Map<number, number>;
  prevX: number;
  prevY: number;
  prevZ: number;
  trailTimer: number;
  active: boolean;
}

const GLITTER_COLORS = [0xff1493, 0xff2d75, 0xff69b4, 0xffb6c1, 0xffd700, 0xffffff];
const tmpColor = new THREE.Color();
const scratchEnemies: Enemy[] = [];

/**
 * Constrói uma geometria 3D de coração estilizada e suave através de curvas Bézier cúbicas
 * com Chanfro (Bevel) estético e subdivisões generosas para iluminação e reflexos perfeitos.
 */
export function createHeartGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Ponto inicial: fenda central superior (cleft)
  shape.moveTo(0, 0.4);
  // Lóbulo esquerdo superior
  shape.bezierCurveTo(-0.15, 0.85, -0.65, 1.25, -1.2, 1.25);
  // Curva externa esquerda
  shape.bezierCurveTo(-1.85, 1.25, -2.15, 0.75, -2.15, 0.15);
  // Curva inferior esquerda afunilando para a ponta
  shape.bezierCurveTo(-2.15, -0.55, -1.45, -1.25, 0, -2.15);
  // Curva inferior direita subindo da ponta
  shape.bezierCurveTo(1.45, -1.25, 2.15, -0.55, 2.15, 0.15);
  // Curva externa direita
  shape.bezierCurveTo(2.15, 0.75, 1.85, 1.25, 1.2, 1.25);
  // Lóbulo direito superior voltando à fenda central
  shape.bezierCurveTo(0.65, 1.25, 0.15, 0.85, 0, 0.4);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 0.45,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.12,
    bevelThickness: 0.12,
    curveSegments: 32,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

export class JuliaHeartSystem {
  private scene: THREE.Scene;
  private hearts: JuliaHeart[] = [];
  private heartGeo: THREE.BufferGeometry;
  private mainMat: THREE.MeshStandardMaterial;
  private haloMat: THREE.MeshBasicMaterial;
  private maxHearts = 64;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.heartGeo = createHeartGeometry();

    // Material de joia neon rosa choque com brilho emissivo vibrante (HDR Bloom)
    this.mainMat = new THREE.MeshStandardMaterial({
      color: 0xff2a7a,
      emissive: 0xff1493,
      emissiveIntensity: 2.3,
      roughness: 0.18,
      metalness: 0.35,
    });

    // Halo externo suave / aura aditiva brilhante
    this.haloMat = new THREE.MeshBasicMaterial({
      color: 0xff69b4,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  spawnSwarm(game: Game, count = 16) {
    const pl = game.player;
    const originX = pl && pl.alive ? pl.x : 0;
    const originZ = pl && pl.alive ? pl.z : 0;

    // Se já houver corações ativos em excesso, remove os mais velhos para manter performance
    while (this.hearts.length + count > this.maxHearts && this.hearts.length > 0) {
      const old = this.hearts.shift()!;
      this.removeHeartMesh(old);
    }

    // Flash inicial na tela e choque de amor
    game.lights.flash(originX, 3, originZ, 0xff2d75, 800, 0.5, 35);
    game.shockwaves.spawn(originX, originZ, 0xff2d75, { endR: 12, duration: 0.6, thick: true });
    game.particles.burst(originX, 1.2, originZ, 50, 0xff69b4, { speed: 12, life: 0.8, size: 0.45 });
    game.particles.burst(originX, 1.2, originZ, 25, 0xffffff, { speed: 8, life: 0.5, size: 0.3, gravity: 0 });

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand(-0.15, 0.15);
      const speed = rand(21, 26);
      const spawnOffset = rand(1.2, 2.5);

      const group = new THREE.Group();
      const mainMesh = new THREE.Mesh(this.heartGeo, this.mainMat);
      const haloMesh = new THREE.Mesh(this.heartGeo, this.haloMat);
      haloMesh.scale.setScalar(1.12);

      group.add(mainMesh);
      group.add(haloMesh);

      const x = originX + Math.cos(angle) * spawnOffset;
      const z = originZ + Math.sin(angle) * spawnOffset;
      const y = 1.35;

      group.position.set(x, y, z);
      this.scene.add(group);

      this.hearts.push({
        mesh: group,
        x,
        y,
        z,
        vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed,
        time: 0,
        life: 11,
        maxLife: 11,
        pierce: 6,
        baseScale: rand(1.1, 1.38),
        burstTimer: 0.45,
        orbitAngle: angle,
        hitCooldowns: new Map(),
        prevX: x,
        prevY: y,
        prevZ: z,
        trailTimer: 0,
        active: true,
      });
    }
  }

  update(dt: number, game: Game) {
    if (this.hearts.length === 0) return;

    const enemies = game.enemies;
    const boss = game.boss;
    const player = game.player;
    const arenaLimit = ARENA_RADIUS - 1.8;

    for (let hIdx = this.hearts.length - 1; hIdx >= 0; hIdx--) {
      const heart = this.hearts[hIdx];
      if (!heart.active) {
        this.removeHeartMesh(heart);
        this.hearts.splice(hIdx, 1);
        continue;
      }

      heart.time += dt;
      heart.life -= dt;

      if (heart.life <= 0 || heart.pierce <= 0) {
        this.explodeHeart(heart, game);
        this.removeHeartMesh(heart);
        this.hearts.splice(hIdx, 1);
        continue;
      }

      // Atualiza cooldown de hits em inimigos específicos
      for (const [eId, cd] of heart.hitCooldowns.entries()) {
        const nextCd = cd - dt;
        if (nextCd <= 0) heart.hitCooldowns.delete(eId);
        else heart.hitCooldowns.set(eId, nextCd);
      }

      // --- MOVIMENTAÇÃO DINÂMICA ---
      if (heart.burstTimer > 0) {
        heart.burstTimer -= dt;
        // Na fase de burst se move na direção inicial com leve atrito
        heart.vx *= Math.exp(-1.4 * dt);
        heart.vz *= Math.exp(-1.4 * dt);
      } else {
        // Busca inteligente: Prioriza Boss se estiver vivo e vulnerável, senão distribui entre os inimigos próximos
        let targetX: number | null = null;
        let targetZ: number | null = null;

        if (boss && boss.hittable && boss.state !== 'dying' && boss.state !== 'dead') {
          targetX = boss.x;
          targetZ = boss.z;
        } else {
          scratchEnemies.length = 0;
          enemies.query(heart.x, heart.z, 48, scratchEnemies);
          if (scratchEnemies.length > 0) {
            const valid = scratchEnemies.filter(e => !e.dead);
            if (valid.length > 0) {
              const notOnCd = valid.filter(e => !heart.hitCooldowns.has(e.id));
              const pool = notOnCd.length > 0 ? notOnCd : valid;
              const chosen = pool[hIdx % pool.length];
              targetX = chosen.x;
              targetZ = chosen.z;
            }
          }
        }

        if (targetX !== null && targetZ !== null) {
          // Curva suave de perseguição (Homing)
          const dx = targetX - heart.x;
          const dz = targetZ - heart.z;
          const dist = Math.hypot(dx, dz) || 1;
          const homingSpeed = 24.5;
          const desVx = (dx / dist) * homingSpeed;
          const desVz = (dz / dist) * homingSpeed;
          const steerRate = 8.5 * dt;

          heart.vx += (desVx - heart.vx) * Math.min(1, steerRate);
          heart.vz += (desVz - heart.vz) * Math.min(1, steerRate);
        } else {
          // Sem alvos na tela: move-se em órbitas/espirais expansivas e majestosas
          heart.orbitAngle += (2.4 + (hIdx % 4) * 0.35) * dt;
          const centerPos = player && player.alive ? player : { x: 0, z: 0 };
          const orbitR = 12 + 6 * Math.sin(heart.time * 2.2 + hIdx * 0.8);
          const desX = centerPos.x + Math.cos(heart.orbitAngle) * orbitR;
          const desZ = centerPos.z + Math.sin(heart.orbitAngle) * orbitR;
          const dx = desX - heart.x;
          const dz = desZ - heart.z;
          const dist = Math.hypot(dx, dz) || 1;
          const wanderSpeed = 19;
          const desVx = (dx / dist) * wanderSpeed;
          const desVz = (dz / dist) * wanderSpeed;

          heart.vx += (desVx - heart.vx) * Math.min(1, 6.0 * dt);
          heart.vz += (desVz - heart.vz) * Math.min(1, 6.0 * dt);
        }
      }

      // Aplica velocidade
      heart.x += heart.vx * dt;
      heart.z += heart.vz * dt;
      heart.y = 1.35 + Math.sin(heart.time * 4.6 + hIdx * 0.65) * 0.45;

      // Colisão elástica romântica com as bordas da arena
      const d2 = heart.x * heart.x + heart.z * heart.z;
      if (d2 > arenaLimit * arenaLimit) {
        const dist = Math.sqrt(d2) || 1;
        const nx = -heart.x / dist;
        const nz = -heart.z / dist;
        const dot = heart.vx * nx + heart.vz * nz;
        heart.vx = heart.vx - 2 * dot * nx;
        heart.vz = heart.vz - 2 * dot * nz;
        heart.x = -nx * (arenaLimit - 0.4);
        heart.z = -nz * (arenaLimit - 0.4);
        game.particles.burst(heart.x, heart.y, heart.z, 8, 0xff2d75, { speed: 6, life: 0.35, size: 0.3 });
      }

      // --- ANIMAÇÃO DE PULSAÇÃO (BATIMENTO CARDÍACO REALISTA "LUB-DUB") ---
      const beat = (heart.time * 5.2 + hIdx * 0.45) % (Math.PI * 2);
      let pulse = 1.0;
      if (beat < 0.45) {
        pulse = 1.0 + Math.sin((beat / 0.45) * Math.PI) * 0.32;
      } else if (beat >= 0.55 && beat < 1.0) {
        pulse = 1.0 + Math.sin(((beat - 0.55) / 0.45) * Math.PI) * 0.16;
      }

      // Suavização do desaparecimento no fim da vida
      const fadeMult = heart.life < 1.2 ? clamp(heart.life / 1.2, 0.05, 1) : 1;
      const currentScale = heart.baseScale * pulse * fadeMult;
      heart.mesh.scale.setScalar(currentScale);

      // --- ORIENTAÇÃO ISOMÉTRICA PERFEITA E BALANÇO 3D ---
      // A câmera isométrica do jogo olha para baixo com inclinação de ~62° (Y=36, Z=19).
      // Alinhamos a face frontal do coração diretamente para o jogador (-1.05 rad em X),
      // aplicando inclinação (pitch), rolagem (roll) que acompanha curvas e oscilação (yaw)
      // suave para revelar as facetas e o chanfro 3D sem nunca torná-lo um fio de perfil.
      const basePitch = -1.05;
      const pitchTilt = clamp(-heart.vz / 25, -0.25, 0.25) * 0.22;
      const rollBank = clamp(-heart.vx / 25, -0.4, 0.4) * 0.35;
      const rollSway = Math.sin(heart.time * 3.8 + hIdx * 0.8) * 0.12;
      const yawSway = Math.sin(heart.time * 2.4 + hIdx * 1.1) * 0.32;

      heart.mesh.rotation.set(basePitch + pitchTilt, yawSway, rollBank + rollSway);
      heart.mesh.position.set(heart.x, heart.y, heart.z);

      // --- RASTROS DE GLITTER E POEIRA ESTELAR COR-DE-ROSA ---
      const glitterCol = GLITTER_COLORS[Math.floor(Math.random() * GLITTER_COLORS.length)];
      tmpColor.setHex(glitterCol);
      game.particles.emit(
        heart.x + rand(-0.35, 0.35),
        heart.y + rand(-0.25, 0.25),
        heart.z + rand(-0.35, 0.35),
        -heart.vx * 0.08 + rand(-0.5, 0.5),
        rand(0.35, 1.1),
        -heart.vz * 0.08 + rand(-0.5, 0.5),
        0.45,
        0.36 * pulse,
        tmpColor.r,
        tmpColor.g,
        tmpColor.b,
        0,
        0.4,
        0,
        1,
      );

      heart.trailTimer += dt;
      if (heart.trailTimer >= 0.05) {
        heart.trailTimer = 0;
        game.vfx.segment(heart.prevX, heart.prevY, heart.prevZ, heart.x, heart.y, heart.z, 0xff2d75, 0.35 * pulse, 0.16);
        heart.prevX = heart.x;
        heart.prevY = heart.y;
        heart.prevZ = heart.z;
      }

      // --- DETECÇÃO DE COLISÃO E DANO EXPRESSIVO ---
      const hitRadius = 1.75 * pulse;
      const dmg = Math.max(1314, Math.round((player?.stats.damage ?? 50) * 16));

      // 1. Colisão contra Inimigos
      scratchEnemies.length = 0;
      enemies.query(heart.x, heart.z, hitRadius + 2.5, scratchEnemies);

      for (const e of scratchEnemies) {
        if (e.dead || heart.hitCooldowns.has(e.id)) continue;
        const dx = e.x - heart.x;
        const dz = e.z - heart.z;
        const rr = e.radius * e.size + hitRadius;
        if (dx * dx + dz * dz <= rr * rr) {
          heart.hitCooldowns.set(e.id, 0.32);
          heart.pierce--;

          game.recordDamage(dmg, 'julia_heart');
          game.damageEnemy(e, dmg, true, 'love' as any);
          e.stun = Math.max(e.stun, 0.75);

          // Efeitos audiovisuais românticos de impacto
          game.lights.flash(e.x, 2, e.z, 0xff2d75, 520, 0.35, 20);
          game.shockwaves.spawn(e.x, e.z, 0xff2d75, { endR: 4.8, duration: 0.35, thick: true });
          game.vfx.impact(e.x, e.y, e.z, 0xff2d75, heart.vx, heart.vz, true);
          game.vfx.explosion(e.x, e.y, e.z, 0xff2d75, 3.2, 1.2);
          game.particles.burst(e.x, e.y, e.z, 30, 0xff69b4, { speed: 9, life: 0.55, size: 0.38 });
          game.particles.burst(e.x, e.y, e.z, 15, 0xffffff, { speed: 6, life: 0.35, size: 0.25, gravity: 0 });

          if (heart.pierce <= 0) break;
        }
      }

      if (heart.pierce <= 0) {
        this.explodeHeart(heart, game);
        this.removeHeartMesh(heart);
        this.hearts.splice(hIdx, 1);
        continue;
      }

      // 2. Colisão contra o Chefe (Boss)
      if (boss && boss.hittable && !heart.hitCooldowns.has(-1)) {
        const dx = boss.x - heart.x;
        const dz = boss.z - heart.z;
        const rr = boss.radius + hitRadius;
        if (dx * dx + dz * dz <= rr * rr) {
          heart.hitCooldowns.set(-1, 0.4);
          heart.pierce -= 2;

          game.recordDamage(dmg * 1.2, 'julia_heart');
          boss.hit(dmg * 1.2, true, game, 'love');

          game.lights.flash(boss.x, 3, boss.z, 0xff2d75, 750, 0.4, 25);
          game.shockwaves.spawn(boss.x, boss.z, 0xff2d75, { endR: 6.5, duration: 0.45, thick: true });
          game.vfx.impact(boss.x, boss.y, boss.z, 0xff2d75, heart.vx, heart.vz, true);
          game.vfx.explosion(boss.x, boss.y, boss.z, 0xff2d75, 4.0, 1.4);
          game.particles.burst(boss.x, boss.y, boss.z, 35, 0xff69b4, { speed: 10, life: 0.6, size: 0.4 });
          game.particles.burst(boss.x, boss.y, boss.z, 20, 0xffffff, { speed: 7, life: 0.4, size: 0.3, gravity: 0 });
          game.audio.heartHit();

          if (heart.pierce <= 0) {
            this.explodeHeart(heart, game);
            this.removeHeartMesh(heart);
            this.hearts.splice(hIdx, 1);
            continue;
          }
        }
      }

      // 3. Colisão contra cristais de suporte
      if (game.arenaProps && game.arenaProps.crystals.length > 0) {
        for (const c of game.arenaProps.crystals) {
          const dx = c.x - heart.x;
          const dz = c.z - heart.z;
          const rr = c.radius + hitRadius;
          if (dx * dx + dz * dz <= rr * rr) {
            game.arenaProps.damageCrystal(c, dmg, game);
            game.vfx.explosion(c.x, 1, c.z, 0xff2d75, 2.5, 0.8);
            game.particles.burst(c.x, 1, c.z, 16, 0xff69b4, { speed: 6, life: 0.4, size: 0.3 });
            break;
          }
        }
      }
    }
  }

  private explodeHeart(heart: JuliaHeart, game: Game) {
    game.vfx.explosion(heart.x, heart.y, heart.z, 0xff2d75, 3.8, 1.3);
    game.shockwaves.spawn(heart.x, heart.z, 0xff2d75, { endR: 5.5, duration: 0.4, thick: true });
    game.particles.burst(heart.x, heart.y, heart.z, 36, 0xff69b4, { speed: 10, life: 0.65, size: 0.42 });
    game.particles.burst(heart.x, heart.y, heart.z, 18, 0xffd700, { speed: 7, life: 0.45, size: 0.3, gravity: 2 });
    game.particles.burst(heart.x, heart.y, heart.z, 14, 0xffffff, { speed: 8, life: 0.35, size: 0.26, gravity: 0 });
  }

  private removeHeartMesh(heart: JuliaHeart) {
    this.scene.remove(heart.mesh);
  }

  clear() {
    for (const h of this.hearts) {
      this.removeHeartMesh(h);
    }
    this.hearts.length = 0;
  }

  dispose() {
    this.clear();
    this.heartGeo.dispose();
    this.mainMat.dispose();
    this.haloMat.dispose();
  }
}
