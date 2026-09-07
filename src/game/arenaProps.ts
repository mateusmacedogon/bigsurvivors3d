import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ARENA_RADIUS, rand } from './config';
import type { Game } from './game';

export interface ArenaCrystal {
  id: number;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  radius: number;
  color: number;
  flash: number;
  mesh: THREE.Mesh;
}

export interface SpeedPad {
  x: number;
  z: number;
  radius: number;
  mesh: THREE.Mesh;
  active: boolean;
  cooldown: number;
}

export interface SupplyDrop {
  x: number;
  z: number;
  y: number;
  t: number;
  mesh: THREE.Group;
  opened: boolean;
  active: boolean;
  landing: boolean;
}

function buildCrystalClusterGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    // Monólito central de cristal facetado
    new THREE.OctahedronGeometry(1.2, 0).scale(0.75, 1.8, 0.75).translate(0, 0.3, 0),
    // Base de rocha / matriz mineral
    new THREE.DodecahedronGeometry(0.85, 0).scale(1.5, 0.45, 1.5).translate(0, -0.7, 0),
    // 5 cristais satélites irregulares com ângulos e escalas variadas
    new THREE.OctahedronGeometry(0.72, 0).scale(0.5, 1.35, 0.5).rotateZ(0.35).rotateY(0.4).translate(0.58, -0.05, 0.32),
    new THREE.OctahedronGeometry(0.68, 0).scale(0.48, 1.25, 0.48).rotateX(-0.4).rotateY(1.5).translate(-0.52, -0.15, 0.48),
    new THREE.OctahedronGeometry(0.58, 0).scale(0.42, 1.05, 0.42).rotateZ(-0.45).rotateY(2.8).translate(-0.58, -0.25, -0.42),
    new THREE.OctahedronGeometry(0.52, 0).scale(0.38, 0.95, 0.38).rotateX(0.4).rotateY(-1.2).translate(0.42, -0.3, -0.52),
    new THREE.OctahedronGeometry(0.42, 0).scale(0.35, 0.75, 0.35).rotateZ(0.5).rotateY(2.2).translate(0.72, -0.45, 0.12),
  ];
  for (const g of parts) {
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
  }
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  if (!merged) return new THREE.OctahedronGeometry(1.2, 0);
  merged.computeVertexNormals();
  return merged;
}

