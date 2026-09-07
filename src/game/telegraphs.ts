import * as THREE from 'three';
import { TELEGRAPH_FRAG, TELEGRAPH_VERT } from './shaders';

export type TelegraphType = 'circle' | 'ring' | 'line';

export interface Telegraph {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  active: boolean;
  type: TelegraphType;
  life: number;
  maxLife: number;
  x: number;
  z: number;
  radius: number;
  angle: number;
  length: number;
  width: number;
  follow: (() => void) | null;
  hold: boolean;
}

/** Decalques holográficos projetados no chão (telegraphs estilo MMORPG). */
export class TelegraphSystem {
  private pool: Telegraph[] = [];
  private scene: THREE.Scene;
  private circleGeo: THREE.PlaneGeometry;
  private lineGeo: THREE.PlaneGeometry;
  private time = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.circleGeo = new THREE.PlaneGeometry(2, 2);
    this.circleGeo.rotateX(-Math.PI / 2);
    this.lineGeo = new THREE.PlaneGeometry(1, 1);
    this.lineGeo.translate(0.5, 0, 0);
    this.lineGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 48; i++) this.pool.push(this.create());
  }

  private create(): Telegraph {
    const mat = new THREE.ShaderMaterial({
      vertexShader: TELEGRAPH_VERT,
      fragmentShader: TELEGRAPH_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(1, 0.3, 0.3) },
        uProgress: { value: 0 },
        uType: { value: 0 },
        uTime: { value: 0 },
        uAlpha: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.circleGeo, mat);
    mesh.visible = false;
    mesh.position.y = 0.06;
    mesh.renderOrder = 5;
    this.scene.add(mesh);
    return {
      mesh, mat, active: false, type: 'circle', life: 0, maxLife: 1,
      x: 0, z: 0, radius: 1, angle: 0, length: 1, width: 1, follow: null, hold: false,
    };
  }

  private acquire(): Telegraph {
    let t = this.pool.find(p => !p.active);
    if (!t) {
      t = this.create();
      this.pool.push(t);
    }
    t.active = true;
    t.mesh.visible = true;
    t.follow = null;
    t.hold = false;
    return t;
  }

  circle(x: number, z: number, radius: number, duration: number, color: number): Telegraph {
    const t = this.acquire();
    t.type = 'circle';
    t.mesh.geometry = this.circleGeo;
    t.x = x; t.z = z; t.radius = radius;
    t.life = duration; t.maxLife = duration;
    t.mat.uniforms.uType.value = 0;
    (t.mat.uniforms.uColor.value as THREE.Color).setHex(color);
    t.mesh.position.set(x, 0.06, z);
    t.mesh.rotation.set(0, 0, 0);
    t.mesh.scale.set(radius, 1, radius);
    return t;
  }

  ring(x: number, z: number, radius: number, duration: number, color: number): Telegraph {
    const t = this.circle(x, z, radius, duration, color);
    t.type = 'ring';
    t.mat.uniforms.uType.value = 1;
    return t;
  }

  line(x: number, z: number, angle: number, length: number, width: number, duration: number, color: number): Telegraph {
    const t = this.acquire();
    t.type = 'line';
    t.mesh.geometry = this.lineGeo;
    t.x = x; t.z = z; t.angle = angle; t.length = length; t.width = width;
    t.life = duration; t.maxLife = duration;
    t.mat.uniforms.uType.value = 2;
    (t.mat.uniforms.uColor.value as THREE.Color).setHex(color);
    this.placeLine(t);
    return t;
  }

  placeLine(t: Telegraph) {
    t.mesh.position.set(t.x, 0.07, t.z);
    t.mesh.rotation.set(0, t.angle - Math.PI / 2, 0);
    t.mesh.scale.set(t.length, 1, t.width);
  }

  release(t: Telegraph) {
    t.active = false;
    t.mesh.visible = false;
    t.follow = null;
  }

  update(dt: number) {
    this.time += dt;
    for (const t of this.pool) {
      if (!t.active) continue;
      if (!t.hold) t.life -= dt;
      if (t.life <= 0) {
        this.release(t);
        continue;
      }
      if (t.follow) t.follow();
      const progress = 1 - t.life / t.maxLife;
      t.mat.uniforms.uProgress.value = progress;
      t.mat.uniforms.uTime.value = this.time;
      t.mat.uniforms.uAlpha.value = Math.min(1, t.life * 4) * Math.min(1, (t.maxLife - t.life) * 6 + 0.2);
    }
  }

  clear() {
    for (const t of this.pool) this.release(t);
  }
}
