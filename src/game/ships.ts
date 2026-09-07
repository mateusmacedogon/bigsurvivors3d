import * as THREE from 'three';
import type { HeroId } from './config';

export interface ShipAnimState {
  firing: number;
  speed: number;
  ultActive: boolean;
  time: number;
}

export interface ShipRig {
  group: THREE.Group;
  engines: THREE.Vector3[];
  muzzles: THREE.Vector3[];
  leds: THREE.MeshBasicMaterial[];
  ledBase: THREE.Color;
  animate: (dt: number, s: ShipAnimState) => void;
}

// ---------------------------------------------------------------------------
// Helpers para materiais e montagem de geometrias
// ---------------------------------------------------------------------------
const hull = (color = 0x141824, metalness = 0.88, roughness = 0.28) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness });

const led = (color: number, mult = 2.8) =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(mult) });

const glass = (color: number, opacity = 0.85) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2.0,
    metalness: 0.15,
    roughness: 0.08,
    transparent: true,
    opacity,
  });

function box(
  w: number, h: number, d: number,
  mat: THREE.Material,
  x = 0, y = 0, z = 0,
  rx = 0, ry = 0, rz = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  return m;
}

function cyl(
  rt: number, rb: number, h: number, segs: number,
  mat: THREE.Material,
  x = 0, y = 0, z = 0,
  rx = 0, ry = 0, rz = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  return m;
}

function cone(
  r: number, h: number, segs: number,
  mat: THREE.Material,
  x = 0, y = 0, z = 0,
  rx = 0, ry = 0, rz = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, segs), mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  return m;
}

function torus(
  r: number, tube: number, radSegs: number, tubSegs: number,
  mat: THREE.Material,
  x = 0, y = 0, z = 0,
  rx = 0, ry = 0, rz = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, radSegs, tubSegs), mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  return m;
}

function edges(mesh: THREE.Mesh, color: number, mult = 2.2) {
  const eg = new THREE.EdgesGeometry(mesh.geometry, 24);
  const lines = new THREE.LineSegments(
    eg,
    new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(mult) }),
  );
  mesh.add(lines);
  return lines.material as THREE.LineBasicMaterial;
}

export function buildShip(hero: HeroId): ShipRig {
  switch (hero) {
    case 'big': return buildBig();
    case 'otton': return buildOtton();
    case 'thiago': return buildThiago();
    case 'pietro': return buildPietro();
    case 'carlinhos': return buildCarlinhos();
    case 'macedo': return buildMacedo();
  }
}

