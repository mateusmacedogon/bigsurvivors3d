import * as THREE from 'three';
import { ARENA_RADIUS, clamp, damp } from './config';
import { FLOOR_FRAG, FLOOR_VERT, NEBULA_FRAG, NEBULA_VERT, SHIELD_FRAG, SHIELD_VERT, STARS_FRAG, STARS_VERT } from './shaders';

// ---------------------------------------------------------------------------
// Mundo: chão, nebulosa, estrelas, parede da arena, luzes
// ---------------------------------------------------------------------------
export class World {
  floorMat: THREE.ShaderMaterial;
  nebulaMat: THREE.ShaderMaterial;
  starsMat: THREE.ShaderMaterial;
  wallMat: THREE.ShaderMaterial;
  stars: THREE.Points;
  private rippleIdx = 0;
  private time = 0;

  constructor(scene: THREE.Scene) {
    // Chão
    const ripples: THREE.Vector4[] = [];
    for (let i = 0; i < 10; i++) ripples.push(new THREE.Vector4(0, 0, 0, 0));
    this.floorMat = new THREE.ShaderMaterial({
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uPlayer: { value: new THREE.Vector3() },
        uColor: { value: new THREE.Color(0x00c8ff) },
        uColor2: { value: new THREE.Color(0x2a1a6a) },
        uRipples: { value: ripples },
        uArena: { value: ARENA_RADIUS },
        uPulse: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_RADIUS * 2 + 40, ARENA_RADIUS * 2 + 40), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.renderOrder = 1;
    scene.add(floor);

    // Nebulosa
    this.nebulaMat = new THREE.ShaderMaterial({
      vertexShader: NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      uniforms: { uTime: { value: 0 } },
      depthWrite: false,
    });
    const neb = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), this.nebulaMat);
    neb.rotation.x = -Math.PI / 2;
    neb.position.y = -70;
    neb.renderOrder = 0;
    scene.add(neb);

    // Poeira estelar 3D
    const N = 1800;
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const phase = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 320;
      pos[i * 3 + 1] = -3 - Math.random() * 60;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 320;
      size[i] = 0.4 + Math.random() * 1.4;
      phase[i] = Math.random() * Math.PI * 2;
    }
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sgeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    sgeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.starsMat = new THREE.ShaderMaterial({
      vertexShader: STARS_VERT,
      fragmentShader: STARS_FRAG,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.7, 0.85, 1.0) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.stars = new THREE.Points(sgeo, this.starsMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // Parede holográfica da arena
    this.wallMat = new THREE.ShaderMaterial({
      vertexShader: SHIELD_VERT,
      fragmentShader: SHIELD_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(0xff2d75) },
        uOpacity: { value: 0.22 },
        uTime: { value: 0 },
        uImpact: { value: new THREE.Vector3(0, 1, 0) },
        uImpactAge: { value: 10 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS, 7, 96, 1, true), this.wallMat);
    wall.position.y = 3.5;
    wall.renderOrder = 6;
    scene.add(wall);

    // Luzes
    const hemi = new THREE.HemisphereLight(0x5070ff, 0x200a30, 1.2);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(20, 50, 10);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0xff40a0, 0.5);
    fill.position.set(-30, 20, -20);
    scene.add(fill);
  }

  setTheme(color: number) {
    (this.floorMat.uniforms.uColor.value as THREE.Color).setHex(color);
  }

  ripple(x: number, z: number, strength = 1) {
    const arr = this.floorMat.uniforms.uRipples.value as THREE.Vector4[];
    arr[this.rippleIdx].set(x, z, this.time, strength);
    this.rippleIdx = (this.rippleIdx + 1) % arr.length;
  }

  update(dt: number, playerPos: THREE.Vector3, pulse: number) {
    this.time += dt;
    this.floorMat.uniforms.uTime.value = this.time;
    (this.floorMat.uniforms.uPlayer.value as THREE.Vector3).copy(playerPos);
    this.floorMat.uniforms.uPulse.value = pulse;
    this.nebulaMat.uniforms.uTime.value = this.time;
    this.starsMat.uniforms.uTime.value = this.time;
    this.wallMat.uniforms.uTime.value = this.time;
    this.stars.rotation.y += dt * 0.004;
  }
}

