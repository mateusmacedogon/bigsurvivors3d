import * as THREE from 'three';
import {
  ARENA_RADIUS, PLAYER_RADIUS, clamp, damp, rand, xpForLevel,
  SECONDARY_WEAPONS, PRIMARY_EVOLUTIONS, type HeroDef, type SecondaryWeaponId, type ActiveWeaponState,
} from './config';
import type { MetaBonuses } from './save';
import { updateSetting } from './settings';
import { buildBottle, buildDroneMesh, buildShip, type ShipRig } from './ships';
import { GhostPool, RibbonTrail } from './effects';
import { SHIELD_FRAG, SHIELD_VERT } from './shaders';
import { GLYPHS } from './projectiles';
import type { Game } from './game';
import type { Input } from './world';
import type { Enemy } from './enemies';

export interface Stats {
  maxHp: number; speed: number; damage: number; fireRate: number; magnet: number; armor: number;
  xpMult: number; ultCd: number; luck: number; critChance: number; lifesteal: number;
  multishot: number; pierce: number; ricochet: number; drones: number; burnChance: number; freezeChance: number;
  area: number; projSpeed: number; regen: number; explosive: number; knockback: number;
}

interface Drone { group: THREE.Group; angle: number; fireTimer: number }

export interface ActiveSecondaryWeapon {
  id: SecondaryWeaponId;
  level: number;
  timer: number;
  evolved: boolean;
}

interface MacedoTrap {
  group: THREE.Group;
  spinner: THREE.Mesh;
  x: number;
  z: number;
  life: number;
  maxLife: number;
  size: number;
  pulseTimer: number;
}

function buildMacedoTrapMesh(): { group: THREE.Group; spinner: THREE.Mesh } {
  const g = new THREE.Group();
  const baseRing = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.75, 16),
    new THREE.MeshBasicMaterial({ color: 0x44ddff, side: THREE.DoubleSide })
  );
  baseRing.rotation.x = -Math.PI / 2;
  baseRing.position.y = 0.05;
  g.add(baseRing);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.1, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a2e3b, metalness: 0.8, roughness: 0.2 })
  );
  pole.position.y = 0.45;
  g.add(pole);

  const spinner = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.24, 0),
    new THREE.MeshBasicMaterial({ color: 0x88eeff, wireframe: true })
  );
  spinner.position.y = 1.05;
  g.add(spinner);

  const innerCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x44ddff })
  );
  innerCore.position.y = 1.05;
  g.add(innerCore);

  return { group: g, spinner };
}

export const UPGRADE_TO_SECONDARY: Record<string, SecondaryWeaponId> = {
  weapon_missile: 'missile_pod',
  weapon_saw: 'orbital_saw',
  weapon_tesla: 'tesla_coil',
  weapon_gravity: 'gravity_well',
  weapon_flamethrower: 'flamethrower',
  weapon_railgun: 'railgun',
  missile_pod: 'missile_pod',
  orbital_saw: 'orbital_saw',
  tesla_coil: 'tesla_coil',
  gravity_well: 'gravity_well',
  flamethrower: 'flamethrower',
  railgun: 'railgun',
};

const query: Enemy[] = [];

export class Player {
  hero: HeroDef;
  group = new THREE.Group();
  rig: ShipRig;
  x = 0; z = 0; vx = 0; vz = 0;
  ix = 0; iz = 0;
  aimAngle = 0; aimX = 0; aimZ = 10;
  aimMode: 'auto' | 'manual' = 'auto';
  radius = PLAYER_RADIUS;
  hp: number; stats: Stats;
  level = 1; xp = 0; xpNext = xpForLevel(1);
  upgrades: Record<string, number> = {};
  secondaryWeapons = new Map<SecondaryWeaponId, ActiveSecondaryWeapon>();
  primaryEvolved = false;
  speedBuffTimer = 0;
  speedBuffMult = 1;
  dashFlameTick = 0;
  dashCount = 0;
  lifestealTimer = 0;
  ascensionPerk: string | null = null;
  hyperModeMult = 1.0;
  noDampeners = false;
  celestialShield = 0;
  bigAfterburnerTick = 0;
  private dashKineticHits = new Set<number>();
  dashCd = 0; dashMax = 1.5; dashTimer = 0; private dashDirX = 0; private dashDirZ = 1; private ghostTimer = 0;
  godMode = false;
  invulnTimer = 0;
  ultCd = 0; ultMax: number; ultActive = false; private ultTimer = 0;
  private fireTimer = 0; private fireAnim = 0; private slashSide = 1; private pendingSlash = -1; private muzzleIdx = 0;
  alive = true;
  zoneSlow = 1;
  private trails: RibbonTrail[] = [];
  private shield: THREE.Mesh; private shieldMat: THREE.ShaderMaterial; private shieldOpacity = 0; private impactAge = 10;
  light: THREE.PointLight;
  private drones: Drone[] = [];
  ghosts: GhostPool;
  glyphPositions: { x: number; z: number }[] = [];
  private glyphMeshes: THREE.Mesh[] = [];
  private glyphAngle = 0;
  private glyphHits = new Map<number, number>();
  private bottle: { group: THREE.Group; t: number; tx: number; tz: number; dur: number } | null = null;
  private burstsLeft = 0; private burstTimer = 0;
  private domeT = -1; private domePushed = new Set<number>();
  private carlinhosUltTimer = 0;
  private carlinhosWaveTick = 0;
  private macedoUltTimer = 0;
  private macedoUltTick = 0;
  private macedoTraps: MacedoTrap[] = [];
  gladiatorFuryTimer = 0;
  pendingCarlinhosEcho = -1;
  carlinhosDivineTimer = 0;
  carlinhosDivineStrikes = 0;
  pietroGlyphLaserTimer = 0;
  private roll = 0; private pitch = 0;
  private time = 0;
  meta: MetaBonuses;

  setMeta(m: MetaBonuses) {
    this.meta = m;
    this.stats = this.computeStats();
  }
  private scene: THREE.Scene;
  private tmp = new THREE.Vector3();