// ---------------------------------------------------------------------------
// BIG - Caça Interceptador Ciano de Alta Tecnologia
// ---------------------------------------------------------------------------
function buildBig(): ShipRig {
  const color = 0x00e5ff;
  const accent = 0x80f5ff;
  const g = new THREE.Group();
  const hPrimary = hull(0x131928, 0.9, 0.25);
  const hSecondary = hull(0x222c42, 0.85, 0.32);
  const hDark = hull(0x0a0d16, 0.95, 0.2);
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0x90a8c0, metalness: 0.95, roughness: 0.12 });
  const leds: THREE.MeshBasicMaterial[] = [];
  const afterburners: THREE.Mesh[] = [];

  const L = (c = color, mult = 2.8) => {
    const m = led(c, mult);
    leds.push(m);
    return m;
  };

  // 1. Nariz e Fuselagem Central Facetada
  // Bico aerodinâmico frontal ultra-afiado
  const nose = cone(0.48, 2.6, 6, hPrimary, 0, 0.05, 1.4, Math.PI / 2, 0, 0);
  nose.scale.set(1.15, 0.65, 1);
  g.add(nose);
  edges(nose, color, 1.4);

  // Ponta afiada do nariz
  const noseProbe = cyl(0.02, 0.08, 0.8, 6, chromeMat, 0, 0.05, 2.8, Math.PI / 2);
  g.add(noseProbe);
  const probeLed = cyl(0.03, 0.03, 0.15, 6, L(accent, 4.0), 0, 0.05, 3.25, Math.PI / 2);
  g.add(probeLed);

  // Canards frontais (micro-asas estabilizadoras no nariz)
  for (const s of [-1, 1]) {
    const canard = box(0.55, 0.04, 0.45, hSecondary, s * 0.45, 0.08, 1.35, 0, s * -0.4, s * 0.15);
    g.add(canard);
    canard.add(box(0.5, 0.03, 0.05, L(), 0, 0.02, 0.2));
  }

  // Seção central da fuselagem
  const midFuselage = box(1.05, 0.6, 2.0, hPrimary, 0, 0.05, -0.4);
  g.add(midFuselage);
  edges(midFuselage, color, 1.2);

  // Placas chanfradas superiores
  const dorsalCarapace = box(0.72, 0.22, 1.6, hSecondary, 0, 0.38, -0.3);
  g.add(dorsalCarapace);

  // Cockpit facetado com interior brilhante
  const cockpitGlass = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.4, 6), glass(color, 0.88));
  cockpitGlass.rotation.x = Math.PI / 2;
  cockpitGlass.scale.set(1, 0.65, 1);
  cockpitGlass.position.set(0, 0.34, 0.35);
  g.add(cockpitGlass);

  // Núcleo de interface piloto interna
  const pilotCore = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), L(accent, 3.5));
  pilotCore.position.set(0, 0.32, 0.3);
  g.add(pilotCore);

  // Espinha dorsal de resfriamento com conduítes neon
  const spineRidge = box(0.12, 0.1, 2.4, L(), 0, 0.48, -0.5);
  g.add(spineRidge);

  // 2. Asas Diedro com Ailerons e Ranhuras LED
  for (const side of [-1, 1]) {
    const wingGroup = new THREE.Group();
    wingGroup.position.set(side * 0.5, 0.02, -0.3);
    wingGroup.rotation.set(0, side * 0.28, side * -0.14); // Diedro acentuado

    // Asa principal em formato delta agressivo
    const wingMain = box(1.85, 0.08, 1.25, hPrimary, side * 0.95, 0, -0.4);
    wingGroup.add(wingMain);
    edges(wingMain, color, 1.3);

    // Borda de ataque com conduíte de luz neon
    const edgeLight = box(1.8, 0.06, 0.08, L(), side * 0.95, 0.04, 0.2);
    wingGroup.add(edgeLight);

    // Aileron móvel rebaixado
    const aileron = box(1.2, 0.06, 0.3, hSecondary, side * 1.05, 0.02, -1.05);
    wingGroup.add(aileron);
    aileron.add(box(1.1, 0.04, 0.05, L(color, 2.0), 0, 0.04, -0.12));

    // Winglet estabilizador vertical pontiagudo
    const winglet = box(0.08, 0.55, 0.9, hSecondary, side * 1.88, 0.24, -0.5, side * 0.15, 0, 0);
    wingGroup.add(winglet);
    winglet.add(box(0.06, 0.5, 0.06, L(accent, 3.2), 0, 0, 0.4));

    g.add(wingGroup);

    // 3. Canhões Duplos de Pulso Pesado (Camadas detalhadas)
    const gunPod = new THREE.Group();
    gunPod.position.set(side * 0.55, -0.06, 0.6);

    // Suporte e carenagem de absorção de recuo
    const gunShroud = box(0.24, 0.22, 1.1, hDark, 0, 0, 0);
    gunPod.add(gunShroud);

    // Tubo principal do canhão railgun
    const barrel = cyl(0.08, 0.09, 1.5, 8, chromeMat, 0, 0, 0.9, Math.PI / 2);
    gunPod.add(barrel);

    // Anéis aceleradores de pulso
    for (let i = 0; i < 3; i++) {
      const ring = torus(0.12, 0.025, 6, 12, L(), 0, 0, 0.4 + i * 0.4, Math.PI / 2);
      gunPod.add(ring);
    }

    // Bocal emissor frontal
    const muzzleTip = cyl(0.065, 0.075, 0.3, 8, L(accent, 3.8), 0, 0, 1.7, Math.PI / 2);
    gunPod.add(muzzleTip);
    g.add(gunPod);

    // 4. Turbinas com Anéis de Exaustão e Pós-Combustores
    const thrusterPod = new THREE.Group();
    thrusterPod.position.set(side * 0.55, -0.02, -1.8);

    // Carenagem cilíndrica da turbina
    const cowl = cyl(0.3, 0.34, 1.0, 12, hDark, 0, 0, 0, Math.PI / 2);
    thrusterPod.add(cowl);

    // Anel de exaustão de titânio
    const nozzRing = torus(0.31, 0.04, 8, 16, chromeMat, 0, 0, -0.5, Math.PI / 2);
    thrusterPod.add(nozzRing);

    // Palhetas de empuxo vetorial
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2;
      const vane = box(0.04, 0.12, 0.22, hSecondary, Math.cos(a) * 0.28, Math.sin(a) * 0.28, -0.55);
      thrusterPod.add(vane);
    }

    // Pós-combustor interior brilhante com pivô na base do bocal
    const burnerGeo = new THREE.ConeGeometry(0.24, 0.9, 12).translate(0, 0.45, 0);
    const burner = new THREE.Mesh(burnerGeo, L(0x38bdf8, 4.0));
    burner.rotation.x = -Math.PI / 2;
    burner.position.set(0, 0, -0.5);
    thrusterPod.add(burner);
    afterburners.push(burner);

    g.add(thrusterPod);
  }

  // Leme Vertical Duplo Canted (Estabilizadores de Cauda)
  for (const side of [-1, 1]) {
    const fin = box(0.06, 0.8, 1.1, hSecondary, side * 0.32, 0.45, -1.55, 0, 0, side * -0.2);
    g.add(fin);
    fin.add(box(0.08, 0.06, 1.0, L(), 0, 0.39, 0));
  }

  const ledBase = new THREE.Color(color);
  return {
    group: g,
    engines: [new THREE.Vector3(-0.55, -0.05, -2.55), new THREE.Vector3(0.55, -0.05, -2.55)],
    muzzles: [new THREE.Vector3(-0.55, -0.06, 2.3), new THREE.Vector3(0.55, -0.06, 2.3)],
    leds, ledBase,
    animate: (_dt, s) => {
      const pulse = 2.4 + Math.sin(s.time * 6) * 0.7 + s.firing * 2.0;
      for (const m of leds) m.color.copy(ledBase).multiplyScalar(pulse);
      const abScale = 1 + s.speed * 0.8 + s.firing * 1.2 + Math.sin(s.time * 25) * 0.15;
      for (const ab of afterburners) {
        ab.scale.set(1, abScale, 1);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// OTTON - Brutamontes Carmesim Blindado Pesado
// ---------------------------------------------------------------------------
function buildOtton(): ShipRig {
  const color = 0xff4a2a;
  const accent = 0xff9a2a;
  const g = new THREE.Group();
  const hHeavy = hull(0x241113, 0.92, 0.35);
  const hPlate = hull(0x38171a, 0.9, 0.28);
  const hJoint = hull(0x100808, 0.95, 0.15);
  const leds: THREE.MeshBasicMaterial[] = [];
  const blades: THREE.Mesh[] = [];

  const L = (c = color, mult = 2.8) => {
    const m = led(c, mult);
    leds.push(m);
    return m;
  };

  // 1. Chassi Principal Angular & Armadura Sobreposta
  const bodyCore = box(1.8, 0.8, 2.6, hHeavy, 0, 0, -0.2);
  g.add(bodyCore);
  edges(bodyCore, color, 1.8);

  // Proa Pesada em Cunha de Aríete
  const prow = cone(1.05, 1.5, 4, hHeavy, 0, 0, 1.6, Math.PI / 2, Math.PI / 4, 0);
  prow.scale.set(1.3, 0.6, 1);
  g.add(prow);
  edges(prow, color, 2.0);

  // Dentes do aríete frontal
  for (const side of [-1, 1]) {
    const tooth = cone(0.18, 0.7, 4, hPlate, side * 0.6, -0.1, 2.35, Math.PI / 2, Math.PI / 4);
    g.add(tooth);
  }

  // Placas de Blindagem Reativa Chanfradas no Teto
  const plate1 = box(1.35, 0.22, 1.5, hPlate, 0, 0.48, -0.3);
  g.add(plate1);
  const plate2 = box(1.0, 0.18, 1.0, hHeavy, 0, 0.65, -0.4);
  g.add(plate2);

  // Ranhuras de ventilação incandescente
  g.add(box(1.0, 0.05, 0.15, L(accent, 3.5), 0, 0.62, 0.35));
  g.add(box(0.15, 0.05, 1.4, L(color, 2.5), 0, 0.75, -0.4));
  for (let i = -1; i <= 1; i += 2) {
    g.add(box(0.3, 0.06, 0.8, L(accent, 3.0), i * 0.45, 0.58, -0.3));
  }

  // Visor Blindado Estreito
  const visor = box(0.9, 0.18, 0.4, glass(accent, 0.95), 0, 0.45, 0.7);
  g.add(visor);
  const visorCore = box(0.75, 0.1, 0.1, L(0xffffff, 4.0), 0, 0.45, 0.75);
  g.add(visorCore);

  // Saias Laterais de Blindagem Espaçada
  for (const side of [-1, 1]) {
    const skirt = box(0.2, 0.7, 2.2, hPlate, side * 1.05, -0.05, -0.2, 0, 0, side * 0.15);
    g.add(skirt);
    skirt.add(box(0.22, 0.06, 1.8, L(color, 2.0), 0, 0.25, 0));
  }

  // 2. Braços Mecânicos Articulados com Lâminas de Plasma
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    // Ombreira Blindada Pesada
    const shoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), hJoint);
    shoulder.position.set(side * 1.25, 0.1, 0.3);
    g.add(shoulder);

    const arm = new THREE.Group();
    arm.position.copy(shoulder.position);

    // Antebraço mecânico reforçado
    const bicep = box(0.36, 0.36, 1.4, hHeavy, 0, 0, 0.7);
    arm.add(bicep);

    // Pistões hidráulicos aparentes
    const piston = cyl(0.06, 0.06, 1.1, 6, hJoint, side * 0.18, 0.15, 0.65, Math.PI / 2);
    arm.add(piston);

    // Canal de energia no braço
    const conduit = box(0.1, 0.1, 1.2, L(accent, 3.2), 0, 0.2, 0.7);
    arm.add(conduit);

    // Protetor do punho
    const gauntlet = box(0.5, 0.5, 0.4, hPlate, 0, 0, 1.4);
    arm.add(gauntlet);

    // Lâmina de Plasma Dupla Gigantesca
    const bladeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(accent).multiplyScalar(4.0),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 2.6), bladeMat);
    blade.rotation.x = -Math.PI / 2;
    blade.rotation.z = Math.PI / 2;
    blade.position.set(0, 0, 2.85);
    arm.add(blade);
    blades.push(blade);

    // Espinha estrutural da lâmina com dentes serrilhados
    const bladeSpine = box(0.08, 0.14, 2.4, hHeavy, 0, 0, 2.75);
    arm.add(bladeSpine);
    const bladeCore = box(0.08, 0.08, 2.4, L(0xfff5e0, 5.0), 0, 0, 2.8);
    arm.add(bladeCore);

    g.add(arm);
    arms.push(arm);
  }

  // 3. Escapamentos Quádruplos Reforçados
  for (const side of [-1, 1]) {
    // Escapamento Superior
    const topEx = cyl(0.24, 0.3, 0.7, 8, hJoint, side * 0.45, 0.2, -1.65, Math.PI / 2);
    g.add(topEx);
    const topGlow = cyl(0.18, 0.18, 0.15, 8, L(accent, 3.5), side * 0.45, 0.2, -2.0, Math.PI / 2);
    g.add(topGlow);

    // Escapamento Inferior
    const btmEx = cyl(0.28, 0.34, 0.7, 8, hJoint, side * 0.65, -0.12, -1.65, Math.PI / 2);
    g.add(btmEx);
    const btmGlow = cyl(0.22, 0.22, 0.15, 8, L(color, 4.0), side * 0.65, -0.12, -2.0, Math.PI / 2);
    g.add(btmGlow);
  }

  const ledBase = new THREE.Color(color);
  let swing = 0;
  let swingSide = 1;
  let lastFiring = 0;

  return {
    group: g,
    engines: [
      new THREE.Vector3(-0.6, -0.05, -2.05),
      new THREE.Vector3(0.6, -0.05, -2.05),
    ],
    muzzles: [new THREE.Vector3(0, 0, 2.4)],
    leds, ledBase,
    animate: (dt, s) => {
      if (s.firing > lastFiring + 0.5) {
        swing = 1;
        swingSide = -swingSide;
      }
      lastFiring = s.firing;
      swing = Math.max(0, swing - dt * 5.5);
      const k = Math.sin(swing * Math.PI);

      arms[0].rotation.y = 0.2 + (swingSide > 0 ? k * 1.55 : -k * 0.4);
      arms[1].rotation.y = -0.2 - (swingSide < 0 ? k * 1.55 : -k * 0.4);
      arms[0].rotation.x = -k * 0.35;
      arms[1].rotation.x = -k * 0.35;

      const pulse = 2.4 + Math.sin(s.time * 8) * 0.7 + swing * 2.5;
      for (const m of leds) m.color.copy(ledBase).multiplyScalar(pulse);
      for (const b of blades) {
        (b.material as THREE.MeshBasicMaterial).opacity = 0.75 + Math.sin(s.time * 18) * 0.2 + swing * 0.3;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// THIAGO - Corveta Bio-Tóxica Verde
// ---------------------------------------------------------------------------
function buildThiago(): ShipRig {
  const color = 0x8cff2a;
  const bioCoreColor = 0xb4ff38;
  const g = new THREE.Group();
  const hChitin = hull(0x122218, 0.9, 0.3);
  const hPlate = hull(0x1d3626, 0.82, 0.35);
  const hConduit = hull(0x0a140e, 0.95, 0.18);
  const leds: THREE.MeshBasicMaterial[] = [];
  const tankMats: THREE.MeshStandardMaterial[] = [];
  const liquidCores: THREE.Mesh[] = [];

  const L = (c = color, mult = 2.8) => {
    const m = led(c, mult);
    leds.push(m);
    return m;
  };

  // 1. Chassi Predatório Biomecânico
  const body = box(1.2, 0.65, 3.2, hChitin, 0, 0, -0.2);
  g.add(body);
  edges(body, color, 1.5);

  // Proa Hidrodinâmica Afilada
  const prow = cone(0.65, 1.4, 6, hChitin, 0, -0.02, 1.95, Math.PI / 2);
  prow.scale.set(1.1, 0.65, 1);
  g.add(prow);
  edges(prow, color, 1.6);

  // Mandíbulas bio-químicas frontais
  for (const side of [-1, 1]) {
    const mandible = cone(0.14, 0.9, 4, hPlate, side * 0.42, -0.1, 2.3, Math.PI / 2, side * -0.2, side * 0.15);
    g.add(mandible);
  }

  // Carapaça dorsal segmentada (exoesqueleto)
  for (let i = 0; i < 4; i++) {
    const seg = box(0.85 - i * 0.08, 0.18, 0.5, hPlate, 0, 0.4 - i * 0.03, 0.5 - i * 0.65);
    g.add(seg);
    seg.add(box(0.12, 0.08, 0.45, L(bioCoreColor, 3.2), 0, 0.1, 0));
  }

  // Cockpit de Olho Composto Biológico
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), glass(color, 0.9));
  cockpit.scale.set(1.1, 0.6, 1.6);
  cockpit.position.set(0, 0.42, 0.6);
  g.add(cockpit);

  // 2. Difusores Químicos em Leque Frontal
  const diffuserBlock = box(0.7, 0.28, 0.5, hConduit, 0, -0.12, 2.45);
  g.add(diffuserBlock);

  // Bicos pulverizadores em leque
  for (let i = -2; i <= 2; i++) {
    const ang = (i / 2) * 0.35;
    const nozzle = cyl(0.05, 0.08, 0.45, 8, hConduit, i * 0.14, -0.12, 2.75, Math.PI / 2, ang, 0);
    g.add(nozzle);
    const nozzleRing = torus(0.065, 0.02, 6, 12, L(bioCoreColor, 3.8), i * 0.14, -0.12, 2.95, Math.PI / 2, ang, 0);
    g.add(nozzleRing);
  }

  // 3. Tanques Cilíndricos de Ácido com Tubulações & Conduítes
  for (const side of [-1, 1]) {
    // Pylons de sustentação dos tanques
    const pylon = box(0.55, 0.18, 1.2, hChitin, side * 0.8, 0.08, -0.3);
    g.add(pylon);

    // Tanque exterior de vidro reforçado
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0x228b22,
      emissive: color,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.6,
      roughness: 0.08,
      metalness: 0.2,
    });
    tankMats.push(tankMat);

    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 1.4, 8, 16), tankMat);
    tank.rotation.x = Math.PI / 2;
    tank.position.set(side * 1.15, 0.08, -0.3);
    g.add(tank);

    // Núcleo líquido incandescente interno
    const liquid = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.3, 6, 12), L(bioCoreColor, 3.5));
    liquid.rotation.x = Math.PI / 2;
    liquid.position.copy(tank.position);
    g.add(liquid);
    liquidCores.push(liquid);

    // Abraçadeiras de retenção metálicas
    for (const bz of [0.35, -0.3, -0.95]) {
      const band = torus(0.39, 0.04, 6, 16, hConduit, side * 1.15, 0.08, bz);
      g.add(band);
    }

    // Tubulações / Mangueiras conectadas do tanque ao difusor
    const pipe1 = cyl(0.06, 0.06, 1.2, 8, hConduit, side * 0.85, 0.18, 0.7, 0.4, side * -0.3, 0);
    g.add(pipe1);
    const pipe2 = cyl(0.05, 0.05, 1.0, 8, hConduit, side * 0.45, 0.05, 1.6, 0.2, side * -0.5, 0);
    g.add(pipe2);

    // Asas Biológicas Aerodinâmicas (formato manta/química)
    const wing = box(1.3, 0.06, 1.2, hPlate, side * 1.7, 0.02, -0.5, 0, side * 0.35, side * -0.15);
    g.add(wing);
    wing.add(box(1.2, 0.04, 0.06, L(), 0, 0.04, 0.4));
    const wingSpine = cone(0.08, 0.6, 4, hChitin, side * 2.3, 0.05, -0.9, Math.PI / 2, 0, side * -0.3);
    g.add(wingSpine);

    // Turbinas Reatoras de Bio-Plasma
    const engine = cyl(0.24, 0.3, 0.8, 8, hConduit, side * 0.42, -0.05, -1.85, Math.PI / 2);
    g.add(engine);
    const eglow = cyl(0.19, 0.19, 0.2, 8, L(bioCoreColor, 3.6), side * 0.42, -0.05, -2.25, Math.PI / 2);
    g.add(eglow);
  }

  const ledBase = new THREE.Color(color);
  return {
    group: g,
    engines: [new THREE.Vector3(-0.42, -0.05, -2.3), new THREE.Vector3(0.42, -0.05, -2.3)],
    muzzles: [new THREE.Vector3(0, -0.12, 3.0)],
    leds, ledBase,
    animate: (_dt, s) => {
      const pulse = 2.2 + Math.sin(s.time * 5) * 0.6 + s.firing * 1.5;
      for (const m of leds) m.color.copy(ledBase).multiplyScalar(pulse);
      for (const t of tankMats) {
        t.emissiveIntensity = 0.9 + Math.sin(s.time * 4) * 0.4 + s.firing * 0.8;
      }
      for (const l of liquidCores) {
        l.scale.set(1 + Math.sin(s.time * 7) * 0.08, 1, 1 + Math.cos(s.time * 7) * 0.08);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// PIETRO - Obelisco Místico Esotérico Roxo
// ---------------------------------------------------------------------------
function buildPietro(): ShipRig {
  const color = 0xc05cff;
  const accent = 0xff3cf0;
  const gold = 0xffd040;
  const g = new THREE.Group();
  const voidHull = hull(0x150b24, 0.95, 0.22);
  const runeHull = hull(0x24123d, 0.9, 0.28);
  const leds: THREE.MeshBasicMaterial[] = [];
  const shards: THREE.Mesh[] = [];

  const L = (c = color, mult = 3.0) => {
    const m = led(c, mult);
    leds.push(m);
    return m;
  };

  // 1. Monólito Central Dividido (Obelisco Rúnico)
  const monolithGroup = new THREE.Group();
  monolithGroup.position.y = 0.4;

  // Lado esquerdo e direito do monólito dividido (sanctum interior exposto)
  for (const side of [-1, 1]) {
    const column = box(0.32, 2.3, 0.5, voidHull, side * 0.3, 0, 0);
    monolithGroup.add(column);
    edges(column, color, 2.0);

    // Inlays rúnicos verticais esculpidos
    for (let r = 0; r < 4; r++) {
      const runeMark = box(0.08, 0.2, 0.52, L(r % 2 === 0 ? color : accent, 3.5), side * 0.3, -0.65 + r * 0.45, 0);
      monolithGroup.add(runeMark);
    }
  }

  // Cristais Superior e Inferior (Capstones)
  const topCrown = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), L(accent, 4.0));
  topCrown.scale.set(0.85, 1.7, 0.85);
  topCrown.position.y = 1.7;
  monolithGroup.add(topCrown);

  const btmAnchor = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), L(color, 3.5));
  btmAnchor.scale.set(0.75, 1.4, 0.75);
  btmAnchor.position.y = -1.45;
  monolithGroup.add(btmAnchor);

  // Orbe Central de Energia Oculta (Singularidade Arcana)
  const orbCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), L(gold, 4.5));
  orbCore.position.y = 0;
  monolithGroup.add(orbCore);

  const orbAura = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 16, 12),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(accent).multiplyScalar(2.0),
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  monolithGroup.add(orbAura);

  g.add(monolithGroup);

  // 2. Fragmentos Orbitais Flutuantes (Void Shards)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), runeHull);
    shard.scale.set(0.55, 1.35, 0.55);
    shard.position.set(Math.cos(a) * 0.88, -0.3 + i * 0.22, Math.sin(a) * 0.88);
    edges(shard, accent, 2.5);
    monolithGroup.add(shard);
    shards.push(shard);
  }

  // 3. Anéis Flutuantes Concêntricos (Astrolábio Místico)
  const rings: THREE.Group[] = [];
  const ringDefs = [
    { r: 1.45, tube: 0.045, tiltX: 0.4, tiltZ: 0.22, speed: 1.4, nodeColor: gold },
    { r: 1.95, tube: 0.04, tiltX: -0.55, tiltZ: 0.45, speed: -1.0, nodeColor: accent },
    { r: 2.45, tube: 0.035, tiltX: 0.25, tiltZ: -0.6, speed: 0.7, nodeColor: color },
  ];

  for (const d of ringDefs) {
    const pivot = new THREE.Group();
    pivot.position.y = 0.4;
    pivot.rotation.set(d.tiltX, 0, d.tiltZ);

    // Aro toroidal luminoso
    const ringMesh = torus(d.r, d.tube, 8, 64, L(color, 2.5), 0, 0, 0, Math.PI / 2);
    pivot.add(ringMesh);

    // Nós rúnicos posicionados no perímetro do anel
    const nodeCount = 6;
    for (let i = 0; i < nodeCount; i++) {
      const a = (i / nodeCount) * Math.PI * 2;
      const node = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), L(d.nodeColor, 3.8));
      node.position.set(Math.cos(a) * d.r, 0, Math.sin(a) * d.r);
      pivot.add(node);
    }

    pivot.userData.speed = d.speed;
    g.add(pivot);
    rings.push(pivot);
  }

  const ledBase = new THREE.Color(color);
  return {
    group: g,
    engines: [new THREE.Vector3(0, -1.45, -0.2)],
    muzzles: [new THREE.Vector3(0, 0.4, 1.6)],
    leds, ledBase,
    animate: (dt, s) => {
      const spd = s.ultActive ? 3.5 : 1.0;
      for (const r of rings) {
        r.rotation.y += dt * (r.userData.speed as number) * spd;
      }
      monolithGroup.rotation.y += dt * 0.65;
      topCrown.rotation.y -= dt * 2.2;
      btmAnchor.rotation.y += dt * 1.8;

      for (let i = 0; i < shards.length; i++) {
        const sh = shards[i];
        sh.rotation.x += dt * 1.5;
        sh.rotation.y += dt * 2.0;
        sh.position.y = 0.5 + Math.sin(s.time * 3 + i * 1.5) * 0.35;
      }

      const pulse = 2.4 + Math.sin(s.time * 4) * 0.7 + s.firing * 1.8 + (s.ultActive ? 2.0 : 0);
      for (const m of leds) m.color.copy(ledBase).multiplyScalar(pulse);
      orbAura.scale.setScalar(1 + Math.sin(s.time * 6) * 0.18 + (s.ultActive ? 0.35 : 0));
    },
  };
}

