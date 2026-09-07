import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  ARENA_RADIUS, BOSS_WAVE, ENEMY_DEFS, MAX_ENEMIES, RARITY_MULT, UPGRADES, WAVE_DURATION, clamp, damp, heroById, rand, xpForLevel,
  SECONDARY_WEAPONS, PRIMARY_EVOLUTIONS, type ActiveWeaponState, type SecondaryWeaponId,
  type EnemyType, type GamePhase, type HeroId, type Notice, type Rarity, type RunResult, type Snapshot, type UpgradeChoice,
  type GameMode, type PactId, PACTS, ASCENSION_PERKS, type AscensionPerkDef,
} from './config';
import { getMetaBonuses, recordRun, unlockAchievement } from './save';
import { AudioEngine } from './audio';
import { FX_FRAG, FX_VERT } from './shaders';
import { CameraRig, Input, World } from './world';
import { ParticleSystem } from './particles';
import { CombatVfx } from './combatVfx';
import { DamageNumbers } from './damageNumbers';
import { TelegraphSystem } from './telegraphs';
import { BeamPool, DebrisPool, DomePool, LightPool, ShockwavePool, SlashPool } from './effects';
import { EnemyManager, type Enemy } from './enemies';
import { ProjectileSystem, type Projectile } from './projectiles';
import { PickupSystem, type PickupKind } from './pickups';
import { Player, UPGRADE_TO_SECONDARY } from './player';
import { Boss } from './boss';
import { buildShip, type ShipRig } from './ships';
import { ArenaPropManager } from './arenaProps';
import { GroundHazardSystem } from './groundHazards';
import { JuliaHeartSystem } from './juliaHearts';
import { RelicManager, ALL_RELIC_IDS, type RelicDef } from './relics';
import { ArenaEventManager, type ArenaEventType } from './arenaEvents';
import { recordMatchHistory, recordCareerRun } from './history';
import { loadSettings, onSettingsChange, updateSetting, type GameSettings, type GraphicQuality } from './settings';

