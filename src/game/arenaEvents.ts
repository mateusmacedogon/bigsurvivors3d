import * as THREE from 'three';
import { ARENA_RADIUS, rand } from './config';
import type { Game } from './game';

export type ArenaEventType = 'meteor_shower' | 'shard_thief' | 'quantum_overload' | 'gravity_storm';

export interface ArenaEventDef {
  type: ArenaEventType;
  name: string;
  desc: string;
  icon: string;
  duration: number;
  color: string;
}

export const ARENA_EVENTS: Record<ArenaEventType, ArenaEventDef> = {
  meteor_shower: {
    type: 'meteor_shower',
    name: 'Chuva de Meteoros de Éter',
    desc: 'Impactos cósmicos devastadores varrem a arena deixando cristais de éter!',
    icon: '☄️',
    duration: 18,
    color: '#ff4d4d',
  },
  shard_thief: {
    type: 'shard_thief',
    name: 'Invasão do Ladrão de Shards',
    icon: '👾',
    desc: 'Um batedor dourado tenta saquear a arena! Destrua-o antes que fuja em 25s!',
    duration: 25,
    color: '#ffd700',
  },
  quantum_overload: {
    type: 'quantum_overload',
    name: 'Zona de Sobrecarga Quântica',
    icon: '⚡',
    desc: 'Domo cósmico de hiper-frequência: dobre sua cadência e recarregue a Suprema dentro do raio!',
    duration: 22,
    color: '#00e5ff',
  },
  gravity_storm: {
    type: 'gravity_storm',
    name: 'Tempestade Gravitacional',
    icon: '🌀',
    desc: 'Flutuação na gravidade: tiros inimigos desacelerados e repulsão triplicada!',
    duration: 16,
    color: '#a855f7',
  },
};

interface PendingMeteor {
  x: number;
  z: number;
  delay: number;
  radius: number;
}

export class ArenaEventManager {
  activeEvent: ArenaEventDef | null = null;
  timer = 0;
  private meteorSpawnTimer = 0;
  private pendingMeteors: PendingMeteor[] = [];

  // Domo de Sobrecarga Quântica
  domeMesh: THREE.Mesh | null = null;
  domeRing: THREE.Mesh | null = null;
  domeX = 0;
  domeZ = 0;
  domeRadius = 11;
  isPlayerInDome = false;

  // Ladrão de Shards
  thiefGroup: THREE.Group | null = null;
  thiefX = 0;
  thiefZ = 0;
  thiefHp = 0;
  thiefMaxHp = 0;
  thiefAlive = false;
  thiefRadius = 1.3;

  constructor(private scene: THREE.Scene) {
    this.createDomeVisual();
    this.createThiefMesh();
  }