// ---------------------------------------------------------------------------
// Câmera: isométrica elevada, interpolação spring, roll em curvas, screenshake
// ---------------------------------------------------------------------------
export class CameraRig {
  camera: THREE.PerspectiveCamera;
  private cur = new THREE.Vector3(0, 0, 0);
  private vel = new THREE.Vector3();
  private roll = 0;
  trauma = 0;
  private shakeT = 0;
  height = 36;
  back = 19;
  private look = new THREE.Vector3();
  zoom = 1;
  private targetZoom = 1;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.5, 900);
    this.camera.position.set(0, this.height, this.back);
    this.camera.lookAt(0, 0, 0);
  }

  shake(amount: number) {
    this.trauma = clamp(this.trauma + amount, 0, 1.2);
  }

  setZoom(z: number) {
    this.targetZoom = z;
  }

  snap(x: number, z: number) {
    this.cur.set(x, 0, z);
    this.vel.set(0, 0, 0);
  }

  update(dt: number, target: THREE.Vector3, lateralVel: number, aim: THREE.Vector3) {
    // spring-damper em direção ao alvo + antecipação da mira
    const leadX = clamp((aim.x - target.x) * 0.14, -6, 6);
    const leadZ = clamp((aim.z - target.z) * 0.14, -6, 6);
    const dx = target.x + leadX - this.cur.x;
    const dz = target.z + leadZ - this.cur.z;
    const k = 34, c = 11;
    this.vel.x += (dx * k - this.vel.x * c) * dt;
    this.vel.z += (dz * k - this.vel.z * c) * dt;
    this.cur.x += this.vel.x * dt;
    this.cur.z += this.vel.z * dt;

    this.zoom += (this.targetZoom - this.zoom) * damp(3, dt);
    const h = this.height * this.zoom;
    const b = this.back * this.zoom;

    // shake multi-eixo
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.shakeT += dt * 40;
    const s = this.trauma * this.trauma;
    const ox = Math.sin(this.shakeT * 1.1) * s * 1.6 + Math.sin(this.shakeT * 2.7) * s * 0.6;
    const oy = Math.cos(this.shakeT * 1.3) * s * 1.2;
    const oz = Math.sin(this.shakeT * 0.9 + 2) * s * 1.6;
    const rz = Math.sin(this.shakeT * 1.7) * s * 0.03;

    this.camera.position.set(this.cur.x + ox, h + oy, this.cur.z + b + oz);
    this.look.set(this.cur.x + ox * 0.5, 0, this.cur.z + oz * 0.5);
    this.camera.lookAt(this.look);

    // roll sutil em curvas fechadas
    const targetRoll = clamp(-lateralVel * 0.0045, -0.07, 0.07);
    this.roll += (targetRoll - this.roll) * damp(4, dt);
    this.camera.rotateZ(this.roll + rz);
  }

  updateOrbit(time: number) {
    const r = 46;
    const a = time * 0.12;
    this.camera.position.set(Math.cos(a) * r, 26 + Math.sin(time * 0.3) * 3, Math.sin(a) * r);
    this.camera.lookAt(0, 2, 0);
  }
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
export class Input {
  keys = new Set<string>();
  private pressed = new Set<string>();
  mouse = new THREE.Vector2(0, 0);
  mouseDown = false;
  gamepadAim: [number, number] | null = null;
  private prevPadButtons: boolean[] = [];
  private el: HTMLElement;
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!this.keys.has(e.code)) this.pressed.add(e.code);
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private onMove = (e: MouseEvent) => {
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  };
  private onDown = (e: MouseEvent) => { if (e.button === 0) this.mouseDown = true; };
  private onUp = () => { this.mouseDown = false; };
  private onBlur = () => { this.keys.clear(); this.mouseDown = false; };

  constructor(el: HTMLElement) {
    this.el = el;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('mousedown', this.onDown);
    window.addEventListener('mouseup', this.onUp);
    window.addEventListener('blur', this.onBlur);
    el.addEventListener('contextmenu', e => e.preventDefault());
  }

  pollGamepad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    let pad: Gamepad | null = null;
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && gamepads[i]!.connected) { pad = gamepads[i]; break; }
    }
    if (!pad) return;

    // Stick direito mira manual
    const rx = pad.axes[2] ?? 0;
    const ry = pad.axes[3] ?? 0;
    if (Math.hypot(rx, ry) > 0.25) {
      this.gamepadAim = [rx, ry];
    }

    const checkBtn = (btnIdx: number, code: string) => {
      const isDown = Boolean(pad!.buttons[btnIdx]?.pressed);
      const wasDown = Boolean(this.prevPadButtons[btnIdx]);
      if (isDown && !wasDown) {
        this.pressed.add(code);
      }
      if (isDown) {
        this.keys.add(code);
      } else if (wasDown) {
        this.keys.delete(code);
      }
      this.prevPadButtons[btnIdx] = isDown;
    };

    checkBtn(0, 'Space'); // A - Dash
    checkBtn(1, 'Space'); // B - Dash
    checkBtn(2, 'Tab');   // X - Auto-aim toggle
    checkBtn(3, 'KeyE');  // Y - Ultimate
    checkBtn(4, 'Space'); // LB - Dash
    checkBtn(5, 'KeyE');  // RB - Ultimate
    checkBtn(6, 'Space'); // LT - Dash
    checkBtn(7, 'Space'); // RT - Dash
    checkBtn(8, 'Tab');   // Select - Auto-aim toggle
    checkBtn(9, 'Escape'); // Start - Pause
  }

  down(code: string) { return this.keys.has(code); }
  consume(code: string) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }
  endFrame() {
    this.pressed.clear();
    this.pollGamepad();
  }

  axis(): [number, number] {
    let x = 0, z = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) z -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z += 1;

    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      for (let i = 0; i < gamepads.length; i++) {
        const pad = gamepads[i];
        if (pad && pad.connected) {
          const gx = pad.axes[0] ?? 0;
          const gz = pad.axes[1] ?? 0;
          if (Math.hypot(gx, gz) > 0.18) {
            x += gx;
            z += gz;
            break;
          }
        }
      }
    }

    const l = Math.hypot(x, z);
    return l > 0 ? [x / l, z / l] : [0, 0];
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mousedown', this.onDown);
    window.removeEventListener('mouseup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
    void this.el;
  }
}