const RARITY_WEIGHTS: [Rarity, number][] = [['common', 55], ['rare', 28], ['epic', 13], ['legendary', 4]];
const scratch: Enemy[] = [];

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: CameraRig;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private fxPass: ShaderPass;
  private fxaaPass: ShaderPass;
  world: World;
  input: Input;
  audio = new AudioEngine();
  particles: ParticleSystem;
  vfx: CombatVfx;
  numbers: DamageNumbers;
  telegraphs: TelegraphSystem;
  shockwaves: ShockwavePool;
  lights: LightPool;
  beams: BeamPool;
  domes: DomePool;
  slashes: SlashPool;
  debris: DebrisPool;
  enemies: EnemyManager;
  projectiles: ProjectileSystem;
  pickups: PickupSystem;
  arenaProps: ArenaPropManager;
  groundHazards: GroundHazardSystem;
  juliaHearts: JuliaHeartSystem;
  relics: RelicManager;
  arenaEvents: ArenaEventManager;
  player!: Player;
  boss: Boss | null = null;

  gameMode: GameMode = 'classic';
  pacts: PactId[] = [];
  hyperMode = false;
  bossRush = false;
  ascensionChoice: [AscensionPerkDef, AscensionPerkDef] | null = null;
  pendingAscension = false;
  penumbraLight: THREE.SpotLight | null = null;
  killsThisRun: Record<string, number> = {};
  unstableGroundTimer = 1.0;

  hasPact(pact: PactId): boolean {
    return this.pacts.includes(pact);
  }

  phase: GamePhase = 'menu';
  time = 0;
  wave = 1;
  waveTime = 0;
  kills = 0;
  elitesKilled = 0;
  coins = 0;
  shards = 0;
  endless = false;
  damageBreakdown: Record<string, number> = {};
  totalDamage = 0;
  graphicsQuality: GraphicQuality = 'high';

  checkAchievement(id: string) {
    const res = unlockAchievement(id);
    if (res.unlocked && res.achievement) {
      this.audio.achievement();
      this.notice('CONQUISTA DESBLOQUEADA!', `${res.achievement.icon} ${res.achievement.name} (+${res.achievement.rewardShards} ◆)`, '#ffd700');
    }
  }
  private bossDefeated = false;
  private bossWarning = 0;
  private timeScale = 1;
  private slowScale = 1;
  private slowT = 0;
  private chromaV = 0;
  private flashV = 0;
  private flashColor = new THREE.Color(1, 1, 1);
  private hurtV = 0;
  private screenShocks = Array.from({ length: 4 }, () => ({ position: new THREE.Vector3(), age: 1, power: 0 }));
  private shockUniforms = Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 1, 0));
  private shockProjection = new THREE.Vector3();
  private notices: Notice[] = [];
  private noticeId = 0;
  private noticeT = 0;
  pendingLevels = 0;
  private choices: UpgradeChoice[] = [];
  private upgradeLevels: Record<string, number> = {};
  private result: RunResult | null = null;
  private spawnTimer = 1;
  private hordeTimer = 8;
  private deathTimer = -1;
  private victoryTimer = -1;
  private aimWorld = new THREE.Vector3(0, 1, 10);
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1);
  private showcase: ShipRig | null = null;
  private showcaseHero: HeroId = 'big';
  private raf = 0;
  private lastT = 0;
  private fps = 60;
  private disposed = false;
  private heroId: HeroId = 'big';
  onPhaseChange: ((p: GamePhase) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    const pr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.90;
    this.scene.background = new THREE.Color(0x02010a);
    this.camera = new CameraRig(window.innerWidth / window.innerHeight);

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.composer.addPass(new RenderPass(this.scene, this.camera.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.45, 0.40, 0.85);
    this.composer.addPass(this.bloom);
    this.fxPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uChroma: { value: 0.2 },
        uVignette: { value: 0.9 },
        uGrain: { value: 0.05 },
        uFlash: { value: 0 },
        uFlashColor: { value: new THREE.Color(1, 1, 1) },
        uDesat: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uShock: { value: this.shockUniforms },
      },
      vertexShader: FX_VERT,
      fragmentShader: FX_FRAG,
    });
    this.composer.addPass(this.fxPass);
    this.composer.addPass(new OutputPass());

    this.fxaaPass = new ShaderPass(FXAAShader);
    (this.fxaaPass.uniforms['resolution'].value as THREE.Vector2).set(1 / (window.innerWidth * pr), 1 / (window.innerHeight * pr));
    this.composer.addPass(this.fxaaPass);

    this.world = new World(this.scene);
    this.input = new Input(canvas);
    this.particles = new ParticleSystem(this.scene);
    this.vfx = new CombatVfx(this.scene);
    this.numbers = new DamageNumbers(this.scene);
    this.telegraphs = new TelegraphSystem(this.scene);
    this.shockwaves = new ShockwavePool(this.scene);
    this.lights = new LightPool(this.scene, 6);
    this.beams = new BeamPool(this.scene);
    this.domes = new DomePool(this.scene);
    this.slashes = new SlashPool(this.scene);
    this.debris = new DebrisPool(this.scene);
    this.enemies = new EnemyManager(this.scene);
    this.projectiles = new ProjectileSystem(this.scene);
    this.pickups = new PickupSystem(this.scene);
    this.arenaProps = new ArenaPropManager(this.scene);
    this.groundHazards = new GroundHazardSystem(this.scene);
    this.juliaHearts = new JuliaHeartSystem(this.scene);
    this.relics = new RelicManager();
    this.arenaEvents = new ArenaEventManager(this.scene);

    this.applySettings(loadSettings());
    onSettingsChange(s => this.applySettings(s));

    this.setShowcaseHero('big');
    window.addEventListener('resize', this.onResize);
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  applySettings(s: GameSettings) {
    this.audio.setMasterVolume(s.masterVolume);
    this.audio.setMusicVolume(s.musicVolume);
    this.audio.setSfxVolume(s.sfxVolume);
    this.graphicsQuality = s.graphicsQuality;
    this.vfx.setQuality(s.graphicsQuality);
    this.numbers.mode = s.damageNumbers;
    if (this.bloom) {
      if (s.graphicsQuality === 'low') this.bloom.strength = 0.18;
      else if (s.graphicsQuality === 'medium') this.bloom.strength = 0.32;
      else if (s.graphicsQuality === 'high') this.bloom.strength = 0.45;
    }
    if (this.fxaaPass) {
      this.fxaaPass.enabled = s.graphicsQuality !== 'low';
    }
    if (this.player) {
      this.player.aimMode = s.aimMode;
    }
  }

  recordDamage(amount: number, weaponSource = 'primary') {
    this.totalDamage += amount;
    this.damageBreakdown[weaponSource] = (this.damageBreakdown[weaponSource] || 0) + amount;
  }

  private onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = this.renderer.getPixelRatio();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.camera.aspect = w / h;
    this.camera.camera.updateProjectionMatrix();
    (this.fxPass.uniforms.uResolution.value as THREE.Vector2).set(w, h);
    if (this.fxaaPass) {
      (this.fxaaPass.uniforms['resolution'].value as THREE.Vector2).set(1 / (w * pr), 1 / (h * pr));
    }
  };

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.input.dispose();
    this.audio.stopMusic();
    this.juliaHearts.dispose();
    this.vfx.dispose();
    this.groundHazards.dispose();
    this.renderer.dispose();
  }

  private setPhase(p: GamePhase) {
    if (this.phase === p) return;
    this.phase = p;
    this.onPhaseChange?.(p);
  }

  // =====================================================================
  // Fluxo de partida
  // =====================================================================
  setShowcaseHero(id: HeroId) {
    this.showcaseHero = id;
    if (this.showcase) this.scene.remove(this.showcase.group);
    this.showcase = buildShip(id);
    this.showcase.group.position.set(0, 2, 0);
    this.scene.add(this.showcase.group);
    this.world.setTheme(heroById(id).color);
  }

  start(heroId: HeroId, mode: GameMode = 'classic', pacts: PactId[] = []) {
    this.audio.init();
    this.audio.resume();
    this.heroId = heroId;
    this.gameMode = mode;
    this.pacts = [...pacts];
    this.hyperMode = mode === 'hyper';
    this.bossRush = mode === 'boss_rush';
    this.relics.reset();
    this.arenaEvents.reset();
    this.ascensionChoice = null;
    this.pendingAscension = false;
    this.clearWorld();
    if (this.showcase) { this.scene.remove(this.showcase.group); this.showcase = null; }
    const hero = heroById(heroId);
    this.player = new Player(this.scene, hero, getMetaBonuses(), this.projectiles.glyphAtlas);
    this.player.aimMode = loadSettings().aimMode;
    if (this.hyperMode) {
      this.player.hyperModeMult = 1.25;
      this.player.stats = this.player.computeStats();
    }
    if (this.hasPact('no_dampeners')) {
      this.player.noDampeners = true;
      this.player.dashMax = 3.0;
    }
    this.world.setTheme(hero.color);
    this.world.setPenumbraMode(this.hasPact('penumbra'));
    if (this.hasPact('penumbra')) {
      this.penumbraLight = new THREE.SpotLight(0xffffff, 55, 45, Math.PI / 3.5, 0.35, 1.2);
      this.penumbraLight.position.set(0, 12, 0);
      this.scene.add(this.penumbraLight);
      this.scene.add(this.penumbraLight.target);
    }
    this.arenaProps.spawnInitialProps();
    this.totalDamage = 0;
    this.damageBreakdown = {};
    this.killsThisRun = {};
    this.unstableGroundTimer = 2.0;
    this.time = 0;
    this.wave = this.bossRush ? 5 : 1;
    this.waveTime = 0;
    this.kills = 0;
    this.elitesKilled = 0;
    this.coins = 0;
    this.shards = 0;
    this.endless = false;
    this.bossDefeated = false;
    this.bossWarning = 0;
    this.pendingLevels = 0;
    this.choices = [];
    this.upgradeLevels = {};
    this.result = null;
    this.spawnTimer = 1.2;
    this.deathTimer = -1;
    this.victoryTimer = -1;
    this.timeScale = 1;
    this.slowScale = 1;
    this.slowT = 0;
    this.chromaV = 0;
    this.flashV = 0;
    this.hurtV = 0;
    this.notices = [];
    this.camera.snap(0, 0);
    this.camera.trauma = 0;
    this.camera.setZoom(1);
    this.setPhase('playing');
    if (this.bossRush) {
      this.startWave(5);
    } else {
      this.notice('ONDA 1', 'Os Farm\'auras se aproximam', '#00e5ff');
    }
    this.audio.startMusic('calm');
    this.flash(0.6, hero.color);
  }

  private clearWorld() {
    if (this.penumbraLight) {
      this.scene.remove(this.penumbraLight);
      this.scene.remove(this.penumbraLight.target);
      this.penumbraLight = null;
    }
    this.world.setPenumbraMode(false);
    if (this.arenaEvents) this.arenaEvents.reset();
    this.enemies.clear();
    this.projectiles.clearAll();
    this.juliaHearts.clear();
    this.arenaProps.clear();
    this.groundHazards.clear();
    this.pickups.clear();
    this.particles.clear();
    this.vfx.clear();
    for (const shock of this.screenShocks) { shock.age = 1; shock.power = 0; }
    this.slashes.clear();
    this.lights.clear();
    this.telegraphs.clear();
    this.shockwaves.clear();
    this.beams.clear();
    this.domes.clear();
    this.numbers.clear();
    this.debris.clear();
    if (this.boss) { this.boss.dispose(this.scene); this.boss = null; }
    if (this.player) this.player.dispose();
  }

  toMenu() {
    this.clearWorld();
    this.setShowcaseHero(this.showcaseHero);
    this.audio.startMusic('calm');
    this.setPhase('menu');
  }

  pause() { if (this.phase === 'playing') { this.setPhase('paused'); this.audio.ui(); } }
  resume() { if (this.phase === 'paused') { this.setPhase('playing'); this.audio.ui(); } }
  togglePause() { if (this.phase === 'playing') this.pause(); else if (this.phase === 'paused') this.resume(); }

  toggleAimMode() {
    const current = this.player ? this.player.aimMode : loadSettings().aimMode;
    const next = current === 'auto' ? 'manual' : 'auto';
    if (this.player) {
      this.player.aimMode = next;
      this.notice(next === 'auto' ? 'MIRA: AUTOMÁTICA' : 'MIRA: MANUAL', undefined, '#00e5ff');
    }
    updateSetting('aimMode', next);
    this.audio.ui();
  }

  continueEndless() {
    if (this.phase !== 'victory') return;
    this.endless = true;
    this.result = null;
    this.setPhase('playing');
    this.startWave(this.wave + 1);
    this.audio.startMusic('calm');
  }

  // =====================================================================
  // Loop
  // =====================================================================
  private loop = (t: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const realDt = Math.min(0.05, (t - this.lastT) / 1000 || 0.016);
    this.lastT = t;
    this.fps += (1 / Math.max(0.001, realDt) - this.fps) * 0.05;

    if (this.input.consume('KeyP') || this.input.consume('Escape')) this.togglePause();

    if (this.phase === 'menu') {
      this.updateMenu(realDt);
    } else if (this.phase === 'playing') {
      if (this.slowT > 0) {
        this.slowT -= realDt;
        this.timeScale += (this.slowScale - this.timeScale) * damp(24, realDt);
      } else {
        this.slowScale = 1;
        this.timeScale += (1 - this.timeScale) * damp(7, realDt);
      }
      this.updateGame(realDt * this.timeScale, realDt);
    } else {
      // pausado / level-up / fim: efeitos continuam suavemente
      const dt = (this.phase === 'gameover' || this.phase === 'victory') ? realDt * 0.6 : realDt * 0.15;
      this.particles.update(dt);
      this.vfx.update(dt);
      this.slashes.update(dt);
      this.beams.update(dt);
      this.shockwaves.update(dt);
      this.debris.update(dt);
      this.lights.update(dt);
      this.domes.update(dt);
      this.numbers.update(dt, this.camera.camera);
      if (this.player) this.player.ghosts.update(dt);
      this.world.update(dt, this.player ? this.player.position : this.aimWorld, 1);
      if (this.player) this.camera.update(realDt, this.player.position, 0, this.aimWorld);
    }
    this.input.endFrame();
    this.render(realDt);
  };

  private updateMenu(dt: number) {
    this.time += dt;
    if (this.showcase) {
      this.showcase.group.rotation.y += dt * 0.4;
      this.showcase.group.position.y = 2 + Math.sin(this.time * 1.5) * 0.3;
      this.showcase.animate(dt, { firing: 0, speed: 0, ultActive: false, time: this.time });
    }
    if (Math.random() < 0.4) {
      const a = Math.random() * Math.PI * 2, r = rand(5, 40);
      const c = new THREE.Color(heroById(this.showcaseHero).color);
      this.particles.emit(Math.cos(a) * r, 0.3, Math.sin(a) * r, 0, rand(0.5, 2), 0, 3, 0.3, c.r, c.g, c.b, -0.2, 0, 0, 1);
    }
    this.particles.update(dt);
    this.juliaHearts.update(dt, this);
    this.vfx.update(dt);
    this.shockwaves.update(dt);
    this.lights.update(dt);
    this.noticeT -= dt;
    if (this.noticeT <= 0 && this.notices.length > 1) { this.notices.shift(); this.noticeT = 2.2; }
    this.world.update(dt, this.aimWorld.set(0, 0, 0), 1);
    this.camera.updateOrbit(this.time);
  }

  private updateGame(dt: number, realDt: number) {
    this.time += dt;
    const pl = this.player;

    // mira: raycast no plano do chão
    this.raycaster.setFromCamera(this.input.mouse, this.camera.camera);
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, new THREE.Vector3());
    if (hit) this.aimWorld.copy(hit);

    pl.update(dt, this, this.input, this.aimWorld);
    this.projectiles.update(dt, this);
    this.arenaProps.update(dt, this);
    this.groundHazards.update(dt, this);
    this.enemies.update(dt, this);
    if (this.boss) this.boss.update(dt, this);
    this.pickups.update(dt, this);
    this.juliaHearts.update(dt, this);
    this.particles.update(dt);
    this.vfx.update(dt);
    this.numbers.update(dt, this.camera.camera);
    this.telegraphs.update(dt);
    this.shockwaves.update(dt);
    this.lights.update(dt);
    this.domes.update(dt);
    this.slashes.update(dt);
    this.beams.update(dt);
    this.debris.update(dt);
    if (this.relics) this.relics.update(dt);
    if (this.arenaEvents) this.arenaEvents.update(dt, this);
    pl.ghosts.update(dt);
    this.world.update(dt, pl.position, pl.ultActive ? 3 : 1);
    this.updateWaves(dt);
    this.camera.update(realDt, pl.position, pl.vx, this.aimWorld);

    // Spotlight Penumbra
    if (this.penumbraLight && pl.alive) {
      this.penumbraLight.position.set(pl.x, 10, pl.z);
      this.penumbraLight.target.position.set(
        pl.x + Math.sin(pl.aimAngle) * 14,
        0.5,
        pl.z + Math.cos(pl.aimAngle) * 14
      );
      this.penumbraLight.target.updateMatrixWorld();
    }

    const hpFrac = pl.alive ? pl.hp / Math.max(1, pl.stats.maxHp) : 1;
    this.audio.updateLowHealth(Boolean(pl.alive && hpFrac <= 0.25), realDt);

    this.chromaV = Math.max(0, this.chromaV - realDt * 2.2);
    this.flashV = Math.max(0, this.flashV - realDt * 1.8);
    this.hurtV = Math.max(0, this.hurtV - realDt * 1.5);
    this.bossWarning = Math.max(0, this.bossWarning - realDt);
    this.noticeT -= realDt;
    if (this.noticeT <= 0 && this.notices.length > 1) { this.notices.shift(); this.noticeT = 2.2; }

    if (this.deathTimer > 0) {
      this.deathTimer -= realDt;
      if (this.deathTimer <= 0) this.finishRun(false);
      return;
    }
    if (this.victoryTimer > 0) {
      this.victoryTimer -= realDt;
      if (this.victoryTimer <= 0) this.finishRun(true);
      return;
    }
    if (pl.level >= 10 && !pl.ascensionPerk && !this.pendingAscension && this.phase === 'playing') {
      this.pendingAscension = true;
    }
    if (this.pendingAscension && pl.alive && this.phase === 'playing') {
      this.pendingAscension = false;
      this.ascensionChoice = ASCENSION_PERKS[this.heroId];
      this.setPhase('ascension');
      this.audio.ascension();
      return;
    }
    if (this.pendingLevels > 0 && pl.alive) this.openLevelUp();
  }

  private render(realDt: number) {
    const u = this.fxPass.uniforms;
    for (let i = 0; i < this.screenShocks.length; i++) {
      const s = this.screenShocks[i];
      s.age = Math.min(1, s.age + realDt / 0.65);
      this.shockProjection.copy(s.position).project(this.camera.camera);
      const visible = s.age < 1 && Math.abs(this.shockProjection.z) <= 1 && this.graphicsQuality !== 'low';
      this.shockUniforms[i].set(this.shockProjection.x * 0.5 + 0.5, this.shockProjection.y * 0.5 + 0.5, s.age, visible ? s.power : 0);
    }
    u.uTime.value += realDt;
    u.uChroma.value = 0.18 + this.chromaV * 1.6 + (this.player?.dashing ? 0.8 : 0);
    u.uFlash.value = this.flashV;
    (u.uFlashColor.value as THREE.Color).copy(this.flashColor);
    u.uDesat.value = this.phase === 'paused' || this.phase === 'levelup' ? 0.4 : this.phase === 'gameover' ? 0.6 : 0;
    u.uVignette.value = 0.85 + this.hurtV * 0.7;
    u.uGrain.value = 0.045;
    const qualityMult = this.graphicsQuality === 'low' ? 0.40 : this.graphicsQuality === 'medium' ? 0.71 : 1.0;
    this.bloom.strength = (0.45 + this.flashV * 0.35 + (this.phase === 'menu' ? 0.08 : 0)) * qualityMult;
    this.composer.render(realDt);
  }

  // =====================================================================
  // Ondas
  // =====================================================================
  private updateWaves(dt: number) {
    if (this.boss && this.boss.state !== 'dead') return;
    if (this.victoryTimer > 0 || this.deathTimer > 0) return;
    this.waveTime += dt;
    const waveDur = this.bossRush ? 22 : (this.hyperMode ? WAVE_DURATION * 0.8 : WAVE_DURATION);
    if (this.bossRush && this.waveTime > 2.0 && this.waveTime < waveDur - 2.5) {
      const hasLivingMiniboss = this.enemies.list.some(e => e.type === 'miniboss' && !e.dead);
      if (!hasLivingMiniboss) {
        this.waveTime = waveDur - 2.5;
      }
    }
    if (this.waveTime >= waveDur) {
      if (this.bossRush) {
        if (this.wave === 5) this.startWave(10);
        else if (this.wave === 10) this.startWave(15);
        else if (this.wave === 15) this.startWave(20);
        else this.startWave(this.wave + 5);
      } else {
        this.startWave(this.wave + 1);
      }
    }

    // Pacto Solo Instável: tremores e fissuras periódicas (independente de framerate)
    if (this.hasPact('unstable_ground')) {
      this.unstableGroundTimer -= dt;
      if (this.unstableGroundTimer <= 0) {
        this.unstableGroundTimer = rand(2.2, 3.6);
        const rx = rand(-ARENA_RADIUS + 5, ARENA_RADIUS - 5);
        const rz = rand(-ARENA_RADIUS + 5, ARENA_RADIUS - 5);
        this.groundHazards.spawn({
          x: rx, z: rz,
          radius: 3.5,
          duration: 4.0,
          dps: 18,
          type: 'fire',
          color: 0xff3b30,
          source: 'unstable_ground',
        });
        this.shockwaves.spawn(rx, rz, 0xff3b30, { startR: 0.5, endR: 3.5, duration: 0.35 });
      }
    }

    // Cadência e densidade regular de monstros
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const w = this.wave;
      const speedScale = (this.hyperMode ? 0.75 : 1.0) * (this.hasPact('ferocious_horde') ? 0.8 : 1.0);
      this.spawnTimer = Math.max(0.12, (0.75 - w * 0.032) * speedScale);
      const count = (2 + Math.floor(w / 1.8)) * (this.hasPact('ferocious_horde') ? 2 : 1);
      for (let i = 0; i < count; i++) if (this.enemies.count < MAX_ENEMIES) this.spawnEnemy();
    }

    // Surto periódico de horda (rushes agressivos)
    this.hordeTimer -= dt;
    if (this.hordeTimer <= 0) {
      this.hordeTimer = rand(9, 13) * (this.hasPact('ferocious_horde') ? 0.75 : 1.0);
      const w = this.wave;
      const hordeCount = Math.min(34, (8 + Math.floor(w * 1.1)) * (this.hasPact('ferocious_horde') ? 1.4 : 1.0));
      const pool: EnemyType[] = w >= 12
        ? ['runner', 'kamikaze', 'orbiter', 'shooter', 'shotgunner', 'sniper', 'trapper']
        : w >= 8
        ? ['runner', 'kamikaze', 'orbiter', 'shooter', 'shotgunner']
        : w >= 4
        ? ['runner', 'kamikaze', 'normal', 'shooter']
        : ['runner', 'normal'];
      const hType = pool[Math.floor(Math.random() * pool.length)];
      const baseAng = Math.random() * Math.PI * 2;
      for (let i = 0; i < hordeCount; i++) {
        if (this.enemies.count >= MAX_ENEMIES) break;
        const a = baseAng + (i / hordeCount) * (Math.PI * 1.3) - Math.PI * 0.65;
        const d = rand(22, 28);
        const x = clamp(this.player.x + Math.cos(a) * d, -ARENA_RADIUS + 4, ARENA_RADIUS - 4);
        const z = clamp(this.player.z + Math.sin(a) * d, -ARENA_RADIUS + 4, ARENA_RADIUS - 4);
        this.enemies.spawn(hType, x, z, w, false);
      }
      if (w >= 3 && Math.random() < 0.5) {
        this.audio.warning();
      }
    }
  }

  startWave(n: number) {
    this.wave = n;
    this.waveTime = 0;
    this.hordeTimer = 8;
    if (n === BOSS_WAVE && !this.bossDefeated) {
      this.startBoss();
      return;
    }
    const newTypes = (Object.keys(ENEMY_DEFS) as EnemyType[]).filter(t => ENEMY_DEFS[t].minWave === n && ENEMY_DEFS[t].weight > 0);
    const sub = n % 5 === 0 ? 'MINI-BOSS DETECTADO' : newTypes.length ? `Novo inimigo: ${ENEMY_DEFS[newTypes[0]].name}` : undefined;
    this.notice(`ONDA ${n}`, sub, n % 5 === 0 ? '#ff4060' : '#00e5ff');
    if (n > 1 && n !== BOSS_WAVE && (n % 4 === 0 || (this.bossRush && n === 10))) {
      this.arenaEvents.triggerRandomEvent(this);
    }
    if (n === 6 || n === 14) {
      const sx = rand(-15, 15);
      const sz = rand(-15, 15);
      this.arenaProps.spawnSupplyDrop(this, sx, sz);
    }
    if (n >= 5) this.checkAchievement('survive_5');
    if (n >= 10) this.checkAchievement('survive_10');
    if (this.endless && n >= 25) this.checkAchievement('endless_25');
    if (n % 5 === 0) {
      const count = n >= 15 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const [x, z] = this.spawnPoint(26 + i * 8);
        const mb = this.enemies.spawn('miniboss', x, z, n);
        mb.spawnT = 1;
        this.telegraphs.ring(x, z, 5, 1, 0xffd700);
        this.particles.burst(x, 2, z, 80, 0xffd700, { speed: 10, life: 1, size: 0.5 });
      }
      this.audio.warning();
      this.camera.shake(0.4);
    }
  }

  private startBoss() {
    const [x, z] = this.spawnPoint(26, 14);
    this.boss = new Boss(this.scene, x, z);
    this.notice('O FARMADOR DE AURA', 'Chefe final — resgate Carlinhos e Macedo!', '#ff30c0');
    this.bossWarning = 3.5;
    this.audio.bossRoar();
    this.audio.warning();
    this.audio.startMusic('boss');
    this.camera.shake(0.6);
    this.chroma(1.5);
    this.enemies.killAll(this);
  }

  private spawnPoint(dist: number, margin = 3): [number, number] {
    const pl = this.player;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = dist + Math.random() * 8;
      const x = pl.x + Math.cos(a) * d, z = pl.z + Math.sin(a) * d;
      if (Math.hypot(x, z) < ARENA_RADIUS - margin) return [x, z];
    }
    const a = Math.atan2(-pl.z, -pl.x);
    return [pl.x + Math.cos(a) * dist, pl.z + Math.sin(a) * dist];
  }

  private spawnEnemy() {
    const w = this.wave;
    const pool = (Object.keys(ENEMY_DEFS) as EnemyType[]).filter(t => ENEMY_DEFS[t].weight > 0 && ENEMY_DEFS[t].minWave <= w);
    let total = 0;
    const weights: number[] = [];
    for (const t of pool) {
      const base = ENEMY_DEFS[t].weight;
      let wt = base;
      if (t === 'normal') {
        wt = Math.max(2, base - Math.floor(w * 0.4));
      } else if (t === 'kamikaze' || t === 'sniper' || t === 'shooter' || t === 'shotgunner') {
        wt = base + Math.min(6, Math.floor(w * 0.35));
      } else if (t === 'shielder' || t === 'healer' || t === 'beam' || t === 'summoner') {
        wt = base + Math.min(5, Math.floor((w - ENEMY_DEFS[t].minWave) * 0.6));
      }
      weights.push(wt);
      total += wt;
    }
    let r = Math.random() * total;
    let type: EnemyType = 'normal';
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) { type = pool[i]; break; }
    }
    const elite = w >= 3 && Math.random() < (0.04 + w * 0.009);
    const [x, z] = this.spawnPoint(30);
    this.enemies.spawn(type, x, z, w, elite);
    this.telegraphs.ring(x, z, elite ? 3 : 1.6, 0.55, elite ? 0xffd700 : 0xa020ff);
    this.particles.burst(x, 1, z, elite ? 24 : 8, elite ? 0xffd700 : 0xa020ff, { speed: 4, life: 0.5, size: 0.3, gravity: -3 });
    if (elite) this.notice('ELITE DETECTADO', ENEMY_DEFS[type].name, '#ffd700');
  }

  // =====================================================================
  // Level-up
  // =====================================================================
  private rollRarity(): Rarity {
    const luck = this.player.stats.luck;
    const w = RARITY_WEIGHTS.map(([r, base]) => {
      let v = base;
      if (r === 'common') v = Math.max(10, base - luck * 3.5);
      if (r === 'rare') v = base + luck * 1.2;
      if (r === 'epic') v = base + luck * 1.4;
      if (r === 'legendary') v = base + luck * 0.9;
      return [r, v] as [Rarity, number];
    });
    const total = w.reduce((a, [, v]) => a + v, 0);
    let r = Math.random() * total;
    for (const [rar, v] of w) { r -= v; if (r <= 0) return rar; }
    return 'common';
  }

  private openLevelUp() {
    const avail = UPGRADES.filter(u => {
      if ((u.exclude ?? []).includes(this.heroId)) return false;
      if (u.onlyHero && u.onlyHero !== this.heroId) return false;
      const currentLvl = this.upgradeLevels[u.id] ?? 0;
      if (currentLvl >= u.max) return false;
      const secId = UPGRADE_TO_SECONDARY[u.id];
      if (secId) {
        if (this.player.secondaryWeapons.has(secId)) {
          return false;
        }
        if (this.player.secondaryWeapons.size >= 4) {
          return false;
        }
      }
      return true;
    });

    const evoChoices: UpgradeChoice[] = [];
    // 1. Primary evolution check
    if (!this.player.primaryEvolved) {
      const evoDef = PRIMARY_EVOLUTIONS[this.heroId];
      if (evoDef) {
        const pairedLvl = this.upgradeLevels[evoDef.pairedUpgrade] ?? 0;
        if (pairedLvl >= 2 || (pairedLvl >= 1 && this.player.level >= 8)) {
          evoChoices.push({
            id: 'evo_primary',
            name: evoDef.name,
            desc: evoDef.desc,
            icon: evoDef.icon,
            rarity: 'legendary',
            value: 1,
            level: 6,
            isEvolution: true,
          });
        }
      }
    }
    // 2. Secondary evolutions check
    for (const [secId, sec] of this.player.secondaryWeapons) {
      if (!sec.evolved) {
        const def = SECONDARY_WEAPONS[secId];
        const pairedLvl = this.upgradeLevels[def.pairedUpgrade] ?? 0;
        if (pairedLvl >= 2 || (pairedLvl >= 1 && this.player.level >= 8)) {
          evoChoices.push({
            id: `evo_${secId}`,
            name: def.evoName,
            desc: def.evoDesc,
            icon: '👑',
            rarity: 'legendary',
            value: 1,
            level: 5,
            isEvolution: true,
          });
        }
      }
    }

    const picks: UpgradeChoice[] = [];
    // Se houver evolução disponível, garanta pelo menos uma no leque de opções e permita escolhas múltiplas
    if (evoChoices.length > 0) {
      const shuffledEvos = [...evoChoices].sort(() => Math.random() - 0.5);
      picks.push(shuffledEvos.shift()!);
      while (shuffledEvos.length > 0 && picks.length < 3 && (avail.length === 0 || Math.random() < 0.4)) {
        picks.push(shuffledEvos.shift()!);
      }
    }

    // Se houver melhorias exclusivas do herói disponíveis, garanta alta chance de oferecer uma
    const heroExclusives = avail.filter(u => u.onlyHero === this.heroId);
    if (heroExclusives.length > 0 && picks.length < 3 && Math.random() < 0.75) {
      const chosenExclusive = heroExclusives[Math.floor(Math.random() * heroExclusives.length)];
      const rarity = this.rollRarity();
      const value = chosenExclusive.unit === 'count' ? 1 : Math.round(chosenExclusive.base * RARITY_MULT[rarity]);
      const heroDef = heroById(this.heroId);
      picks.push({
        id: chosenExclusive.id,
        name: chosenExclusive.name,
        desc: chosenExclusive.desc(value),
        icon: chosenExclusive.icon,
        rarity,
        value,
        level: (this.upgradeLevels[chosenExclusive.id] ?? 0) + 1,
        isHeroExclusive: true,
        heroName: heroDef.name,
        heroColor: heroDef.css,
      });
      const idx = avail.indexOf(chosenExclusive);
      if (idx >= 0) avail.splice(idx, 1);
    }

    const bag = [...avail];
    while (picks.length < 3 && bag.length) {
      const i = Math.floor(Math.random() * bag.length);
      const def = bag.splice(i, 1)[0];
      const rarity = this.rollRarity();
      const value = def.unit === 'count' ? 1 : Math.round(def.base * RARITY_MULT[rarity]);
      const isExclusive = def.onlyHero === this.heroId;
      const heroDef = isExclusive ? heroById(this.heroId) : undefined;
      picks.push({
        id: def.id,
        name: def.name,
        desc: def.desc(value),
        icon: def.icon,
        rarity,
        value,
        level: (this.upgradeLevels[def.id] ?? 0) + 1,
        isHeroExclusive: isExclusive,
        heroName: heroDef?.name,
        heroColor: heroDef?.css,
      });
    }
    if (!picks.length) {
      this.pendingLevels = 0;
      if (this.phase === 'levelup') this.setPhase('playing');
      return;
    }
    this.choices = picks;
    this.pendingLevels--;
    this.setPhase('levelup');
    this.audio.levelUp();
    this.flash(0.35, this.player.hero.color);
  }

  chooseUpgrade(id: string) {
    if (this.phase !== 'levelup') return;
    const c = this.choices.find(x => x.id === id);
    if (!c) return;
    this.player.applyUpgrade(id, c.value);
    this.upgradeLevels[id] = (this.upgradeLevels[id] ?? 0) + 1;
    if (this.player.secondaryWeapons.size >= 3) this.checkAchievement('arsenal');
    if (this.player.primaryEvolved || Array.from(this.player.secondaryWeapons.values()).some(w => w.evolved)) {
      this.checkAchievement('evolution');
    }
    if (this.player.stats.speed >= (heroById(this.heroId).speed * 1.5)) {
      this.checkAchievement('speed_demon');
    }
    this.audio.cardPick();
    this.particles.ring(this.player.x, 1, this.player.z, 40, this.player.hero.color, 1.5, 10, 0.7, 0.4);
    this.shockwaves.spawn(this.player.x, this.player.z, this.player.hero.color, { endR: 10, duration: 0.6 });
    this.choices = [];
    if (this.pendingLevels > 0) this.openLevelUp();
    else this.setPhase('playing');
  }

  chooseAscension(perkId: string) {
    if (this.phase !== 'ascension') return;
    this.player.applyAscensionPerk(perkId, this);
    this.ascensionChoice = null;
    this.pendingAscension = false;
    this.notice('ASCENSÃO CÓSMICA DESPERTA!', 'Poder estelar atingido!', '#ffd700');
    if (this.pendingLevels > 0) this.openLevelUp();
    else this.setPhase('playing');
  }

  grantRandomRelic(): RelicDef | null {
    if (!this.relics) return null;
    const r = this.relics.rollRandomRelic();
    if (r) {
      this.relics.add(r.id);
      this.audio.relicFound();
      this.notice('RELÍQUIA CÓSMICA ENCONTRADA!', `${r.icon} ${r.name}: ${r.desc}`, r.color);
      if (this.player) {
        const hex = parseInt(r.color.replace('#', '0x')) || 0xffd700;
        this.particles.burst(this.player.x, 1.5, this.player.z, 50, hex, { speed: 10, life: 0.8, size: 0.45 });
        this.shockwaves.spawn(this.player.x, this.player.z, hex, { endR: 10, duration: 0.5, thick: true });
      }
    }
    return r;
  }

  gainXp(v: number) {
    const pl = this.player;
    const hyperXpMult = this.hyperMode ? 1.5 : 1.0;
    pl.xp += v * pl.stats.xpMult * hyperXpMult;
    while (pl.xp >= pl.xpNext) {
      pl.xp -= pl.xpNext;
      pl.level++;
      pl.xpNext = xpForLevel(pl.level);
      this.pendingLevels++;
      if (pl.level === 10 && !pl.ascensionPerk) {
        this.pendingAscension = true;
      }
    }
  }

  // =====================================================================
  // Dano & combate
  // =====================================================================
  damagePlayer(amount: number, sx = this.player.x, sz = this.player.z + 1) {
    const pl = this.player;
    if (!pl.alive) return;
    const dealt = pl.takeDamage(amount, sx, sz, this);
    if (dealt <= 0) return;
    this.numbers.spawn(pl.x, 1.6, pl.z, dealt, 'player');
    this.hurtV = 1;
    this.camera.shake(clamp(0.18 + dealt / 70, 0, 0.6));
    this.chroma(0.9);
    this.audio.hurt();
    this.particles.burst(pl.x, 1, pl.z, 14, pl.hero.color, { speed: 7, life: 0.5, size: 0.3 });
    if (!pl.alive) {
      this.deathTimer = 2.6;
      this.vfx.explosion(pl.x, 1, pl.z, pl.hero.color, 10, 2.5);
      this.particles.burst(pl.x, 1, pl.z, 260, pl.hero.color, { speed: 18, life: 1.6, size: 0.5, gravity: 10 });
      this.particles.burst(pl.x, 1, pl.z, 120, 0xffffff, { speed: 24, life: 0.9, size: 0.4, gravity: 0 });
      this.shockwaves.spawn(pl.x, pl.z, pl.hero.color, { endR: 24, duration: 1.2, thick: true });
      this.debris.spawn(pl.x, 1, pl.z, pl.hero.color, 18, 12, 1.2);
      this.lights.flash(pl.x, 3, pl.z, pl.hero.color, 3000, 1.5, 60);
      this.world.ripple(pl.x, pl.z, 3);
      this.slowTime(0.22, 1.8);
      this.camera.shake(1.1);
      this.flash(0.7, 0xff2040);
      this.audio.playerDeath();
      this.audio.stopMusic();
    }
  }

  applyLifesteal(rawHeal: number) {
    const pl = this.player;
    if (!pl || !pl.alive || pl.stats.lifesteal <= 0) return;
    if (pl.lifestealTimer > 0) return;
    const heal = Math.min(rawHeal, 3.0);
    if (heal <= 0) return;
    pl.heal(heal);
    pl.lifestealTimer = 0.08;
    if (Math.random() < 0.12 && heal >= 0.5) this.numbers.spawn(pl.x, 1.6, pl.z, heal, 'heal');
  }

  damageEnemy(e: Enemy, dmg: number, crit: boolean, kind: 'normal' | 'corrode' | 'love' = 'normal'): boolean {
    if (this.relics) {
      dmg *= this.relics.getDamageMult(this.player.hp / Math.max(1, this.player.stats.maxHp));
    }
    const before = Math.max(0, e.hp);
    const killed = this.enemies.damage(e, dmg, this, crit, kind);
    if (crit && this.relics && this.relics.has('vacuum_reactor') && Math.random() < 0.6) {
      this.projectiles.spawnMicroVortex(e.x, e.z, this.player.stats.damage);
    }
    if (killed && this.relics && this.relics.has('refraction_prism')) {
      this.projectiles.fireRefractionLasers(e.x, e.z, Math.random() * Math.PI * 2, this.player.stats.damage, this);
    }
    const ls = this.player?.stats?.lifesteal ?? 0;
    if (ls > 0 && this.player?.alive) {
      this.applyLifesteal(Math.min(dmg, before) * ls);
    }
    if (kind === 'love') this.audio.heartHit();
    else if (kind !== 'corrode') this.audio.hit();
    return killed;
  }

  private applyOnHit(e: Enemy, dmg: number, fromDrone: boolean) {
    const s = this.player.stats;
    if (fromDrone) return;
    const hero = this.player.hero.id;
    const burnChance = s.burnChance + (hero === 'thiago' ? 0.35 : 0);
    if (burnChance > 0 && Math.random() < burnChance) {
      this.enemies.applyBurn(e, s.damage * (hero === 'thiago' ? 1.2 : 0.7), 3, hero === 'thiago' ? 0x8cff2a : 0xff8020);
    }
    if (s.freezeChance > 0 && Math.random() < s.freezeChance) {
      this.enemies.applyFreeze(e, 1.6);
      this.particles.burst(e.x, e.y, e.z, 8, 0x9ad8ff, { speed: 4, life: 0.5, size: 0.3, gravity: 2 });
      if (Math.random() < 0.3) this.audio.freeze();
    }
    if (s.explosive > 0 && Math.random() < s.explosive) {
      this.explodePlayer(e.x, e.z, 3.4 * s.area, dmg * 0.9, 0xffa040, 8, false);
    }
  }

  hitEnemyWithProjectile(e: Enemy, p: Projectile) {
    const s = this.player.stats;
    const crit = Math.random() < s.critChance;
    const dmg = p.dmg * (crit ? 2 : 1);
    this.recordDamage(dmg, p.weaponSource || p.kind || 'primary');
    this.enemies.knockback(e, p.vx, p.vz, 4.5 * p.knock * (crit ? 1.5 : 1));
    this.vfx.impact(p.x, p.y, p.z, new THREE.Color(p.r, p.g, p.b).getHex(), p.vx, p.vz, crit);
    this.particles.burst(p.x, p.y, p.z, crit ? 10 : 4, new THREE.Color(p.r, p.g, p.b), { speed: 6, life: 0.3, size: 0.25, gravity: 4 });
    if (this.damageEnemy(e, dmg, crit) === false) this.applyOnHit(e, dmg, p.fromDrone);
    if (p.weaponSource === 'singularity_cannon') {
      this.explodePlayer(p.x, p.z, 3.2 * s.area, p.dmg * 0.5, 0x00e5ff, 6, false);
    }

    // BIG: Acelerador de Plasma (bifurcação de tiros de laser ao impactar o alvo)
    if (this.heroId === 'big' && (this.upgradeLevels['hero_big_plasma_accelerator'] ?? 0) > 0 && p.kind === 'laser' && !(p as any).isSplit) {
      const baseAngle = Math.atan2(p.vx, p.vz);
      const splitDmg = p.dmg * 0.55;
      const splitSpd = Math.hypot(p.vx, p.vz) * 0.9;
      const rico = this.upgradeLevels['hero_big_plasma_accelerator'] ?? 1;
      for (const offset of [-0.55, 0.55]) {
        const ang = baseAngle + offset;
        const splitProj = this.projectiles.spawn({
          kind: 'laser',
          x: p.x, y: p.y, z: p.z,
          vx: Math.sin(ang) * splitSpd,
          vz: Math.cos(ang) * splitSpd,
          dmg: splitDmg,
          life: 0.8,
          radius: 0.28,
          pierce: 1,
          ricochet: rico,
          color: 0x00f0ff,
          trail: 0.3,
          knock: p.knock * 0.5,
          weaponSource: 'primary',
        });
        (splitProj as any).isSplit = true;
      }
    }

    // PIETRO: Ecos Arcanos (glifos e projéteis replicam fragmentos espectrais teleguiados)
    if (this.heroId === 'pietro' && (this.upgradeLevels['hero_pietro_echo_glyphs'] ?? 0) > 0 && !p.fromDrone && !(p as any).isEcho && (p.kind === 'rune' || p.weaponSource === 'primary' || p.weaponSource === 'apocalypse_lexicon')) {
      const echoCount = (this.upgradeLevels['hero_pietro_echo_glyphs'] ?? 1) * 2;
      for (let k = 0; k < echoCount; k++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 16 * s.projSpeed;
        const echo = this.projectiles.spawn({
          kind: 'rune',
          x: p.x, y: 1.1, z: p.z,
          vx: Math.sin(ang) * spd,
          vz: Math.cos(ang) * spd,
          dmg: p.dmg * 0.45,
          life: 1.8,
          radius: 0.4,
          pierce: 1,
          homing: true,
          color: 0xb84dff,
          weaponSource: 'echo_glyphs',
        });
        (echo as any).isEcho = true;
      }
    }

    // PIETRO: Anátema Cósmico (aplica maldição de dano extra sofrido)
    if (this.heroId === 'pietro' && (this.upgradeLevels['hero_pietro_cosmic_vulnerability'] ?? 0) > 0) {
      const vulnLvl = this.upgradeLevels['hero_pietro_cosmic_vulnerability'] ?? 1;
      this.enemies.applyCurse(e, 5.0, 1 + vulnLvl * 0.25);
    }
  }

  hitBossWithProjectile(p: Projectile) {
    if (!this.boss) return;
    const s = this.player.stats;
    const crit = Math.random() < s.critChance;
    const relicMult = this.relics ? this.relics.getDamageMult(this.player.hp / Math.max(1, s.maxHp)) : 1;
    const dmg = p.dmg * (crit ? 2 : 1) * relicMult;
    this.recordDamage(dmg, p.weaponSource || p.kind || 'primary');
    this.boss.hit(dmg, crit, this);
    this.particles.burst(p.x, p.y, p.z, 6, new THREE.Color(p.r, p.g, p.b), { speed: 6, life: 0.3, size: 0.28, gravity: 4 });
    this.vfx.impact(p.x, p.y, p.z, new THREE.Color(p.r, p.g, p.b).getHex(), p.vx, p.vz, crit);
    this.applyLifesteal(dmg * s.lifesteal);
    this.audio.hit();
    if (p.weaponSource === 'singularity_cannon') {
      this.explodePlayer(p.x, p.z, 3.2 * s.area, p.dmg * 0.5, 0x00e5ff, 6, false, 'singularity_cannon');
    }

    // BIG: Acelerador de Plasma no boss
    if (this.heroId === 'big' && (this.upgradeLevels['hero_big_plasma_accelerator'] ?? 0) > 0 && p.kind === 'laser' && !(p as any).isSplit) {
      const baseAngle = Math.atan2(p.vx, p.vz);
      const splitDmg = p.dmg * 0.55;
      const splitSpd = Math.hypot(p.vx, p.vz) * 0.9;
      const rico = this.upgradeLevels['hero_big_plasma_accelerator'] ?? 1;
      for (const offset of [-0.55, 0.55]) {
        const ang = baseAngle + offset;
        const splitProj = this.projectiles.spawn({
          kind: 'laser',
          x: p.x, y: p.y, z: p.z,
          vx: Math.sin(ang) * splitSpd,
          vz: Math.cos(ang) * splitSpd,
          dmg: splitDmg,
          life: 0.8,
          radius: 0.28,
          pierce: 1,
          ricochet: rico,
          color: 0x00f0ff,
          trail: 0.3,
          knock: 1,
          weaponSource: 'primary',
        });
        (splitProj as any).isSplit = true;
      }
    }

    // PIETRO: Ecos Arcanos no boss
    if (this.heroId === 'pietro' && (this.upgradeLevels['hero_pietro_echo_glyphs'] ?? 0) > 0 && !p.fromDrone && !(p as any).isEcho && (p.kind === 'rune' || p.weaponSource === 'primary' || p.weaponSource === 'apocalypse_lexicon')) {
      const echoCount = (this.upgradeLevels['hero_pietro_echo_glyphs'] ?? 1) * 2;
      for (let k = 0; k < echoCount; k++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 16 * s.projSpeed;
        const echo = this.projectiles.spawn({
          kind: 'rune',
          x: p.x, y: 1.1, z: p.z,
          vx: Math.sin(ang) * spd,
          vz: Math.cos(ang) * spd,
          dmg: p.dmg * 0.45,
          life: 1.8,
          radius: 0.4,
          pierce: 1,
          homing: true,
          color: 0xb84dff,
          weaponSource: 'echo_glyphs',
        });
        (echo as any).isEcho = true;
      }
    }

    // PIETRO: Anátema Cósmico no boss
    if (this.heroId === 'pietro' && (this.upgradeLevels['hero_pietro_cosmic_vulnerability'] ?? 0) > 0) {
      const vulnLvl = this.upgradeLevels['hero_pietro_cosmic_vulnerability'] ?? 1;
      this.boss.applyCurse(5.0, 1 + vulnLvl * 0.25);
    }
  }

  hitEnemyMelee(e: Enemy, baseDmg: number, dx: number, dz: number, knock: number, weaponSource = 'primary') {
    const s = this.player.stats;
    const crit = Math.random() < s.critChance;
    const dmg = baseDmg * (crit ? 2 : 1);
    this.recordDamage(dmg, weaponSource);
    this.enemies.knockback(e, dx, dz, knock * (crit ? 1.4 : 1));
    this.vfx.impact(e.x, e.y, e.z, this.player.hero.color, dx, dz, crit);
    this.particles.burst(e.x, e.y, e.z, crit ? 12 : 5, this.player.hero.color, { speed: 7, life: 0.35, size: 0.3 });
    if (!this.damageEnemy(e, dmg, crit)) this.applyOnHit(e, dmg, false);
    if (this.heroId === 'pietro' && (this.upgradeLevels['hero_pietro_cosmic_vulnerability'] ?? 0) > 0) {
      const vulnLvl = this.upgradeLevels['hero_pietro_cosmic_vulnerability'] ?? 1;
      this.enemies.applyCurse(e, 5.0, 1 + vulnLvl * 0.25);
    }
  }

  hitBossMelee(baseDmg: number, weaponSource = 'primary') {
    if (!this.boss) return;
    const s = this.player.stats;
    const crit = Math.random() < s.critChance;
    const relicMult = this.relics ? this.relics.getDamageMult(this.player.hp / Math.max(1, s.maxHp)) : 1;
    const dmg = baseDmg * (crit ? 2 : 1) * relicMult;
    this.recordDamage(dmg, weaponSource);
    this.boss.hit(dmg, crit, this);
    this.applyLifesteal(dmg * s.lifesteal);
    this.audio.hit();
    if (this.heroId === 'pietro' && (this.upgradeLevels['hero_pietro_cosmic_vulnerability'] ?? 0) > 0) {
      const vulnLvl = this.upgradeLevels['hero_pietro_cosmic_vulnerability'] ?? 1;
      this.boss.applyCurse(5.0, 1 + vulnLvl * 0.25);
    }
  }

  hitEnemyDirect(e: Enemy, baseDmg: number, weaponSource = 'primary', forceCrit = false) {
    if (e.dead) return;
    const s = this.player.stats;
    const crit = forceCrit || Math.random() < s.critChance;
    const dmg = baseDmg * (crit ? 2 : 1);
    this.recordDamage(dmg, weaponSource);
    this.damageEnemy(e, dmg, crit);
    if (this.heroId === 'pietro' && (this.upgradeLevels['hero_pietro_cosmic_vulnerability'] ?? 0) > 0) {
      const vulnLvl = this.upgradeLevels['hero_pietro_cosmic_vulnerability'] ?? 1;
      this.enemies.applyCurse(e, 5.0, 1 + vulnLvl * 0.25);
    }
  }

  hitBossDirect(baseDmg: number, weaponSource = 'primary', forceCrit = false) {
    if (!this.boss) return;
    const s = this.player.stats;
    const crit = forceCrit || Math.random() < s.critChance;
    const relicMult = this.relics ? this.relics.getDamageMult(this.player.hp / Math.max(1, s.maxHp)) : 1;
    const dmg = baseDmg * (crit ? 2 : 1) * relicMult;
    this.recordDamage(dmg, weaponSource);
    this.boss.hit(dmg, crit, this);
    this.applyLifesteal(dmg * s.lifesteal);
    this.audio.hit();
    if (this.heroId === 'pietro' && (this.upgradeLevels['hero_pietro_cosmic_vulnerability'] ?? 0) > 0) {
      const vulnLvl = this.upgradeLevels['hero_pietro_cosmic_vulnerability'] ?? 1;
      this.boss.applyCurse(5.0, 1 + vulnLvl * 0.25);
    }
  }

  /** Explosão do jogador (AoE contra inimigos). */
  explodePlayer(x: number, z: number, R: number, dmg: number, color: number, knock: number, big = true, source = 'explosion') {
    scratch.length = 0;
    this.enemies.query(x, z, R + 3, scratch);
    const s = this.player.stats;
    for (const e of scratch) {
      if (e.dead) continue;
      const dx = e.x - x, dz = e.z - z;
      const d = Math.hypot(dx, dz);
      if (d > R + e.radius * e.size) continue;
      const fall = 1 - clamp((d - 2) / Math.max(1, R), 0, 0.5);
      const crit = Math.random() < s.critChance;
      this.enemies.knockback(e, dx, dz, knock);
      this.damageEnemy(e, dmg * fall * (crit ? 2 : 1), crit);
    }
    const boss = this.boss;
    if (boss && boss.hittable && Math.hypot(boss.x - x, boss.z - z) < R + boss.radius) {
      const crit = Math.random() < s.critChance;
      boss.hit(dmg * (crit ? 2 : 1), crit, this);
    }
    if (this.arenaProps && this.arenaProps.crystals.length > 0) {
      for (const c of this.arenaProps.crystals) {
        if (Math.hypot(c.x - x, c.z - z) <= R + c.radius) {
          this.arenaProps.damageCrystal(c, dmg, this);
        }
      }
    }
    this.recordDamage(dmg, source);
    this.vfx.explosion(x, 1, z, color, R * 0.65, big ? 1.2 : 0.5);
    if (big) this.blastDistortion(x, z, Math.min(1.4, R / 12));
    this.particles.burst(x, 1, z, big ? 40 : 18, color, { speed: big ? 10 : 7, life: 0.6, size: 0.35 });
    this.shockwaves.spawn(x, z, color, { endR: R, duration: big ? 0.45 : 0.35 });
    if (big) { this.lights.flash(x, 2, z, color, 600, 0.4, 25); this.world.ripple(x, z, 0.8); this.audio.explosion(0.7); }
  }

  /** Explosão inimiga (AoE contra o jogador). */
  explodeEnemy(x: number, z: number, R: number, dmg: number, color: number) {
    this.vfx.explosion(x, 1, z, color, R * 0.8, 1.2);
    this.blastDistortion(x, z, 0.6);
    this.particles.burst(x, 1, z, 50, color, { speed: 11, life: 0.7, size: 0.4 });
    this.particles.burst(x, 1, z, 20, 0xffffff, { speed: 8, life: 0.3, size: 0.3, gravity: 0 });
    this.shockwaves.spawn(x, z, color, { endR: R * 1.1, duration: 0.45, thick: true });
    this.lights.flash(x, 2, z, color, 700, 0.4, 28);
    this.world.ripple(x, z, 1);
    this.camera.shake(0.2);
    this.audio.explosion(0.9);
    const pl = this.player;
    if (pl.alive && !pl.invulnerable && Math.hypot(pl.x - x, pl.z - z) < R + pl.radius) this.damagePlayer(dmg, x, z);
  }

  // =====================================================================
  // Coleta & recompensas
  // =====================================================================
  collect(kind: PickupKind, value: number, x: number, z: number) {
    const pl = this.player;
    switch (kind) {
      case 'xp': this.gainXp(value); break;
      case 'coin':
        this.coins += value;
        if (this.coins >= 50) this.checkAchievement('coin_hoarder');
        break;
      case 'shard': this.shards += value; this.notice('SHARD COLETADO', `+${value} shard permanente`, '#ff60ff'); break;
      case 'heal': { const h = pl.stats.maxHp * 0.3; pl.heal(h); this.numbers.spawn(pl.x, 1.6, pl.z, h, 'heal'); break; }
      case 'magnet': this.pickups.magnetAll(); this.shockwaves.spawn(pl.x, pl.z, 0xffffff, { endR: 60, duration: 1.2 }); break;
    }
    this.audio.pickup(kind);
    const c = kind === 'xp' ? 0x00e5ff : kind === 'coin' ? 0xffc040 : kind === 'shard' ? 0xff60ff : kind === 'heal' ? 0x40ff90 : 0xffffff;
    this.particles.burst(x, 1, z, kind === 'xp' ? 3 : 8, c, { speed: 3, life: 0.35, size: 0.22, gravity: -2 });
  }

  onEnemyKilled(e: Enemy) {
    if (e.type === 'mine') return;
    this.kills++;
    this.killsThisRun[e.type] = (this.killsThisRun[e.type] ?? 0) + 1;
    this.checkAchievement('first_kill');
    if (e.elite) {
      this.elitesKilled++;
      if (this.elitesKilled >= 8) this.checkAchievement('elite_hunter');
      if (Math.random() < 0.35) {
        const relic = this.grantRandomRelic();
        if (relic) {
          this.notice('BAÚ DE ELITE ABERTO!', `Relíquia Cósmica: ${relic.name}`, relic.color);
        }
      }
    }
    const def = e.def;
    let xp = def.xp * (e.elite ? 3 : 1);
    if (e.type === 'miniboss') {
      this.checkAchievement('kill_miniboss');
      xp = 60;
      for (let i = 0; i < 4 + Math.floor(Math.random() * 2); i++) this.pickups.spawn('shard', e.x + rand(-2, 2), e.z + rand(-2, 2), 1);
      for (let i = 0; i < 10; i++) this.pickups.spawn('coin', e.x + rand(-3, 3), e.z + rand(-3, 3), 1);
      this.pickups.spawn('heal', e.x, e.z, 1);
      this.grantRandomRelic();
      this.notice('SENTINELA DESTRUÍDA', 'Recompensas liberadas', '#ffd700');
    }
    while (xp > 0) {
      const v = xp >= 20 ? 20 : xp >= 8 ? 8 : xp >= 3 ? 3 : 1;
      this.pickups.spawn('xp', e.x + rand(-0.8, 0.8), e.z + rand(-0.8, 0.8), v);
      xp -= v;
    }
    const dropMult = this.relics ? this.relics.getDropsMultiplier() : 1.0;
    if (Math.random() < def.coin * (e.elite ? 3 : 1) * dropMult) this.pickups.spawn('coin', e.x, e.z, Math.round(1 * dropMult));
    if (e.elite && Math.random() < 0.45 * dropMult) this.pickups.spawn('shard', e.x, e.z, Math.round(1 * dropMult));
    if (Math.random() < 0.012) this.pickups.spawn('heal', e.x, e.z, 1);
    if (Math.random() < 0.004) this.pickups.spawn('magnet', e.x, e.z, 1);

    // THIAGO: Reação Bio-Tóxica em Cadeia (detonação bio-tóxica ao abater inimigos sob corrosão)
    if (this.heroId === 'thiago' && (this.upgradeLevels['hero_thiago_chain_reaction'] ?? 0) > 0 && (e.burn > 0 || e.burnDps > 0)) {
      const chainLvl = this.upgradeLevels['hero_thiago_chain_reaction'] ?? 1;
      const expR = (3 + chainLvl) * this.player.stats.area;
      const expDmg = this.player.stats.damage * (1.2 + chainLvl * 0.6);
      this.explodePlayer(e.x, e.z, expR, expDmg, 0x8cff2a, 12, false, 'chain_reaction');
      this.groundHazards.spawn({
        x: e.x, z: e.z,
        radius: expR * 0.75,
        duration: 2.2 + chainLvl * 0.5,
        dps: expDmg * 0.5,
        type: 'acid',
        color: 0x8cff2a,
        source: 'chain_reaction',
      });
      // Infectar monstros vizinhos na nuvem
      scratch.length = 0;
      this.enemies.query(e.x, e.z, expR, scratch);
      for (const ne of scratch) {
        if (!ne.dead && ne.id !== e.id) {
          this.enemies.applyBurn(ne, this.player.stats.damage * (1.0 + chainLvl * 0.3), 3.5 + chainLvl * 0.5, 0x8cff2a);
        }
      }
    }

    // CARLINHOS: Compaixão Curativa (chance de gerar orbe de cura ao derrotar inimigos)
    if (this.heroId === 'carlinhos' && (this.upgradeLevels['hero_carlinhos_pacifist_healing'] ?? 0) > 0) {
      const healLvl = this.upgradeLevels['hero_carlinhos_pacifist_healing'];
      if (Math.random() < 0.05 * healLvl) {
        this.pickups.spawn('heal', e.x, e.z, 1);
      }
    }
  }

  bossLoot(x: number, z: number) {
    for (let i = 0; i < 70; i++) this.pickups.spawn('xp', x + rand(-6, 6), z + rand(-6, 6), 5);
    for (let i = 0; i < 30; i++) this.pickups.spawn('coin', x + rand(-7, 7), z + rand(-7, 7), 1);
    for (let i = 0; i < 15; i++) this.pickups.spawn('shard', x + rand(-5, 5), z + rand(-5, 5), 1);
    this.pickups.spawn('heal', x + 2, z, 1);
    this.pickups.spawn('heal', x - 2, z, 1);
    this.pickups.spawn('magnet', x, z + 3, 1);
  }

  onBossDefeated() {
    if (this.boss) { this.boss.dispose(this.scene); this.boss = null; }
    this.bossDefeated = true;
    this.kills++;
    this.checkAchievement('rescue_heroes');
    this.enemies.killAll(this);
    this.projectiles.clearAll(true);
    this.audio.victory();
    this.audio.startMusic('calm');
    this.notice('FARMADOR ANIQUILADO', 'Carlinhos e Macedo estão a salvo!', '#ffd700');
    this.victoryTimer = 3.2;
  }

  private finishRun(victory: boolean) {
    const pl = this.player;
    let shardMult = 1.0;
    if (this.hyperMode) shardMult += 0.5;
    for (const p of this.pacts) {
      const pdef = PACTS[p];
      if (pdef) shardMult += pdef.shardBonus;
    }
    if (this.relics && this.relics.has('pact_of_ambition')) {
      shardMult *= 2.0;
    }
    const shardsEarned = Math.round((this.shards + Math.floor(this.coins / 25)) * shardMult);
    const dps = Math.round(this.totalDamage / Math.max(1, this.time));
    const activeWeapons: ActiveWeaponState[] = pl ? pl.getActiveWeapons() : [];
    this.result = {
      victory,
      wave: this.wave,
      kills: this.kills,
      time: this.time,
      coins: this.coins,
      shards: shardsEarned,
      level: pl ? pl.level : 1,
      hero: this.heroId,
      dps,
      damageBreakdown: { ...this.damageBreakdown },
      activeWeapons,
      gameMode: this.gameMode,
      pacts: [...this.pacts],
      relics: this.relics ? Array.from(this.relics.activeRelics) : [],
      ascension: pl ? pl.ascensionPerk : null,
    };
    recordRun({ wave: this.wave, kills: this.kills, shards: shardsEarned, victory });
    recordMatchHistory(this.result);
    recordCareerRun(this.result, this.totalDamage, this.killsThisRun);
    this.shards = 0; this.coins = 0;
    this.setPhase(victory ? 'victory' : 'gameover');
  }

  // =====================================================================
  // Feedback
  // =====================================================================
  notice(text: string, sub?: string, color?: string) {
    this.notices.push({ id: ++this.noticeId, text, sub, color });
    if (this.notices.length > 3) this.notices.shift();
    if (this.notices.length === 1) this.noticeT = 2.4;
  }

  chroma(v: number) { this.chromaV = Math.max(this.chromaV, v); }
  blastDistortion(x: number, z: number, power = 1) {
    const s = this.screenShocks.find(s => s.age >= 1) ?? this.screenShocks.reduce((a, b) => a.age > b.age ? a : b);
    s.position.set(x, 1, z); s.age = 0; s.power = Math.min(1.5, power);
  }
  flash(v: number, color = 0xffffff) { this.flashV = Math.max(this.flashV, Math.min(0.40, v)); this.flashColor.setHex(color); }
  slowTime(scale: number, dur: number) { this.slowScale = Math.min(this.slowScale, scale); this.slowT = Math.max(this.slowT, dur); }

  getOffscreenThreats(): { angle: number; distance: number; isBoss: boolean; name: string }[] {
    const list: { angle: number; distance: number; isBoss: boolean; name: string }[] = [];
    const pl = this.player;
    if (!pl || !pl.alive) return list;
    if (this.boss && this.boss.state !== 'dead') {
      const dx = this.boss.x - pl.x, dz = this.boss.z - pl.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 18) {
        list.push({ angle: Math.atan2(dx, -dz), distance: Math.round(dist), isBoss: true, name: this.boss.name });
      }
    }
    for (const e of this.enemies.list) {
      if (e.dead || e.type !== 'miniboss') continue;
      const dx = e.x - pl.x, dz = e.z - pl.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 18) {
        list.push({ angle: Math.atan2(dx, -dz), distance: Math.round(dist), isBoss: false, name: "Sentinela Farm'aura" });
      }
    }
    if (this.arenaEvents && this.arenaEvents.thiefAlive) {
      const dx = this.arenaEvents.thiefX - pl.x, dz = this.arenaEvents.thiefZ - pl.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 12) {
        list.push({ angle: Math.atan2(dx, -dz), distance: Math.round(dist), isBoss: false, name: 'Ladrão de Shards' });
      }
    }
    return list;
  }

  // =====================================================================
  // Snapshot para a HUD
  // =====================================================================
  getSnapshot(): Snapshot {
    const pl = this.player;
    const mb = this.enemies.list.find(e => e.type === 'miniboss' && !e.dead);
    let boss: Snapshot['boss'] = null;
    if (this.boss && this.boss.state !== 'dead') boss = { name: this.boss.name, hp: this.boss.hp, max: this.boss.maxHp, phase: this.boss.phase };
    else if (mb) boss = { name: "SENTINELA FARM'AURA", hp: mb.hp, max: mb.maxHp, phase: 0 };
    const cur = this.notices.length ? this.notices[this.notices.length - 1] : null;
    const dps = Math.round(this.totalDamage / Math.max(1, this.time));
    const activeWeapons: ActiveWeaponState[] = pl ? pl.getActiveWeapons() : [];
    const crateAlert = this.arenaProps ? Boolean(this.arenaProps.supplyDrop?.active) : false;

    return {
      phase: this.phase,
      hero: pl ? pl.hero.id : null,
      hp: pl ? pl.hp : 0, maxHp: pl ? pl.stats.maxHp : 1,
      level: pl ? pl.level : 1, xp: pl ? pl.xp : 0, xpNext: pl ? pl.xpNext : 1,
      wave: this.wave, waveTime: this.waveTime, waveDuration: WAVE_DURATION,
      kills: this.kills, coins: this.coins, shards: this.shards, time: this.time,
      dashCd: pl ? pl.dashCd : 0, dashMax: pl ? pl.dashMax : 1,
      ultCd: pl ? pl.ultCd : 0, ultMax: pl ? pl.ultMax : 1, ultActive: pl ? pl.ultActive : false,
      boss,
      notice: cur,
      hurt: this.hurtV,
      choices: this.choices,
      upgrades: UPGRADES.filter(u => (this.upgradeLevels[u.id] ?? 0) > 0).map(u => ({ id: u.id, name: u.name, icon: u.icon, level: this.upgradeLevels[u.id] })),
      fps: Math.round(this.fps),
      endless: this.endless,
      result: this.result,
      bossWarning: this.bossWarning > 0,
      aimMode: pl ? pl.aimMode : 'auto',
      dps,
      damageBreakdown: { ...this.damageBreakdown },
      activeWeapons,
      crateAlert,
      gameMode: this.gameMode,
      pacts: [...this.pacts],
      relics: this.relics ? Array.from(this.relics.activeRelics) : [],
      ascensionPerk: pl ? pl.ascensionPerk : null,
      ascensionChoice: this.ascensionChoice,
      activeArenaEvent: this.arenaEvents?.currentEvent ? {
        type: this.arenaEvents.currentEvent.id,
        name: this.arenaEvents.currentEvent.name,
        desc: this.arenaEvents.currentEvent.desc,
        icon: this.arenaEvents.currentEvent.icon,
        timer: this.arenaEvents.currentEvent.timer,
        color: this.arenaEvents.currentEvent.color,
      } : null,
      offscreenThreats: this.getOffscreenThreats(),
    };
  }

  getRadar(): { px: number; pz: number; angle: number; points: number[] } {
    const pl = this.player;
    const pts: number[] = [];
    if (!pl) return { px: 0, pz: 0, angle: 0, points: pts };
    const R2 = 50 * 50;
    for (const e of this.enemies.list) {
      if (e.dead) continue;
      const dx = e.x - pl.x, dz = e.z - pl.z;
      if (dx * dx + dz * dz > R2) continue;
      pts.push(dx, dz, e.type === 'miniboss' ? 2 : e.elite ? 1 : e.type === 'mine' ? 3 : 0);
    }
    if (this.boss && this.boss.state !== 'dead') pts.push(this.boss.x - pl.x, this.boss.z - pl.z, 4);
    if (this.arenaProps) {
      if (this.arenaProps.supplyDrop && this.arenaProps.supplyDrop.active) {
        pts.push(this.arenaProps.supplyDrop.x - pl.x, this.arenaProps.supplyDrop.z - pl.z, 5);
      }
      for (const c of this.arenaProps.crystals) {
        const dx = c.x - pl.x, dz = c.z - pl.z;
        if (dx * dx + dz * dz <= R2) pts.push(dx, dz, 6);
      }
    }
    return { px: pl.x, pz: pl.z, angle: pl.aimAngle, points: pts };
  }

  // =========================================================================
  // MOD MENU / CHEATS (sociedadegdc)
  // =========================================================================
  isGodMode(): boolean {
    return this.player ? this.player.godMode : false;
  }

  toggleGodMode(): boolean {
    if (!this.player) return false;
    this.player.godMode = !this.player.godMode;
    if (this.player.godMode) {
      this.audio.cardPick();
      this.notice('MODO DEUS ATIVADO', 'Dano e morte desativados', '#ffcf40');
      this.flash(0.3, 0xffd700);
    } else {
      this.audio.hit();
      this.notice('MODO DEUS DESATIVADO', 'Vulnerabilidade restaurada', '#ff4466');
    }
    return this.player.godMode;
  }

  addLevels(count: number) {
    if (!this.player || !this.player.alive) return;
    this.player.level += count;
    this.pendingLevels += count;
    this.player.xpNext = xpForLevel(this.player.level);
    this.audio.levelUp();
    this.notice(`+${count} NÍVEIS ADICIONADOS`, `Nível atual: ${this.player.level}`, '#00e5ff');
    this.flash(0.3, this.player.hero.color);
    if (this.phase === 'playing') this.openLevelUp();
  }

  addXpCheat(amount: number) {
    if (!this.player || !this.player.alive) return;
    this.gainXp(amount);
    this.audio.pickup('xp');
    this.notice(`+${amount.toLocaleString()} XP`, undefined, '#44ddff');
  }

  healPlayerFull() {
    if (!this.player) return;
    this.player.hp = this.player.stats.maxHp;
    this.audio.pickup('heal');
    this.flash(0.2, 0x00ff88);
    this.notice('VIDA RESTAURADA (100%)', undefined, '#00ff88');
  }

  chargeUltFull() {
    if (!this.player) return;
    this.player.ultCd = 0;
    this.audio.cardPick();
    this.notice('HABILIDADE SUPREMA PRONTA!', undefined, '#ff30c0');
  }

  maxOutCurrentRun() {
    if (!this.player || !this.player.alive) return;
    const pl = this.player;

    // 1. Arma Primária Evoluída
    pl.primaryEvolved = true;

    // 2. 4 Armas Secundárias no Nível 5 e Evoluídas
    const secWeapons: SecondaryWeaponId[] = ['missile_pod', 'orbital_saw', 'tesla_coil', 'gravity_well'];
    for (const id of secWeapons) {
      pl.secondaryWeapons.set(id, { id, level: 5, timer: 0.1, evolved: true });
    }

    // 3. Upgrades Genéricos e Exclusivos do Herói
    for (const u of UPGRADES) {
      if (u.exclude?.includes(this.heroId)) continue;
      if (u.onlyHero && u.onlyHero !== this.heroId) continue;
      const current = this.upgradeLevels[u.id] ?? 0;
      const needed = u.max - current;
      if (needed > 0) {
        for (let i = 0; i < needed; i++) {
          const val = u.unit === 'count' ? 1 : u.base;
          pl.applyUpgrade(u.id, val);
          this.upgradeLevels[u.id] = (this.upgradeLevels[u.id] ?? 0) + 1;
        }
      }
    }

    // 4. Restaurar HP e Ult
    pl.hp = pl.stats.maxHp;
    pl.ultCd = 0;
    pl.dashCd = 0;

    this.checkAchievement('arsenal');
    this.checkAchievement('evolution');
    this.checkAchievement('speed_demon');

    this.audio.ult(this.heroId);
    this.flash(0.5, 0x00ffcc);
    this.particles.burst(pl.x, 1.5, pl.z, 150, 0x00ffcc, { speed: 18, life: 1.0, size: 0.5 });
    this.notice('NAVE E ARSENAL MAXIMIZADOS!', 'Todas as armas e evoluções ativas!', '#00ffcc');
  }

  nukeEnemies() {
    let count = 0;
    for (const e of this.enemies.list) {
      if (!e.dead) {
        this.damageEnemy(e, 999999, true);
        count++;
      }
    }
    if (this.boss && this.boss.hittable) {
      this.boss.hit(8000, true, this);
    }
    this.audio.explosion(3);
    this.flash(0.5, 0xffffff);
    this.camera.shake(0.8);
    this.notice(`NUKE! ${count} INIMIGOS ELIMINADOS`, undefined, '#ff3344');
  }

  advanceWave(toWave?: number) {
    const target = toWave ?? (this.wave + 1);
    this.startWave(target);
  }

  spawnBossCheat() {
    this.startWave(BOSS_WAVE);
  }

  spawnMinibossCheat() {
    const [x, z] = this.spawnPoint(16);
    this.enemies.spawn('miniboss', x, z, this.wave);
    this.telegraphs.ring(x, z, 5, 1, 0xffd700);
    this.particles.burst(x, 2, z, 80, 0xffd700, { speed: 10, life: 1, size: 0.5 });
    this.audio.warning();
    this.notice('MINI-BOSS INVOCADO!', undefined, '#ffd700');
  }

  spawnPickupCheat(kind: PickupKind) {
    if (!this.player) return;
    const px = this.player.x + (Math.random() - 0.5) * 4;
    const pz = this.player.z + (Math.random() - 0.5) * 4;
    this.pickups.spawn(kind, px, pz, kind === 'xp' ? 150 : 1);
    this.audio.pickup(kind);
    this.notice(`DROP GERADO: ${kind.toUpperCase()}`, undefined, '#00ffcc');
  }

  spawnSupplyDropCheat() {
    if (!this.player) return;
    this.arenaProps.spawnSupplyDrop(this, this.player.x, this.player.z);
    this.audio.warning();
    this.notice('CÁPSULA SPACEX ENVIADA!', 'Caiu na sua posição', '#00ffcc');
  }

  /** Easter Egg Romântico: Julia — O Amor Conquista o Cosmos! */
  triggerJuliaEasterEgg() {
    this.audio.init();
    this.audio.resume();
    this.notice('💖 JULIA 💖', 'O Amor Conquista o Cosmos!', '#ff2d75');
    this.audio.juliaEasterEgg();
    this.flash(0.7, 0xff2d75);
    this.chroma(0.9);
    this.camera.shake(0.35);
    this.juliaHearts.spawnSwarm(this, 16);
  }

  triggerArenaEventCheat(type: ArenaEventType) {
    if (!this.arenaEvents) return;
    this.arenaEvents.triggerEvent(type, this);
  }

  grantAllRelicsCheat() {
    if (!this.relics) return;
    for (const r of ALL_RELIC_IDS) {
      this.relics.add(r);
    }
    this.audio.relicFound();
    this.notice('TODAS AS 7 RELÍQUIAS ATIVADAS!', undefined, '#ffd700');
  }

  triggerAscensionCheat() {
    if (!this.player || !this.player.alive) return;
    this.ascensionChoice = ASCENSION_PERKS[this.heroId];
    this.setPhase('ascension');
    this.audio.ascension();
    this.notice('CHEAT: ASCENSÃO LIBERADA', 'Escolha seu perk de nível 10', '#ffd700');
  }

  setGameModeCheat(mode: GameMode) {
    this.gameMode = mode;
    this.hyperMode = mode === 'hyper';
    this.bossRush = mode === 'boss_rush';
    if (this.player) {
      this.player.hyperModeMult = this.hyperMode ? 1.25 : 1.0;
      this.player.stats = this.player.computeStats();
    }
    this.notice(`MODO DE JOGO ALTERADO: ${mode.toUpperCase()}`, undefined, '#00e5ff');
  }

  togglePactCheat(pact: PactId) {
    const idx = this.pacts.indexOf(pact);
    if (idx >= 0) {
      this.pacts.splice(idx, 1);
      this.notice(`PACTO DESATIVADO: ${PACTS[pact]?.name ?? pact}`, undefined, '#ffaa00');
    } else {
      this.pacts.push(pact);
      this.notice(`PACTO ATIVADO: ${PACTS[pact]?.name ?? pact}`, undefined, '#a855f7');
    }
    if (pact === 'penumbra') {
      const active = this.hasPact('penumbra');
      this.world.setPenumbraMode(active);
      if (active && !this.penumbraLight) {
        this.penumbraLight = new THREE.SpotLight(0xffffff, 55, 45, Math.PI / 3.5, 0.35, 1.2);
        this.penumbraLight.position.set(0, 12, 0);
        this.scene.add(this.penumbraLight);
        this.scene.add(this.penumbraLight.target);
      } else if (!active && this.penumbraLight) {
        this.scene.remove(this.penumbraLight);
        this.scene.remove(this.penumbraLight.target);
        this.penumbraLight = null;
      }
    }
    if (pact === 'no_dampeners' && this.player) {
      this.player.noDampeners = this.hasPact('no_dampeners');
      this.player.dashMax = this.player.noDampeners ? 3.0 : 1.5;
    }
  }
}