  constructor(scene: THREE.Scene, hero: HeroDef, meta: MetaBonuses, glyphAtlas: THREE.Texture) {
    this.scene = scene;
    this.hero = hero;
    this.meta = meta;
    this.rig = buildShip(hero.id);
    this.rig.group.rotation.order = 'YXZ';
    this.group.add(this.rig.group);
    this.group.position.set(0, 1.1, 0);
    if (hero.id === 'pietro') this.rig.group.position.y = 0.9;
    scene.add(this.group);
    this.stats = this.computeStats();
    this.hp = this.stats.maxHp;
    this.ultMax = hero.ultCd * this.stats.ultCd;

    for (const eng of this.rig.engines) {
      void eng;
      this.trails.push(new RibbonTrail(scene, hero.color, hero.id === 'pietro' ? 34 : 26, hero.id === 'otton' ? 0.4 : 0.3));
    }
    this.shieldMat = new THREE.ShaderMaterial({
      vertexShader: SHIELD_VERT,
      fragmentShader: SHIELD_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(hero.color) },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uImpact: { value: new THREE.Vector3(0, 0, 1) },
        uImpactAge: { value: 10 },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(2.1, 36, 24), this.shieldMat);
    this.shield.visible = false;
    this.shield.renderOrder = 15;
    scene.add(this.shield);
    this.light = new THREE.PointLight(hero.color, 8, 14, 1.8);
    this.light.position.y = 2.5;
    this.group.add(this.light);
    this.ghosts = new GhostPool(scene);
    this.group.updateMatrixWorld(true);
    this.ghosts.build(this.rig.group, hero.color, 6);

    // glifos gigantes (ult Pietro)
    if (hero.id === 'pietro') {
      for (let i = 0; i < 4; i++) {
        const geo = new THREE.PlaneGeometry(3.6, 3.6);
        const uv = geo.attributes.uv as THREE.BufferAttribute;
        for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / GLYPHS.length);
        const mat = new THREE.MeshBasicMaterial({ map: glyphAtlas, color: new THREE.Color(0xc05cff).multiplyScalar(2.5), transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
        const m = new THREE.Mesh(geo, mat);
        m.visible = false;
        m.renderOrder = 16;
        scene.add(m);
        this.glyphMeshes.push(m);
      }
    }
  }

  get invulnerable() { return this.godMode || this.dashTimer > 0 || this.invulnTimer > 0 || !this.alive; }
  get dashing() { return this.dashTimer > 0; }
  get position() { return this.group.position; }

  computeStats(): Stats {
    const u = this.upgrades, m = this.meta, h = this.hero;
    const pct = (id: string) => (u[id] ?? 0) / 100;
    const trapBonus = h.id === 'macedo' && (u.hero_macedo_quantum_network ?? 0) > 0
      ? (u.hero_macedo_quantum_network ?? 0) * (this.macedoTraps ? this.macedoTraps.length : 0)
      : 0;
    const furyLvl = h.id === 'otton' ? (u.hero_otton_gladiator_armor ?? 0) : 0;
    const furyActive = this.gladiatorFuryTimer > 0 && furyLvl > 0;
    const furyBonus = furyActive ? furyLvl * 0.20 : 0;
    const rapidSiloReduc = h.id === 'big' ? (u.hero_big_rapid_silo ?? 0) * 0.20 : 0;
    const ottonBleedKnock = h.id === 'otton' && (u.hero_otton_bleeding_strike ?? 0) > 0 ? 1.4 : 1;
    const bigSpeedAsc = this.ascensionPerk === 'big_lightning_interceptor' ? 1.30 : 1.0;
    const ottonHpAsc = this.ascensionPerk === 'otton_armored_colossus' ? 120 : 0;
    const ottonArmorAsc = this.ascensionPerk === 'otton_armored_colossus' ? 2.0 : 1.0;
    return {
      maxHp: h.hp + m.hp + (u.maxhp ?? 0) + ottonHpAsc,
      speed: h.speed * (1 + m.speed + pct('speed')) * this.speedBuffMult * (1 + trapBonus * 0.04) * (1 + furyBonus) * this.hyperModeMult * bigSpeedAsc,
      damage: h.damage * (1 + m.dmg + pct('damage')) * (1 + trapBonus * 0.04),
      fireRate: (1 + pct('firerate')) * (1 + furyBonus),
      magnet: 5.5 * (1 + m.magnet + pct('magnet')),
      armor: (m.armor + (u.armor ?? 0)) * ottonArmorAsc,
      xpMult: 1 + m.xp + pct('xpgain'),
      ultCd: Math.max(0.3, 1 - m.ultcd - pct('ultcd') - rapidSiloReduc),
      luck: m.luck,
      critChance: 0.05 + pct('crit'),
      lifesteal: pct('lifesteal'),
      multishot: u.multishot ?? 0,
      pierce: u.pierce ?? 0,
      ricochet: u.ricochet ?? 0,
      drones: u.drone ?? 0,
      burnChance: pct('burn'),
      freezeChance: pct('freeze'),
      area: 1 + pct('area'),
      projSpeed: (1 + pct('projspeed')) * (h.id === 'big' ? 1 + (u.hero_big_plasma_accelerator ?? 0) * 0.35 : 1),
      regen: u.regen ?? 0,
      explosive: pct('explosive'),
      knockback: (1 + pct('knockback')) * ottonBleedKnock,
    };
  }

  applyAscensionPerk(perkId: string, game: Game) {
    this.ascensionPerk = perkId;
    if (perkId === 'otton_armored_colossus') {
      this.hp += 120;
    }
    this.stats = this.computeStats();
    game.audio.ascension();
    game.particles.burst(this.x, 1.5, this.z, 50, 0xffd700, { speed: 12, life: 0.8, size: 0.45 });
    game.shockwaves.spawn(this.x, this.z, 0xffd700, { endR: 8, duration: 0.5, thick: true });
  }

  applyUpgrade(id: string, value: number) {
    this.upgrades[id] = (this.upgrades[id] ?? 0) + value;
    const oldMax = this.stats.maxHp;
    this.stats = this.computeStats();
    this.ultMax = this.hero.ultCd * this.stats.ultCd;
    if (id === 'maxhp') {
      const addedHp = this.stats.maxHp - oldMax;
      this.hp = Math.min(this.stats.maxHp, this.hp + addedHp);
    } else if (this.stats.maxHp > oldMax) {
      this.hp += this.stats.maxHp - oldMax;
    }
    if (id === 'drone') this.rebuildDrones();

    const secId = UPGRADE_TO_SECONDARY[id] ?? (id.startsWith('weapon_') ? (id.replace('weapon_', '') as SecondaryWeaponId) : undefined);
    if (secId && SECONDARY_WEAPONS[secId]) {
      const cur = this.secondaryWeapons.get(secId);
      if (cur) {
        cur.level = Math.min(5, cur.level + 1);
      } else {
        this.secondaryWeapons.set(secId, { id: secId, level: 1, timer: 0.1, evolved: false });
      }
    } else if (id.startsWith('evo_')) {
      const evoKey = id.replace('evo_', '');
      if (evoKey === 'primary') {
        this.primaryEvolved = true;
      } else {
        const wid = UPGRADE_TO_SECONDARY[evoKey] ?? (evoKey as SecondaryWeaponId);
        const cur = this.secondaryWeapons.get(wid);
        if (cur) {
          cur.evolved = true;
          cur.level = 5;
        }
      }
    }
  }

  applySpeedBuff(mult: number, duration: number) {
    this.speedBuffMult = mult;
    this.speedBuffTimer = duration;
    this.stats = this.computeStats();
  }

  getActiveWeapons(): ActiveWeaponState[] {
    const list: ActiveWeaponState[] = [
      {
        id: 'main',
        name: this.primaryEvolved ? PRIMARY_EVOLUTIONS[this.hero.id].name : this.hero.weapon,
        icon: this.primaryEvolved ? PRIMARY_EVOLUTIONS[this.hero.id].icon : '⚔',
        level: this.primaryEvolved ? 6 : 1,
        evolved: this.primaryEvolved,
      }
    ];
    for (const [id, w] of this.secondaryWeapons) {
      const def = SECONDARY_WEAPONS[id];
      list.push({
        id,
        name: w.evolved ? def.evoName : def.name,
        icon: w.evolved ? '👑' : def.icon,
        level: w.level,
        evolved: w.evolved,
      });
    }
    return list;
  }

  private rebuildDrones() {
    for (const d of this.drones) this.scene.remove(d.group);
    this.drones = [];
    for (let i = 0; i < this.stats.drones; i++) {
      const group = buildDroneMesh(this.hero.color);
      this.scene.add(group);
      this.drones.push({ group, angle: (i / this.stats.drones) * Math.PI * 2, fireTimer: i * 0.2 });
    }
  }

  impulse(x: number, z: number) {
    this.ix += x; this.iz += z;
  }

  heal(amount: number) {
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
  }

  takeDamage(amount: number, sx: number, sz: number, game?: Game): number {
    if (this.invulnerable) return 0;
    const maxReduction = amount * 0.60;
    const reduction = Math.min(this.stats.armor, maxReduction);
    amount = Math.max(1, amount - reduction);
    if (this.gladiatorFuryTimer > 0 && this.hero.id === 'otton') {
      const furyLvl = this.upgrades.hero_otton_gladiator_armor ?? 1;
      amount *= Math.max(0.45, 1 - furyLvl * 0.15);
    }
    // Absorção pelo escudo de compaixão celestial
    if (this.celestialShield > 0) {
      const absorbed = Math.min(this.celestialShield, amount);
      this.celestialShield -= absorbed;
      amount -= absorbed;
      if (amount <= 0) return 0;
    }
    // Reflexão do Colosso Blindado
    if (this.ascensionPerk === 'otton_armored_colossus' && game) {
      const reflectDmg = amount * 0.4;
      for (const e of game.enemies.list) {
        if (!e.dead && Math.hypot(e.x - this.x, e.z - this.z) <= 6.5) {
          game.damageEnemy(e, reflectDmg, false, 'normal');
        }
      }
      game.shockwaves.spawn(this.x, this.z, 0xff4a2a, { endR: 6.5, duration: 0.35 });
    }
    this.hp -= amount;
    this.invulnTimer = 0.45;
    const dx = sx - this.x, dz = sz - this.z;
    const d = Math.hypot(dx, dz) || 1;
    (this.shieldMat.uniforms.uImpact.value as THREE.Vector3).set(dx / d, 0.2, dz / d);
    this.impactAge = 0;
    this.shieldOpacity = 1;

    // Checagem de Protocolo Fênix antes da destruição
    if (this.hp <= 0) {
      if (game && game.relics && game.relics.canTriggerPhoenix()) {
        game.relics.triggerPhoenix();
        this.hp = Math.round(this.stats.maxHp * 0.4);
        this.invulnTimer = 3.5;
        this.alive = true;
        game.audio.explosion(3);
        game.audio.victory();
        game.vfx.explosion(this.x, 1.0, this.z, 0xff7700, 14, 1.8);
        game.shockwaves.spawn(this.x, this.z, 0xff4500, { endR: 18, duration: 0.8, thick: true });
        game.particles.burst(this.x, 1.0, this.z, 80, 0xffaa00, { speed: 18, life: 1.0, size: 0.5 });
        for (const e of game.enemies.list) {
          if (!e.dead && Math.hypot(e.x - this.x, e.z - this.z) <= 18) {
            game.damageEnemy(e, 350 + game.wave * 35, true, 'normal');
          }
        }
        game.notice('PROTOCOLO FÊNIX ATIVADO!', 'Supernova de emergência detonada! 40% HP restaurado!', '#f97316');
        return amount;
      }
      this.hp = 0;
      this.alive = false;
    }
    return amount;
  }

  // ---------------------------------------------------------------------
  update(dt: number, game: Game, input: Input, aim: THREE.Vector3) {
    this.time += dt;
    if (!this.alive) {
      this.group.visible = false;
      this.shield.visible = false;
      for (const t of this.trails) t.intensity = Math.max(0, t.intensity - dt * 3);
      return;
    }
    const s = this.stats;

    // speed buff timer
    if (this.speedBuffTimer > 0) {
      this.speedBuffTimer -= dt;
      if (this.speedBuffTimer <= 0) {
        this.speedBuffMult = 1;
        this.stats = this.computeStats();
      }
    }

    // alternar modo de mira com Tab
    if (input.consume('Tab')) {
      this.aimMode = this.aimMode === 'auto' ? 'manual' : 'auto';
      updateSetting('aimMode', this.aimMode);
      game.notice(this.aimMode === 'auto' ? 'MIRA: AUTOMÁTICA' : 'MIRA: MANUAL', undefined, '#00e5ff');
      game.audio.ui();
    }

    // mira automática ou manual
    if (this.aimMode === 'auto') {
      const boss = game.boss;
      let target: { x: number; z: number } | null = null;
      if (boss && boss.hittable && Math.hypot(boss.x - this.x, boss.z - this.z) < 45) {
        target = boss;
      } else {
        let bestDist = 36 * 36;
        let bestElite: { x: number; z: number } | null = null;
        let bestNormal: { x: number; z: number } | null = null;
        let normalDist = 32 * 32;
        for (const e of game.enemies.list) {
          if (e.dead || e.type === 'mine') continue;
          const d2 = (e.x - this.x) ** 2 + (e.z - this.z) ** 2;
          if (e.elite && d2 < bestDist) {
            bestDist = d2;
            bestElite = e;
          } else if (d2 < normalDist) {
            normalDist = d2;
            bestNormal = e;
          }
        }
        target = bestElite ?? bestNormal;
      }

      if (target) {
        this.aimX = target.x;
        this.aimZ = target.z;
        const targetAngle = Math.atan2(target.x - this.x, target.z - this.z);
        let diff = Math.atan2(Math.sin(targetAngle - this.aimAngle), Math.cos(targetAngle - this.aimAngle));
        this.aimAngle += diff * damp(20, dt);
      } else {
        this.aimX = aim.x;
        this.aimZ = aim.z;
        this.aimAngle = Math.atan2(aim.x - this.x, aim.z - this.z);
      }
    } else {
      if (input.gamepadAim) {
        const [gx, gz] = input.gamepadAim;
        this.aimAngle = Math.atan2(gx, gz);
        this.aimX = this.x + gx * 20;
        this.aimZ = this.z + gz * 20;
      } else {
        this.aimX = aim.x;
        this.aimZ = aim.z;
        this.aimAngle = Math.atan2(aim.x - this.x, aim.z - this.z);
      }
    }

    if (this.stats.speed >= this.hero.speed * 1.5) {
      game.checkAchievement('speed_demon');
    }

    // cooldowns
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (!this.ultActive) this.ultCd = Math.max(0, this.ultCd - dt);
    this.lifestealTimer = Math.max(0, this.lifestealTimer - dt);
    if (s.regen > 0) this.heal(s.regen * dt);

    // movimento
    const [ax, az] = input.axis();
    const maxSpeed = s.speed * this.zoneSlow * (game.relics ? game.relics.getSpeedMult() : 1.0);
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.vx = this.dashDirX * 62;
      this.vz = this.dashDirZ * 62;
      this.ghostTimer -= dt;
      if (this.ghostTimer <= 0) { this.ghostTimer = 0.035; this.ghosts.spawn(this.rig.group); }
      if (Math.random() < 0.9) game.particles.emit(this.x + rand(-0.6, 0.6), 1, this.z + rand(-0.6, 0.6), -this.vx * 0.1, 1, -this.vz * 0.1, 0.35, 0.35, this.rig.ledBase.r, this.rig.ledBase.g, this.rig.ledBase.b, 0, 0, 0, 1);

      // Dash Flame
      if ((this.upgrades.dash_flame ?? 0) > 0) {
        this.dashFlameTick -= dt;
        if (this.dashFlameTick <= 0) {
          this.dashFlameTick = 0.04;
          const dmg = (this.upgrades.dash_flame ?? 1) * 16;
          game.particles.burst(this.x, 0.4, this.z, 5, 0xff4500, { speed: 3, life: 0.5, size: 0.35, gravity: 0 });
          query.length = 0;
          game.enemies.query(this.x, this.z, 2.6, query);
          for (const e of query) {
            if (!e.dead) {
              game.hitEnemyDirect(e, dmg, 'dash_flame');
              game.enemies.applyBurn(e, dmg, 2.5, 0xff4500);
            }
          }
        }
      }
      // Dash Kinetic
      if ((this.upgrades.dash_kinetic ?? 0) > 0) {
        const dmg = (this.upgrades.dash_kinetic ?? 1) * 35;
        query.length = 0;
        game.enemies.query(this.x, this.z, this.radius + 1.2, query);
        for (const e of query) {
          if (!e.dead && e.type !== 'mine' && !this.dashKineticHits.has(e.id)) {
            this.dashKineticHits.add(e.id);
            game.hitEnemyDirect(e, dmg, 'dash_kinetic');
            game.enemies.knockback(e, this.dashDirX, this.dashDirZ, 30);
            e.stun = Math.max(e.stun, 0.5);
            game.audio.hit();
            game.camera.shake(0.06);
          }
        }
        if (game.arenaProps && game.arenaProps.crystals.length > 0) {
          for (const c of game.arenaProps.crystals) {
            if (Math.hypot(c.x - this.x, c.z - this.z) < this.radius + c.radius) {
              game.arenaProps.damageCrystal(c, dmg, game);
            }
          }
        }
      }
    } else {
      const k = damp(11, dt);
      this.vx += (ax * maxSpeed - this.vx) * k;
      this.vz += (az * maxSpeed - this.vz) * k;
    }
    // impulsos externos
    const ik = Math.max(0, 1 - 7 * dt);
    this.x += (this.vx + this.ix) * dt;
    this.z += (this.vz + this.iz) * dt;
    this.ix *= ik; this.iz *= ik;
    const r = Math.hypot(this.x, this.z);
    const lim = ARENA_RADIUS - 1.6;
    if (r > lim) { this.x *= lim / r; this.z *= lim / r; }
    if (game.arenaProps) {
      const resolved = game.arenaProps.resolveCollision(this.x, this.z, this.radius);
      this.x = resolved.x;
      this.z = resolved.z;
    }

    // dash
    if (input.consume('Space') && this.dashCd <= 0 && this.dashTimer <= 0) {
      this.dashCd = this.dashMax;
      this.dashTimer = 0.2;
      this.ghostTimer = 0;
      this.dashKineticHits.clear();
      this.dashCount++;
      if (this.dashCount >= 40) game.checkAchievement('dash_master');
      if (ax !== 0 || az !== 0) { this.dashDirX = ax; this.dashDirZ = az; }
      else { this.dashDirX = Math.sin(this.aimAngle); this.dashDirZ = Math.cos(this.aimAngle); }
      game.audio.dash();
      game.chroma(1.2);
      game.camera.shake(0.12);
      game.particles.ring(this.x, 0.8, this.z, 20, this.hero.color, 1, 8, 0.4, 0.3);
      game.vfx.muzzle(this.x, 1, this.z, Math.atan2(-this.dashDirX, -this.dashDirZ), this.hero.color, 2);
      game.shockwaves.spawn(this.x, this.z, this.hero.color, { endR: 3.5, duration: 0.28 });
      game.world.ripple(this.x, this.z, 0.6);

      // Relic: Tesla Battery
      if (game.relics && game.relics.has('tesla_battery')) {
        game.projectiles.fireTeslaChain(this.x, this.z, this.stats.damage * 2.2, 5, game, true, 'tesla_battery');
      }
      // Relic: Vacuum Reactor
      if (game.relics && game.relics.has('vacuum_reactor')) {
        game.projectiles.spawnMicroVortex(this.x, this.z, this.stats.damage * 1.5);
      }
    }

    // ultimate
    if (input.consume('KeyQ')) this.tryUlt(game);
    this.updateUlt(dt, game);

    // arma primária
    this.fireAnim = Math.max(0, this.fireAnim - dt * 4);
    if (!game.player.dashing || this.hero.id === 'otton' || this.hero.id === 'carlinhos') this.fire(dt, game);
    if (this.pendingSlash >= 0) {
      this.pendingSlash -= dt;
      if (this.pendingSlash < 0) this.slash(game, this.aimAngle + (this.slashSide > 0 ? 0.35 : -0.35), -this.slashSide);
    }

    if (this.gladiatorFuryTimer > 0) {
      this.gladiatorFuryTimer -= dt;
      if (Math.random() < 0.35) {
        game.particles.emit(this.x + rand(-0.4, 0.4), 1.1, this.z + rand(-0.4, 0.4), 0, 1.2, 0, 0.25, 0.28, 1, 0.15, 0.15, 0, 0, 0, 1);
      }
      if (this.gladiatorFuryTimer <= 0) {
        this.stats = this.computeStats();
      }
    }

    if (this.pendingCarlinhosEcho >= 0) {
      this.pendingCarlinhosEcho -= dt;
      if (this.pendingCarlinhosEcho < 0) {
        this.fireCarlinhosEcho(game);
      }
    }

    if (this.carlinhosDivineStrikes > 0) {
      this.carlinhosDivineTimer -= dt;
      if (this.carlinhosDivineTimer <= 0) {
        this.carlinhosDivineTimer = 0.24;
        this.carlinhosDivineStrikes--;
        this.strikeDivineLight(game);
      }
    }

    // armas secundárias ativas
    this.updateSecondaryWeapons(dt, game);

    // drones
    this.updateDrones(dt, game);

    // armadilhas do macedo
    this.updateMacedoTraps(dt, game);

    // Ascension: Big Interceptador Relâmpago (Pós-Combustão Contínua)
    if (this.ascensionPerk === 'big_lightning_interceptor') {
      this.bigAfterburnerTick -= dt;
      if (this.bigAfterburnerTick <= 0) {
        this.bigAfterburnerTick = 0.15;
        game.particles.burst(this.x, 0.4, this.z, 4, 0xffaa00, { speed: 4, life: 0.4, size: 0.35, gravity: 0 });
        query.length = 0;
        game.enemies.query(this.x, this.z, 3.8, query);
        for (const e of query) {
          if (!e.dead) {
            game.damageEnemy(e, s.damage * 0.45, false, 'normal');
            game.enemies.applyBurn(e, s.damage * 0.35, 2.0, 0xff6600);
          }
        }
      }
    }

    // Ascension: Thiago Alquimista Cáustico (Cura ao pisar em ácido)
    if (this.ascensionPerk === 'thiago_caustic_alchemist' && game.groundHazards) {
      if (game.groundHazards.isInHazard(this.x, this.z, 'acid')) {
        this.heal(14 * dt);
      }
    }

    // Ascension: Pietro Guardião Esotérico (Deflexão e aura rúnica defensiva)
    if (this.ascensionPerk === 'pietro_esoteric_guardian') {
      game.projectiles.clearEnemyInRadius(this.x, this.z, 4.2, game);
      if (Math.random() < 0.2) {
        game.particles.ring(this.x, 1.0, this.z, 12, 0xc05cff, 3.5, 4, 0.25, 0.2);
      }
      query.length = 0;
      game.enemies.query(this.x, this.z, 4.2, query);
      for (const e of query) {
        if (!e.dead) {
          game.damageEnemy(e, s.damage * 0.4 * dt, false, 'normal');
        }
      }
    }

    // visual
    const speedNow = Math.hypot(this.vx, this.vz);
    const fwdX = Math.sin(this.aimAngle), fwdZ = Math.cos(this.aimAngle);
    const rightX = Math.cos(this.aimAngle), rightZ = -Math.sin(this.aimAngle);
    const lateral = (this.vx * rightX + this.vz * rightZ) / Math.max(1, s.speed);
    const forward = (this.vx * fwdX + this.vz * fwdZ) / Math.max(1, s.speed);
    const targetRoll = clamp(-lateral * 0.6, -0.6, 0.6) * (this.dashing ? 1.4 : 1);
    const targetPitch = clamp(forward * 0.28, -0.3, 0.3);
    this.roll += (targetRoll - this.roll) * damp(9, dt);
    this.pitch += (targetPitch - this.pitch) * damp(9, dt);
    this.group.position.set(this.x, 1.1 + Math.sin(this.time * 2.2) * 0.08 + (this.hero.id === 'pietro' ? 0.4 : 0), this.z);
    this.rig.group.rotation.set(this.pitch, this.aimAngle, this.roll);
    this.group.visible = true;
    if (this.invulnTimer > 0 && this.dashTimer <= 0) this.group.visible = Math.floor(this.time * 24) % 2 === 0;
    this.rig.animate(dt, { firing: this.fireAnim, speed: speedNow / s.speed, ultActive: this.ultActive, time: this.time });
    this.group.updateMatrixWorld(true);
    this.light.intensity = 8 + this.fireAnim * 5 + (this.dashing ? 8 : 0);

    // trilhas
    const inten = 0.35 + clamp(speedNow / s.speed, 0, 1) * 0.65 + (this.dashing ? 1.2 : 0);
    for (let i = 0; i < this.trails.length; i++) {
      this.tmp.copy(this.rig.engines[i]).applyMatrix4(this.rig.group.matrixWorld);
      this.trails[i].intensity += (inten - this.trails[i].intensity) * damp(8, dt);
      this.trails[i].update(dt, this.tmp.x, this.tmp.y, this.tmp.z);
    }

    // escudo
    this.impactAge += dt;
    this.shieldOpacity = Math.max(0, this.shieldOpacity - dt * 1.6);
    const so = this.shieldOpacity + (this.dashing ? 0.35 : 0);
    this.shield.visible = so > 0.01;
    this.shield.position.copy(this.group.position);
    this.shield.rotation.y = this.time * 0.3;
    this.shieldMat.uniforms.uOpacity.value = so;
    this.shieldMat.uniforms.uTime.value = this.time;
    this.shieldMat.uniforms.uImpactAge.value = this.impactAge;
  }