export class ArenaPropManager {
  scene: THREE.Scene;
  crystals: ArenaCrystal[] = [];
  speedPads: SpeedPad[] = [];
  supplyDrop: SupplyDrop | null = null;
  private crystalGeo: THREE.BufferGeometry;
  private crystalMat: THREE.MeshStandardMaterial;
  private padMat: THREE.MeshBasicMaterial;
  private nextCrystalId = 1;
  private spawnTimer = 4;
  private time = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.crystalGeo = buildCrystalClusterGeometry();
    this.crystalMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00a0ff,
      emissiveIntensity: 0.8,
      metalness: 0.8,
      roughness: 0.2,
      wireframe: false,
    });

    this.padMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });

    this.spawnInitialProps();
  }

  spawnInitialProps() {
    const padCoords = [
      [-28, -28], [28, -28],
      [-28, 28],  [28, 28],
    ];
    for (const [px, pz] of padCoords) {
      const geo = new THREE.RingGeometry(0.8, 2.5, 24);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, this.padMat.clone());
      mesh.position.set(px, 0.04, pz);
      this.scene.add(mesh);
      this.speedPads.push({ x: px, z: pz, radius: 2.6, mesh, active: true, cooldown: 0 });
    }

    // Inicializar 5 cristais de éter
    for (let i = 0; i < 5; i++) {
      this.spawnCrystal();
    }
  }

  spawnCrystal(): ArenaCrystal | null {
    if (this.crystals.length >= 8) return null;
    const a = Math.random() * Math.PI * 2;
    const dist = rand(15, ARENA_RADIUS - 12);
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;

    const colors = [0x00f0ff, 0xa855f7, 0x10b981, 0xf59e0b];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const mat = this.crystalMat.clone();
    mat.color.setHex(color);
    mat.emissive.setHex(color);

    const mesh = new THREE.Mesh(this.crystalGeo, mat);
    mesh.position.set(x, 1.2, z);
    mesh.rotation.set(rand(-0.2, 0.2), rand(0, Math.PI * 2), rand(-0.2, 0.2));
    this.scene.add(mesh);

    const crystal: ArenaCrystal = {
      id: this.nextCrystalId++,
      x, z,
      hp: 60,
      maxHp: 60,
      radius: 1.3,
      color,
      flash: 0,
      mesh,
    };
    this.crystals.push(crystal);
    return crystal;
  }

  damageCrystal(crystal: ArenaCrystal, amount: number, game: Game): boolean {
    crystal.hp -= amount;
    crystal.flash = 0.5;
    (crystal.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.5;

    game.particles.burst(crystal.x, 1.2, crystal.z, 6, crystal.color, {
      speed: 5, life: 0.35, size: 0.25, gravity: 2,
    });

    game.numbers.spawn(crystal.x, 1.8, crystal.z, amount, 'normal');
    if (crystal.hp <= 0) {
      this.shatterCrystal(crystal, game);
      return true;
    }
    return false;
  }

  resolveCollision(px: number, pz: number, pr: number): { x: number; z: number } {
    for (const c of this.crystals) {
      const dx = px - c.x, dz = pz - c.z;
      const dist = Math.hypot(dx, dz);
      const minDist = c.radius + pr;
      if (dist < minDist && dist > 1e-4) {
        const push = (minDist - dist) * 0.7;
        px += (dx / dist) * push;
        pz += (dz / dist) * push;
      }
    }
    return { x: px, z: pz };
  }

  shatterCrystal(crystal: ArenaCrystal, game: Game) {
    game.vfx.explosion(crystal.x, 1.2, crystal.z, crystal.color, 2, 0.5);
    this.scene.remove(crystal.mesh);
    const idx = this.crystals.indexOf(crystal);
    if (idx >= 0) this.crystals.splice(idx, 1);

    game.particles.burst(crystal.x, 1.2, crystal.z, 35, crystal.color, {
      speed: 9, life: 0.8, size: 0.4, gravity: 4,
    });
    game.debris.spawn(crystal.x, 1.2, crystal.z, crystal.color, 6, 8, 1);
    game.audio.explosion(0.6);

    // Drops: gemas de XP garantidas + moedas + chance de ímã ou cura
    const gemCount = Math.floor(rand(4, 7));
    for (let i = 0; i < gemCount; i++) {
      const a = Math.random() * Math.PI * 2, r = rand(0.5, 2.5);
      game.pickups.spawn('xp', crystal.x + Math.cos(a) * r, crystal.z + Math.sin(a) * r, rand(3, 8));
    }
    const coinCount = Math.floor(rand(1, 3));
    for (let i = 0; i < coinCount; i++) {
      const a = Math.random() * Math.PI * 2, r = rand(0.5, 2.5);
      game.pickups.spawn('coin', crystal.x + Math.cos(a) * r, crystal.z + Math.sin(a) * r, 1);
    }
    if (Math.random() < 0.2) {
      game.pickups.spawn('heal', crystal.x, crystal.z, 30);
    } else if (Math.random() < 0.15) {
      game.pickups.spawn('magnet', crystal.x, crystal.z, 1);
    }
  }

  spawnSupplyDrop(game: Game, x?: number, z?: number) {
    this.triggerSupplyDrop(game, x, z);
  }

  triggerSupplyDrop(game: Game, targetX?: number, targetZ?: number) {
    if (this.supplyDrop && this.supplyDrop.active) return;
    const a = Math.random() * Math.PI * 2;
    const dist = rand(10, ARENA_RADIUS - 20);
    const x = targetX ?? Math.cos(a) * dist;
    const z = targetZ ?? Math.sin(a) * dist;

    // Grupo visual da cápsula SpaceX Dragon/Falcon com aletas de grade e escudo térmico
    const group = new THREE.Group();
    const aeroWhite = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.85, roughness: 0.22 });
    const darkComposite = new THREE.MeshStandardMaterial({ color: 0x181a1f, metalness: 0.9, roughness: 0.35 });
    const titaniumMat = new THREE.MeshStandardMaterial({ color: 0x5a626a, metalness: 0.96, roughness: 0.2 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.95, roughness: 0.15, emissive: 0xff9900, emissiveIntensity: 1.2 });
    const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd700).multiplyScalar(3.5) });

    // 1. Escudo Térmico PICA-X na Base
    const heatShield = new THREE.Mesh(new THREE.CylinderGeometry(1.68, 1.74, 0.38, 24), darkComposite);
    heatShield.position.y = 0.19;
    group.add(heatShield);

    // 2. Casco Cônico Pressurizado da Dragon
    const capsuleBody = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.68, 2.6, 24), aeroWhite);
    capsuleBody.position.y = 1.68;
    group.add(capsuleBody);

    // Faixa preta aerodinâmica de separação
    const trunkBand = new THREE.Mesh(new THREE.CylinderGeometry(1.58, 1.66, 0.35, 24), darkComposite);
    trunkBand.position.y = 0.55;
    group.add(trunkBand);

    // 3. Nariz Aerodinâmico e Escotilha de Acoplamento (Docking Ring)
    const noseCap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.05, 1.1, 24), aeroWhite);
    noseCap.position.y = 3.53;
    group.add(noseCap);

    const dockingRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 24), goldMat);
    dockingRing.rotation.x = Math.PI / 2;
    dockingRing.position.y = 4.08;
    group.add(dockingRing);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), beaconMat);
    beacon.position.y = 4.25;
    group.add(beacon);

    // 4. Quatro Aletas de Grade em Titânio (Grid Fins) Desdobradas
    for (let f = 0; f < 4; f++) {
      const fa = (f / 4) * Math.PI * 2;
      const finGroup = new THREE.Group();
      finGroup.position.set(Math.cos(fa) * 1.55, 2.6, Math.sin(fa) * 1.55);
      finGroup.rotation.y = fa;

      // Dobradiça da aleta
      const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.35), darkComposite);
      finGroup.add(hinge);

      // Moldura da aleta de grade
      const finFrame = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.05), titaniumMat);
      finFrame.position.x = 0.45;
      finGroup.add(finFrame);

      // Barras cruzadas da grelha de titânio
      const barH = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.06), titaniumMat);
      barH.position.x = 0.45;
      finGroup.add(barH);
      const barV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), titaniumMat);
      barV.position.x = 0.45;
      finGroup.add(barV);

      group.add(finGroup);
    }

    // 5. Nacelles de Propulsores SuperDraco embutidos no casco
    for (let tIdx = 0; tIdx < 4; tIdx++) {
      const ta = ((tIdx + 0.5) / 4) * Math.PI * 2;
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 0.25), darkComposite);
      pod.position.set(Math.cos(ta) * 1.25, 1.8, Math.sin(ta) * 1.25);
      pod.rotation.y = ta;

      // Bocais duplos de escape perfeitamente angulados e orientados no pod
      for (const dSide of [-0.08, 0.08]) {
        const nozz = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.22, 6), goldMat);
        nozz.rotation.x = 0.35;
        nozz.position.set(dSide, -0.15, 0.12);
        pod.add(nozz);
      }
      group.add(pod);
    }

    group.position.set(x, 60, z);
    this.scene.add(group);

    this.supplyDrop = {
      active: true,
      landing: true,
      x, z,
      y: 60,
      t: 0,
      mesh: group,
      opened: false,
    };

    game.telegraphs.circle(x, z, 4.5, 2.2, 0xffd700);
    game.notice('CÁPSULA DE SUPRIMENTOS SPACEX', 'Carga orbital de Elon Musk em rota de colisão!', '#ffd700');
    game.audio.supplyPodDrop();
  }

  update(dt: number, game: Game) {
    this.time += dt;
    const pl = game.player;

    // Respawn suave de cristais
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = rand(6, 12);
      if (this.crystals.length < 6) this.spawnCrystal();
    }

    // Animação e flash dos cristais
    for (const c of this.crystals) {
      c.mesh.rotation.y += dt * 0.4;
      c.mesh.position.y = 1.2 + Math.sin(this.time * 2 + c.id) * 0.12;
      if (c.flash > 0) {
        c.flash -= dt * 4;
        const mat = c.mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = Math.max(0.8, 0.8 + c.flash * 2);
      }
    }

    // Zonas aceleradoras de plasma
    for (const pad of this.speedPads) {
      if (!pad.active) {
        pad.cooldown -= dt;
        if (pad.cooldown <= 0) {
          pad.active = true;
          (pad.mesh.material as THREE.MeshBasicMaterial).opacity = 0.6;
        }
      } else {
        const pulse = 0.5 + Math.sin(this.time * 6) * 0.2;
        (pad.mesh.material as THREE.MeshBasicMaterial).opacity = pulse;
        pad.mesh.rotation.z += dt * 0.6;

        if (pl.alive) {
          const dx = pl.x - pad.x, dz = pl.z - pad.z;
          if (dx * dx + dz * dz < pad.radius * pad.radius) {
            pad.active = false;
            pad.cooldown = 9;
            (pad.mesh.material as THREE.MeshBasicMaterial).opacity = 0.15;
            pl.applySpeedBuff(1.6, 2.8);
            game.audio.speedBoost();
            game.particles.burst(pad.x, 0.3, pad.z, 25, 0x38bdf8, { speed: 8, life: 0.45, size: 0.3, gravity: 0 });
            game.notice('PROPULSÃO HIPERESPACIAL!', '+60% Velocidade', '#38bdf8');
          }
        }
      }
    }

    // Evento da Cápsula SpaceX
    const drop = this.supplyDrop;
    if (drop && drop.active) {
      if (drop.landing) {
        drop.y = Math.max(0, drop.y - dt * 36);
        drop.mesh.position.y = drop.y;
        if (Math.random() < 0.7) {
          game.particles.emit(drop.x, drop.y + 2, drop.z, rand(-1, 1), 3, rand(-1, 1), 0.4, 0.4, 1, 0.6, 0.1, 0, 0, 0, 1);
        }
        if (drop.y <= 0.1) {
          drop.y = 0;
          drop.landing = false;
          game.shockwaves.spawn(drop.x, drop.z, 0xffd700, { endR: 12, duration: 0.6, thick: true });
          game.camera.shake(0.6);
          game.audio.explosion(1.5);
          game.particles.burst(drop.x, 1, drop.z, 60, 0xffd700, { speed: 12, life: 0.9, size: 0.5 });
          game.vfx.explosion(drop.x, 1, drop.z, 0xffd700, 4.5, 1.2);
        }
      } else if (!drop.opened && pl.alive) {
        // cápsula no chão esperando abertura por proximidade
        drop.mesh.rotation.y += dt * 1.5;
        const dx = pl.x - drop.x, dz = pl.z - drop.z;
        if (dx * dx + dz * dz < 3.2 * 3.2) {
          drop.opened = true;
          drop.active = false;
          this.scene.remove(drop.mesh);
          game.audio.achievement();
          game.flash(0.6, 0xffd700);
          game.particles.burst(drop.x, 2, drop.z, 120, 0xffd700, { speed: 18, life: 1.2, size: 0.6 });
          // Concede baú lendário: 2 upgrades de nível, 50 shards e Relíquia Cósmica!
          game.shards += 50;
          game.coins += 25;
          pl.heal(pl.stats.maxHp);
          pl.level += 2;
          game.pendingLevels += 2;
          if (pl.level >= 10 && !pl.ascensionPerk) {
            game.pendingAscension = true;
          }
          const relic = game.grantRandomRelic();
          game.notice(
            'SUPRIMENTOS SPACEX COLETADOS!',
            `+2 Níveis instantâneos · +50 Shards · Vida Cheia${relic ? ` · Relíquia: ${relic.name}` : ''}`,
            '#ffd700'
          );
        }
      }
    }
  }

  clear() {
    for (const c of this.crystals) this.scene.remove(c.mesh);
    this.crystals.length = 0;
    for (const p of this.speedPads) this.scene.remove(p.mesh);
    this.speedPads.length = 0;
    if (this.supplyDrop) {
      this.scene.remove(this.supplyDrop.mesh);
      this.supplyDrop = null;
    }
  }
}