  private createDomeVisual() {
    const geo = new THREE.CylinderGeometry(this.domeRadius, this.domeRadius, 1.2, 32, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.domeMesh = new THREE.Mesh(geo, mat);
    this.domeMesh.position.y = 0.6;
    this.domeMesh.visible = false;
    this.scene.add(this.domeMesh);

    const ringGeo = new THREE.RingGeometry(this.domeRadius - 0.4, this.domeRadius + 0.4, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.domeRing = new THREE.Mesh(ringGeo, ringMat);
    this.domeRing.position.y = 0.08;
    this.domeRing.visible = false;
    this.scene.add(this.domeRing);
  }

  private createThiefMesh() {
    this.thiefGroup = new THREE.Group();
    // Corpo dourado angular
    const bodyGeo = new THREE.OctahedronGeometry(1.1, 1);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xff8c00,
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.2,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    this.thiefGroup.add(body);

    // Anéis de propulsão holográficos
    const ringGeo = new THREE.TorusGeometry(1.4, 0.08, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe066, wireframe: true });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    this.thiefGroup.add(ring);

    this.thiefGroup.position.y = 1.4;
    this.thiefGroup.visible = false;
    this.scene.add(this.thiefGroup);
  }

  triggerRandomEvent(game: Game) {
    const types: ArenaEventType[] = ['meteor_shower', 'shard_thief', 'quantum_overload', 'gravity_storm'];
    const chosen = types[Math.floor(Math.random() * types.length)];
    this.triggerEvent(chosen, game);
  }

  triggerEvent(type: ArenaEventType, game: Game) {
    this.stopEvent(game);
    const def = ARENA_EVENTS[type];
    this.activeEvent = def;
    this.timer = def.duration;

    game.notice(`EVENTO: ${def.name.toUpperCase()}`, def.desc, def.color);
    game.audio.warning();

    if (type === 'quantum_overload') {
      // Posiciona o domo próximo ao centro ou a meio caminho do jogador
      const angle = Math.random() * Math.PI * 2;
      const dist = rand(8, 24);
      this.domeX = Math.cos(angle) * dist;
      this.domeZ = Math.sin(angle) * dist;
      if (this.domeMesh) {
        this.domeMesh.position.x = this.domeX;
        this.domeMesh.position.z = this.domeZ;
        this.domeMesh.visible = true;
      }
      if (this.domeRing) {
        this.domeRing.position.x = this.domeX;
        this.domeRing.position.z = this.domeZ;
        this.domeRing.visible = true;
      }
      game.shockwaves.spawn(this.domeX, this.domeZ, 0x00e5ff, { endR: this.domeRadius, duration: 0.8 });
    } else if (type === 'shard_thief') {
      const angle = Math.random() * Math.PI * 2;
      this.thiefX = Math.cos(angle) * 35;
      this.thiefZ = Math.sin(angle) * 35;
      this.thiefMaxHp = 450 + game.wave * 120;
      this.thiefHp = this.thiefMaxHp;
      this.thiefAlive = true;
      if (this.thiefGroup) {
        this.thiefGroup.position.set(this.thiefX, 1.4, this.thiefZ);
        this.thiefGroup.visible = true;
      }
      game.shockwaves.spawn(this.thiefX, this.thiefZ, 0xffd700, { endR: 6, duration: 0.6 });
      game.particles.burst(this.thiefX, 1.4, this.thiefZ, 30, 0xffd700, { speed: 8, life: 0.5, size: 0.4 });
    }
  }

  stopEvent(game?: Game) {
    if (this.activeEvent && game) {
      if (this.activeEvent.type === 'shard_thief' && this.thiefAlive) {
        // Fugiu!
        game.notice('LADRÃO DE SHARDS ESCAPOU!', 'O batedor alienígena saltou pelo hiper-espaço!', '#ffaa00');
        game.particles.burst(this.thiefX, 1.4, this.thiefZ, 40, 0xffaa00, { speed: 12, life: 0.6, size: 0.4 });
        game.audio.teleport();
      }
    }
    this.activeEvent = null;
    this.timer = 0;
    this.isPlayerInDome = false;
    this.thiefAlive = false;
    this.pendingMeteors = [];
    if (this.domeMesh) this.domeMesh.visible = false;
    if (this.domeRing) this.domeRing.visible = false;
    if (this.thiefGroup) this.thiefGroup.visible = false;
  }

  reset() {
    this.activeEvent = null;
    this.timer = 0;
    this.isPlayerInDome = false;
    this.thiefAlive = false;
    this.pendingMeteors = [];
    if (this.domeMesh) this.domeMesh.visible = false;
    if (this.domeRing) this.domeRing.visible = false;
    if (this.thiefGroup) this.thiefGroup.visible = false;
  }

  get currentEvent(): { id: ArenaEventType; name: string; desc: string; icon: string; timer: number; color: string } | null {
    if (!this.activeEvent) return null;
    return {
      id: this.activeEvent.type,
      name: this.activeEvent.name,
      desc: this.activeEvent.desc,
      icon: this.activeEvent.icon,
      timer: Math.max(0, Math.ceil(this.timer)),
      color: this.activeEvent.color,
    };
  }

  isGravityStormActive(): boolean {
    return this.activeEvent?.type === 'gravity_storm';
  }

  update(dt: number, game: Game) {
    if (!this.activeEvent) return;

    this.timer -= dt;
    if (this.timer <= 0) {
      this.stopEvent(game);
      return;
    }

    const type = this.activeEvent.type;

    if (type === 'meteor_shower') {
      this.meteorSpawnTimer -= dt;
      if (this.meteorSpawnTimer <= 0) {
        this.meteorSpawnTimer = rand(0.7, 1.2);
        // Spawna 1 a 2 meteoros
        const count = Math.random() < 0.5 ? 1 : 2;
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * (ARENA_RADIUS - 8);
          const mx = Math.cos(a) * r;
          const mz = Math.sin(a) * r;
          const radius = rand(4.0, 5.8);
          this.pendingMeteors.push({ x: mx, z: mz, delay: 1.1, radius });
          game.telegraphs.circle(mx, mz, radius, 1.1, 0xff2222);
        }
      }

      // Atualiza meteoros pendentes
      for (let i = this.pendingMeteors.length - 1; i >= 0; i--) {
        const m = this.pendingMeteors[i];
        m.delay -= dt;
        if (m.delay <= 0) {
          this.pendingMeteors.splice(i, 1);
          this.detonateMeteor(m.x, m.z, m.radius, game);
        }
      }
    } else if (type === 'quantum_overload') {
      // Rotaciona anel visual
      if (this.domeRing) this.domeRing.rotation.z += dt * 0.8;
      // Checa se jogador está dentro
      const p = game.player;
      const d = Math.hypot(p.x - this.domeX, p.z - this.domeZ);
      this.isPlayerInDome = d <= this.domeRadius;
      if (this.isPlayerInDome) {
        // Acelera recarga da Suprema
        p.ultCd = Math.max(0, p.ultCd - dt * 2.0);
        if (Math.random() < 0.4) {
          game.particles.emit(p.x + rand(-0.8, 0.8), 0.5, p.z + rand(-0.8, 0.8), 0, 1.5, 0, 0.25, 0.3, 0, 0.9, 1, 0, 0, 0, 1);
        }
      }
    } else if (type === 'shard_thief' && this.thiefAlive && this.thiefGroup) {
      // Movimentação evasiva ultra-rápida do ladrão
      const p = game.player;
      const dx = this.thiefX - p.x;
      const dz = this.thiefZ - p.z;
      const dist = Math.hypot(dx, dz) || 1;

      // Foge do jogador enquanto circula a arena
      const fleeSpeed = 16;
      let vx = (dx / dist) * fleeSpeed;
      let vz = (dz / dist) * fleeSpeed;

      // Se perto da borda, desvia para o centro
      const dCenter = Math.hypot(this.thiefX, this.thiefZ);
      if (dCenter > ARENA_RADIUS - 10) {
        vx -= (this.thiefX / dCenter) * fleeSpeed * 1.5;
        vz -= (this.thiefZ / dCenter) * fleeSpeed * 1.5;
      }

      this.thiefX += vx * dt;
      this.thiefZ += vz * dt;
      this.thiefGroup.position.x = this.thiefX;
      this.thiefGroup.position.z = this.thiefZ;
      this.thiefGroup.rotation.y += dt * 5;
      this.thiefGroup.rotation.x += dt * 3;

      // Rastro dourado
      if (Math.random() < 0.6) {
        game.particles.emit(this.thiefX, 1.2, this.thiefZ, rand(-0.5, 0.5), rand(0.2, 0.8), rand(-0.5, 0.5), 0.2, 0.3, 1, 0.85, 0, 0, 0, 0, 1);
      }

      // Checa colisão com tiros do jogador
      for (const proj of game.projectiles.pool) {
        if (!proj.active || proj.enemy) continue;
        const pdx = proj.x - this.thiefX;
        const pdz = proj.z - this.thiefZ;
        if (pdx * pdx + pdz * pdz <= (proj.radius + this.thiefRadius) ** 2) {
          this.hitThief(proj.dmg, game);
          proj.active = false;
        }
      }
    } else if (type === 'gravity_storm') {
      // Partículas flutuantes ascendentes na arena
      if (Math.random() < 0.4) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * (ARENA_RADIUS - 5);
        game.particles.emit(Math.cos(a) * r, 0.2, Math.sin(a) * r, 0, rand(1.0, 3.0), 0, 0.3, 0.3, 0.65, 0.33, 0.95, 0, 0, 0, 1);
      }
    }
  }

  private detonateMeteor(x: number, z: number, radius: number, game: Game) {
    game.audio.explosion(2.2);
    game.shockwaves.spawn(x, z, 0xff3300, { endR: radius * 1.4, duration: 0.55, thick: true });
    game.vfx.explosion(x, 0.5, z, 0xff4500, radius * 0.8, 1.2);
    game.particles.burst(x, 1.0, z, 40, 0xff6600, { speed: 14, life: 0.6, size: 0.45 });

    // Dano aos inimigos
    for (const e of game.enemies.list) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d <= radius + e.radius) {
        game.damageEnemy(e, 180 + game.wave * 15, true, 'normal');
      }
    }

    // Dano à nave do jogador
    const pd = Math.hypot(game.player.x - x, game.player.z - z);
    if (pd <= radius + game.player.radius) {
      game.damagePlayer(35, x, z);
    }

    // Chance de deixar cristais ou shards de éter
    if (Math.random() < 0.65) {
      const crystalCount = Math.random() < 0.4 ? 2 : 1;
      for (let i = 0; i < crystalCount; i++) {
        game.pickups.spawn('shard', x + rand(-1.2, 1.2), z + rand(-1.2, 1.2), 2);
      }
      game.pickups.spawn('coin', x, z, 1);
    }
  }

  hitThief(dmg: number, game: Game) {
    if (!this.thiefAlive) return;
    this.thiefHp -= dmg;
    game.numbers.spawn(this.thiefX, 2.0, this.thiefZ, Math.round(dmg), 'crit');
    game.particles.burst(this.thiefX, 1.4, this.thiefZ, 6, 0xffd700, { speed: 5, life: 0.25, size: 0.2 });

    if (this.thiefHp <= 0) {
      this.thiefAlive = false;
      if (this.thiefGroup) this.thiefGroup.visible = false;
      this.activeEvent = null;

      // Detonação gloriosa e recompensa colossal!
      game.audio.explosion(2.5);
      game.audio.victory();
      game.notice('LADRÃO DE SHARDS ELIMINADO!', 'Baú Cósmico Dourado com relíquia libertado!', '#ffd700');
      game.shockwaves.spawn(this.thiefX, this.thiefZ, 0xffd700, { endR: 12, duration: 0.8, thick: true });
      game.vfx.explosion(this.thiefX, 1.5, this.thiefZ, 0xffd700, 8, 1.5);
      game.particles.burst(this.thiefX, 1.5, this.thiefZ, 70, 0xffd700, { speed: 16, life: 0.8, size: 0.5 });

      // Spawna baú de relíquia ou concede diretamente
      game.grantRandomRelic();

      // Drops de ouro e shards maciços
      for (let i = 0; i < 15; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 4;
        game.pickups.spawn('shard', this.thiefX + Math.cos(a) * d, this.thiefZ + Math.sin(a) * d, 2);
      }
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 3;
        game.pickups.spawn('coin', this.thiefX + Math.cos(a) * d, this.thiefZ + Math.sin(a) * d, 1);
      }
    }
  }

  getFireRateMultiplier(): number {
    return this.isPlayerInDome ? 2.0 : 1.0;
  }

  getEnemyProjSpeedMultiplier(): number {
    return this.activeEvent?.type === 'gravity_storm' ? 0.5 : 1.0;
  }

  getPlayerKnockbackMultiplier(): number {
    return this.activeEvent?.type === 'gravity_storm' ? 3.0 : 1.0;
  }
}
