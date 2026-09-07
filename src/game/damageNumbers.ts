import * as THREE from 'three';
import { TEXT_FRAG, TEXT_VERT } from './shaders';

const CHARS = '0123456789+-♥';

export function makeDigitAtlas(): THREE.CanvasTexture {
  const cell = 64;
  const canvas = document.createElement('canvas');
  canvas.width = cell * CHARS.length;
  canvas.height = cell;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `900 52px Orbitron, "Rajdhani", "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < CHARS.length; i++) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 6;
    if (CHARS[i] === '♥') {
      const cx = i * cell + cell / 2;
      const cy = cell / 2 + 1;
      const s = 17.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy + s * 0.88);
      ctx.bezierCurveTo(cx - s * 1.25, cy + s * 0.12, cx - s * 1.35, cy - s * 0.72, cx - s * 0.65, cy - s * 0.95);
      ctx.bezierCurveTo(cx - s * 0.25, cy - s * 1.08, cx, cy - s * 0.65, cx, cy - s * 0.45);
      ctx.bezierCurveTo(cx, cy - s * 0.65, cx + s * 0.25, cy - s * 1.08, cx + s * 0.65, cy - s * 0.95);
      ctx.bezierCurveTo(cx + s * 1.35, cy - s * 0.72, cx + s * 1.25, cy + s * 0.12, cx, cy + s * 0.88);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    } else {
      ctx.strokeText(CHARS[i], i * cell + cell / 2, cell / 2 + 2);
      ctx.fillText(CHARS[i], i * cell + cell / 2, cell / 2 + 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export type NumberKind = 'normal' | 'crit' | 'heal' | 'player' | 'corrode' | 'love';

interface DmgNumber {
  x: number; y: number; z: number;
  vy: number; vx: number;
  life: number; maxLife: number;
  cells: number[];
  r: number; g: number; b: number;
  scale: number;
  kind: NumberKind;
}

const KIND_COLORS: Record<NumberKind, [number, number, number]> = {
  normal: [0.85, 1.0, 1.0],
  crit: [1.0, 0.82, 0.25],
  heal: [0.4, 1.0, 0.5],
  player: [1.0, 0.3, 0.3],
  corrode: [0.6, 1.0, 0.2],
  love: [1.0, 0.17, 0.52],
};

/** Números de dano flutuantes 3D (billboard) via InstancedMesh + atlas de dígitos. */
export class DamageNumbers {
  mesh: THREE.InstancedMesh;
  mode: 'full' | 'crits' | 'off' = 'full';
  private numbers: DmgNumber[] = [];
  private maxNumbers = 90;
  private maxDigits = 480;
  private colAttr: THREE.InstancedBufferAttribute;
  private alphaAttr: THREE.InstancedBufferAttribute;
  private cellAttr: THREE.InstancedBufferAttribute;
  private dummy = new THREE.Object3D();
  private right = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(0.62, 0.78);
    this.colAttr = new THREE.InstancedBufferAttribute(new Float32Array(this.maxDigits * 3), 3);
    this.alphaAttr = new THREE.InstancedBufferAttribute(new Float32Array(this.maxDigits), 1);
    this.cellAttr = new THREE.InstancedBufferAttribute(new Float32Array(this.maxDigits), 1);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr.setUsage(THREE.DynamicDrawUsage);
    this.cellAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aColor', this.colAttr);
    geo.setAttribute('aAlpha', this.alphaAttr);
    geo.setAttribute('aCell', this.cellAttr);
    const mat = new THREE.ShaderMaterial({
      vertexShader: TEXT_VERT,
      fragmentShader: TEXT_FRAG,
      uniforms: { uAtlas: { value: makeDigitAtlas() }, uCells: { value: CHARS.length } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.maxDigits);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 50;
    scene.add(this.mesh);
    // regenera o atlas quando a fonte Orbitron terminar de carregar
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        const old = mat.uniforms.uAtlas.value as THREE.Texture;
        mat.uniforms.uAtlas.value = makeDigitAtlas();
        old.dispose();
      }).catch(() => undefined);
    }
  }

  spawn(x: number, y: number, z: number, value: number, kind: NumberKind = 'normal') {
    if (this.mode === 'off') return;
    if (this.mode === 'crits' && kind !== 'crit' && kind !== 'player') return;
    if (this.numbers.length >= this.maxNumbers) this.numbers.shift();
    const v = Math.round(value);
    let text = String(Math.abs(v));
    if (kind === 'heal') text = '+' + text;
    else if (kind === 'love') text = '♥' + text + '♥';
    const cells: number[] = [];
    for (const ch of text) {
      const idx = CHARS.indexOf(ch);
      if (idx >= 0) cells.push(idx);
    }
    const [r, g, b] = KIND_COLORS[kind];
    const life = kind === 'love' ? 1.3 : kind === 'crit' ? 1.1 : 0.8;
    this.numbers.push({
      x: x + (Math.random() - 0.5) * 0.6, y: y + 1.2, z: z + (Math.random() - 0.5) * 0.3,
      vy: 4.5 + Math.random() * 1.5, vx: (Math.random() - 0.5) * 2,
      life, maxLife: life, cells, r, g, b,
      scale: kind === 'love' ? 1.7 : kind === 'crit' ? 1.5 : kind === 'player' ? 1.25 : 1,
      kind,
    });
  }

  update(dt: number, camera: THREE.Camera) {
    this.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    let idx = 0;
    for (let n = this.numbers.length - 1; n >= 0; n--) {
      const d = this.numbers[n];
      d.life -= dt;
      if (d.life <= 0) {
        this.numbers.splice(n, 1);
        continue;
      }
      d.vy -= 9 * dt;
      d.y += d.vy * dt;
      d.x += d.vx * dt;
      const age = d.maxLife - d.life;
      const pop = d.kind === 'love' ? 1 + Math.max(0, 1 - age * 6) * 1.1 : d.kind === 'crit' ? 1 + Math.max(0, 1 - age * 5) * 0.9 : 1 + Math.max(0, 1 - age * 8) * 0.35;
      const s = d.scale * pop;
      const alpha = Math.min(1, d.life * 3);
      const w = 0.5 * s;
      const start = -((d.cells.length - 1) * w) / 2;
      for (let i = 0; i < d.cells.length && idx < this.maxDigits; i++) {
        const off = start + i * w;
        this.dummy.position.set(d.x + this.right.x * off, d.y + this.right.y * off, d.z + this.right.z * off);
        this.dummy.quaternion.copy(camera.quaternion);
        this.dummy.scale.setScalar(s);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(idx, this.dummy.matrix);
        this.colAttr.setXYZ(idx, d.r, d.g, d.b);
        this.alphaAttr.setX(idx, alpha);
        this.cellAttr.setX(idx, d.cells[i]);
        idx++;
      }
    }
    this.mesh.count = idx;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.cellAttr.needsUpdate = true;
  }

  clear() {
    this.numbers.length = 0;
    this.mesh.count = 0;
  }
}