// ---------------------------------------------------------------------------
// CARLINHOS - Nave Esférica de Compaixão e Bondade (Dourado/Âmbar)
// ---------------------------------------------------------------------------
function buildCarlinhos(): ShipRig {
  const color = 0xffcc44;
  const accent = 0xfff0aa;
  const g = new THREE.Group();
  const hPrimary = hull(0x282010, 0.88, 0.25);
  const hSecondary = hull(0x423618, 0.85, 0.3);
  const goldChrome = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.95, roughness: 0.15 });
  const leds: THREE.MeshBasicMaterial[] = [];
  const afterburners: THREE.Mesh[] = [];

  const L = (c = color, mult = 2.8) => {
    const mat = led(c, mult);
    leds.push(mat);
    return mat;
  };

  // 1. Chassi Esférico Suavizado (Disco Saucer Cósmico)
  const saucer = new THREE.Mesh(new THREE.SphereGeometry(1.35, 20, 14), hPrimary);
  saucer.scale.set(1.3, 0.52, 1.3);
  saucer.position.set(0, 0.05, 0);
  g.add(saucer);
  edges(saucer, color, 1.3);

  // Anel equatorial reforçado com placas douradas
  const beltRing = torus(1.65, 0.08, 8, 36, goldChrome, 0, 0.05, 0, Math.PI / 2);
  beltRing.scale.set(1.05, 1.05, 1);
  g.add(beltRing);

  // 4 Projeções de Pétalas Estabilizadoras com Conduítes Neon
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const px = Math.sin(a) * 1.5, pz = Math.cos(a) * 1.5;
    const petal = box(0.42, 0.08, 0.75, hSecondary, px, 0.04, pz, 0, -a, 0);
    g.add(petal);
    petal.add(box(0.32, 0.06, 0.55, L(color, 2.5), 0, 0.03, 0));
  }

  // 2. Cúpula Central de Compaixão Translúcida
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), glass(0xffd700, 0.88));
  dome.scale.set(1.0, 0.75, 1.0);
  dome.position.set(0, 0.32, 0);
  g.add(dome);

  // Núcleo de Bondade (Coração Energético Radiante)
  const heartCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 2), L(accent, 4.0));
  heartCore.position.set(0, 0.34, 0);
  g.add(heartCore);

  // 3. Halo / Anel Flutuante de Bondade que Orbita a Nave
  const haloGroup = new THREE.Group();
  haloGroup.position.set(0, 0.25, 0);
  g.add(haloGroup);
  const haloMesh = torus(1.95, 0.045, 8, 48, L(accent, 3.2), 0, 0, 0, Math.PI / 2);
  haloGroup.add(haloMesh);

  // Micro-orbes flutuantes no anel
  const haloOrbs: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), L(0xffffff, 4.0));
    haloGroup.add(orb);
    haloOrbs.push(orb);
  }

  // 4. Lente / Emissor Frontal da Onda de Gentileza
  const frontEmitter = cyl(0.32, 0.42, 0.35, 12, goldChrome, 0, 0.06, 1.38, Math.PI / 2);
  g.add(frontEmitter);
  const emitterLens = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), L(accent, 3.5));
  emitterLens.position.set(0, 0.06, 1.55);
  emitterLens.scale.set(1, 0.5, 0.5);
  g.add(emitterLens);

  // 5. Propulsores Traseiros
  for (const s of [-1, 1]) {
    const engineHousing = cyl(0.24, 0.3, 0.65, 10, hSecondary, s * 0.7, 0.06, -1.05, Math.PI / 2);
    g.add(engineHousing);
    engineHousing.add(torus(0.25, 0.04, 6, 16, L(color, 2.5), 0, -0.32, 0, Math.PI / 2));

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.75, 10), L(accent, 3.8));
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(s * 0.7, 0.06, -1.55);
    g.add(flame);
    afterburners.push(flame);
  }

  const ledBase = new THREE.Color(color);

  return {
    group: g,
    engines: [new THREE.Vector3(-0.7, 0.06, -1.05), new THREE.Vector3(0.7, 0.06, -1.05)],
    muzzles: [new THREE.Vector3(0, 0.06, 1.55)],
    leds,
    ledBase,
    animate: (dt, s) => {
      // Rotação do anel de compaixão
      haloGroup.rotation.y += dt * 1.8;
      haloGroup.rotation.x = Math.sin(s.time * 2.2) * 0.15;
      haloGroup.position.y = 0.25 + Math.sin(s.time * 3) * 0.08;

      for (let i = 0; i < haloOrbs.length; i++) {
        const oa = (i * Math.PI * 2) / 3 + s.time * 2.5;
        haloOrbs[i].position.set(Math.sin(oa) * 1.95, 0, Math.cos(oa) * 1.95);
      }

      // Pulso de respiração do coração e da cúpula
      const heartPulse = 1 + Math.sin(s.time * 4.5) * 0.18 + (s.ultActive ? 0.35 : 0);
      heartCore.scale.setScalar(heartPulse);
      heartCore.rotation.y += dt * 2.5;
      heartCore.rotation.z += dt * 1.5;

      const pwr = 2.4 + Math.sin(s.time * 5) * 0.8 + s.firing * 2.2 + (s.ultActive ? 2.5 : 0);
      for (const m of leds) m.color.copy(ledBase).multiplyScalar(pwr);

      const fScale = 0.8 + (s.speed / 14) * 0.7 + Math.random() * 0.2;
      for (const b of afterburners) {
        b.scale.set(1 + Math.random() * 0.15, fScale, 1 + Math.random() * 0.15);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// MACEDO - Nave Tática de Transmissão Quântica (Ciano/Azul Elétrico)
// ---------------------------------------------------------------------------
function buildMacedo(): ShipRig {
  const color = 0x44ddff;
  const accent = 0x88eeff;
  const g = new THREE.Group();
  const hPrimary = hull(0x0e1824, 0.9, 0.24);
  const hSecondary = hull(0x182c3e, 0.86, 0.28);
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0x98c0d8, metalness: 0.95, roughness: 0.12 });
  const leds: THREE.MeshBasicMaterial[] = [];
  const afterburners: THREE.Mesh[] = [];

  const L = (c = color, mult = 2.8) => {
    const mat = led(c, mult);
    leds.push(mat);
    return mat;
  };

  // 1. Fuselagem Angular Stealth (Formato de Flecha de Alta Velocidade)
  const mainHull = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.7, 4), hPrimary);
  mainHull.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  mainHull.scale.set(1.4, 0.5, 1);
  mainHull.position.set(0, 0.08, 0.2);
  g.add(mainHull);
  edges(mainHull, color, 1.4);

  // Blindagem dorsal com canaletas de resfriamento
  const dorsalPlates = box(0.72, 0.16, 1.8, hSecondary, 0, 0.28, -0.3);
  g.add(dorsalPlates);
  dorsalPlates.add(box(0.1, 0.06, 1.6, L(accent, 3.2), 0, 0.1, 0));

  // 2. Pontas Duplas de Transmissão Dianteiras (Agulhas Telemáticas)
  for (const s of [-1, 1]) {
    const needle = cyl(0.02, 0.06, 1.1, 6, chromeMat, s * 0.32, 0.08, 1.8, Math.PI / 2);
    g.add(needle);
    needle.add(cyl(0.03, 0.03, 0.2, 6, L(accent, 4.0), 0, 0.48, 0));
  }

  // 3. Torre de Telemensagem e Antena Parabólica Holográfica
  const mastGroup = new THREE.Group();
  mastGroup.position.set(0, 0.35, -0.15);
  g.add(mastGroup);

  // Mastro vertical
  const mast = cyl(0.06, 0.09, 0.85, 8, chromeMat, 0, 0.4, 0);
  mastGroup.add(mast);

  // Prato de radar / antena parabólica inclinada para frente
  const dishGroup = new THREE.Group();
  dishGroup.position.set(0, 0.8, 0);
  dishGroup.rotation.x = -0.35;
  mastGroup.add(dishGroup);

  const dishRing = torus(0.44, 0.045, 8, 28, L(color, 3.2), 0, 0, 0, 0);
  dishGroup.add(dishRing);
  const dishBack = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 8), glass(color, 0.75));
  dishBack.scale.set(1, 1, 0.3);
  dishGroup.add(dishBack);
  const dishFeed = cyl(0.02, 0.02, 0.3, 6, chromeMat, 0, 0, 0.15, Math.PI / 2);
  dishGroup.add(dishFeed);
  const dishEmitter = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), L(accent, 4.5));
  dishEmitter.position.set(0, 0, 0.3);
  dishGroup.add(dishEmitter);

  // 4. Asas Táticas Diedro com Trilhos de Armadilhas de Telemensagem
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(s * 0.45, 0.05, -0.4);
    wing.rotation.set(0, s * -0.22, s * 0.12);
    g.add(wing);

    // Corpo da asa
    const wingBody = box(1.3, 0.07, 1.1, hPrimary, s * 0.65, 0, 0);
    wing.add(wingBody);
    edges(wingBody, color, 1.2);

    // Trilho de dados neon
    wing.add(box(1.2, 0.04, 0.06, L(color, 2.5), s * 0.6, 0.04, 0.1));

    // Pod disparador de armadilhas na ponta da asa
    const pod = cyl(0.12, 0.14, 0.75, 8, hSecondary, s * 1.35, 0, 0.05, Math.PI / 2);
    wing.add(pod);
    pod.add(cyl(0.14, 0.14, 0.08, 8, L(accent, 3.5), 0, 0.35, 0));

    // Aileron vertical na ponta
    const fin = box(0.05, 0.55, 0.5, hSecondary, s * 1.38, 0.24, -0.15, 0, 0, s * -0.18);
    wing.add(fin);
    fin.add(box(0.06, 0.48, 0.04, L(), 0, 0, 0.18));
  }

  // 5. Propulsores Vetoriais Duplos Traseiros
  for (const s of [-1, 1]) {
    const eng = box(0.38, 0.28, 0.75, hSecondary, s * 0.55, 0.1, -1.2);
    g.add(eng);
    eng.add(box(0.34, 0.24, 0.06, L(color, 3.0), 0, 0, -0.38));

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 8), L(accent, 3.8));
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(s * 0.55, 0.1, -1.8);
    g.add(flame);
    afterburners.push(flame);
  }

  const ledBase = new THREE.Color(color);

  return {
    group: g,
    engines: [new THREE.Vector3(-0.55, 0.1, -1.2), new THREE.Vector3(0.55, 0.1, -1.2)],
    muzzles: [new THREE.Vector3(0, 0.8, 0.3), new THREE.Vector3(-1.35, 0.05, -0.35), new THREE.Vector3(1.35, 0.05, -0.35)],
    leds,
    ledBase,
    animate: (_dt, s) => {
      // Varredura da antena de telemensagem
      dishGroup.rotation.y = Math.sin(s.time * 3.2) * 0.65;
      dishGroup.rotation.z = Math.cos(s.time * 2.8) * 0.18;

      const pwr = 2.5 + Math.sin(s.time * 6) * 0.9 + s.firing * 2.4 + (s.ultActive ? 3.0 : 0);
      for (const m of leds) m.color.copy(ledBase).multiplyScalar(pwr);

      const fScale = 0.85 + (s.speed / 14.2) * 0.75 + Math.random() * 0.2;
      for (const b of afterburners) {
        b.scale.set(1 + Math.random() * 0.15, fScale, 1 + Math.random() * 0.15);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Drone Auxiliar - Mini Caça Autônomo Sci-Fi
// ---------------------------------------------------------------------------
export function buildDroneMesh(color: number): THREE.Group {
  const g = new THREE.Group();
  const dHull = hull(0x101524, 0.9, 0.25);
  const dWing = hull(0x1e273e, 0.85, 0.3);
  const dLed = led(color, 3.5);

  // Corpo em ponta de flecha facetada
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 6), dHull);
  body.rotation.x = Math.PI / 2;
  body.scale.set(1.1, 0.65, 1);
  g.add(body);
  edges(body, color, 1.6);

  // Sensor frontal visor / olho
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), dLed);
  eye.position.set(0, 0.04, 0.5);
  eye.scale.set(1.4, 0.6, 0.8);
  g.add(eye);

  // Asas em delta anguladas
  for (const side of [-1, 1]) {
    const wing = box(0.65, 0.04, 0.5, dWing, side * 0.42, 0, -0.2, 0, side * 0.3, side * -0.15);
    g.add(wing);
    wing.add(box(0.6, 0.03, 0.04, dLed, 0, 0.02, 0.2));
  }

  // Micro-canhão inferior
  const blaster = cyl(0.04, 0.04, 0.5, 6, hull(0x0c0e18), 0, -0.14, 0.25, Math.PI / 2);
  g.add(blaster);

  // Anel propulsor orbital
  const ring = torus(0.36, 0.03, 6, 24, dLed, 0, 0, -0.45, Math.PI / 2);
  g.add(ring);

  // Chama do propulsor traseiro
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 8), dLed);
  jet.rotation.x = -Math.PI / 2;
  jet.position.set(0, 0, -0.7);
  g.add(jet);

  return g;
}

