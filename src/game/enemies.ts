import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ARENA_RADIUS, ENEMY_DEFS, clamp, enemyDmgMul, enemyHpMul, enemySpeedMul, rand, type EnemyDef, type EnemyType } from './config';
import { NEON_FRAG, NEON_VERT } from './shaders';
import type { Beam } from './effects';
import type { Telegraph } from './telegraphs';
import type { Game } from './game';
import { recordEnemyKill } from './save';

export interface Enemy {
  id: number;
  type: EnemyType;
  def: EnemyDef;
  x: number; y: number; z: number;
  vx: number; vz: number;
  kx: number; kz: number;
  hp: number; maxHp: number;
  shield: number; maxShield: number;
  radius: number; size: number; speed: number; damage: number;
  angle: number;
  elite: boolean;
  eliteMod?: 'teleporter' | 'reflector' | 'firemaker';
  eliteCd?: number;
  flash: number;
  frozen: number;
  burn: number; burnDps: number; burnColor: number; burnTick: number;
  bleed: number; bleedDps: number; bleedTick: number;
  curse: number; curseMult?: number;
  stun: number;
  timer: number; timer2: number; state: number;
  tx: number; tz: number;
  contactCd: number;
  beam: Beam | null;
  tele: Telegraph | null;
  dead: boolean;
  spawnT: number;
  spiral: number;
  pattern: number;
  target: Enemy | null;
  lastHit: number;
  life: number;
  spin: number;
}

interface Rift { x: number; z: number; t: number; type: EnemyType; tele: Telegraph }
interface Zone { x: number; z: number; r: number; life: number; isFire?: boolean }

const ALL_TYPES = Object.keys(ENEMY_DEFS) as EnemyType[];
const tmpC = new THREE.Color();
const tmpC2 = new THREE.Color();
const neighbors: Enemy[] = [];

class SpatialHash {
  cell = 4;
  private buckets = new Map<number, Enemy[]>();
  private key(cx: number, cz: number) { return (cx + 4096) * 8192 + (cz + 4096); }
  clear() { for (const b of this.buckets.values()) b.length = 0; }
  insert(e: Enemy) {
    const k = this.key(Math.floor(e.x / this.cell), Math.floor(e.z / this.cell));
    let b = this.buckets.get(k);
    if (!b) { b = []; this.buckets.set(k, b); }
    b.push(e);
  }
  query(x: number, z: number, r: number, out: Enemy[]) {
    const x0 = Math.floor((x - r) / this.cell), x1 = Math.floor((x + r) / this.cell);
    const z0 = Math.floor((z - r) / this.cell), z1 = Math.floor((z + r) / this.cell);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const b = this.buckets.get(this.key(cx, cz));
        if (b) for (let i = 0; i < b.length; i++) out.push(b[i]);
      }
    }
  }
}

function mergeClean(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  for (const g of geometries) {
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') {
        g.deleteAttribute(name);
      }
    }
    if (!g.attributes.normal) g.computeVertexNormals();
  }
  const merged = mergeGeometries(geometries, false);
  for (const g of geometries) g.dispose();
  if (!merged) {
    console.error('mergeGeometries failed, using fallback');
    return new THREE.BoxGeometry(1, 1, 1);
  }
  merged.computeVertexNormals();
  return merged;
}

