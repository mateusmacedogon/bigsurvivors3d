import * as THREE from 'three';
import { ARENA_RADIUS, BOSS_WAVE, clamp, enemyDmgMul, rand, type EnemyType } from './config';
import { CORE_FRAG, CORE_VERT } from './shaders';
import type { Beam } from './effects';
import type { Game } from './game';

type BossState = 'enter' | 'fight' | 'transition' | 'dying' | 'dead';
type Pattern = 'shock' | 'cone' | 'summon' | 'sweep' | 'mortar' | 'spiral' | 'teleport' | 'ring';

interface DamageRing { x: number; z: number; r: number; speed: number; maxR: number; hit: boolean }

const PATTERNS: Record<number, Pattern[]> = {
  1: ['shock', 'cone', 'summon', 'cone', 'shock', 'cone'],
  2: ['sweep', 'mortar', 'cone', 'shock', 'mortar', 'sweep'],
  3: ['spiral', 'teleport', 'ring', 'spiral', 'teleport', 'cone', 'ring'],
};
const DURATION: Record<Pattern, number> = { shock: 3.2, cone: 2.4, summon: 2.0, sweep: 4.6, mortar: 2.6, spiral: 4.8, teleport: 1.7, ring: 1.3 };

export class Boss {
  name = 'O FARMADOR DE AURA';
  group = new THREE.Group();
  body = new THREE.Group();
  x: number; z: number; y = 40;
  radius = 4.8;
  hp: number;
  maxHp: number;
  shield = 32000;
  maxShield = 32000;
  phase = 1;
  state: BossState = 'enter';
  hittable = false;
  bleed = 0;
  bleedDps = 0;
  bleedTick = 0;
  curse = 0;
  curseMult = 1;
  private t = 0;
  private coreMat: THREE.ShaderMaterial;
  private core: THREE.Mesh;
  private cage: THREE.Mesh;
  private cageMat: THREE.MeshBasicMaterial;
  private ringPivots: THREE.Group[] = [];
  private platePivots: THREE.Group[] = [];
  private plates: THREE.Mesh[] = [];
  private eyes = new THREE.Group();
  private light: THREE.PointLight;
  private glowRing: THREE.Mesh;
  private open = 0;
  private rage = 0;
  private pattern: Pattern | null = null;
  private pT = 0;
  private cd = 2.5;
  private pIdx = 0;
  private rings: DamageRing[] = [];
  private beams: Beam[] = [];
  private beamAngle = 0;
  private beamDir = 1;
  private spiral = 0;
  private contactCd = 0;
  private transT = 0;
  private dyingT = 0;
  private flash = 0;
  private dmgMul: number;
  private lastVolley = -1;
  private teleDone = 0;