  // ---------------------------------------------------------------------
  private fire(dt: number, game: Game) {
    this.fireTimer -= dt;
    if (this.fireTimer > 0) return;
    const s = this.stats;
    const rate = this.hero.fireRate * s.fireRate;
    this.fireTimer = Math.max(this.fireTimer + 1 / rate, -0.05);
    this.fireAnim = 1;
    const aim = this.aimAngle;
    const color = this.hero.color;
    const evo = this.primaryEvolved;

    switch (this.hero.id) {
      case 'big': {
        const isSiege = this.ascensionPerk === 'big_siege_cannoneer';
        const n = (evo ? 2 : 1) + s.multishot;
        this.muzzleIdx ^= 1;
        this.tmp.copy(this.rig.muzzles[this.muzzleIdx]).applyMatrix4(this.rig.group.matrixWorld);
        for (let i = 0; i < n; i++) {
          const a = aim + (i - (n - 1) / 2) * (evo ? 0.14 : 0.1);
          const sp = (evo ? 58 : 48) * s.projSpeed;
          game.projectiles.spawn({
            kind: 'laser', x: this.tmp.x, z: this.tmp.z, y: this.tmp.y, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp,
            dmg: s.damage * (evo ? 2.2 : 1) * (isSiege ? 2.0 : 1.0), life: 1.4, radius: evo ? 0.5 : 0.32, pierce: s.pierce + (evo ? 4 : 0),
            ricochet: s.ricochet + (evo ? 1 : 0), color: isSiege ? 0xff4422 : (evo ? 0xffffff : color), trail: 0.45, knock: s.knockback * (evo ? 1.5 : 1),
            scale: (evo ? 1.6 : 1) * (isSiege ? 1.35 : 1.0), weaponSource: evo ? 'singularity_cannon' : (isSiege ? 'plasma_cannon' : 'primary'),
            aoeRadius: isSiege ? 3.2 : 0,
          });
        }
        game.particles.burst(this.tmp.x, this.tmp.y, this.tmp.z, evo ? 8 : 4, isSiege ? 0xff4422 : color, { speed: 6, life: 0.25, size: 0.3, gravity: 0 });
        game.vfx.muzzle(this.tmp.x, this.tmp.y, this.tmp.z, aim, isSiege ? 0xff4422 : color, evo ? 1.5 : 1);
        game.audio.shoot('big');
        break;
      }
      case 'thiago': {
        const n = (evo ? 5 : 2) + s.multishot;
        this.tmp.copy(this.rig.muzzles[0]).applyMatrix4(this.rig.group.matrixWorld);
        for (let i = 0; i < n; i++) {
          const a = aim + rand(evo ? -0.8 : -0.34, evo ? 0.8 : 0.34);
          const sp = (evo ? 32 : 24) * s.projSpeed * rand(0.8, 1.3);
          game.projectiles.spawn({
            kind: 'drop', x: this.tmp.x, z: this.tmp.z, y: this.tmp.y + rand(-0.2, 0.2), vx: Math.sin(a) * sp, vz: Math.cos(a) * sp,
            dmg: s.damage * (evo ? 1.8 : 1), life: (evo ? 0.8 : 0.52) * s.area, radius: (evo ? 0.6 : 0.34) * s.area,
            pierce: s.pierce + (evo ? 2 : 0), ricochet: s.ricochet, color, scale: (evo ? 1.4 : 0.8) + Math.random() * 0.5,
            knock: s.knockback * 0.4, weaponSource: evo ? 'acid_tempest' : 'primary',
          });
        }
        game.audio.shoot('thiago');
        game.vfx.muzzle(this.tmp.x, this.tmp.y, this.tmp.z, aim, color, evo ? 1.2 : 0.75);
        break;
      }
      case 'pietro': {
        const n = (evo ? 3 : 1) + s.multishot;
        this.tmp.copy(this.rig.muzzles[0]).applyMatrix4(this.rig.group.matrixWorld);
        for (let i = 0; i < n; i++) {
          const a = aim + (i - (n - 1) / 2) * (evo ? 0.24 : 0.17);
          const sp = (evo ? 28 : 23) * s.projSpeed;
          game.projectiles.spawn({
            kind: 'rune', x: this.tmp.x, z: this.tmp.z, y: 1.1, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp,
            dmg: s.damage * (evo ? 2.4 : 1), life: evo ? 3.5 : 2.4, radius: (evo ? 1.1 : 0.7) * s.area,
            pierce: (evo ? 6 : 2) + s.pierce, ricochet: s.ricochet + (evo ? 3 : 0), color, spin: 8 * (i % 2 ? -1 : 1),
            scale: s.area * (evo ? 1.6 : 1), trail: 0.3, knock: s.knockback * (evo ? 1.6 : 1),
            weaponSource: evo ? 'apocalypse_lexicon' : 'primary',
          });
        }
        game.audio.shoot('pietro');
        game.vfx.muzzle(this.tmp.x, this.tmp.y, this.tmp.z, aim, color, evo ? 1.4 : 1);
        break;
      }
      case 'otton': {
        this.slash(game, aim, this.slashSide);
        this.slashSide = -this.slashSide;
        if (s.multishot > 0 || evo) this.pendingSlash = 0.11;
        break;
      }
      case 'carlinhos': {
        if (this.ascensionPerk === 'carlinhos_celestial_harmony') {
          this.celestialShield = Math.min(100, this.celestialShield + 14);
        }
        const isResonant = this.ascensionPerk === 'carlinhos_resonant_love';
        const radius = (evo ? 16 : 9.5) * s.area + s.multishot * 0.8;
        const dmg = s.damage * (evo ? 2.3 : 1) * (isResonant ? 2.5 : 1.0);
        game.shockwaves.spawn(this.x, this.z, isResonant ? 0xff44aa : (evo ? 0xfff077 : 0xffcc44), {
          startR: 0.8,
          endR: radius,
          duration: 0.48,
          thick: true,
          intensity: 3.8,
        });
        game.domes.spawn(this.x, 0.8, this.z, isResonant ? 0xff44aa : 0xffcc44, radius * 0.8, 0.42);
        game.lights.flash(this.x, 2.5, this.z, isResonant ? 0xff44aa : 0xffcc44, 1500, 0.4, 35);
        game.camera.shake(0.12);
        game.audio.shoot('carlinhos');

        query.length = 0;
        game.enemies.query(this.x, this.z, radius + 3, query);
        let hits = 0;
        for (const e of query) {
          if (e.dead) continue;
          const dx = e.x - this.x, dz = e.z - this.z;
          const d = Math.hypot(dx, dz);
          if (d > radius + e.radius * e.size) continue;
          game.hitEnemyMelee(e, dmg, dx, dz, 24 * s.knockback, evo ? 'unconditional_love' : 'primary');
          hits++;
          if (this.hero.id === 'carlinhos' && (this.upgrades.hero_carlinhos_pacifist_healing ?? 0) > 0) {
            const healLvl = this.upgrades.hero_carlinhos_pacifist_healing;
            if (Math.random() < 0.25 * healLvl) {
              game.pickups.spawn('heal', e.x, e.z, 1);
            }
          }
        }
        const boss = game.boss;
        if (boss && boss.hittable) {
          const dx = boss.x - this.x, dz = boss.z - this.z;
          if (Math.hypot(dx, dz) < radius + boss.radius) {
            game.hitBossMelee(dmg, evo ? 'unconditional_love' : 'primary');
            hits++;
          }
        }
        if (game.arenaProps && game.arenaProps.crystals.length > 0) {
          for (const c of game.arenaProps.crystals) {
            if (Math.hypot(c.x - this.x, c.z - this.z) <= radius + c.radius) {
              game.arenaProps.damageCrystal(c, dmg, game);
            }
          }
        }
        if (isResonant) {
          game.projectiles.clearAll(true);
        } else {
          game.projectiles.clearEnemyInRadius(this.x, this.z, radius * 0.85, game);
        }
        if (evo && hits > 0) {
          this.heal(Math.min(6, hits * 0.75));
          game.particles.burst(this.x, 1.2, this.z, 16, 0xfff0aa, { speed: 8, life: 0.6, size: 0.35, gravity: -2 });
        }
        if ((this.upgrades.hero_carlinhos_echoing_peace ?? 0) > 0) {
          this.pendingCarlinhosEcho = 0.16;
        }
        break;
      }
      case 'macedo': {
        const extraTraps = (this.upgrades.hero_macedo_quantum_network ?? 0) * 2;
        const maxTraps = (evo ? 10 : (7 + Math.floor(s.multishot))) + extraTraps;
        while (this.macedoTraps.length >= maxTraps) {
          const old = this.macedoTraps.shift();
          if (old) {
            this.scene.remove(old.group);
          }
        }
        const tx = clamp(this.aimX, -ARENA_RADIUS + 3, ARENA_RADIUS - 3);
        const tz = clamp(this.aimZ, -ARENA_RADIUS + 3, ARENA_RADIUS - 3);
        const { group: trapGroup, spinner } = buildMacedoTrapMesh();
        trapGroup.position.set(tx, 0, tz);
        this.scene.add(trapGroup);
        this.macedoTraps.push({
          group: trapGroup,
          spinner,
          x: tx,
          z: tz,
          life: 7.5,
          maxLife: 7.5,
          size: (evo ? 7.5 : 5.2) * s.area,
          pulseTimer: 0.1,
        });
        if ((this.upgrades.hero_macedo_quantum_network ?? 0) > 0) {
          this.stats = this.computeStats();
        }
        game.shockwaves.spawn(tx, tz, 0x44ddff, { startR: 0.4, endR: 3.2, duration: 0.25 });
        game.audio.shoot('macedo');
        break;
      }
    }
  }