function geoFor(type: EnemyType): THREE.BufferGeometry {
  switch (type) {
    case 'normal': {
      // Peão cibernético invasor: caça delta com fuselagem facetada, asas estabilizadoras, cockpit e turbinas
      const parts: THREE.BufferGeometry[] = [
        // Fuselagem cônica afiada
        new THREE.ConeGeometry(0.55, 1.6, 5).rotateX(Math.PI / 2).scale(1.1, 0.6, 1).translate(0, 0, 0.4),
        // Placa de blindagem superior
        new THREE.BoxGeometry(0.8, 0.25, 1.2).translate(0, 0.22, -0.1),
        // Asas estabilizadoras enflechadas
        new THREE.BoxGeometry(0.7, 0.06, 0.6).rotateY(0.4).translate(0.75, 0.05, -0.3),
        new THREE.BoxGeometry(0.7, 0.06, 0.6).rotateY(-0.4).translate(-0.75, 0.05, -0.3),
        // Turbinas duplas de exaustão
        new THREE.CylinderGeometry(0.16, 0.22, 0.5, 8).rotateX(Math.PI / 2).translate(0.35, 0, -0.9),
        new THREE.CylinderGeometry(0.16, 0.22, 0.5, 8).rotateX(Math.PI / 2).translate(-0.35, 0, -0.9),
        // Leme dorsal
        new THREE.BoxGeometry(0.06, 0.45, 0.8).translate(0, 0.35, -0.4),
        // Sensor ótico frontal
        new THREE.SphereGeometry(0.18, 8, 6).scale(1.2, 0.6, 1.2).translate(0, 0.12, 0.9),
      ];
      return mergeClean(parts);
    }

    case 'runner': {
      // Interceptor ultrarrápido agulha: fuselagem afilada, asas em flecha negativa com pontas afiadas e propulsor
      const parts: THREE.BufferGeometry[] = [
        // Bico agulha ultra-afiado
        new THREE.ConeGeometry(0.36, 2.3, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4).translate(0, 0, 0.6),
        // Asas dianteiras em flecha cortante
        new THREE.BoxGeometry(1.25, 0.04, 0.4).rotateY(-0.45).translate(0.68, 0, 0.1),
        new THREE.BoxGeometry(1.25, 0.04, 0.4).rotateY(0.45).translate(-0.68, 0, 0.1),
        // Espinhos das pontas das asas
        new THREE.ConeGeometry(0.08, 0.55, 4).rotateX(Math.PI / 2).translate(1.2, 0, 0.45),
        new THREE.ConeGeometry(0.08, 0.55, 4).rotateX(Math.PI / 2).translate(-1.2, 0, 0.45),
        // Espinha dorsal hidrodinâmica
        new THREE.CylinderGeometry(0.1, 0.24, 1.6, 6).rotateX(Math.PI / 2).translate(0, 0.12, -0.3),
        // Bocal do pós-combustor micro-jet
        new THREE.CylinderGeometry(0.16, 0.24, 0.6, 8).rotateX(Math.PI / 2).translate(0, 0, -1.1),
      ];
      return mergeClean(parts);
    }

    case 'tank': {
      // Dreadnought pesado couraçado: cidadela chanfrada, aríete frontal com dentes, saias laterais e escapamentos quádruplos
      const parts: THREE.BufferGeometry[] = [
        // Núcleo blindado facetado
        new THREE.DodecahedronGeometry(1.25, 0).scale(1.2, 0.75, 1.35),
        // Aríete frontal em cunha
        new THREE.BoxGeometry(1.8, 0.7, 0.85).rotateX(0.28).translate(0, 0.1, 1.3),
        // Dentes perfuradores do aríete
        new THREE.ConeGeometry(0.18, 0.75, 4).rotateX(Math.PI / 2).translate(0.62, -0.05, 1.85),
        new THREE.ConeGeometry(0.18, 0.75, 4).rotateX(Math.PI / 2).translate(-0.62, -0.05, 1.85),
        // Blindagens laterais (saias de absorção)
        new THREE.BoxGeometry(0.5, 0.8, 2.2).translate(1.22, 0, -0.1),
        new THREE.BoxGeometry(0.5, 0.8, 2.2).translate(-1.22, 0, -0.1),
        // Cúpula superior de comando
        new THREE.CylinderGeometry(0.6, 0.75, 0.4, 8).translate(0, 0.72, -0.15),
        // Escapamentos industriais quádruplos
        new THREE.CylinderGeometry(0.16, 0.2, 0.6, 6).translate(0.5, 0.6, -1.05),
        new THREE.CylinderGeometry(0.16, 0.2, 0.6, 6).translate(-0.5, 0.6, -1.05),
        new THREE.CylinderGeometry(0.16, 0.2, 0.6, 6).translate(0.5, 0.18, -1.25),
        new THREE.CylinderGeometry(0.16, 0.2, 0.6, 6).translate(-0.5, 0.18, -1.25),
      ];
      return mergeClean(parts);
    }

    case 'shooter': {
      // Gunship tático: chassi hexagonal com canhão de plasma frontal estendido, aletas radiadoras e ótica
      const parts: THREE.BufferGeometry[] = [
        // Chassi hexagonal
        new THREE.CylinderGeometry(0.68, 0.8, 0.58, 6).rotateX(Math.PI / 2),
        // Tubo do canhão de plasma
        new THREE.CylinderGeometry(0.13, 0.17, 1.7, 8).rotateX(Math.PI / 2).translate(0, 0, 1.2),
        // Freio de boca do canhão
        new THREE.BoxGeometry(0.34, 0.2, 0.3).translate(0, 0, 2.05),
        // Aletas laterais de resfriamento
        new THREE.BoxGeometry(1.6, 0.08, 0.7).translate(0, 0.12, -0.2),
        // Cúpula sensora / olho
        new THREE.SphereGeometry(0.24, 8, 6).translate(0, 0.42, 0.2),
        // Cone propulsor traseiro
        new THREE.ConeGeometry(0.32, 0.65, 6).rotateX(-Math.PI / 2).translate(0, 0, -0.8),
      ];
      return mergeClean(parts);
    }

    case 'sniper': {
      // Craft de franco-atirador: longo cano flautado com freio de boca ranhurado, fuso stealth, scope e estabilizadores
      const parts: THREE.BufferGeometry[] = [
        // Cano de sniper longo flautado
        new THREE.CylinderGeometry(0.09, 0.12, 3.2, 8).rotateX(Math.PI / 2).translate(0, 0, 1.35),
        // Freio de boca em bloco
        new THREE.BoxGeometry(0.3, 0.22, 0.5).translate(0, 0, 2.95),
        // Fuso de recebimento stealth
        new THREE.BoxGeometry(0.6, 0.4, 1.7).translate(0, 0, -0.4),
        // Luneta / sensor telescópico superior
        new THREE.CylinderGeometry(0.13, 0.15, 1.2, 8).rotateX(Math.PI / 2).translate(0, 0.36, 0.18),
        // Asas de estabilização bipodal perfeitamente simétricas
        new THREE.BoxGeometry(1.7, 0.06, 0.5).translate(0, -0.06, -0.3),
        new THREE.ConeGeometry(0.09, 0.75, 4).rotateZ(1.2).translate(1.05, -0.22, -0.3),
        new THREE.ConeGeometry(0.09, 0.75, 4).rotateZ(-1.2).translate(-1.05, -0.22, -0.3),
      ];
      return mergeClean(parts);
    }

    case 'shotgunner': {
      // Canhoneiro de espalhadora pesada: fuso largo blindado, escudo frontal e 3 canos em leque divergente
      const parts: THREE.BufferGeometry[] = [
        // Chassi largo blindado
        new THREE.BoxGeometry(1.9, 0.62, 1.15).translate(0, 0, -0.1),
        // Escudo de deflexão frontal
        new THREE.BoxGeometry(2.25, 0.78, 0.24).translate(0, 0.08, 0.5),
        // Três canos pesados (central e dois laterais angulados)
        new THREE.CylinderGeometry(0.17, 0.21, 1.25, 8).rotateX(Math.PI / 2).translate(0, 0.05, 1.15),
        new THREE.CylinderGeometry(0.15, 0.19, 1.15, 8).rotateX(Math.PI / 2).rotateY(0.2).translate(0.68, 0.05, 1.05),
        new THREE.CylinderGeometry(0.15, 0.19, 1.15, 8).rotateX(Math.PI / 2).rotateY(-0.2).translate(-0.68, 0.05, 1.05),
        // Bocais alargados
        new THREE.TorusGeometry(0.19, 0.045, 6, 12).translate(0, 0.05, 1.75),
        new THREE.TorusGeometry(0.17, 0.045, 6, 12).rotateY(0.2).translate(0.8, 0.05, 1.6),
        new THREE.TorusGeometry(0.17, 0.045, 6, 12).rotateY(-0.2).translate(-0.8, 0.05, 1.6),
        // Motores reforçados traseiros
        new THREE.CylinderGeometry(0.28, 0.34, 0.55, 8).rotateX(Math.PI / 2).translate(0.62, 0, -0.9),
        new THREE.CylinderGeometry(0.28, 0.34, 0.55, 8).rotateX(Math.PI / 2).translate(-0.62, 0, -0.9),
      ];
      return mergeClean(parts);
    }

    case 'orbiter': {
      // Centrífuga orbital zumbidora: anel serrilhado externo, gimbal interno e pinos radiadores
      const parts: THREE.BufferGeometry[] = [
        // Anel toroidal externo
        new THREE.TorusGeometry(0.9, 0.15, 8, 24).rotateX(Math.PI / 2),
        // Anel interno gimbal
        new THREE.TorusGeometry(0.52, 0.07, 6, 16).rotateY(Math.PI / 4),
        // Núcleo giroscópio central
        new THREE.OctahedronGeometry(0.3, 0),
        // Eixo vertical
        new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6),
      ];
      // 6 dentes cortantes apontando radialmente para fora
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        parts.push(
          new THREE.ConeGeometry(0.14, 0.55, 4)
            .rotateZ(-Math.PI / 2)
            .rotateY(a)
            .translate(Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05),
        );
      }
      return mergeClean(parts);
    }

    case 'mortar': {
      // Artilharia de obus pesado: carcaça hexagonal com estabilizadores e cano maciço inclinado para a frente
      const parts: THREE.BufferGeometry[] = [
        // Base hexagonal de apoio
        new THREE.CylinderGeometry(0.95, 1.25, 0.65, 6).translate(0, 0.32, 0),
        // Sapatas de ancoragem e absorção
        new THREE.BoxGeometry(0.38, 0.28, 1.75).translate(0, 0.14, 0),
        new THREE.BoxGeometry(1.75, 0.28, 0.38).translate(0, 0.14, 0),
        // Tubo maciço de lançamento inclinado para a frente (+Z) em direção ao alvo
        new THREE.CylinderGeometry(0.36, 0.46, 1.85, 8).rotateX(0.65).translate(0, 1.1, 0.45),
        // Anéis de reforço no cano
        new THREE.TorusGeometry(0.42, 0.05, 6, 16).rotateX(0.65).translate(0, 0.9, 0.32),
        new THREE.TorusGeometry(0.4, 0.05, 6, 16).rotateX(0.65).translate(0, 1.4, 0.62),
        // Pistões de recuo laterais
        new THREE.CylinderGeometry(0.09, 0.09, 1.15, 6).rotateX(0.65).translate(0.36, 0.9, 0.45),
        new THREE.CylinderGeometry(0.09, 0.09, 1.15, 6).rotateX(0.65).translate(-0.36, 0.9, 0.45),
      ];
      return mergeClean(parts);
    }

    case 'beam': {
      // Cruzador laser: fuso lanceiro, dois emissores frontais segurando a lente de feixe e dissipadores
      const parts: THREE.BufferGeometry[] = [
        // Fuselagem lanceira
        new THREE.BoxGeometry(0.68, 0.58, 2.5).translate(0, 0, 0),
        // Radiadores dorsais
        new THREE.BoxGeometry(0.38, 0.18, 1.7).translate(0, 0.38, -0.2),
        // Pinças frontais emissoras de feixe
        new THREE.BoxGeometry(0.13, 0.26, 1.35).translate(0.3, 0, 1.75),
        new THREE.BoxGeometry(0.13, 0.26, 1.35).translate(-0.3, 0, 1.75),
        // Anel de foco óptico
        new THREE.TorusGeometry(0.23, 0.045, 8, 16).translate(0, 0, 2.05),
        // Aletas térmicas laterais
        new THREE.BoxGeometry(1.35, 0.07, 1.15).translate(0, -0.05, -0.38),
        // Propulsor de alta potência
        new THREE.CylinderGeometry(0.28, 0.34, 0.58, 8).rotateX(Math.PI / 2).translate(0, 0, -1.4),
      ];
      return mergeClean(parts);
    }

    case 'summoner': {
      // Invocador arcano: monólito cósmico alto, anéis equatoriais de contenção e pilares satélites
      const parts: THREE.BufferGeometry[] = [
        // Monólito central esguio
        new THREE.OctahedronGeometry(0.78, 0).scale(0.68, 2.3, 0.68),
        // Anel de abertura dimensional equatorial
        new THREE.TorusGeometry(0.62, 0.06, 6, 24).rotateX(Math.PI / 2),
        // Anel secundário inclinado
        new THREE.TorusGeometry(0.78, 0.04, 6, 24).rotateX(Math.PI / 3).rotateZ(0.4),
      ];
      // 4 fragmentos satélites flutuantes
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        parts.push(
          new THREE.OctahedronGeometry(0.19, 0)
            .scale(0.58, 1.4, 0.58)
            .translate(Math.cos(a) * 0.95, 0.75, Math.sin(a) * 0.95),
        );
      }
      return mergeClean(parts);
    }

    case 'minelayer': {
      // Blindado semeador industrial: carcaça em esteira pesada, lâmina frontal, calha traseira e tambores
      const parts: THREE.BufferGeometry[] = [
        // Casco blindado reforçado
        new THREE.BoxGeometry(1.75, 0.62, 1.75),
        // Lâmina / cunha frontal de demolição
        new THREE.BoxGeometry(2.05, 0.68, 0.28).rotateX(0.24).translate(0, 0, 0.98),
        // Calha ejetora traseira de minas
        new THREE.BoxGeometry(1.15, 0.48, 0.75).translate(0, 0.28, -0.82),
        // Rolo dispensador traseiro
        new THREE.CylinderGeometry(0.13, 0.13, 1.05, 8).rotateZ(Math.PI / 2).translate(0, 0.14, -1.12),
        // Tambores laterais de armazenamento de minas
        new THREE.CylinderGeometry(0.28, 0.28, 1.35, 8).rotateX(Math.PI / 2).translate(1.02, 0.14, 0),
        new THREE.CylinderGeometry(0.28, 0.28, 1.35, 8).rotateX(Math.PI / 2).translate(-1.02, 0.14, 0),
      ];
      return mergeClean(parts);
    }

    case 'trapper': {
      // Aranha predadora / armadilha: carapaça angular 4-pontas, garras curvadas para baixo e bico tecedor
      const parts: THREE.BufferGeometry[] = [
        // Carapaça angular em diamante
        new THREE.TetrahedronGeometry(0.95, 0).scale(1.15, 0.75, 1.15).translate(0, 0.25, 0),
        // Bico emissor central de teia
        new THREE.TorusGeometry(0.34, 0.07, 6, 12).rotateX(Math.PI / 2).translate(0, 0.05, 0),
        // Espinho de antena sensorial superior
        new THREE.CylinderGeometry(0.04, 0.07, 1.2, 4).translate(0, 0.95, 0),
      ];
      // 4 garras predatórias arqueadas para fora e para baixo
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        parts.push(
          new THREE.ConeGeometry(0.14, 1.2, 4)
            .rotateX(2.6)
            .rotateY(a)
            .translate(Math.cos(a) * 0.85, 0.05, Math.sin(a) * 0.85),
        );
      }
      return mergeClean(parts);
    }

    case 'kamikaze': {
      // Bomba de fusão instável: orbe central com cinturão equatorial, 8 pontas detonadoras e foguete
      const parts: THREE.BufferGeometry[] = [
        // Núcleo esférico de fusão
        new THREE.SphereGeometry(0.66, 10, 8),
        // Cinturão de retenção equatorial
        new THREE.TorusGeometry(0.7, 0.075, 6, 16).rotateX(Math.PI / 2),
        // 6 chifres detonadores omnidirecionais
        new THREE.ConeGeometry(0.12, 0.52, 4).rotateX(Math.PI / 2).translate(0, 0, 0.82),
        new THREE.ConeGeometry(0.12, 0.52, 4).rotateX(-Math.PI / 2).translate(0, 0, -0.82),
        new THREE.ConeGeometry(0.12, 0.52, 4).rotateZ(Math.PI / 2).translate(0.82, 0, 0),
        new THREE.ConeGeometry(0.12, 0.52, 4).rotateZ(-Math.PI / 2).translate(-0.82, 0, 0),
        new THREE.ConeGeometry(0.12, 0.52, 4).translate(0, 0.82, 0),
        new THREE.ConeGeometry(0.12, 0.52, 4).rotateX(Math.PI).translate(0, -0.82, 0),
        // Bocal do motor foguete de aceleração
        new THREE.CylinderGeometry(0.19, 0.3, 0.48, 8).rotateX(Math.PI / 2).translate(0, 0, -0.82),
      ];
      return mergeClean(parts);
    }

    case 'healer': {
      // Drone de suporte bio-médico: cruz volumétrica 3D com pontas chanfradas e auréola emissora
      const parts: THREE.BufferGeometry[] = [
        // Braço longitudinal da cruz
        new THREE.BoxGeometry(1.55, 0.42, 0.52),
        // Braço transversal da cruz
        new THREE.BoxGeometry(0.52, 0.42, 1.55),
        // Tampas cônicas nas 4 pontas da cruz
        new THREE.ConeGeometry(0.26, 0.38, 4).rotateZ(-Math.PI / 2).translate(0.92, 0, 0),
        new THREE.ConeGeometry(0.26, 0.38, 4).rotateZ(Math.PI / 2).translate(-0.92, 0, 0),
        new THREE.ConeGeometry(0.26, 0.38, 4).rotateX(Math.PI / 2).translate(0, 0, 0.92),
        new THREE.ConeGeometry(0.26, 0.38, 4).rotateX(-Math.PI / 2).translate(0, 0, -0.92),
        // Auréola emissora de nano-reparo superior
        new THREE.TorusGeometry(0.48, 0.055, 6, 18).rotateX(Math.PI / 2).translate(0, 0.42, 0),
        // Bulbo emissor central
        new THREE.SphereGeometry(0.24, 8, 6).translate(0, 0.38, 0),
      ];
      return mergeClean(parts);
    }

    case 'shielder': {
      // Gerador de escudo de força: carcaça hexagonal com pylons projetores de barreira e anéis
      const parts: THREE.BufferGeometry[] = [
        // Chassi hexagonal
        new THREE.CylinderGeometry(1.1, 1.1, 0.65, 6),
        // Anéis projetores de barreira superior e inferior
        new THREE.TorusGeometry(1.25, 0.065, 6, 24).rotateX(Math.PI / 2).translate(0, 0.32, 0),
        new THREE.TorusGeometry(1.25, 0.065, 6, 24).rotateX(Math.PI / 2).translate(0, -0.32, 0),
        // Cúpula do reator
        new THREE.SphereGeometry(0.46, 10, 8),
      ];
      // 6 pylons periféricos nas pontas do hexágono
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        parts.push(
          new THREE.CylinderGeometry(0.11, 0.15, 0.85, 6).translate(Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2),
        );
      }
      return mergeClean(parts);
    }

    case 'miniboss': {
      // Colosso invasor: gigantesca fortaleza de batalha icosaédrica com cornos de sítio e placas orbitais
      const parts: THREE.BufferGeometry[] = [
        // Núcleo maciço da cidadela
        new THREE.IcosahedronGeometry(2.2, 1),
        // Anéis de foco energético
        new THREE.TorusGeometry(2.9, 0.11, 8, 32).rotateX(Math.PI / 2),
        new THREE.TorusGeometry(2.5, 0.09, 8, 24).rotateY(Math.PI / 3),
      ];
      // 6 cornos/canhões de cerco massivos
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        parts.push(
          new THREE.ConeGeometry(0.48, 1.5, 6)
            .rotateX(Math.PI / 2)
            .rotateY(a)
            .translate(Math.cos(a) * 2.3, 0, Math.sin(a) * 2.3),
        );
        // Placas de blindagem reativa externas
        parts.push(
          new THREE.BoxGeometry(1.15, 0.75, 0.28)
            .rotateY(a)
            .translate(Math.cos(a) * 2.7, 0, Math.sin(a) * 2.7),
        );
      }
      return mergeClean(parts);
    }

    case 'mine': {
      // Mina estática de proximidade: núcleo em diamante facetado, 6 sensores omnidirecionais e garras de ancoragem
      const parts: THREE.BufferGeometry[] = [
        // Núcleo em diamante
        new THREE.OctahedronGeometry(0.62, 0),
        // Anel de varredura do sensor
        new THREE.TorusGeometry(0.48, 0.045, 6, 16).rotateX(Math.PI / 2),
        // 6 espinhos sensores de detonação
        new THREE.ConeGeometry(0.085, 0.42, 4).rotateX(Math.PI / 2).translate(0, 0, 0.68),
        new THREE.ConeGeometry(0.085, 0.42, 4).rotateX(-Math.PI / 2).translate(0, 0, -0.68),
        new THREE.ConeGeometry(0.085, 0.42, 4).rotateZ(Math.PI / 2).translate(0.68, 0, 0),
        new THREE.ConeGeometry(0.085, 0.42, 4).rotateZ(-Math.PI / 2).translate(-0.68, 0, 0),
        new THREE.ConeGeometry(0.085, 0.42, 4).translate(0, 0.68, 0),
        new THREE.ConeGeometry(0.085, 0.42, 4).rotateX(Math.PI).translate(0, -0.68, 0),
      ];
      // 3 garras de ancoragem no solo
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        parts.push(
          new THREE.BoxGeometry(0.09, 0.28, 0.38)
            .rotateY(a)
            .translate(Math.cos(a) * 0.38, -0.38, Math.sin(a) * 0.38),
        );
      }
      return mergeClean(parts);
    }
  }
}

