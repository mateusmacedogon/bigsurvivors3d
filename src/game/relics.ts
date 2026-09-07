// ===== BIG SURVIVOR: Relíquias Cósmicas Passivas (Build Enablers) =====

export type RelicId =
  | 'vacuum_reactor'
  | 'tesla_battery'
  | 'refraction_prism'
  | 'phoenix_protocol'
  | 'cosmic_fury'
  | 'chronos_compass'
  | 'pact_of_ambition';

export interface RelicDef {
  id: RelicId;
  name: string;
  icon: string;
  desc: string;
  flavor: string;
  color: string;
  rarity: 'epic' | 'legendary';
}

export const RELICS: Record<RelicId, RelicDef> = {
  vacuum_reactor: {
    id: 'vacuum_reactor',
    name: 'Reator de Vácuo Quântico',
    icon: '🌀',
    desc: 'Acertos críticos geram micro-buracos negros de 0.8s que sugam inimigos próximos.',
    flavor: 'Captura o colapso estelar infinitesimal na fusão dos tiros.',
    color: '#c084fc',
    rarity: 'epic',
  },
  tesla_battery: {
    id: 'tesla_battery',
    name: 'Bateria Tesla de Alta Tensão',
    icon: '⚡',
    desc: 'Executar um Dash dispara arcos de relâmpago automático nos 5 inimigos mais próximos.',
    flavor: 'Descarrega a estática do propulsor diretamente no casco alienígena.',
    color: '#60a5fa',
    rarity: 'epic',
  },
  refraction_prism: {
    id: 'refraction_prism',
    name: 'Prisma de Refração',
    icon: '💎',
    desc: 'Tiros que eliminam inimigos refratam em 3 feixes de laser menores em leque.',
    flavor: 'Cristal hiperdenso que divide frequências fotônicas destrutivas.',
    color: '#38bdf8',
    rarity: 'epic',
  },
  phoenix_protocol: {
    id: 'phoenix_protocol',
    name: 'Protocolo Fênix',
    icon: '🔥',
    desc: '1x por run: ao sofrer dano fatal, a nave fica invulnerável por 3.5s, cura 40% do HP e detona uma supernova.',
    flavor: 'Sobrecarga de emergência dos reatores em temperatura de supernova.',
    color: '#f97316',
    rarity: 'legendary',
  },
  cosmic_fury: {
    id: 'cosmic_fury',
    name: 'Condutor de Fúria Cósmica',
    icon: '💢',
    desc: 'Quanto menor a vida da nave, maior o dano (+1.5% de dano para cada 1% de HP perdido).',
    flavor: 'Converte a deformação do casco em voltagem para as armas de bordo.',
    color: '#ef4444',
    rarity: 'epic',
  },
  chronos_compass: {
    id: 'chronos_compass',
    name: 'Bússola de Cronos',
    icon: '🧭',
    desc: 'Congelar ou atordoar monstros concede +15% de velocidade de movimento por 4s.',
    flavor: 'Distorce o fluxo temporal pessoal ao manipular a inércia dos alvos.',
    color: '#34d399',
    rarity: 'epic',
  },
  pact_of_ambition: {
    id: 'pact_of_ambition',
    name: 'Pacto da Ambição',
    icon: '💰',
    desc: 'Inimigos soltam o dobro de moedas e shards, mas ganham +15% de velocidade de movimento.',
    flavor: 'Risco extremo para ganhos cósmicos astronômicos.',
    color: '#fbbf24',
    rarity: 'legendary',
  },
};

export const RELIC_DEFS = RELICS;
export const ALL_RELIC_IDS: RelicId[] = Object.keys(RELICS) as RelicId[];

export class RelicManager {
  activeRelics = new Set<RelicId>();
  phoenixTriggered = false;
  chronosTimer = 0;

  reset() {
    this.activeRelics.clear();
    this.phoenixTriggered = false;
    this.chronosTimer = 0;
  }

  has(id: RelicId): boolean {
    return this.activeRelics.has(id);
  }

  add(id: RelicId): boolean {
    if (this.activeRelics.has(id)) return false;
    this.activeRelics.add(id);
    return true;
  }

  getActiveList(): RelicDef[] {
    return Array.from(this.activeRelics).map(id => RELICS[id]).filter(Boolean);
  }

  getAvailablePool(): RelicDef[] {
    return ALL_RELIC_IDS.filter(id => !this.activeRelics.has(id)).map(id => RELICS[id]);
  }

  rollRandomRelic(): RelicDef | null {
    const pool = this.getAvailablePool();
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  update(dt: number) {
    if (this.chronosTimer > 0) {
      this.chronosTimer -= dt;
    }
  }

  // Multiplicador de dano da Fúria Cósmica
  getDamageMult(hpFrac: number): number {
    if (!this.has('cosmic_fury')) return 1.0;
    const missingPct = Math.max(0, (1 - hpFrac) * 100);
    return 1.0 + (missingPct * 0.015);
  }

  // Bônus de velocidade da Bússola de Cronos
  getSpeedMult(): number {
    let mult = 1.0;
    if (this.has('chronos_compass') && this.chronosTimer > 0) {
      mult += 0.15;
    }
    return mult;
  }

  triggerChronos() {
    if (this.has('chronos_compass')) {
      this.chronosTimer = 4.0;
    }
  }

  // Pacto da Ambição: velocidade dos inimigos e multiplicador de recompensas
  getEnemySpeedMult(): number {
    return this.has('pact_of_ambition') ? 1.15 : 1.0;
  }

  getDropsMultiplier(): number {
    return this.has('pact_of_ambition') ? 2.0 : 1.0;
  }

  // Protocolo Fênix: previne morte fatal 1 vez
  canTriggerPhoenix(): boolean {
    return this.has('phoenix_protocol') && !this.phoenixTriggered;
  }

  triggerPhoenix() {
    this.phoenixTriggered = true;
  }
}