  private fireCarlinhosEcho(game: Game) {
    const s = this.stats;
    const evo = this.primaryEvolved;
    const echoLvl = this.upgrades.hero_carlinhos_echoing_peace ?? 1;
    const radius = (evo ? 16 : 9.5) * s.area + s.multishot * 0.8;
    const dmg = s.damage * (evo ? 2.3 : 1) * (0.5 + echoLvl * 0.2);
    game.shockwaves.spawn(this.x, this.z, 0xfff0aa, {
      startR: 0.8,
      endR: radius,
      duration: 0.36,
      thick: true,
      intensity: 3.2,
    });
    game.particles.ring(this.x, 0.8, this.z, 20, 0xfff0aa, radius * 0.8, 3, 0.4, 0.3);
    query.length = 0;
    game.enemies.query(this.x, this.z, radius + 2.5, query);
    for (const e of query) {
      if (e.dead) continue;
      const dx = e.x - this.x, dz = e.z - this.z;
      if (Math.hypot(dx, dz) <= radius + e.radius * e.size) {
        game.hitEnemyMelee(e, dmg, dx, dz, 20 * s.knockback, 'echoing_peace');
        if (this.hero.id === 'carlinhos' && (this.upgrades.hero_carlinhos_pacifist_healing ?? 0) > 0) {
          const healLvl = this.upgrades.hero_carlinhos_pacifist_healing;
          if (Math.random() < 0.25 * healLvl) {
            game.pickups.spawn('heal', e.x, e.z, 1);
          }
        }
      }
    }
    const boss = game.boss;
    if (boss && boss.hittable && Math.hypot(boss.x - this.x, boss.z - this.z) <= radius + boss.radius) {
      game.hitBossMelee(dmg, 'echoing_peace');
    }
    game.projectiles.clearEnemyInRadius(this.x, this.z, radius * 0.85, game);
  }