  constructor(scene: THREE.Scene, x: number, z: number) {
    this.x = x; this.z = z;
    this.maxHp = 110000;
    this.hp = this.maxHp;
    this.maxShield = 32000;
    this.shield = this.maxShield;
    this.dmgMul = enemyDmgMul(BOSS_WAVE);

    this.coreMat = new THREE.ShaderMaterial({
      vertexShader: CORE_VERT,
      fragmentShader: CORE_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: new THREE.Color(0xd020c0) },
        uColorB: { value: new THREE.Color(0xffc040) },
        uRage: { value: 0 },
      },
    });
    this.core = new THREE.Mesh(new THREE.SphereGeometry(2.6, 40, 32), this.coreMat);
    this.body.add(this.core);
    this.cageMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc040).multiplyScalar(2), wireframe: true, transparent: true, opacity: 0.45 });
    this.cage = new THREE.Mesh(new THREE.IcosahedronGeometry(3.35, 1), this.cageMat);
    this.body.add(this.cage);

    const hull = new THREE.MeshStandardMaterial({ color: 0x160c22, metalness: 0.92, roughness: 0.24 });
    const hullArmor = new THREE.MeshStandardMaterial({ color: 0x2c143e, metalness: 0.88, roughness: 0.28 });
    const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff22a8).multiplyScalar(3.0) });
    const goldLed = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc040).multiplyScalar(3.5) });

    // Núcleo interno de singularidade cósmica
    const innerSingularity = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), goldLed);
    this.body.add(innerSingularity);

    // Coroa de Espinhos Superior e Inferior (Void Thorns) com simetria radial perfeita
    for (let c = 0; c < 8; c++) {
      const ca = (c / 8) * Math.PI * 2;
      const thornPivot = new THREE.Group();
      thornPivot.rotation.y = ca;

      // Espinho superior apontando radialmente para fora e para cima
      const topThorn = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.6, 5), hull);
      topThorn.position.set(2.5, 3.3, 0);
      topThorn.rotation.z = -0.42;
      const topGlow = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), ledMat);
      topGlow.position.set(0, 0.8, 0);
      topThorn.add(topGlow);
      thornPivot.add(topThorn);

      // Espinho inferior invertido apontando radialmente para fora e para baixo
      const btmThorn = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.5, 5), hull);
      btmThorn.position.set(2.5, -3.3, 0);
      btmThorn.rotation.z = Math.PI + 0.42;
      const btmGlow = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), goldLed);
      btmGlow.position.set(0, 0.75, 0);
      btmThorn.add(btmGlow);
      thornPivot.add(btmThorn);

      this.body.add(thornPivot);
    }

    // 6 Geradores de Pulso & Bobinas de Aura montados entre os pivôs
    for (let gIdx = 0; gIdx < 6; gIdx++) {
      const ga = ((gIdx + 0.5) / 6) * Math.PI * 2;
      const genPivot = new THREE.Group();
      genPivot.rotation.y = ga;

      const genBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.0), hullArmor);
      genBase.position.set(0, 0, 3.2);
      genPivot.add(genBase);

      const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.2, 12), hull);
      coil.rotation.x = Math.PI / 2;
      coil.position.set(0, 0, 3.7);
      genPivot.add(coil);

      // Anéis de contenção magnética
      for (let r = 0; r < 3; r++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.045, 6, 16), goldLed);
        ring.position.set(0, 0, 3.3 + r * 0.35);
        genPivot.add(ring);
      }

      // Bulbo de descarga de aura
      const discharge = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), ledMat);
      discharge.position.set(0, 0, 4.4);
      genPivot.add(discharge);

      this.body.add(genPivot);
    }

    // 6 Placas Mecânicas Blindadas e Anguladas (Carapaça Externa)
    for (let i = 0; i < 6; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (i / 6) * Math.PI * 2;

      // Placa central de blindagem pesada
      const plate = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.0, 0.65), hull);
      plate.position.z = 3.9;

      // Asas anguladas laterais da placa
      for (const side of [-1, 1]) {
        const wingPlate = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.7, 0.45), hullArmor);
        wingPlate.position.set(side * 1.85, 0, -0.15);
        wingPlate.rotation.y = side * 0.35; // Ângulo agressivo chanfrado
        plate.add(wingPlate);

        // Conduítes verticais nas asas
        const wingLed = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 0.12), goldLed);
        wingLed.position.set(0, 0, 0.25);
        wingPlate.add(wingLed);

        // Espinho secundário lateral
        const sideSpike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 5), hull);
        sideSpike.rotation.x = Math.PI / 2;
        sideSpike.rotation.y = side * 0.2;
        sideSpike.position.set(side * 1.6, 0, 0.7);
        plate.add(sideSpike);
      }

      // Conduítes de energia horizontais superior e inferior
      const ledTop = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.14), ledMat);
      ledTop.position.set(0, 0.95, 0.35);
      plate.add(ledTop);

      const ledBtm = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.14), ledMat);
      ledBtm.position.set(0, -0.95, 0.35);
      plate.add(ledBtm);

      // Conduíte vertical central
      const ledMid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.6, 0.14), goldLed);
      ledMid.position.set(0, 0, 0.36);
      plate.add(ledMid);

      // Espinho colossal central
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.8, 6), hull);
      spike.rotation.x = Math.PI / 2;
      spike.position.set(0, 0, 1.15);
      plate.add(spike);

      // Braço mecânico de suporte hidráulico na parte traseira
      const armHydraulic = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 8), hullArmor);
      armHydraulic.rotation.x = Math.PI / 2;
      armHydraulic.position.set(0, 0, -0.7);
      plate.add(armHydraulic);

      pivot.add(plate);
      this.body.add(pivot);
      this.platePivots.push(pivot);
      this.plates.push(plate);
    }

    // Arranjo Ocular Predatório Agressivo (6 Olhos Cúbicos/Esféricos Crystalline)
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff1525).multiplyScalar(4.5) });
    const eyePos = [
      [-1.3, 0.7, 2.45, 0.3], [1.3, 0.7, 2.45, 0.3],
      [-0.65, 0.05, 2.7, 0.38], [0.65, 0.05, 2.7, 0.38],
      [-0.35, -0.65, 2.55, 0.28], [0.35, -0.65, 2.55, 0.28],
    ];
    for (const [ex, ey, ez, es] of eyePos) {
      const eyeSocket = new THREE.Mesh(new THREE.TorusGeometry(es * 1.1, es * 0.25, 6, 14), hullArmor);
      eyeSocket.position.set(ex, ey, ez);
      this.eyes.add(eyeSocket);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(es, 10, 8), eyeMat);
      eye.position.set(ex, ey, ez + 0.05);
      eye.scale.set(1, 0.65, 0.75);
      this.eyes.add(eye);
    }
    this.body.add(this.eyes);
    this.group.add(this.body);

    // 3 Anéis Concêntricos Gigantescos de Distorção Gravitacional
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x1a0a28,
      emissive: 0xff25b0,
      emissiveIntensity: 1.6,
      metalness: 0.92,
      roughness: 0.25,
    });
    const nodeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc040).multiplyScalar(3.5) });
    const ringDefs = [
      { r: 5.6, tube: 0.32, tx: 0.5, tz: 0.1, nodes: 8, nodeScale: 0.55 },
      { r: 7.4, tube: 0.26, tx: -0.7, tz: 0.6, nodes: 12, nodeScale: 0.48 },
      { r: 9.2, tube: 0.22, tx: 0.25, tz: -0.9, nodes: 16, nodeScale: 0.42 },
    ];
    for (const d of ringDefs) {
      const pivot = new THREE.Group();
      pivot.rotation.set(d.tx, 0, d.tz);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(d.r, d.tube, 10, 80), ringMat);
      ring.rotation.x = Math.PI / 2;
      pivot.add(ring);

      // Palhetas / Nós de foco gravitacional
      for (let i = 0; i < d.nodes; i++) {
        const a = (i / d.nodes) * Math.PI * 2;
        const node = new THREE.Mesh(new THREE.OctahedronGeometry(d.nodeScale, 0), nodeMat);
        node.scale.set(1, 1.6, 1);
        node.position.set(Math.cos(a) * d.r, 0, Math.sin(a) * d.r);
        node.rotation.y = a;
        pivot.add(node);

        // Aleta de deflexão de campo
        const vane = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.6), hullArmor);
        vane.position.set(Math.cos(a) * (d.r + 0.4), 0, Math.sin(a) * (d.r + 0.4));
        vane.rotation.y = a + Math.PI / 2;
        pivot.add(vane);
      }
      this.group.add(pivot);
      this.ringPivots.push(pivot);
    }

    this.light = new THREE.PointLight(0xff30c0, 260, 50, 1.6);
    this.group.add(this.light);
    const glowGeo = new THREE.RingGeometry(6, 10.5, 64);
    glowGeo.rotateX(-Math.PI / 2);
    this.glowRing = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff30c0).multiplyScalar(1.5), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    scene.add(this.glowRing);

    this.group.position.set(x, this.y, z);
    scene.add(this.group);
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group);
    scene.remove(this.glowRing);
    for (const b of this.beams) b.release();
    this.beams.length = 0;
  }

  get hpFrac() { return this.hp / this.maxHp; }

  applyBleed(dps: number, dur: number) {
    this.bleed = Math.max(this.bleed, dur);
    this.bleedDps = Math.max(this.bleedDps, dps);
  }

  applyCurse(dur: number, mult = 1.25) {
    this.curse = Math.max(this.curse, dur);
    this.curseMult = Math.max(this.curseMult, mult);
  }

  hit(amount: number, crit: boolean, game: Game, kind: 'normal' | 'love' = 'normal'): boolean {
    if (!this.hittable || this.state === 'dying' || this.state === 'dead') return false;
    if (this.curse > 0) amount *= this.curseMult;

    // Redução inata de dano do Chefe (25% armadura estelar)
    amount *= 0.75;

    // Limitador de pico de dano por acerto (máx 2.2% do HP total)
    const maxSingleHit = this.maxHp * 0.022;
    if (amount > maxSingleHit) {
      amount = maxSingleHit + (amount - maxSingleHit) * 0.20;
    }

    // Absorção de Escudo de Fase do Chefe (+60% quebra com Projéteis de Antimatéria)
    if (this.shield > 0) {
      const antimatter = (game.player?.upgrades?.antimatter_rounds ?? 0) > 0;
      const shieldMult = antimatter ? 1.6 : 1.0;
      const sDmg = amount * shieldMult;
      const abs = Math.min(this.shield, sDmg);
      this.shield -= abs;
      amount = Math.max(0, amount - (abs / shieldMult));
      game.particles.burst(this.x + rand(-1.5, 1.5), this.y + 1.8, this.z + rand(-1.5, 1.5), 6, 0x4d8dff, { speed: 5, life: 0.35, size: 0.3, gravity: 0 });
      if (amount <= 0) {
        this.flash = 0.5;
        return false;
      }
    }

    this.hp -= amount;
    this.flash = 1;
    game.numbers.spawn(this.x + rand(-2, 2), this.y + 2, this.z, amount, kind === 'love' ? 'love' : (crit ? 'crit' : 'normal'));
    if (this.hp <= 0) {
      this.hp = 0;
      this.shield = 0;
      this.startDying(game);
      return true;
    }
    const newPhase = this.hpFrac > 0.6 ? 1 : this.hpFrac > 0.3 ? 2 : 3;
    if (newPhase > this.phase) this.startTransition(newPhase, game);
    return false;
  }

  private startTransition(phase: number, game: Game) {
    this.phase = phase;
    this.state = 'transition';
    this.transT = 0;
    this.hittable = false;
    this.shield = this.maxShield * (phase === 2 ? 0.75 : 1.0);
    game.particles.ring(this.x, this.y + 1, this.z, 40, phase === 2 ? 0xffc040 : 0xff2050, 4.5, 10, 0.7, 0.4);
    this.endPattern();
    game.projectiles.clearAll(true);
    game.audio.bossPhase();
    game.camera.shake(0.7);
    game.chroma(1.2);
    game.shockwaves.spawn(this.x, this.z, 0xff30c0, { endR: 40, duration: 1.2, thick: true, intensity: 3 });
    game.enemies.pushAll(this.x, this.z, 30, 25, 1.5);
    if (phase === 2) {
      for (const t of ['tank', 'shielder'] as EnemyType[]) {
        const a = Math.random() * Math.PI * 2;
        const x = clamp(this.x + Math.cos(a) * 10, -ARENA_RADIUS + 4, ARENA_RADIUS - 4);
        const z = clamp(this.z + Math.sin(a) * 10, -ARENA_RADIUS + 4, ARENA_RADIUS - 4);
        game.enemies.rifts.push({ x, z, t: 1.0, type: t, tele: game.telegraphs.ring(x, z, 2.8, 1.05, 0xffc040) });
      }
    } else if (phase === 3) {
      for (const t of ['kamikaze', 'sniper', 'kamikaze'] as EnemyType[]) {
        const a = Math.random() * Math.PI * 2;
        const x = clamp(this.x + Math.cos(a) * 12, -ARENA_RADIUS + 4, ARENA_RADIUS - 4);
        const z = clamp(this.z + Math.sin(a) * 12, -ARENA_RADIUS + 4, ARENA_RADIUS - 4);
        game.enemies.rifts.push({ x, z, t: 0.8, type: t, tele: game.telegraphs.ring(x, z, 2.5, 0.85, 0xff2050) });
      }
    }
    const taunt = phase === 2
      ? '"Carlinhos e Macedo alimentam meu motor estelar! É tarde demais!"'
      : '"SOBRECARGA DE AURA! VOU EXPLODIR ESTE SISTEMA SOLAR!"';
    game.notice(phase === 2 ? 'NÚCLEO EXPOSTO' : 'FÚRIA TOTAL', taunt, phase === 2 ? '#ffc040' : '#ff2050');
    game.audio.bossTaunt();
  }

  private startDying(game: Game) {
    this.state = 'dying';
    this.dyingT = 0;
    this.hittable = false;
    this.endPattern();
    this.rings.length = 0;
    game.projectiles.clearAll(true);
    game.audio.bossRoar();
    game.slowTime(0.25, 1.2);
    game.notice('COLAPSO ESTELAR', 'O Farmador de Aura está caindo!', '#ffffff');
  }

  private endPattern() {
    this.pattern = null;
    for (const b of this.beams) b.release();
    this.beams.length = 0;
  }

  // -------------------------------------------------------------------------
  update(dt: number, game: Game) {
    this.t += dt;
    const pl = game.player;
    this.coreMat.uniforms.uTime.value = this.t;
    this.flash = Math.max(0, this.flash - dt * 5);
    this.cageMat.color.setHex(0xffc040).multiplyScalar(2 + this.flash * 4);
    this.light.intensity = 260 + this.flash * 400 + Math.sin(this.t * 4) * 50 + this.rage * 160;

    // Efeitos de sangramento e maldição esotérica
    if (this.bleed > 0 && this.hittable) {
      this.bleed -= dt;
      this.bleedTick -= dt;
      if (this.bleedTick <= 0) {
        this.bleedTick = 0.25;
        const tick = this.bleedDps * 0.25;
        game.recordDamage(tick, 'bleeding');
        this.hit(tick, true, game);
        game.particles.burst(this.x, this.y + 1.2, this.z, 6, 0xdc143c, { speed: 4, life: 0.35, size: 0.3, gravity: 6 });
      }
      if (this.bleed <= 0) this.bleedDps = 0;
    }

    if (this.curse > 0) {
      this.curse -= dt;
      if (Math.random() < 0.25) {
        game.particles.emit(this.x + rand(-2.5, 2.5), this.y + 1.8, this.z + rand(-2.5, 2.5), 0, 1.8, 0, 0.45, 0.35, 0.75, 0.36, 1, 0, 0, 0, 1);
      }
      if (this.curse <= 0) this.curseMult = 1;
    }

    // animação contínua
    const spin = 1 + this.rage * 1.6 + (this.pattern === 'spiral' ? 2.5 : 0);
    this.ringPivots[0].rotation.y += dt * 0.7 * spin;
    this.ringPivots[1].rotation.x += dt * 0.5 * spin;
    this.ringPivots[1].rotation.y -= dt * 0.35 * spin;
    this.ringPivots[2].rotation.z += dt * 0.4 * spin;
    this.ringPivots[2].rotation.y += dt * 0.25 * spin;
    this.cage.rotation.y -= dt * 0.4;
    this.cage.rotation.x += dt * 0.2;
    const targetOpen = this.phase >= 2 ? 1 : 0;
    this.open += (targetOpen - this.open) * Math.min(1, dt * 1.5);
    const targetRage = this.phase >= 3 ? 1 : 0;
    this.rage += (targetRage - this.rage) * Math.min(1, dt * 1.2);
    this.coreMat.uniforms.uRage.value = this.rage;
    for (let i = 0; i < this.plates.length; i++) {
      const p = this.plates[i];
      p.position.z = 3.9 + this.open * 3.2;
      p.rotation.x = -this.open * 0.9;
      this.platePivots[i].rotation.y = (i / 6) * Math.PI * 2 + this.rage * this.t * 1.5;
    }
    const coreScale = 1 + this.open * 0.25 + this.rage * 0.2 + Math.sin(this.t * 3) * 0.04 + this.flash * 0.08;
    this.core.scale.setScalar(coreScale);
    const yaw = Math.atan2(pl.x - this.x, pl.z - this.z);
    let dy = yaw - this.body.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.body.rotation.y += dy * Math.min(1, dt * 2.5);
    this.glowRing.position.set(this.x, 0.12, this.z);
    this.glowRing.rotation.y += dt * 0.5;
    (this.glowRing.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(this.t * 3) * 0.08 + this.rage * 0.15;

    switch (this.state) {
      case 'enter': {
        this.y += (3.2 - this.y) * Math.min(1, dt * 1.4);
        if (this.y < 4.2) {
          this.y = 3.2;
          this.state = 'fight';
          this.hittable = true;
          this.cd = 1.5;
          game.camera.shake(1.0);
          game.world.ripple(this.x, this.z, 3);
          game.shockwaves.spawn(this.x, this.z, 0xff30c0, { endR: 30, duration: 1, thick: true });
          game.audio.explosion(2);
          game.notice('O FARMADOR DE AURA', '"Você acha que sua aura chega aos meus pés, mortal?"', '#ff30c0');
          game.audio.bossTaunt();
        }
        break;
      }
      case 'transition': {
        this.transT += dt;
        if (Math.random() < 0.8) game.particles.burst(this.x + rand(-4, 4), this.y + rand(-2, 2), this.z + rand(-4, 4), 3, this.phase === 3 ? 0xff2050 : 0xffc040, { speed: 4, life: 0.6, size: 0.4, gravity: -4 });
        if (this.transT > 1.8) {
          this.state = 'fight';
          this.hittable = true;
          this.cd = 0.8;
          this.pIdx = 0;
        }
        break;
      }
      case 'fight': {
        this.fight(dt, game);
        break;
      }
      case 'dying': {
        this.dying(dt, game);
        break;
      }
      case 'dead':
        break;
    }

    // anéis de dano (ondas de choque)
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += r.speed * dt;
      if (r.r > r.maxR) { this.rings.splice(i, 1); continue; }
      if (!r.hit && pl.alive && !pl.invulnerable) {
        const d = Math.hypot(pl.x - r.x, pl.z - r.z);
        if (Math.abs(d - r.r) < 1.3) {
          r.hit = true;
          game.damagePlayer(26 * this.dmgMul, r.x, r.z);
          pl.impulse((pl.x - r.x) / (d || 1) * 24, (pl.z - r.z) / (d || 1) * 24);
        }
      }
    }

    this.group.position.set(this.x, this.y + Math.sin(this.t * 1.5) * 0.3, this.z);
  }

  private fight(dt: number, game: Game) {
    const pl = game.player;
    const dx = pl.x - this.x, dz = pl.z - this.z;
    const d = Math.hypot(dx, dz) || 0.001;
    this.contactCd -= dt;

    // movimento
    if (this.pattern !== 'teleport' && this.pattern !== 'sweep') {
      const desired = this.phase === 3 ? 14 : 17;
      const speed = this.phase === 1 ? 3.4 : this.phase === 2 ? 4.4 : 3.0;
      let mx = 0, mz = 0;
      if (d > desired + 3) { mx = dx / d; mz = dz / d; }
      else if (d < desired - 4) { mx = -dx / d; mz = -dz / d; }
      else { mx = -dz / d * 0.5; mz = dx / d * 0.5; }
      this.x += mx * speed * dt;
      this.z += mz * speed * dt;
      const rr = Math.hypot(this.x, this.z);
      const lim = ARENA_RADIUS - 12;
      if (rr > lim) { this.x *= lim / rr; this.z *= lim / rr; }
    }

    // contato
    if (d < this.radius + pl.radius && this.contactCd <= 0 && !pl.invulnerable) {
      game.damagePlayer(32 * this.dmgMul, this.x, this.z);
      pl.impulse(dx / d * 30, dz / d * 30);
      this.contactCd = 0.8;
    }

    if (this.pattern === null) {
      this.cd -= dt;
      if (this.cd <= 0) {
        const list = PATTERNS[this.phase];
        this.pattern = list[this.pIdx % list.length];
        this.pIdx++;
        this.pT = 0;
        this.lastVolley = -1;
        this.teleDone = 0;
        this.beginPattern(game);
      }
      return;
    }

    const prev = this.pT;
    this.pT += dt;
    const crossed = (t: number) => prev < t && this.pT >= t;
    const every = (interval: number, from = 0, to = Infinity) => {
      if (this.pT < from || this.pT > to) return false;
      const k = Math.floor((this.pT - from) / interval);
      if (k !== this.lastVolley) { this.lastVolley = k; return true; }
      return false;
    };
    const aim = Math.atan2(dx, dz);

    switch (this.pattern) {
      case 'shock': {
        for (const st of [0.3, 1.2, 2.1]) {
          if (crossed(st - 0.3)) game.telegraphs.ring(this.x, this.z, 9, 0.35, 0xff30c0);
          if (crossed(st)) {
            this.rings.push({ x: this.x, z: this.z, r: 3, speed: 23, maxR: 55, hit: false });
            game.shockwaves.spawn(this.x, this.z, 0xff30c0, { startR: 3, endR: 55, duration: 52 / 23, intensity: 3.5, y: 0.5 });
            game.audio.shockwave();
            game.camera.shake(0.3);
            game.world.ripple(this.x, this.z, 2);
          }
        }
        break;
      }
      case 'cone': {
        if (every(0.38, 0.15)) {
          const k = this.lastVolley;
          if (k % 2 === 0) {
            for (let i = -3; i <= 3; i++) this.fire(game, aim + i * 0.18, 16, 16, 0xff30c0, 0.36);
          } else {
            for (let i = -1; i <= 1; i++) this.fire(game, aim + i * 0.08, 26, 18, 0xffc040, 0.32);
          }
          game.audio.enemyShot('boss');
        }
        break;
      }
      case 'summon': {
        if (crossed(0.1)) {
          const types: EnemyType[] = this.phase === 3
            ? ['kamikaze', 'sniper', 'tank', 'shooter', 'kamikaze', 'shotgunner']
            : this.phase === 2
            ? ['shooter', 'runner', 'kamikaze', 'shotgunner', 'runner', 'tank']
            : ['normal', 'runner', 'shooter', 'normal', 'kamikaze', 'runner'];
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + this.t;
            const x = clamp(this.x + Math.cos(a) * 9, -ARENA_RADIUS + 4, ARENA_RADIUS - 4);
            const z = clamp(this.z + Math.sin(a) * 9, -ARENA_RADIUS + 4, ARENA_RADIUS - 4);
            game.enemies.rifts.push({ x, z, t: 1.0, type: types[i], tele: game.telegraphs.ring(x, z, 2.2, 1.05, 0xa020ff) });
          }
          game.audio.warning();
        }
        break;
      }
      case 'sweep': {
        if (crossed(0.0)) {
          this.beamAngle = aim + 0.9 * this.beamDir;
          this.beamDir = -this.beamDir;
          game.telegraphs.line(this.x, this.z, this.beamAngle, 65, 2.2, 1.0, 0xffc040);
          game.telegraphs.line(this.x, this.z, this.beamAngle + Math.PI, 65, 2.2, 1.0, 0xffc040);
          game.audio.beamStart();
        }
        if (crossed(1.0)) {
          this.beams.push(game.beams.acquire(0xffc040), game.beams.acquire(0xff30c0));
          game.camera.shake(0.35);
        }
        if (this.pT >= 1.0 && this.beams.length) {
          this.beamAngle += -this.beamDir * 0.65 * dt;
          const w = 2.2 + Math.sin(this.t * 25) * 0.2;
          this.beams[0].set(this.x, this.z, this.beamAngle, 65, w);
          this.beams[1].set(this.x, this.z, this.beamAngle + Math.PI, 65, w);
          for (const ang of [this.beamAngle, this.beamAngle + Math.PI]) {
            const fx = Math.sin(ang), fz = Math.cos(ang);
            const px = pl.x - this.x, pz = pl.z - this.z;
            const along = px * fx + pz * fz;
            const perp = Math.abs(px * fz - pz * fx);
            if (along > 0 && along < 65 && perp < 1.6 + pl.radius) game.damagePlayer(25 * this.dmgMul, this.x, this.z);
            if (Math.random() < 0.6) {
              const tt = Math.random() * 60;
              game.particles.emit(this.x + fx * tt, 1, this.z + fz * tt, rand(-2, 2), rand(1, 4), rand(-2, 2), 0.35, 0.3, 1, 0.7, 0.2, 0, 0, 0, 1);
            }
          }
        }
        break;
      }
      case 'mortar': {
        if (every(0.14, 0.1, 2.2)) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * 9;
          const tx = clamp(pl.x + Math.cos(a) * r, -ARENA_RADIUS + 2, ARENA_RADIUS - 2);
          const tz = clamp(pl.z + Math.sin(a) * r, -ARENA_RADIUS + 2, ARENA_RADIUS - 2);
          const tele = game.telegraphs.circle(tx, tz, 3.6, 1.2, 0xffb020);
          game.projectiles.spawnBomb(this.x, this.z, tx, tz, 1.2, 26 * this.dmgMul, 3.6, 0xffb020, tele);
          if (this.lastVolley % 3 === 0) game.audio.enemyShot('mortar');
        }
        break;
      }
      case 'spiral': {
        this.spiral += dt * 3.4;
        if (every(0.05, 0.1)) {
          this.fire(game, this.spiral, 14, 14, 0xff30c0, 0.34, 6);
          this.fire(game, this.spiral + Math.PI, 14, 14, 0xff30c0, 0.34, 6);
          this.fire(game, -this.spiral * 0.8 + Math.PI / 2, 11, 14, 0xffc040, 0.34, 6);
          this.fire(game, -this.spiral * 0.8 + Math.PI * 1.5, 11, 14, 0xffc040, 0.34, 6);
          if (this.lastVolley % 4 === 0) game.audio.enemyShot('boss');
        }
        break;
      }
      case 'teleport': {
        if (this.pT < 0.45 && Math.random() < 0.9) game.particles.implode(this.x, this.y, this.z, 6, 0xff30c0, 12, 0.4);
        if (crossed(0.45)) {
          this.group.visible = false;
          this.hittable = false;
          game.particles.burst(this.x, this.y, this.z, 80, 0xff30c0, { speed: 14, life: 0.7, size: 0.45, gravity: 0 });
          game.audio.teleport();
        }
        if (crossed(0.8)) {
          const a = Math.random() * Math.PI * 2;
          let nx = pl.x + Math.cos(a) * 13, nz = pl.z + Math.sin(a) * 13;
          const rr = Math.hypot(nx, nz);
          const lim = ARENA_RADIUS - 12;
          if (rr > lim) { nx *= lim / rr; nz *= lim / rr; }
          this.x = nx; this.z = nz;
          this.group.visible = true;
          this.hittable = true;
          game.shockwaves.spawn(this.x, this.z, 0xffc040, { endR: 14, duration: 0.6, thick: true, intensity: 3 });
          game.lights.flash(this.x, 4, this.z, 0xff30c0, 1500, 0.5, 45);
          game.camera.shake(0.55);
          game.world.ripple(this.x, this.z, 2.5);
          game.particles.burst(this.x, this.y, this.z, 120, 0xffc040, { speed: 16, life: 0.9, size: 0.45 });
          const ddx = pl.x - this.x, ddz = pl.z - this.z;
          const dd = Math.hypot(ddx, ddz) || 1;
          if (dd < 10 && !pl.invulnerable) {
            game.damagePlayer(22 * this.dmgMul, this.x, this.z);
          }
          if (dd < 14) pl.impulse(ddx / dd * 32, ddz / dd * 32);
          game.enemies.pushAll(this.x, this.z, 14, 20, 0.5);
        }
        if (crossed(1.15)) {
          for (let i = 0; i < 30; i++) this.fire(game, (i / 30) * Math.PI * 2 + this.spiral, 13, 14, 0xff30c0, 0.34, 6);
          game.audio.enemyShot('shotgun');
        }
        break;
      }
      case 'ring': {
        for (const st of [0.2, 0.7]) {
          if (crossed(st)) {
            const n = 34;
            const off = st > 0.5 ? Math.PI / n : 0;
            for (let i = 0; i < n; i++) this.fire(game, (i / n) * Math.PI * 2 + off, 12.5, 14, st > 0.5 ? 0xffc040 : 0xff30c0, 0.34, 6);
            game.audio.enemyShot('shotgun');
            game.camera.shake(0.2);
          }
        }
        break;
      }
    }

    if (this.pT >= DURATION[this.pattern]) {
      this.endPattern();
      this.cd = this.phase === 1 ? 1.2 : this.phase === 2 ? 0.8 : 0.4;
    }
  }

  private beginPattern(game: Game) {
    if (this.pattern === 'shock' || this.pattern === 'spiral') game.audio.bossRoar();
    if (this.pattern === 'summon' || this.pattern === 'mortar') game.notice(this.pattern === 'summon' ? 'INVOCAÇÃO' : 'CHUVA DE MORTEIROS', undefined, '#ffc040');
  }

  private fire(game: Game, angle: number, speed: number, dmg: number, color: number, radius = 0.34, life = 5) {
    game.projectiles.spawn({
      kind: 'ebullet', enemy: true, x: this.x + Math.sin(angle) * 3, z: this.z + Math.cos(angle) * 3, y: 1.2,
      vx: Math.sin(angle) * speed, vz: Math.cos(angle) * speed, dmg: dmg * this.dmgMul, life, radius, color, scale: 1.25,
    });
  }

  private dying(dt: number, game: Game) {
    this.dyingT += dt;
    const t = this.dyingT;
    game.camera.trauma = Math.max(game.camera.trauma, 0.45 + t * 0.15);
    const k = clamp(t / 2.4, 0, 1);
    for (const p of this.ringPivots) {
      p.scale.setScalar(Math.max(0.01, 1 - k));
      p.rotation.y += dt * 6 * k;
    }
    this.core.scale.setScalar(1 + k * 0.9 + Math.sin(t * 30) * 0.08 * k);
    this.light.intensity = 260 + k * 1400;
    this.coreMat.uniforms.uRage.value = 1 + k;
    if (Math.random() < 0.95) game.particles.implode(this.x, this.y, this.z, 8, Math.random() < 0.5 ? 0xffc040 : 0xff30c0, 22, 0.55);
    if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) {
      game.vfx.explosion(this.x + rand(-5, 5), this.y + rand(-2, 2), this.z + rand(-5, 5), 0xffa040, 2.5, 0.6);
      game.particles.burst(this.x + rand(-5, 5), this.y + rand(-3, 3), this.z + rand(-5, 5), 30, 0xffffff, { speed: 8, life: 0.6, size: 0.4, gravity: 0 });
      game.audio.explosion(0.8);
    }
    if (t >= 2.6 && this.state === 'dying' && this.teleDone === 0) {
      this.teleDone = 1;
      game.vfx.explosion(this.x, this.y, this.z, 0xffb030, 13, 4);
      game.blastDistortion(this.x, this.z, 1.5);
      this.group.visible = false;
      this.glowRing.visible = false;
      game.flash(1.4, 0xffffff);
      game.chroma(2.5);
      game.camera.shake(1.2);
      game.slowTime(0.35, 1.0);
      game.particles.burst(this.x, this.y, this.z, 500, 0xffc040, { speed: 26, life: 2.0, size: 0.6, gravity: 8, drag: 1.2 });
      game.particles.burst(this.x, this.y, this.z, 300, 0xff30c0, { speed: 18, life: 1.8, size: 0.5, gravity: 6 });
      game.particles.burst(this.x, this.y, this.z, 200, 0xffffff, { speed: 30, life: 1.2, size: 0.4, gravity: 0 });
      for (let i = 0; i < 4; i++) game.shockwaves.spawn(this.x, this.z, i % 2 ? 0xffc040 : 0xff30c0, { startR: 2, endR: 40 + i * 18, duration: 1.4 + i * 0.3, thick: i < 2, intensity: 3.5 });
      game.debris.spawn(this.x, this.y, this.z, 0xff30c0, 40, 16, 2.5);
      game.lights.flash(this.x, 6, this.z, 0xffffff, 6000, 1.5, 90);
      game.world.ripple(this.x, this.z, 4);
      game.audio.explosion(3);
      game.bossLoot(this.x, this.z);
      game.audio.capsuleRescue();
      game.notice('CÁPSULAS DE RESGATE EJETADAS!', 'Carlinhos e Macedo foram ejetados com segurança!', '#00ffff');
      game.particles.burst(this.x - 4, this.y + 3, this.z - 2, 50, 0x00ffff, { speed: 10, life: 1.6, size: 0.5 });
      game.particles.burst(this.x + 4, this.y + 3, this.z + 2, 50, 0x00ff88, { speed: 10, life: 1.6, size: 0.5 });
    }
    if (t >= 3.4) {
      this.state = 'dead';
      game.onBossDefeated();
    }
  }
}