// ---------------------------------------------------------------------------
// Garrafa do Big - Coquetel Molotov Espacial Ciberpunk
// ---------------------------------------------------------------------------
export function buildBottle(): THREE.Group {
  const g = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1848cc,
    emissive: 0x0088ff,
    emissiveIntensity: 2.2,
    metalness: 0.2,
    roughness: 0.08,
    transparent: true,
    opacity: 0.88,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xff9900,
    emissiveIntensity: 1.5,
    metalness: 0.95,
    roughness: 0.15,
  });

  // Base hexagonal reforçada
  const baseRim = cyl(1.35, 1.45, 0.6, 8, hull(0x181a24), 0, 0.3, 0);
  g.add(baseRim);

  // Corpo principal de vidro cristalino reforçado
  const body = cyl(1.28, 1.35, 3.6, 16, glassMat, 0, 2.2, 0);
  g.add(body);

  // Ombreira cônica da garrafa
  const shoulder = cyl(0.65, 1.28, 1.2, 16, glassMat, 0, 4.4, 0);
  g.add(shoulder);

  // Gargalo com caneluras
  const neck = cyl(0.46, 0.65, 1.6, 12, glassMat, 0, 5.6, 0);
  g.add(neck);

  // Colar de liga dourada no gargalo
  const neckRing = torus(0.55, 0.08, 8, 16, goldMat, 0, 6.2, 0, Math.PI / 2);
  g.add(neckRing);

  // Tampa tecnológica com válvula de pressão
  const cap = cyl(0.58, 0.58, 0.6, 12, goldMat, 0, 6.6, 0);
  g.add(cap);

  // Rótulo Holográfico Neon Anti-Aura
  const label = cyl(1.33, 1.34, 1.8, 16, new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xff2a5a).multiplyScalar(2.8),
    side: THREE.DoubleSide,
  }), 0, 2.2, 0);
  g.add(label);

  // Faixas de aviso de perigo no rótulo
  const hazard1 = cyl(1.35, 1.35, 0.12, 16, led(0xffd700, 3.5), 0, 3.0, 0);
  g.add(hazard1);
  const hazard2 = cyl(1.35, 1.35, 0.12, 16, led(0xffd700, 3.5), 0, 1.4, 0);
  g.add(hazard2);

  // Fogo interior turbilhonante (plasma de combustão cósmica)
  const fireMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xff6015).multiplyScalar(2.5),
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const fire = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), fireMat);
  fire.scale.set(1, 1.8, 1);
  fire.position.y = 2.4;
  g.add(fire);
  g.userData.fire = fire;

  // Lacre de plasma aceso na ponta do bico
  const flameFuse = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 8), led(0xff3300, 4.0));
  flameFuse.position.y = 7.3;
  g.add(flameFuse);

  return g;
}