  private strikeDivineLight(game: Game) {
    const s = this.stats;
    let tx = this.x + rand(-22, 22);
    let tz = this.z + rand(-22, 22);
    const target = game.enemies.nearest(this.x, this.z, 28);
    const boss = game.boss;
    if (boss && boss.hittable && Math.random() < 0.65) {
      tx = boss.x + rand(-1.2, 1.2);
      tz = boss.z + rand(-1.2, 1.2);
    } else if (target && Math.random() < 0.75) {
      tx = target.x + rand(-1.5, 1.5);
      tz = target.z + rand(-1.5, 1.5);
    }
    const r = Math.hypot(tx, tz);
    if (r > ARENA_RADIUS - 3) { tx *= (ARENA_RADIUS - 3) / r; tz *= (ARENA_RADIUS - 3) / r; }
    const radius = 5.5 * s.area;
    const dmg = s.damage * 4.5;
    game.groundHazards.spawn({
      x: tx, z: tz,
      radius,
      duration: 3.5,
      dps: dmg * 0.8,
      type: 'holy',
      color: 0xffe066,
      source: 'holy_grace',
    });
    game.shockwaves.spawn(tx, tz, 0xffe066, { startR: 0.5, endR: radius, duration: 0.45, thick: true });
    game.lights.flash(tx, 4, tz, 0xffe066, 1200, 0.4, 30);
    game.particles.burst(tx, 1, tz, 25, 0xfff0aa, { speed: 8, life: 0.5, size: 0.35 });
    query.length = 0;
    game.enemies.query(tx, tz, radius, query);
    for (const e of query) {
      if (!e.dead) {
        game.hitEnemyDirect(e, dmg, 'holy_grace');
        e.stun = Math.max(e.stun, 1.2);
      }
    }
    if (boss && boss.hittable && Math.hypot(boss.x - tx, boss.z - tz) <= radius + boss.radius) {
      game.hitBossDirect(dmg * 1.25, 'holy_grace');
    }
  }