export class EnemyManager {
  list: Enemy[] = [];
  private hash = new SpatialHash();
  private nextId = 1;
  private meshes: Record<EnemyType, THREE.InstancedMesh>;
  private tints: Record<EnemyType, THREE.InstancedBufferAttribute>;
  private flashes: Record<EnemyType, THREE.InstancedBufferAttribute>;
  private mats: THREE.ShaderMaterial[] = [];
  private cores: THREE.InstancedMesh;
  private rings: THREE.InstancedMesh;
  private links: THREE.LineSegments;
  private linkPos: THREE.BufferAttribute;
  private linkCol: THREE.BufferAttribute;
  private dummy = new THREE.Object3D();
  private time = 0;
  rifts: Rift[] = [];
  zones: Zone[] = [];
  private caps: Record<EnemyType, number>;

  constructor(scene: THREE.Scene) {
    const caps = {} as Record<EnemyType, number>;
    const meshes = {} as Record<EnemyType, THREE.InstancedMesh>;
    const tints = {} as Record<EnemyType, THREE.InstancedBufferAttribute>;
    const flashes = {} as Record<EnemyType, THREE.InstancedBufferAttribute>;
    for (const t of ALL_TYPES) {
      const cap = t === 'normal' ? 260 : t === 'miniboss' ? 6 : t === 'mine' ? 60 : 120;
      caps[t] = cap;
      const geo = geoFor(t);
      const tint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
      const flash = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aTint', tint);
      geo.setAttribute('aFlash', flash);
      const def = ENEMY_DEFS[t];
      const mat = new THREE.ShaderMaterial({
        vertexShader: NEON_VERT,
        fragmentShader: NEON_FRAG,
        uniforms: { uTime: { value: 0 }, uBase: { value: new THREE.Color(def.color).multiplyScalar(0.22).lerp(new THREE.Color(0x0a0a18), 0.4) } },
      });
      this.mats.push(mat);
      const mesh = new THREE.InstancedMesh(geo, mat, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false;
      scene.add(mesh);
      meshes[t] = mesh;
      tints[t] = tint;
      flashes[t] = flash;
    }
    this.caps = caps;
    this.meshes = meshes;
    this.tints = tints;
    this.flashes = flashes;

    this.cores = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 500);
    this.cores.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(500 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.cores.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cores.count = 0;
    this.cores.frustumCulled = false;
    scene.add(this.cores);

    const ringGeo = new THREE.TorusGeometry(1, 0.07, 6, 40);
    ringGeo.rotateX(Math.PI / 2);
    this.rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 200);
    this.rings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(200 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.rings.count = 0;
    this.rings.frustumCulled = false;
    scene.add(this.rings);

    const lg = new THREE.BufferGeometry();
    this.linkPos = new THREE.BufferAttribute(new Float32Array(128 * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.linkCol = new THREE.BufferAttribute(new Float32Array(128 * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    lg.setAttribute('position', this.linkPos);
    lg.setAttribute('color', this.linkCol);
    lg.setDrawRange(0, 0);
    this.links = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.links.frustumCulled = false;
    scene.add(this.links);
  }

  get count() { return this.list.length; }

  query(x: number, z: number, r: number, out: Enemy[]) { this.hash.query(x, z, r, out); }

  nearest(x: number, z: number, maxR: number, exclude?: Enemy): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxR * maxR;
    for (const e of this.list) {
      if (e.dead || e === exclude || e.type === 'mine') continue;
      const d = (e.x - x) ** 2 + (e.z - z) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  spawn(type: EnemyType, x: number, z: number, wave: number, elite = false): Enemy {
    const def = ENEMY_DEFS[type];
    const hpMul = enemyHpMul(wave);
    const size = (elite ? 1.5 : 1) * (type === 'miniboss' ? 1 : rand(0.92, 1.08));
    const e: Enemy = {
      id: this.nextId++, type, def, x, y: 0.9, z, vx: 0, vz: 0, kx: 0, kz: 0,
      hp: def.hp * hpMul * (elite ? 3.5 : 1), maxHp: def.hp * hpMul * (elite ? 3.5 : 1),
      shield: 0, maxShield: 0,
      radius: def.radius, size, speed: def.speed * enemySpeedMul(wave) * (elite ? 1.2 : 1) * rand(0.92, 1.08),
      damage: def.damage * enemyDmgMul(wave) * (elite ? 1.5 : 1),
      angle: Math.random() * Math.PI * 2, elite, flash: 0, frozen: 0,
      burn: 0, burnDps: 0, burnColor: 0xff8020, burnTick: 0,
      bleed: 0, bleedDps: 0, bleedTick: 0,
      curse: 0,
      stun: 0,
      timer: rand(0.5, 2), timer2: Math.random() * Math.PI * 2, state: 0, tx: x, tz: z, contactCd: 0,
      beam: null, tele: null, dead: false, spawnT: type === 'mine' ? 0 : 0.55, spiral: 0, pattern: 0, target: null, lastHit: 99,
      life: type === 'mine' ? 25 : Infinity, spin: 0,
    };
    if (type === 'miniboss') {
      e.y = 2.2;
      e.maxShield = e.maxHp * 0.28;
      e.shield = e.maxShield;
      e.timer = 2;
    }
    if (type === 'mine') { e.y = 0.5; e.hp = e.maxHp = 1; }
    if (type === 'kamikaze') e.timer2 = 0;
    if (elite) {
      e.maxShield = e.maxHp * 0.35;
      e.shield = e.maxShield;
      const mods: ('teleporter' | 'reflector' | 'firemaker')[] = ['teleporter', 'reflector', 'firemaker'];
      e.eliteMod = mods[Math.floor(Math.random() * mods.length)];
      e.eliteCd = rand(2.2, 4.0);
    }
    this.list.push(e);
    return e;
  }

  applyBurn(e: Enemy, dps: number, dur: number, color: number) {
    e.burn = Math.max(e.burn, dur);
    e.burnDps = Math.max(e.burnDps, dps);
    e.burnColor = color;
  }

  applyBleed(e: Enemy, dps: number, dur: number) {
    e.bleed = Math.max(e.bleed, dur);
    e.bleedDps = Math.max(e.bleedDps, dps);
  }

  applyCurse(e: Enemy, dur: number, mult = 1.25) {
    e.curse = Math.max(e.curse, dur);
    e.curseMult = Math.max(e.curseMult ?? 1, mult);
  }

  applyFreeze(e: Enemy, dur: number) {
    if (e.type === 'miniboss') dur *= 0.4;
    e.frozen = Math.max(e.frozen, dur);
  }

  knockback(e: Enemy, dx: number, dz: number, force: number) {
    const d = Math.hypot(dx, dz) || 1;
    const mass = e.type === 'tank' ? 0.35 : e.type === 'miniboss' ? 0.08 : 1;
    e.kx += dx / d * force * mass;
    e.kz += dz / d * force * mass;
  }

  pushAll(x: number, z: number, radius: number, force: number, stun: number) {
    for (const e of this.list) {
      if (e.dead) continue;
      const dx = e.x - x, dz = e.z - z;
      const d = Math.hypot(dx, dz);
      if (d < radius) {
        const k = 1 - d / radius * 0.5;
        this.knockback(e, dx, dz, force * k);
        e.stun = Math.max(e.stun, stun);
      }
    }
  }

  damage(e: Enemy, amount: number, game: Game, crit = false, kind: 'normal' | 'corrode' | 'love' = 'normal'): boolean {
    if (e.dead) return false;
    if (e.curse > 0) amount *= (e.curseMult ?? 1.25);
    if (e.type === 'tank') amount = Math.max(1, amount - 3 * (e.elite ? 2 : 1) * enemyDmgMul(game.wave));
    if (e.type === 'miniboss') amount *= 0.85;
    if (e.shield > 0) {
      const abs = Math.min(e.shield, amount);
      e.shield -= abs;
      amount -= abs;
      game.particles.burst(e.x, e.y + 0.5, e.z, 5, 0x4d8dff, { speed: 5, life: 0.35, size: 0.25, gravity: 0 });
      if (amount <= 0) { e.flash = 0.6; return false; }
    }
    e.hp -= amount;
    e.flash = 1;
    e.lastHit = 0;
    if (kind !== 'corrode' || Math.random() < 0.5) game.numbers.spawn(e.x, e.y + e.radius * e.size, e.z, amount, kind === 'love' ? 'love' : crit ? 'crit' : kind);
    if (e.hp <= 0) { this.kill(e, game); return true; }
    if (e.elite && e.eliteMod === 'reflector' && Math.random() < 0.2) {
      const ang = Math.atan2(game.player.x - e.x, game.player.z - e.z);
      this.fire(game, e, ang, 16, e.damage * 0.35, 0x00ffff, 0.25, 2.5);
      game.audio.shieldHit();
      game.particles.burst(e.x, e.y + 0.5, e.z, 5, 0x00ffff, { speed: 4, life: 0.3, size: 0.2 });
    }
    return false;
  }

  kill(e: Enemy, game: Game) {
    if (e.dead) return;
    recordEnemyKill(e.type);
    e.dead = true;
    this.releaseFx(e);
    const c = e.def.color;
    const big = e.type === 'tank' || e.type === 'miniboss' || e.elite;
    const n = e.type === 'miniboss' ? 220 : big ? 70 : e.type === 'mine' ? 20 : 26;
    if (e.type !== 'mine' && e.type !== 'kamikaze') {
      game.vfx.explosion(e.x, e.y, e.z, c, e.type === 'miniboss' ? 9 : big ? 3.4 : 1.5 * e.size, big ? 1.4 : 0.35);
    }
    game.particles.burst(e.x, e.y, e.z, n, c, { speed: big ? 14 : 9, life: big ? 1.3 : 0.9, size: big ? 0.5 : 0.35 });
    game.particles.burst(e.x, e.y, e.z, Math.floor(n / 3), 0xffffff, { speed: 6, life: 0.4, size: 0.3, gravity: 0 });
    game.debris.spawn(e.x, e.y, e.z, c, big ? 8 : 3, big ? 10 : 6, e.size);
    if (e.type === 'kamikaze' || e.type === 'mine') {
      game.explodeEnemy(e.x, e.z, e.type === 'mine' ? 3.2 : 2.6, e.damage, c);
    } else if (big) {
      game.blastDistortion(e.x, e.z, e.type === 'miniboss' ? 1.4 : 0.5);
      game.shockwaves.spawn(e.x, e.z, c, { endR: e.type === 'miniboss' ? 22 : 8, duration: 0.7, thick: true });
      game.lights.flash(e.x, 3, e.z, c, e.type === 'miniboss' ? 1500 : 500, 0.6, 40);
      game.camera.shake(e.type === 'miniboss' ? 0.8 : 0.3);
      game.world.ripple(e.x, e.z, e.type === 'miniboss' ? 2.5 : 1);
      game.audio.explosion(e.type === 'miniboss' ? 2.5 : 1.2);
    } else {
      game.audio.enemyDeath();
    }
    game.onEnemyKilled(e);
  }

  private releaseFx(e: Enemy) {
    if (e.beam) { e.beam.release(); e.beam = null; }
    if (e.tele) { e.tele.hold = false; e.tele.life = 0.01; e.tele = null; }
  }

  clear() {
    for (const e of this.list) this.releaseFx(e);
    this.list.length = 0;
    for (const r of this.rifts) { r.tele.hold = false; r.tele.life = 0.01; }
    this.rifts.length = 0;
    this.zones.length = 0;
    this.hash.clear();
    this.render(null);
  }

  killAll(game: Game) {
    for (const e of [...this.list]) if (!e.dead) this.kill(e, game);
  }

  // ---------------------------------------------------------------------
  update(dt: number, game: Game) {
    this.time += dt;
    for (const m of this.mats) m.uniforms.uTime.value = this.time;
    const pl = game.player;

    this.hash.clear();
    for (const e of this.list) if (!e.dead) this.hash.insert(e);

    // fendas do invocador
    for (let i = this.rifts.length - 1; i >= 0; i--) {
      const r = this.rifts[i];
      r.t -= dt;
      if (r.t <= 0) {
        this.rifts.splice(i, 1);
        r.tele.hold = false; r.tele.life = 0.01;
        if (this.list.length < 300) {
          const e = this.spawn(r.type, r.x, r.z, game.wave);
          e.spawnT = 0.3;
        }
        game.particles.burst(r.x, 0.5, r.z, 20, 0xa020ff, { speed: 6, life: 0.6, size: 0.3, gravity: 6 });
      }
    }
    // zonas de estase e fogo
    let slow = 1;
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.life -= dt;
      if (z.life <= 0) { this.zones.splice(i, 1); continue; }
      const pDist = Math.hypot(pl.x - z.x, pl.z - z.z);
      if (z.isFire) {
        if (pDist < z.r && pl.alive) {
          game.damagePlayer(16 * enemyDmgMul(game.wave) * dt, z.x, z.z);
        }
        if (Math.random() < 0.35) {
          const a = Math.random() * Math.PI * 2, rr = Math.random() * z.r;
          game.particles.emit(z.x + Math.cos(a) * rr, 0.2, z.z + Math.sin(a) * rr, 0, 1.4, 0, 0.6, 0.25, 1, 0.35, 0.05, 0, 0, 0, 1);
        }
      } else {
        if (pDist < z.r) slow = 0.45;
        if (Math.random() < 0.3) {
          const a = Math.random() * Math.PI * 2, rr = Math.random() * z.r;
          game.particles.emit(z.x + Math.cos(a) * rr, 0.2, z.z + Math.sin(a) * rr, 0, 1.5, 0, 0.8, 0.2, 0.25, 1, 0.9, 0, 0, 0, 1);
        }
      }
    }
    pl.zoneSlow = slow;

    for (const e of this.list) {
      if (e.dead) continue;
      e.lastHit += dt;
      if (e.spawnT > 0) { e.spawnT -= dt; continue; }
      e.flash = Math.max(0, e.flash - dt * 6);
      e.contactCd -= dt;
      if (e.life !== Infinity) { e.life -= dt; if (e.life <= 0) { this.kill(e, game); continue; } }

      // status
      if (e.burn > 0) {
        e.burn -= dt;
        e.burnTick -= dt;
        if (e.burnTick <= 0) {
          e.burnTick = 0.3;
          const tick = e.burnDps * 0.3;
          game.recordDamage(tick, e.burnColor === 0x8cff2a ? 'corrode' : 'burn');
          if (this.damage(e, tick, game, false, 'corrode')) continue;
          game.particles.emit(e.x + rand(-0.4, 0.4), e.y + 0.6, e.z + rand(-0.4, 0.4), 0, 2.5, 0, 0.5, 0.3, tmpC.setHex(e.burnColor).r, tmpC.g, tmpC.b, 0, 0, 0, 1);
        }
        if (e.burn <= 0) e.burnDps = 0;
      }
      if (e.bleed > 0) {
        e.bleed -= dt;
        e.bleedTick -= dt;
        if (e.bleedTick <= 0) {
          e.bleedTick = 0.25;
          const tick = e.bleedDps * 0.25;
          game.recordDamage(tick, 'bleeding');
          if (this.damage(e, tick, game, true, 'normal')) continue;
          game.particles.burst(e.x, e.y + 0.6, e.z, 4, 0xdc143c, { speed: 3.5, life: 0.25, size: 0.25, gravity: 8 });
        }
        if (e.bleed <= 0) e.bleedDps = 0;
      }
      if (e.curse > 0) {
        e.curse -= dt;
        if (Math.random() < 0.22) {
          game.particles.emit(e.x + rand(-0.35, 0.35), e.y + 0.6, e.z + rand(-0.35, 0.35), 0, 1.2, 0, 0.35, 0.22, 0.75, 0.36, 1, 0, 0, 0, 1);
        }
        if (e.curse <= 0) e.curseMult = 1;
      }
      if (e.frozen > 0) e.frozen -= dt;
      if (e.stun > 0) e.stun -= dt;
      if (e.elite && e.lastHit > 3 && e.shield < e.maxShield) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.12 * dt);

      // elite modifiers
      if (e.elite && e.eliteMod) {
        if (e.eliteMod === 'firemaker') {
          e.eliteCd = (e.eliteCd || 0) - dt;
          if (e.eliteCd <= 0) {
            e.eliteCd = rand(2.0, 3.2);
            this.zones.push({ x: e.x, z: e.z, r: 2.2, life: 5.0, isFire: true });
            game.particles.burst(e.x, 0.2, e.z, 12, 0xff4500, { speed: 3.5, life: 0.5, size: 0.35, gravity: 0 });
          }
          if (Math.random() < 0.2) {
            game.particles.emit(e.x + rand(-0.25, 0.25), 0.2, e.z + rand(-0.25, 0.25), 0, 0.6, 0, 0.5, 0.3, 1, 0.4, 0, 0, 0, 0, 1);
          }
        } else if (e.eliteMod === 'teleporter') {
          e.eliteCd = (e.eliteCd || 0) - dt;
          const pDist = Math.hypot(pl.x - e.x, pl.z - e.z);
          if (e.eliteCd <= 0 && pDist < 8 && pl.alive) {
            e.eliteCd = rand(4, 6);
            game.particles.burst(e.x, e.y, e.z, 16, 0xbf40bf, { speed: 5, life: 0.4, size: 0.3 });
            const ang = Math.random() * Math.PI * 2;
            e.x = clamp(pl.x + Math.cos(ang) * 9, -ARENA_RADIUS + 3, ARENA_RADIUS - 3);
            e.z = clamp(pl.z + Math.sin(ang) * 9, -ARENA_RADIUS + 3, ARENA_RADIUS - 3);
            game.particles.burst(e.x, e.y, e.z, 16, 0xbf40bf, { speed: 5, life: 0.4, size: 0.3 });
            game.audio.dash();
          }
        }
      }

      const mul = (e.frozen > 0 ? 0.22 : 1) * (e.stun > 0 ? 0 : 1);

      // knockback
      e.x += e.kx * dt; e.z += e.kz * dt;
      const kf = Math.max(0, 1 - 6 * dt);
      e.kx *= kf; e.kz *= kf;

      if (mul > 0) this.behave(e, dt, game, mul);
      else if (e.tele && e.type !== 'mine') { e.tele.hold = false; e.tele.life = 0.01; e.tele = null; e.state = 0; if (e.beam) { e.beam.release(); e.beam = null; } }

      // separação suave (boids buffer)
      if (e.type !== 'mine') {
        neighbors.length = 0;
        this.hash.query(e.x, e.z, e.radius * e.size + 2.5, neighbors);
        const massA = e.type === 'tank' ? 3 : e.type === 'miniboss' ? 8 : 1;
        for (const o of neighbors) {
          if (o === e || o.dead || o.type === 'mine') continue;
          const dx = e.x - o.x, dz = e.z - o.z;
          const rr = e.radius * e.size + o.radius * o.size;
          const softR = rr + 1.2;
          const d2 = dx * dx + dz * dz;
          if (d2 < softR * softR && d2 > 1e-6) {
            const d = Math.sqrt(d2);
            const massB = o.type === 'tank' ? 3 : o.type === 'miniboss' ? 8 : 1;
            const ratio = massB / (massA + massB);
            let push = 0;
            if (d < rr) {
              push = (rr - d) * 0.5 * ratio * 2;
            } else {
              push = ((softR - d) / 1.2) * 0.25 * ratio;
            }
            e.x += dx / d * push; e.z += dz / d * push;
          }
        }
      }

      // limites da arena
      const rad = Math.hypot(e.x, e.z);
      const lim = ARENA_RADIUS - 1.5;
      if (rad > lim) { e.x *= lim / rad; e.z *= lim / rad; }

      // contato com o jogador
      if (pl.alive) {
        const dx = pl.x - e.x, dz = pl.z - e.z;
        const d = Math.hypot(dx, dz);
        if (e.type === 'mine') {
          if (d < 1.9) this.kill(e, game);
        } else if (d < e.radius * e.size + pl.radius && e.contactCd <= 0) {
          if (!pl.invulnerable) {
            game.damagePlayer(e.damage, e.x, e.z);
            e.contactCd = 0.7;
            if (e.type === 'kamikaze') { this.kill(e, game); continue; }
            this.knockback(e, -dx, -dz, 6);
          }
        }
      }

      // flutuação
      const baseY = e.type === 'miniboss' ? 2.2 : e.type === 'mine' ? 0.5 : 0.9 + (e.size - 1) * 0.6;
      e.y = baseY + Math.sin(this.time * 3 + e.id) * 0.12;
    }

    // remover mortos
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].dead) this.list.splice(i, 1);
    this.render(game);
  }

  // ---------------------------------------------------------------------
  private moveToward(e: Enemy, tx: number, tz: number, dt: number, speed: number) {
    const dx = tx - e.x, dz = tz - e.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    const step = Math.min(d, speed * dt);
    e.vx = dx / d * speed; e.vz = dz / d * speed;
    e.x += dx / d * step; e.z += dz / d * step;
  }

  private keepDistance(e: Enemy, dt: number, game: Game, mul: number, desired: number, tol = 2) {
    const pl = game.player;
    const dx = pl.x - e.x, dz = pl.z - e.z;
    const d = Math.hypot(dx, dz) || 0.001;
    e.angle = Math.atan2(dx, dz);
    const sp = e.speed * mul;
    if (d > desired + tol) this.moveToward(e, pl.x, pl.z, dt, sp);
    else if (d < desired - tol) this.moveToward(e, e.x - dx / d * 5, e.z - dz / d * 5, dt, sp);
    else {
      // strafe orbital lento
      const dir = e.id % 2 === 0 ? 1 : -1;
      const tx = e.x + (-dz / d) * dir * 3, tz = e.z + (dx / d) * dir * 3;
      this.moveToward(e, tx, tz, dt, sp * 0.5);
    }
  }

  private fire(game: Game, e: Enemy, angle: number, speed: number, dmg: number, color: number, radius = 0.32, life = 4) {
    game.projectiles.spawn({
      kind: 'ebullet', enemy: true, x: e.x + Math.sin(angle) * e.radius * e.size, z: e.z + Math.cos(angle) * e.radius * e.size, y: e.y,
      vx: Math.sin(angle) * speed, vz: Math.cos(angle) * speed, dmg, life, radius, color,
    });
  }

  private behave(e: Enemy, dt: number, game: Game, mul: number) {
    const pl = game.player;
    const dx = pl.x - e.x, dz = pl.z - e.z;
    const d = Math.hypot(dx, dz) || 0.001;
    const aimAngle = Math.atan2(dx, dz);
    const sp = e.speed * mul;

    switch (e.type) {
      case 'normal': {
        // enxame: leve ondulação lateral coordenada
        const sway = Math.sin(this.time * 2 + e.id * 0.7) * 1.5;
        this.moveToward(e, pl.x + (-dz / d) * sway, pl.z + (dx / d) * sway, dt, sp);
        e.angle = aimAngle;
        break;
      }
      case 'runner': {
        e.timer -= dt;
        if (e.state === 1) {
          e.timer2 -= dt;
          this.moveToward(e, e.tx, e.tz, dt, sp * 3.2);
          if (Math.random() < 0.6) game.particles.emit(e.x, e.y, e.z, 0, 0, 0, 0.3, 0.3, 1, 0.6, 0.2, 0, 0, 0, 1);
          if (e.timer2 <= 0) { e.state = 0; e.timer = rand(1.6, 2.6); }
        } else {
          this.moveToward(e, pl.x, pl.z, dt, sp);
          if (e.timer <= 0 && d < 16) {
            e.state = 1; e.timer2 = 0.32;
            e.tx = pl.x + dx / d * 3; e.tz = pl.z + dz / d * 3;
          }
        }
        e.angle = Math.atan2(e.vx, e.vz);
        break;
      }
      case 'tank': {
        this.moveToward(e, pl.x, pl.z, dt, sp);
        e.angle += dt * 0.6;
        break;
      }
      case 'shooter': {
        this.keepDistance(e, dt, game, mul, 12);
        e.timer -= dt;
        if (e.timer <= 0 && d < 30) {
          e.timer = rand(1.8, 2.6);
          this.fire(game, e, aimAngle, 14, e.damage, 0xff5533);
          game.audio.enemyShot('orb');
          game.particles.burst(e.x + Math.sin(aimAngle), e.y, e.z + Math.cos(aimAngle), 5, 0xff5533, { speed: 3, life: 0.25, size: 0.25, gravity: 0 });
        }
        break;
      }
      case 'sniper': {
        if (e.state === 0) {
          this.keepDistance(e, dt, game, mul, 22, 3);
          e.timer -= dt;
          if (e.timer <= 0 && d < 40) {
            e.state = 1; e.timer2 = 1.15;
            const t = game.telegraphs.line(e.x, e.z, aimAngle, 60, 0.5, 1.15, 0xff0044);
            e.tele = t;
            t.follow = () => { t.x = e.x; t.z = e.z; t.angle = e.angle; game.telegraphs.placeLine(t); };
            game.audio.sniperLock();
          }
        } else {
          const prevT2 = e.timer2;
          e.timer2 -= dt;
          if (prevT2 >= 0.35 && e.timer2 < 0.35) {
            game.audio.sniperLock();
          }
          if (e.tele && e.timer2 < 0.35) {
            e.tele.mat.uniforms.uColor.value.setHex(Math.floor(e.timer2 * 14) % 2 === 0 ? 0xffffff : 0xff0044);
          }
          // rastreia lentamente
          let da = aimAngle - e.angle;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          e.angle += clamp(da, -1.2 * dt, 1.2 * dt);
          if (e.timer2 <= 0) {
            e.state = 0; e.timer = rand(2.8, 4);
            if (e.tele) { e.tele.hold = false; e.tele.life = 0.01; e.tele = null; }
            this.fire(game, e, e.angle, 42, e.damage, 0xff0044, 0.3, 3);
            game.audio.enemyShot('sniper');
            game.particles.burst(e.x, e.y, e.z, 10, 0xff0044, { speed: 5, life: 0.3, size: 0.25, gravity: 0 });
          }
        }
        break;
      }
      case 'shotgunner': {
        this.keepDistance(e, dt, game, mul, 9);
        e.timer -= dt;
        if (e.timer <= 0 && d < 22) {
          e.timer = rand(2.4, 3.2);
          for (let i = -2; i <= 2; i++) this.fire(game, e, aimAngle + i * 0.21, 13, e.damage, 0xff7a00, 0.28, 2.5);
          game.audio.enemyShot('shotgun');
        }
        break;
      }
      case 'orbiter': {
        if (e.state === 0) {
          e.timer2 += dt * sp / 9;
          const tx = pl.x + Math.cos(e.timer2) * 9, tz = pl.z + Math.sin(e.timer2) * 9;
          this.moveToward(e, tx, tz, dt, sp * 1.3);
          e.timer -= dt;
          if (e.timer <= 0 && d < 14) {
            e.state = 1; e.timer = 0.65;
            e.tx = pl.x + dx / d * 7; e.tz = pl.z + dz / d * 7;
          }
        } else {
          e.timer -= dt;
          this.moveToward(e, e.tx, e.tz, dt, sp * 3.4);
          if (Math.random() < 0.7) game.particles.emit(e.x, e.y, e.z, 0, 0, 0, 0.35, 0.35, 0.2, 0.9, 1, 0, 0, 0, 1);
          if (e.timer <= 0) { e.state = 0; e.timer = rand(3, 4.5); }
        }
        e.angle = Math.atan2(e.vx, e.vz);
        e.spin += dt * 9;
        break;
      }
      case 'mortar': {
        this.keepDistance(e, dt, game, mul, 17, 3);
        e.timer -= dt;
        if (e.timer <= 0 && d < 34) {
          e.timer = rand(2.8, 3.6);
          const tx = pl.x + pl.vx * 0.45 + rand(-1.5, 1.5), tz = pl.z + pl.vz * 0.45 + rand(-1.5, 1.5);
          const dur = 1.35;
          const tele = game.telegraphs.circle(tx, tz, 3.4, dur, 0xffb020);
          game.projectiles.spawnBomb(e.x, e.z, tx, tz, dur, e.damage, 3.4, 0xffb020, tele);
          game.audio.enemyShot('mortar');
        }
        break;
      }
      case 'beam': {
        if (e.state === 0) {
          this.keepDistance(e, dt, game, mul, 13, 2);
          e.timer -= dt;
          if (e.timer <= 0 && d < 24) {
            e.state = 1; e.timer2 = 1.0;
            const t = game.telegraphs.line(e.x, e.z, aimAngle, 34, 1.6, 1.0, 0xff3cff);
            e.tele = t;
            t.follow = () => { t.x = e.x; t.z = e.z; t.angle = e.angle; game.telegraphs.placeLine(t); };
            game.audio.beamStart();
          }
        } else if (e.state === 1) {
          const prevT2 = e.timer2;
          e.timer2 -= dt;
          e.angle = aimAngle;
          if (prevT2 >= 0.35 && e.timer2 < 0.35) {
            game.audio.warning();
          }
          if (e.tele && e.timer2 < 0.35) {
            e.tele.mat.uniforms.uColor.value.setHex(Math.floor(e.timer2 * 14) % 2 === 0 ? 0xffffff : 0xff3cff);
          }
          if (e.timer2 <= 0) {
            e.state = 2; e.timer2 = 2.3;
            if (e.tele) { e.tele.hold = false; e.tele.life = 0.01; e.tele = null; }
            e.beam = game.beams.acquire(0xff3cff);
            game.camera.shake(0.15);
          }
        } else {
          e.timer2 -= dt;
          let da = aimAngle - e.angle;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          e.angle += clamp(da, -0.55 * dt, 0.55 * dt);
          if (e.beam) {
            e.beam.set(e.x, e.z, e.angle, 34, 1.4 + Math.sin(this.time * 30) * 0.15);
            // dano: distância do jogador à linha
            const fx = Math.sin(e.angle), fz = Math.cos(e.angle);
            const px = pl.x - e.x, pz = pl.z - e.z;
            const along = px * fx + pz * fz;
            const perp = Math.abs(px * fz - pz * fx);
            if (along > 0 && along < 34 && perp < 1.1 + pl.radius) game.damagePlayer(e.damage * 0.7, e.x, e.z);
            if (Math.random() < 0.5) {
              const t = Math.random() * 34;
              game.particles.emit(e.x + fx * t, 1, e.z + fz * t, rand(-2, 2), rand(1, 3), rand(-2, 2), 0.3, 0.25, 1, 0.3, 1, 0, 0, 0, 1);
            }
          }
          if (e.timer2 <= 0) {
            e.state = 0; e.timer = rand(2.5, 3.5);
            if (e.beam) { e.beam.release(); e.beam = null; }
          }
        }
        break;
      }
      case 'summoner': {
        this.keepDistance(e, dt, game, mul, 16, 3);
        e.timer -= dt;
        e.spin += dt * 2;
        if (e.timer <= 0 && d < 36 && this.list.length < 240) {
          e.timer = rand(5.5, 7);
          for (let i = 0; i < 2; i++) {
            const a = Math.random() * Math.PI * 2, r = rand(2.5, 6);
            const x = clamp(e.x + Math.cos(a) * r, -ARENA_RADIUS + 3, ARENA_RADIUS - 3);
            const z = clamp(e.z + Math.sin(a) * r, -ARENA_RADIUS + 3, ARENA_RADIUS - 3);
            this.rifts.push({ x, z, t: 1.0, type: game.wave >= 8 && Math.random() < 0.4 ? 'runner' : 'normal', tele: game.telegraphs.ring(x, z, 2.0, 1.05, 0xa020ff) });
          }
          game.particles.burst(e.x, e.y + 1, e.z, 16, 0xa020ff, { speed: 4, life: 0.6, size: 0.3, gravity: -2 });
        }
        break;
      }
      case 'minelayer': {
        this.keepDistance(e, dt, game, mul, 10, 2);
        e.timer -= dt;
        if (e.timer <= 0 && d < 28) {
          e.timer = rand(2.6, 3.4);
          const m = this.spawn('mine', e.x - Math.sin(e.angle) * 1.2, e.z - Math.cos(e.angle) * 1.2, game.wave);
          m.damage = e.damage;
          game.particles.burst(m.x, 0.5, m.z, 8, 0xffe02d, { speed: 3, life: 0.4, size: 0.25 });
        }
        break;
      }
      case 'trapper': {
        this.keepDistance(e, dt, game, mul, 12, 2);
        e.timer -= dt;
        if (e.timer <= 0 && d < 26) {
          e.timer = rand(4.5, 6);
          const tele = game.telegraphs.circle(pl.x, pl.z, 4.2, 8, 0x40ffe0);
          tele.hold = false;
          this.zones.push({ x: pl.x, z: pl.z, r: 4.2, life: 8 });
          game.particles.ring(pl.x, 0.3, pl.z, 24, 0x40ffe0, 4.2, 0.5, 0.8, 0.3);
          game.audio.freeze();
        }
        e.spin += dt * 1.5;
        break;
      }
      case 'kamikaze': {
        e.timer2 = Math.min(3, e.timer2 + dt * 0.5);
        this.moveToward(e, pl.x, pl.z, dt, sp * (1 + e.timer2 * 0.55));
        e.angle = aimAngle;
        if (Math.random() < 0.5) game.particles.emit(e.x, e.y, e.z, 0, 1, 0, 0.3, 0.3, 1, 0.15, 0.1, 0, 0, 0, 1);
        break;
      }
      case 'healer': {
        e.timer -= dt;
        if (e.timer <= 0) {
          e.timer = 0.5;
          let best: Enemy | null = null;
          let bs = Infinity;
          for (const o of this.list) {
            if (o === e || o.dead || o.type === 'healer' || o.type === 'mine' || o.hp >= o.maxHp) continue;
            const dd = (o.x - e.x) ** 2 + (o.z - e.z) ** 2;
            if (dd < 14 * 14 && dd < bs) { bs = dd; best = o; }
          }
          e.target = best;
          if (best) {
            best.hp = Math.min(best.maxHp, best.hp + best.maxHp * 0.045);
            game.particles.emit(best.x, best.y + 0.8, best.z, 0, 2.5, 0, 0.5, 0.35, 0.2, 1, 0.5, 0, 0, 0, 1);
          }
        }
        if (e.target && !e.target.dead) {
          const t = e.target;
          const td = Math.hypot(t.x - e.x, t.z - e.z);
          if (td > 6) this.moveToward(e, t.x, t.z, dt, sp);
          e.angle = Math.atan2(t.x - e.x, t.z - e.z);
        } else {
          e.target = null;
          this.keepDistance(e, dt, game, mul, 15, 3);
        }
        e.spin += dt * 2;
        break;
      }
      case 'shielder': {
        this.keepDistance(e, dt, game, mul, 14, 3);
        e.timer -= dt;
        if (e.timer <= 0) {
          e.timer = 4;
          let n = 0;
          const cands = this.list.filter(o => o !== e && !o.dead && o.type !== 'mine' && o.type !== 'shielder' && (o.x - e.x) ** 2 + (o.z - e.z) ** 2 < 100)
            .sort((a, b) => ((a.x - e.x) ** 2 + (a.z - e.z) ** 2) - ((b.x - e.x) ** 2 + (b.z - e.z) ** 2));
          for (const o of cands) {
            if (n >= 4) break;
            o.maxShield = Math.max(o.maxShield, o.maxHp * 0.3);
            o.shield = Math.max(o.shield, o.maxHp * 0.3);
            game.particles.burst(o.x, o.y + 0.5, o.z, 8, 0x4d8dff, { speed: 3, life: 0.5, size: 0.3, gravity: -3 });
            n++;
          }
          if (n > 0) game.audio.shieldHit();
        }
        e.spin += dt;
        break;
      }
      case 'miniboss': {
        this.keepDistance(e, dt, game, mul, 10, 3);
        e.spin += dt * 0.8;
        e.timer -= dt;
        if (e.state === 0 && e.timer <= 0) {
          e.state = 1; e.pattern = (e.pattern + 1) % 4; e.timer2 = 0;
          e.timer = e.pattern === 0 ? 2.6 : e.pattern === 2 ? 0.6 : 1.2;
        } else if (e.state === 1) {
          e.timer2 += dt;
          if (e.pattern === 0) {
            // espiral dupla
            e.spiral += dt * 4.2;
            if (Math.floor(e.timer2 / 0.085) !== Math.floor((e.timer2 - dt) / 0.085)) {
              this.fire(game, e, e.spiral, 13.5, e.damage * 0.75, 0xffd700, 0.3, 5);
              this.fire(game, e, e.spiral + Math.PI, 13.5, e.damage * 0.75, 0xffd700, 0.3, 5);
              this.fire(game, e, -e.spiral * 0.6, 11, e.damage * 0.75, 0xff8020, 0.3, 5);
              game.audio.enemyShot('boss');
            }
          } else if (e.pattern === 1 && e.timer2 > 0.5 && e.timer2 - dt <= 0.5) {
            for (let i = 0; i < 28; i++) this.fire(game, e, (i / 28) * Math.PI * 2, 13.5, e.damage * 0.85, 0xffd700, 0.32, 5);
            game.audio.enemyShot('shotgun');
          } else if (e.pattern === 2 && e.timer2 > 0.3 && e.timer2 - dt <= 0.3) {
            for (let i = 0; i < 5; i++) {
              const a = (i / 5) * Math.PI * 2 + e.spiral;
              const x = e.x + Math.cos(a) * 5, z = e.z + Math.sin(a) * 5;
              this.rifts.push({ x, z, t: 1.0, type: i % 2 ? 'runner' : 'shooter', tele: game.telegraphs.ring(x, z, 2.0, 1.05, 0xffd700) });
            }
          } else if (e.pattern === 3) {
            if (Math.floor(e.timer2 / 0.26) !== Math.floor((e.timer2 - dt) / 0.26)) {
              for (let i = -1; i <= 1; i++) this.fire(game, e, aimAngle + i * 0.15, 25, e.damage * 0.9, 0xff3060, 0.34, 4);
              game.audio.enemyShot('orb');
            }
          }
          if (e.timer <= 0) { e.state = 0; e.timer = e.hp < e.maxHp * 0.5 ? rand(1.1, 1.7) : rand(1.5, 2.2); }
        }
        break;
      }
      case 'mine':
        break;
    }
  }

  // ---------------------------------------------------------------------
  private render(game: Game | null) {
    const counts = {} as Record<EnemyType, number>;
    for (const t of ALL_TYPES) counts[t] = 0;
    let coreCount = 0;
    let ringCount = 0;
    let linkCount = 0;
    const d = this.dummy;
    const t = this.time;
    const pos = this.linkPos.array as Float32Array;
    const col = this.linkCol.array as Float32Array;

    for (const e of this.list) {
      if (e.dead) continue;
      const i = counts[e.type];
      if (i >= this.caps[e.type]) continue;
      const mesh = this.meshes[e.type];
      const spawnK = e.spawnT > 0 ? Math.max(0.01, 1 - e.spawnT / 0.55) : 1;
      const spawnS = spawnK < 1 ? 1.4 * spawnK * (2 - spawnK) : 1;
      let s = e.size * spawnS * (1 + e.flash * 0.22);
      if (e.type === 'kamikaze') s *= 1 + Math.sin(t * 14) * 0.15;
      if (e.type === 'mine') s *= 1 + Math.sin(t * 8 + e.id) * 0.2;
      if (e.frozen > 0) s *= 0.95;
      d.position.set(e.x, e.y, e.z);
      switch (e.type) {
        case 'orbiter': d.rotation.set(0, e.spin, 0); break;
        case 'tank': d.rotation.set(0, e.angle, 0); break;
        case 'summoner': d.rotation.set(0, e.spin, 0); break;
        case 'healer': d.rotation.set(0, e.spin, 0); break;
        case 'shielder': d.rotation.set(0, e.spin, 0); break;
        case 'trapper': d.rotation.set(0, e.spin, 0); break;
        case 'miniboss': d.rotation.set(e.spin * 0.3, e.spin, e.spin * 0.2); break;
        case 'mine': d.rotation.set(0, t * 2 + e.id, 0); break;
        case 'shooter': d.rotation.set(0, e.angle, 0); break;
        default: d.rotation.set(0, e.angle, e.type === 'runner' || e.type === 'normal' ? clamp(-e.vx * 0.03, -0.5, 0.5) : 0);
      }
      d.scale.setScalar(s);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);

      // tinta
      tmpC.setHex(e.def.color);
      if (e.elite) tmpC.lerp(tmpC2.setHex(0xffd700), 0.55);
      if (e.frozen > 0) tmpC.lerp(tmpC2.setHex(0x9ad8ff), 0.8);
      else if (e.burn > 0) tmpC.lerp(tmpC2.setHex(e.burnColor), 0.6);
      if (e.stun > 0) tmpC.multiplyScalar(0.5 + 0.5 * Math.abs(Math.sin(t * 20)));
      this.tints[e.type].setXYZ(i, tmpC.r, tmpC.g, tmpC.b);
      this.flashes[e.type].setX(i, e.flash);
      counts[e.type]++;

      // núcleo
      if (coreCount < 500 && e.type !== 'mine') {
        d.rotation.set(0, 0, 0);
        const cs = (e.type === 'miniboss' ? 2.6 : e.type === 'tank' ? 1.4 : 0.9) * e.size * spawnS * (1 + Math.sin(t * 6 + e.id) * 0.12);
        d.position.set(e.x, e.y + (e.type === 'normal' ? 0.15 : 0.1), e.z);
        d.scale.setScalar(cs);
        d.updateMatrix();
        this.cores.setMatrixAt(coreCount, d.matrix);
        tmpC.setHex(e.elite ? 0xffd700 : e.def.color).multiplyScalar(e.flash > 0.3 ? 5 : 2.6);
        if (e.frozen > 0) tmpC.setHex(0xb0e8ff).multiplyScalar(2.5);
        this.cores.instanceColor!.setXYZ(coreCount, tmpC.r, tmpC.g, tmpC.b);
        coreCount++;
      }
      // anéis (elite / escudo)
      if (ringCount < 200 && (e.elite || e.shield > 0 || e.type === 'miniboss')) {
        const rs = e.radius * e.size * 1.5 + 0.4;
        d.position.set(e.x, 0.15, e.z);
        d.rotation.set(0, t * 1.5, 0);
        d.scale.set(rs, 1, rs);
        d.updateMatrix();
        this.rings.setMatrixAt(ringCount, d.matrix);
        if (e.shield > 0) tmpC.setHex(0x4d8dff).multiplyScalar(2.5);
        else tmpC.setHex(0xffd700).multiplyScalar(2.2);
        this.rings.instanceColor!.setXYZ(ringCount, tmpC.r, tmpC.g, tmpC.b);
        ringCount++;
      }
      // links de suporte
      if (linkCount < 128) {
        let target: Enemy | null = null;
        let color = 0;
        if (e.type === 'healer' && e.target && !e.target.dead) { target = e.target; color = 0x33ff99; }
        if (target) {
          const b = linkCount * 6;
          pos[b] = e.x; pos[b + 1] = e.y + 0.3; pos[b + 2] = e.z;
          pos[b + 3] = target.x; pos[b + 4] = target.y + 0.3; pos[b + 5] = target.z;
          tmpC.setHex(color).multiplyScalar(2);
          col[b] = tmpC.r; col[b + 1] = tmpC.g; col[b + 2] = tmpC.b;
          col[b + 3] = tmpC.r; col[b + 4] = tmpC.g; col[b + 5] = tmpC.b;
          linkCount++;
        }
      }
    }
    // links escudeiro -> aliados escudados
    if (game) {
      for (const e of this.list) {
        if (e.dead || e.type !== 'shielder') continue;
        for (const o of this.list) {
          if (linkCount >= 128) break;
          if (o === e || o.dead || o.shield <= 0 || o.type === 'shielder') continue;
          if ((o.x - e.x) ** 2 + (o.z - e.z) ** 2 > 160) continue;
          const b = linkCount * 6;
          pos[b] = e.x; pos[b + 1] = e.y + 0.3; pos[b + 2] = e.z;
          pos[b + 3] = o.x; pos[b + 4] = o.y + 0.3; pos[b + 5] = o.z;
          const k = 1.5 + Math.sin(t * 10 + o.id) * 0.5;
          col[b] = 0.3 * k; col[b + 1] = 0.55 * k; col[b + 2] = 1.0 * k;
          col[b + 3] = 0.3 * k; col[b + 4] = 0.55 * k; col[b + 5] = 1.0 * k;
          linkCount++;
        }
      }
    }

    for (const ty of ALL_TYPES) {
      const m = this.meshes[ty];
      m.count = counts[ty];
      m.instanceMatrix.needsUpdate = true;
      this.tints[ty].needsUpdate = true;
      this.flashes[ty].needsUpdate = true;
    }
    this.cores.count = coreCount;
    this.cores.instanceMatrix.needsUpdate = true;
    this.cores.instanceColor!.needsUpdate = true;
    this.rings.count = ringCount;
    this.rings.instanceMatrix.needsUpdate = true;
    this.rings.instanceColor!.needsUpdate = true;
    this.links.geometry.setDrawRange(0, linkCount * 2);
    this.linkPos.needsUpdate = true;
    this.linkCol.needsUpdate = true;
  }
}