  private slash(game: Game, angle: number, side: number) {
    const s = this.stats;
    const evo = this.primaryEvolved && this.hero.id === 'otton';
    if (this.hero.id === 'otton' && (this.upgrades.hero_otton_gladiator_armor ?? 0) > 0) {
      this.gladiatorFuryTimer = 4.0;
      this.stats = this.computeStats();
    }
    const radius = (evo ? 7.5 : 5) * s.area + s.multishot * 0.4;
    const half = evo ? Math.PI : (78 + s.multishot * 14) * Math.PI / 180;
    const fx = Math.sin(angle), fz = Math.cos(angle);
    game.slashes.spawn(this.x + fx * 0.8, this.z + fz * 0.8, angle, radius, evo ? 0xff2050 : this.hero.color, side);
    query.length = 0;
    game.enemies.query(this.x, this.z, radius + 3, query);
    let hits = 0;
    const dmg = s.damage * (evo ? 2.2 : 1);
    if (this.ascensionPerk === 'otton_dimensional_blade') {
      game.projectiles.spawn({
        kind: 'rail',
        x: this.x + fx * 0.8, z: this.z + fz * 0.8, y: 1.0,
        vx: fx * 55, vz: fz * 55,
        dmg: dmg * 1.35,
        life: 1.3,
        radius: 1.1,
        pierce: 999,
        color: 0xff2050,
        scale: 1.8,
        trail: 0.8,
        weaponSource: 'dimensional_blade',
      });
    }
    for (const e of query) {
      if (e.dead) continue;
      const dx = e.x - this.x, dz = e.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d > radius + e.radius * e.size) continue;
      let da = Math.atan2(dx, dz) - angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (!evo && Math.abs(da) > half) continue;
      game.hitEnemyMelee(e, dmg, dx, dz, 18 * s.knockback, evo ? 'dimensional_cleave' : 'primary');
      if (this.hero.id === 'otton' && (this.upgrades.hero_otton_bleeding_strike ?? 0) > 0) {
        const bleedLvl = this.upgrades.hero_otton_bleeding_strike;
        game.enemies.applyBleed(e, s.damage * (0.8 + bleedLvl * 0.4), 3.5);
        e.stun = Math.max(e.stun, 0.35);
      }
      hits++;
    }
    const boss = game.boss;
    if (boss && boss.hittable) {
      const dx = boss.x - this.x, dz = boss.z - this.z;
      const d = Math.hypot(dx, dz);
      let da = Math.atan2(dx, dz) - angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (d < radius + boss.radius && (evo || Math.abs(da) < half)) {
        game.hitBossMelee(dmg, evo ? 'dimensional_cleave' : 'primary');
        if (this.hero.id === 'otton' && (this.upgrades.hero_otton_bleeding_strike ?? 0) > 0) {
          const bleedLvl = this.upgrades.hero_otton_bleeding_strike;
          boss.applyBleed(s.damage * (0.8 + bleedLvl * 0.4), 3.5);
        }
        hits++;
      }
    }
    if (game.arenaProps && game.arenaProps.crystals.length > 0) {
      for (const c of game.arenaProps.crystals) {
        const dx = c.x - this.x, dz = c.z - this.z;
        const d = Math.hypot(dx, dz);
        if (d <= radius + c.radius) {
          let da = Math.atan2(dx, dz) - angle;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          if (evo || Math.abs(da) <= half) {
            game.arenaProps.damageCrystal(c, dmg, game);
          }
        }
      }
    }
    game.projectiles.clearEnemyInRadius(this.x + fx * radius * 0.5, this.z + fz * radius * 0.5, radius * 0.6, game);
    if (hits > 0) { game.camera.shake(0.08 + Math.min(0.25, hits * 0.02)); game.audio.hit(); }
    game.audio.slash();
    game.particles.burst(this.x + fx * radius * 0.6, 1, this.z + fz * radius * 0.6, 6 + hits * 3, evo ? 0xff2050 : 0xff9a2a, { speed: 8, life: 0.4, size: 0.3, gravity: 10 });
  }

  private updateMacedoTraps(dt: number, game: Game) {
    if (this.macedoTraps.length === 0) return;
    const s = this.stats;
    const evo = this.primaryEvolved && this.hero.id === 'macedo';
    const dmg = s.damage * 0.85 * (evo ? 1.7 : 1);

    for (let i = this.macedoTraps.length - 1; i >= 0; i--) {
      const t = this.macedoTraps[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.group);
        this.macedoTraps.splice(i, 1);
        if ((this.upgrades.hero_macedo_quantum_network ?? 0) > 0) {
          this.stats = this.computeStats();
        }
        continue;
      }
      // Giro do diamante holográfico
      t.spinner.rotation.y += dt * 3.5;
      t.spinner.rotation.x += dt * 2.0;

      // Macedo: Vórtice Telemático (sucção gravitacional contínua)
      if ((this.upgrades.hero_macedo_magnetic_traps ?? 0) > 0) {
        const magnetLvl = this.upgrades.hero_macedo_magnetic_traps;
        const pullR = t.size * 1.35;
        query.length = 0;
        game.enemies.query(t.x, t.z, pullR, query);
        for (const e of query) {
          if (e.dead || e.type === 'mine') continue;
          const dx = t.x - e.x, dz = t.z - e.z;
          const d = Math.hypot(dx, dz) || 1;
          const pull = (1 - d / pullR) * (14 + magnetLvl * 6) * dt;
          e.x += (dx / d) * pull;
          e.z += (dz / d) * pull;
        }
        if (Math.random() < 0.18) {
          game.particles.implode(t.x, 0.5, t.z, 2, 0x44ddff, pullR * 0.8, 0.2);
        }
      }

      const isMesh = this.ascensionPerk === 'macedo_telematic_mesh';
      const isPulsar = this.ascensionPerk === 'macedo_static_pulsar';
      t.pulseTimer -= dt;
      if (t.pulseTimer <= 0) {
        const magnetLvl = this.upgrades.hero_macedo_magnetic_traps ?? 0;
        const pulseMult = (1 + magnetLvl * 0.30) * (isPulsar ? 2.0 : 1.0);
        t.pulseTimer = (0.45 / pulseMult) / s.fireRate;
        game.shockwaves.spawn(t.x, t.z, 0x44ddff, { startR: 0.5, endR: t.size, duration: 0.32, thick: false });
        query.length = 0;
        game.enemies.query(t.x, t.z, t.size + 2, query);
        for (const e of query) {
          if (e.dead) continue;
          const dx = e.x - t.x, dz = e.z - t.z;
          if (Math.hypot(dx, dz) <= t.size + e.radius * e.size) {
            game.recordDamage(dmg, evo ? 'telematics_network' : 'primary');
            game.damageEnemy(e, dmg, Math.random() < s.critChance, 'normal');
            e.stun = Math.max(e.stun, isPulsar ? 1.5 : 0.22);
            game.particles.burst(e.x, 1, e.z, 4, 0x44ddff, { speed: 5, life: 0.2, size: 0.25 });
          }
        }
        const boss = game.boss;
        if (boss && boss.hittable && Math.hypot(boss.x - t.x, boss.z - t.z) <= t.size + boss.radius) {
          game.hitBossMelee(dmg, evo ? 'telematics_network' : 'primary');
        }
        if (game.arenaProps && game.arenaProps.crystals.length > 0) {
          for (const c of game.arenaProps.crystals) {
            if (Math.hypot(c.x - t.x, c.z - t.z) <= t.size + c.radius) {
              game.arenaProps.damageCrystal(c, dmg, game);
            }
          }
        }

        // Se evoluído (Rede Neural Telemática) ou perk Telematic Mesh, conecta arcos elétricos com outras armadilhas
        if ((evo || isMesh) && this.macedoTraps.length > 1) {
          for (const other of this.macedoTraps) {
            if (other === t) continue;
            const distTraps = Math.hypot(other.x - t.x, other.z - t.z);
            if (distTraps < 32) {
              game.particles.burst((t.x + other.x) * 0.5, 0.6, (t.z + other.z) * 0.5, 3, 0x88eeff, { speed: 2, life: 0.15, size: 0.2 });
              for (const e of game.enemies.list) {
                if (e.dead) continue;
                const l2 = distTraps * distTraps;
                const tx = ((e.x - t.x) * (other.x - t.x) + (e.z - t.z) * (other.z - t.z)) / l2;
                if (tx >= 0 && tx <= 1) {
                  const px = t.x + tx * (other.x - t.x);
                  const pz = t.z + tx * (other.z - t.z);
                  if (Math.hypot(e.x - px, e.z - pz) < 2.0) {
                    game.damageEnemy(e, dmg * (isMesh ? 1.2 : 0.75), false, 'normal');
                    e.stun = Math.max(e.stun, isPulsar ? 1.5 : 0.35);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  private updateSecondaryWeapons(dt: number, game: Game) {
    const s = this.stats;
    for (const [id, sec] of this.secondaryWeapons) {
      const def = SECONDARY_WEAPONS[id];
      sec.timer -= dt;

      if (id === 'orbital_saw') {
        // As lâminas orbitais permanecem ativas ao redor da nave
        const targetCount = sec.evolved ? 6 : 3;
        let activeCount = 0;
        for (const p of game.projectiles.pool) {
          if (p.active && p.kind === 'saw') {
            activeCount++;
            if (sec.evolved && p.weaponSource !== 'stellar_saw') {
              p.weaponSource = 'stellar_saw';
              p.dmg = def.baseDmg * 1.8 * (s.damage / this.hero.damage);
              p.scale = s.area * 1.4;
              p.r = 0; p.g = 1; p.b = 1;
            }
          }
        }
        if (activeCount < targetCount) {
          const needed = targetCount - activeCount;
          for (let i = 0; i < needed; i++) {
            const orbitIdx = activeCount + i;
            const ring = sec.evolved && orbitIdx % 2 === 1 ? 5.2 : 3.4;
            const orbitAngle = (orbitIdx / targetCount) * Math.PI * 2;
            game.projectiles.spawn({
              kind: 'saw',
              x: this.x + Math.cos(orbitAngle) * ring,
              z: this.z + Math.sin(orbitAngle) * ring,
              y: 1.0,
              vx: 0, vz: 0,
              dmg: def.baseDmg * (sec.evolved ? 1.8 : 1.0) * (s.damage / this.hero.damage),
              life: 14,
              radius: 0.9 * s.area,
              color: sec.evolved ? def.evoColor : def.color,
              orbitRadius: ring,
              orbitSpeed: (sec.evolved ? 5.2 : 4.0),
              orbitAngle,
              scale: s.area * (sec.evolved ? 1.4 : 1),
              weaponSource: sec.evolved ? 'stellar_saw' : 'orbital_saw',
            });
            game.audio.orbitalSaw();
          }
        }
      } else if (sec.timer <= 0) {
        if (id === 'missile_pod') {
          const cd = (def.cooldown * (sec.evolved ? 0.65 : 0.9)) / s.fireRate;
          sec.timer = cd;
          const count = (sec.evolved ? 6 : 3) + s.multishot;
          const dmg = def.baseDmg * (sec.evolved ? 2.2 : 1.1) * (s.damage / this.hero.damage);
          for (let i = 0; i < count; i++) {
            const a = this.aimAngle + rand(-1.2, 1.2);
            const sp = rand(24, 32) * s.projSpeed;
            game.projectiles.spawn({
              kind: 'missile',
              x: this.x + rand(-0.8, 0.8),
              z: this.z + rand(-0.8, 0.8),
              y: 1.3,
              vx: Math.sin(a) * sp,
              vz: Math.cos(a) * sp,
              dmg,
              life: 3.5,
              radius: 0.45,
              homing: true,
              aoeRadius: (sec.evolved ? 6.5 : 4.2) * s.area,
              color: sec.evolved ? def.evoColor : def.color,
              scale: sec.evolved ? 1.4 : 1,
              trail: 0.8,
              weaponSource: sec.evolved ? 'macabre_swarm' : 'missile_pod',
            });
          }
          game.audio.missileLaunch();
        } else if (id === 'tesla_coil') {
          const cd = (def.cooldown * (sec.evolved ? 0.65 : 0.9)) / s.fireRate;
          sec.timer = cd;
          const jumps = (sec.evolved ? 12 : 4) + s.multishot * 2;
          const dmg = def.baseDmg * (sec.evolved ? 2.2 : 1.1) * (s.damage / this.hero.damage);
          game.projectiles.fireTeslaChain(this.x, this.z, dmg, jumps, game, sec.evolved);
        } else if (id === 'gravity_well') {
          const cd = (def.cooldown * (sec.evolved ? 0.65 : 0.9)) / s.fireRate;
          sec.timer = cd;
          const a = this.aimAngle;
          const sp = 18 * s.projSpeed;
          const dmg = def.baseDmg * (sec.evolved ? 2.4 : 1.1) * (s.damage / this.hero.damage);
          game.projectiles.spawn({
            kind: 'vortex',
            x: this.x + Math.sin(a) * 1.5,
            z: this.z + Math.cos(a) * 1.5,
            y: 1.0,
            vx: Math.sin(a) * sp,
            vz: Math.cos(a) * sp,
            dmg,
            life: sec.evolved ? 3.0 : 2.0,
            radius: 1.2,
            pullRadius: (sec.evolved ? 14 : 8) * s.area,
            color: sec.evolved ? def.evoColor : def.color,
            scale: (sec.evolved ? 1.8 : 1.2) * s.area,
            spin: 6,
            weaponSource: sec.evolved ? 'singularity_well' : 'gravity_well',
          });
          game.audio.gravityImplosion();
        } else if (id === 'flamethrower') {
          const cd = (def.cooldown * (sec.evolved ? 0.75 : 1.0)) / s.fireRate;
          sec.timer = cd;
          const dmg = def.baseDmg * (sec.evolved ? 2.5 : 1.0) * (s.damage / this.hero.damage);
          game.projectiles.fireFlamethrower(this.x, this.z, this.aimAngle, dmg, sec.evolved, game, s.multishot);
        } else if (id === 'railgun') {
          const cd = (def.cooldown * (sec.evolved ? 0.7 : 0.9)) / s.fireRate;
          sec.timer = cd;
          const dmg = def.baseDmg * (sec.evolved ? 2.6 : 1.0) * (s.damage / this.hero.damage);
          game.projectiles.fireRailgun(this.x, this.z, this.aimAngle, dmg, sec.evolved, game);
          for (let i = 1; i <= s.multishot; i++) {
            game.projectiles.fireRailgun(this.x, this.z, this.aimAngle + i * 0.12, dmg * 0.85, sec.evolved, game);
            game.projectiles.fireRailgun(this.x, this.z, this.aimAngle - i * 0.12, dmg * 0.85, sec.evolved, game);
          }
        }
      }
    }
  }

  private updateDrones(dt: number, game: Game) {
    const s = this.stats;
    for (const d of this.drones) {
      d.angle += dt * 1.7;
      const px = this.x + Math.cos(d.angle) * 2.8, pz = this.z + Math.sin(d.angle) * 2.8;
      d.group.position.set(px, 1.7 + Math.sin(this.time * 3 + d.angle) * 0.15, pz);
      d.fireTimer -= dt;
      const target = game.enemies.nearest(px, pz, 22);
      if (target) d.group.rotation.y = Math.atan2(target.x - px, target.z - pz);
      else d.group.rotation.y = this.aimAngle;
      if (d.fireTimer <= 0) {
        d.fireTimer = 0.6 / s.fireRate;
        if (target) {
          const a = Math.atan2(target.x - px, target.z - pz);
          const sp = 42 * s.projSpeed;
          game.projectiles.spawn({
            kind: 'laser', x: px, z: pz, y: 1.7, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, dmg: s.damage * 0.45, life: 1.2, radius: 0.28,
            pierce: 0, ricochet: 0, color: this.hero.color, scale: 0.7, fromDrone: true, trail: 0.15,
          });
          if (Math.random() < 0.5) game.audio.droneShot();
        }
      }
    }
  }

  // ---------------------------------------------------------------------
  private tryUlt(game: Game) {
    if (this.ultCd > 0 || this.ultActive) return;
    const s = this.stats;
    this.ultCd = this.ultMax;
    game.slowTime(0.18, 0.5);
    game.flash(0.55, this.hero.color);
    game.chroma(1.6);
    game.camera.shake(0.4);
    game.audio.ultCharge();
    game.world.ripple(this.x, this.z, 1.5);
    game.notice(this.hero.ult.toUpperCase(), undefined, this.hero.css);
    switch (this.hero.id) {
      case 'big': {
        const siloLvl = this.upgrades.hero_big_rapid_silo ?? 0;
        const dur = Math.max(0.85, 1.35 - siloLvl * 0.15);
        const group = buildBottle();
        group.position.set(this.aimX, 70, this.aimZ);
        this.scene.add(group);
        this.bottle = { group, t: 0, tx: this.aimX, tz: this.aimZ, dur };
        const flameActive = (this.upgrades.hero_big_flame_bottle ?? 0) > 0;
        game.telegraphs.circle(this.aimX, this.aimZ, 13 * s.area * (1 + siloLvl * 0.25), dur, flameActive ? 0xff3300 : 0xff6a00);
        this.ultActive = true;
        break;
      }
      case 'otton': {
        this.burstsLeft = 4 + (this.upgrades.hero_otton_burning_passion ?? 0);
        this.burstTimer = 0.15;
        this.ultActive = true;
        game.audio.ult('otton');
        break;
      }
      case 'thiago': {
        this.domeT = 0;
        this.domePushed.clear();
        this.ultActive = true;
        const surgeLvl = this.upgrades.hero_thiago_inconvenience_surge ?? 0;
        const domeR = (26 + surgeLvl * 8) * s.area;
        game.domes.spawn(this.x, 1, this.z, 0x8cff2a, domeR, 1.1);
        game.lights.flash(this.x, 3, this.z, 0x8cff2a, 1500, 1.0, 50);
        game.audio.ult('thiago');
        break;
      }
      case 'pietro': {
        const liturgyLvl = this.upgrades.hero_pietro_eternal_orbit ?? 0;
        const isHerald = this.ascensionPerk === 'pietro_herald_of_void';
        this.ultTimer = (isHerald ? 14 : 9) + liturgyLvl * 3.5;
        this.pietroGlyphLaserTimer = 0.2;
        this.ultActive = true;
        this.glyphHits.clear();
        for (const m of this.glyphMeshes) m.visible = true;
        game.audio.ult('pietro');
        break;
      }
      case 'carlinhos': {
        const graceLvl = this.upgrades.hero_carlinhos_divine_grace ?? 0;
        this.carlinhosUltTimer = 6.0;
        this.ultActive = true;
        if (graceLvl > 0) {
          this.heal(this.stats.maxHp);
          this.invulnTimer = 2.0 + graceLvl * 1.0;
          this.carlinhosDivineStrikes = 6 + graceLvl * 2;
          this.carlinhosDivineTimer = 0.1;
        } else {
          this.heal(this.stats.maxHp * 0.4);
        }
        game.audio.ult('carlinhos');
        game.shockwaves.spawn(this.x, this.z, 0xffcc44, { startR: 2, endR: 65, duration: 1.6, thick: true, intensity: 4 });
        game.domes.spawn(this.x, 1, this.z, 0xfff0aa, 50, 1.4);
        game.lights.flash(this.x, 4, this.z, 0xffcc44, 3000, 1.2, 80);
        game.camera.shake(0.6);
        game.flash(0.7, 0xffdd66);
        for (const e of game.enemies.list) {
          if (!e.dead) {
            e.stun = Math.max(e.stun, 6.0);
          }
        }
        if (game.boss && game.boss.hittable) {
          game.hitBossMelee(s.damage * 8, 'unconditional_love');
        }
        game.notice('BONDADE!', graceLvl > 0 ? 'GRAÇA DIVINA: VIDA RESTAURADA E LUZ PURIFICADORA' : 'TODOS OS INIMIGOS PACIFICADOS', '#ffcc44');
        break;
      }
      case 'macedo': {
        this.macedoUltTimer = 4.5;
        this.macedoUltTick = 0.1;
        this.ultActive = true;
        game.audio.ult('macedo');
        for (let i = 0; i < 3; i++) {
          game.shockwaves.spawn(this.x, this.z, 0x44ddff, { startR: 1 + i * 2, endR: 50 + i * 15, duration: 0.9 + i * 0.3, thick: true, intensity: 4 });
        }
        game.domes.spawn(this.x, 1, this.z, 0x88eeff, 45, 1.1);
        game.lights.flash(this.x, 4, this.z, 0x44ddff, 2800, 1.2, 75);
        game.camera.shake(0.8);
        game.flash(0.7, 0x88eeff);
        const shockDmg = s.damage * 4.5;
        game.recordDamage(shockDmg, 'ult');
        for (const e of game.enemies.list) {
          if (!e.dead) {
            e.stun = Math.max(e.stun, 4.5);
            game.damageEnemy(e, shockDmg, true, 'normal');
            game.particles.burst(e.x, 1, e.z, 6, 0x44ddff, { speed: 8, life: 0.3, size: 0.3 });
          }
        }
        if (game.boss && game.boss.hittable) {
          game.hitBossMelee(s.damage * 10, 'telematics_network');
        }
        if ((this.upgrades.hero_macedo_overload_cascade ?? 0) > 0) {
          const cascadeLvl = this.upgrades.hero_macedo_overload_cascade;
          let cascadeCount = 0;
          for (const e of game.enemies.list) {
            if (!e.dead && cascadeCount < 8) {
              cascadeCount++;
              game.projectiles.fireTeslaChain(e.x, e.z, s.damage * (1.6 + cascadeLvl * 0.5), 2 + cascadeLvl * 2, game, true, 'overload_cascade');
            }
          }
        }
        game.notice('SURTO COMUNICATIVO!', 'SOBRECARGA ELETROMAGNÉTICA GLOBAL', '#44ddff');
        break;
      }
    }
  }

  private updateUlt(dt: number, game: Game) {
    const s = this.stats;
    // BIG: garrafa
    if (this.bottle) {
      const b = this.bottle;
      b.t += dt / b.dur;
      const k = clamp(b.t, 0, 1);
      const y = 70 * (1 - k * k) + 2.4;
      b.group.position.set(b.tx + Math.sin(k * 3) * 0.3, y, b.tz);
      b.group.rotation.set(0.35, b.t * 6, 0.2);
      const fire = b.group.userData.fire as THREE.Mesh;
      fire.scale.set(1 + k, 1.6 + k * 2, 1 + k);
      (fire.material as THREE.MeshBasicMaterial).opacity = 0.25 + k * 0.4;
      const flameBottleActive = (this.upgrades.hero_big_flame_bottle ?? 0) > 0;
      const particleCount = flameBottleActive ? 12 : 6;
      for (let i = 0; i < particleCount; i++) {
        game.particles.emit(
          b.tx + rand(-1.5, 1.5), y + rand(-2, 3), b.tz + rand(-1.5, 1.5),
          rand(-3, 3), 6 + rand(0, 8), rand(-3, 3),
          0.5, 0.7,
          flameBottleActive ? 1 : 0.45 + Math.random() * 0.3,
          flameBottleActive ? 0.3 + Math.random() * 0.2 : 0.1,
          flameBottleActive ? 0.05 : -4,
          -4, 0, 0, 1
        );
      }
      if (b.t >= 1) {
        this.scene.remove(b.group);
        this.bottle = null;
        this.ultActive = false;
        const siloLvl = this.upgrades.hero_big_rapid_silo ?? 0;
        const R = 13 * s.area * (1 + siloLvl * 0.25);
        game.explodePlayer(b.tx, b.tz, R, s.damage * (9 + siloLvl * 2.5), 0xff6a00, 45 * s.knockback, true, 'ult');
        game.domes.spawn(b.tx, 1, b.tz, 0xff8a20, R * 1.05, 0.7);
        for (let i = 0; i < 3; i++) game.shockwaves.spawn(b.tx, b.tz, i === 1 ? 0xffd040 : 0xff6a00, { startR: 1, endR: R * (1.2 + i * 0.5), duration: 0.8 + i * 0.25, thick: i === 0, intensity: 3.5 });
        game.particles.burst(b.tx, 1, b.tz, 320, 0xff8a20, { speed: 24, life: 1.6, size: 0.55, gravity: 14 });
        game.vfx.explosion(b.tx, 1, b.tz, 0xff8a20, R * 0.65, 3);
        game.particles.burst(b.tx, 1, b.tz, 140, 0xffffff, { speed: 30, life: 0.8, size: 0.4, gravity: 0 });
        game.lights.flash(b.tx, 4, b.tz, 0xff8a20, 4000, 1.2, 70);
        game.world.ripple(b.tx, b.tz, 4);
        game.camera.shake(1.3);
        game.chroma(2.2);
        game.flash(0.8, 0xffb060);
        game.slowTime(0.3, 0.45);
        game.audio.ult('big');

        // Big: Garrafa Flamejante
        if ((this.upgrades.hero_big_flame_bottle ?? 0) > 0) {
          const flameLvl = this.upgrades.hero_big_flame_bottle;
          const flameR = R * (1.1 + flameLvl * 0.15);
          game.groundHazards.spawn({
            x: b.tx, z: b.tz,
            radius: flameR,
            duration: 6.0,
            dps: s.damage * (1.8 + flameLvl * 0.65),
            color: 0xff4500,
            type: 'fire',
            source: 'garrafa_flamejante'
          });
          game.shockwaves.spawn(b.tx, b.tz, 0xff3300, { startR: 1, endR: flameR * 1.25, duration: 0.9, thick: true });
          game.particles.burst(b.tx, 1, b.tz, 160, 0xff3300, { speed: 18, life: 1.2, size: 0.5, gravity: 6 });
          query.length = 0;
          game.enemies.query(b.tx, b.tz, flameR + 2.5, query);
          for (const e of query) {
            if (!e.dead) {
              game.enemies.applyBurn(e, s.damage * (2.4 + flameLvl * 0.8), 5.0, 0xff4500);
            }
          }
          const boss = game.boss;
          if (boss && boss.hittable && Math.hypot(boss.x - b.tx, boss.z - b.tz) < flameR + boss.radius) {
            const bossFlameDmg = s.damage * (3 + flameLvl);
            boss.hit(bossFlameDmg, false, game);
            game.recordDamage(bossFlameDmg, 'garrafa_flamejante');
          }
        }
      }
    }
    // OTTON: rajadas 360°
    if (this.burstsLeft > 0) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) {
        this.burstsLeft--;
        this.burstTimer = 0.27;
        const passionLvl = this.upgrades.hero_otton_burning_passion ?? 0;
        const n = 26 + passionLvl * 10;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + this.burstsLeft * 0.13;
          const sp = 27 * s.projSpeed;
          game.projectiles.spawn({
            kind: 'orb', x: this.x + Math.sin(a) * 1.2, z: this.z + Math.cos(a) * 1.2, y: 1.1, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp,
            dmg: s.damage * 1.5, life: 1.9, radius: 0.5, pierce: 1 + s.pierce, ricochet: s.ricochet + passionLvl * 2, color: 0xff3c9a, trail: 0.2, knock: s.knockback * 1.5,
            weaponSource: passionLvl > 0 ? 'burning_passion' : 'ult',
          });
        }
        game.particles.ring(this.x, 1, this.z, 40, 0xff3c9a, 1.5, 12, 0.6, 0.4);
        if (passionLvl > 0) {
          game.particles.burst(this.x, 1.2, this.z, 24, 0xff69b4, { speed: 9, life: 0.5, size: 0.35 });
        }
        game.shockwaves.spawn(this.x, this.z, 0xff3c9a, { endR: 10, duration: 0.5 });
        game.camera.shake(0.3);
        game.lights.flash(this.x, 3, this.z, 0xff3c9a, 1200, 0.4, 40);
        if (this.burstsLeft === 0) this.ultActive = false;
      }
    }
    // THIAGO: domo de repulsão
    if (this.domeT >= 0) {
      this.domeT += dt;
      const surgeLvl = this.upgrades.hero_thiago_inconvenience_surge ?? 0;
      const maxDomeR = (26 + surgeLvl * 8) * s.area;
      const R = maxDomeR * Math.min(1, 1 - Math.pow(1 - Math.min(1, this.domeT / (1.1 - surgeLvl * 0.08)), 3));
      query.length = 0;
      game.enemies.query(this.x, this.z, R + 3, query);
      for (const e of query) {
        if (e.dead || this.domePushed.has(e.id)) continue;
        const dx = e.x - this.x, dz = e.z - this.z;
        const d = Math.hypot(dx, dz);
        if (d > R) continue;
        this.domePushed.add(e.id);
        const knockForce = (38 + surgeLvl * 25) * s.knockback;
        game.enemies.knockback(e, dx, dz, knockForce);
        e.stun = Math.max(e.stun, 2.6 + surgeLvl * 1.2);
        game.enemies.applyBurn(e, s.damage * (2.2 + surgeLvl * 0.8), 4 + surgeLvl, 0x8cff2a);
        const domeDmg = s.damage * (3 + surgeLvl);
        game.recordDamage(domeDmg, 'ult');
        game.damageEnemy(e, domeDmg, Math.random() < s.critChance, 'corrode');
        if (surgeLvl > 0) {
          const healAmt = 1.5 * surgeLvl;
          this.heal(healAmt);
          if (Math.random() < 0.25) {
            game.numbers.spawn(this.x, 1.6, this.z, healAmt, 'heal');
          }
        }
      }
      const boss = game.boss;
      if (boss && boss.hittable && !this.domePushed.has(-1) && Math.hypot(boss.x - this.x, boss.z - this.z) < R + boss.radius) {
        this.domePushed.add(-1);
        game.hitBossMelee(s.damage * (12 + surgeLvl * 4), 'ult');
      }
      game.projectiles.clearEnemyInRadius(this.x, this.z, R, game);
      if (Math.random() < 0.8) game.particles.ring(this.x, 0.6, this.z, 6, 0x8cff2a, R, 3, 0.5, 0.35);
      if (this.domeT >= 1.3) { this.domeT = -1; this.ultActive = false; game.camera.shake(0.5); game.world.ripple(this.x, this.z, 3); }
    }
    // PIETRO: 4 palavras malditas
    if (this.hero.id === 'pietro' && this.ultTimer > 0) {
      this.ultTimer -= dt;
      const liturgyLvl = this.upgrades.hero_pietro_eternal_orbit ?? 0;
      this.glyphAngle += dt * (3.3 + liturgyLvl * 1.2);
      const R = (6.5 + liturgyLvl * 1.2) * s.area;
      this.glyphPositions.length = 0;
      for (let i = 0; i < 4; i++) {
        const a = this.glyphAngle + (i / 4) * Math.PI * 2;
        const gx = this.x + Math.cos(a) * R, gz = this.z + Math.sin(a) * R;
        this.glyphPositions.push({ x: gx, z: gz });
        const m = this.glyphMeshes[i];
        m.position.set(gx, 2.2 + Math.sin(this.time * 4 + i) * 0.3, gz);
        m.quaternion.copy(game.camera.camera.quaternion);
        m.rotation.z += Math.sin(this.time * 5 + i) * 0.15;
        const fade = Math.min(1, this.ultTimer * 2, ((9 + liturgyLvl * 3.5) - this.ultTimer) * 3);
        (m.material as THREE.MeshBasicMaterial).opacity = fade;
        m.scale.setScalar(fade * s.area);
        if (Math.random() < 0.5) game.particles.emit(gx, 1.5, gz, rand(-1, 1), 2, rand(-1, 1), 0.5, 0.35, 0.75, 0.36, 1, 0, 0, 0, 1);
        // dano
        query.length = 0;
        game.enemies.query(gx, gz, 3.5, query);
        for (const e of query) {
          if (e.dead) continue;
          if (Math.hypot(e.x - gx, e.z - gz) > 2.6 * s.area + e.radius * e.size) continue;
          const last = this.glyphHits.get(e.id) ?? -1;
          if (this.time - last < 0.2) continue;
          this.glyphHits.set(e.id, this.time);
          game.hitEnemyMelee(e, s.damage * 1.3, e.x - this.x, e.z - this.z, 12, 'ult');
        }
        const boss = game.boss;
        if (boss && boss.hittable && Math.hypot(boss.x - gx, boss.z - gz) < 2.6 * s.area + boss.radius) {
          const last = this.glyphHits.get(-1 - i) ?? -1;
          if (this.time - last >= 0.2) { this.glyphHits.set(-1 - i, this.time); game.hitBossMelee(s.damage * 1.3, 'ult'); }
        }
      }

      // Liturgia Ancestral & Arauto do Vácuo: raios cósmicos adicionais
      const isHerald = this.ascensionPerk === 'pietro_herald_of_void';
      if (liturgyLvl > 0 || isHerald) {
        this.pietroGlyphLaserTimer -= dt;
        if (this.pietroGlyphLaserTimer <= 0) {
          this.pietroGlyphLaserTimer = isHerald ? 0.22 : 0.45;
          for (const gp of this.glyphPositions) {
            const target = game.enemies.nearest(gp.x, gp.z, 26);
            if (target) {
              const la = Math.atan2(target.x - gp.x, target.z - gp.z);
              const sp = 48 * s.projSpeed;
              game.projectiles.spawn({
                kind: 'laser',
                x: gp.x, z: gp.z, y: 2.2,
                vx: Math.sin(la) * sp, vz: Math.cos(la) * sp,
                dmg: s.damage * (isHerald ? 1.8 : 0.8 + liturgyLvl * 0.35),
                life: 0.9,
                radius: 0.35,
                color: isHerald ? 0x9333ea : 0xd888ff,
                pierce: isHerald ? 4 : 1,
                weaponSource: isHerald ? 'herald_void' : 'liturgy',
              });
              game.particles.burst(gp.x, 2.2, gp.z, 4, 0xc05cff, { speed: 4, life: 0.2, size: 0.2 });
            }
          }
        }
      }
      if (this.ultTimer <= 0) {
        this.ultActive = false;
        this.glyphPositions.length = 0;
        for (const m of this.glyphMeshes) m.visible = false;
        game.particles.burst(this.x, 1.5, this.z, 60, 0xc05cff, { speed: 10, life: 0.8, size: 0.4 });
      }
    }

    // CARLINHOS: Bondade (pacificação prolongada e partículas celestiais)
    if (this.hero.id === 'carlinhos' && this.carlinhosUltTimer > 0) {
      this.carlinhosUltTimer -= dt;
      this.carlinhosWaveTick -= dt;
      if (this.carlinhosWaveTick <= 0) {
        this.carlinhosWaveTick = 0.5;
        game.particles.ring(this.x, 0.8, this.z, 10, 0xffcc44, 5.0, 2.5, 0.6, 0.4);
        for (const e of game.enemies.list) {
          if (!e.dead && e.stun < 0.8) {
            e.stun = 1.0;
          }
        }
      }
      if (this.carlinhosUltTimer <= 0) {
        this.ultActive = false;
        game.particles.burst(this.x, 1.5, this.z, 50, 0xfff0aa, { speed: 8, life: 0.7, size: 0.4 });
      }
    }

    // MACEDO: Surto Comunicativo (relâmpagos contínuos)
    if (this.hero.id === 'macedo' && this.macedoUltTimer > 0) {
      this.macedoUltTimer -= dt;
      this.macedoUltTick -= dt;
      if (this.macedoUltTick <= 0) {
        this.macedoUltTick = 0.45;
        let strikes = 0;
        for (const e of game.enemies.list) {
          if (!e.dead && strikes < 5) {
            strikes++;
            const strikeDmg = s.damage * 1.2;
            game.recordDamage(strikeDmg, 'ult');
            game.damageEnemy(e, strikeDmg, false, 'normal');
            game.particles.burst(e.x, 1.2, e.z, 6, 0x44ddff, { speed: 6, life: 0.25, size: 0.25 });
            game.shockwaves.spawn(e.x, e.z, 0x44ddff, { startR: 0.3, endR: 2.2, duration: 0.2 });
          }
        }
      }
      if (this.macedoUltTimer <= 0) {
        this.ultActive = false;
        game.particles.burst(this.x, 1.5, this.z, 60, 0x44ddff, { speed: 10, life: 0.8, size: 0.4 });
      }
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.scene.remove(this.shield);
    for (const t of this.trails) t.dispose(this.scene);
    for (const d of this.drones) this.scene.remove(d.group);
    for (const m of this.glyphMeshes) this.scene.remove(m);
    if (this.bottle) this.scene.remove(this.bottle.group);
    for (const t of this.macedoTraps) {
      this.scene.remove(t.group);
    }
    this.macedoTraps = [];
    this.ghosts.clearAll();
  }
}
