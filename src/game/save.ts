import { META_UPGRADES, type MetaId, type HeroId } from './config';

const KEY = 'bigsurvivor_antiaura_meta_v1';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  rewardShards: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_kill', name: 'Primeiro Contato', desc: 'Elimine seu primeiro invasor Farm\'aura.', icon: '🎯', rewardShards: 25 },
  { id: 'survive_5', name: 'Resistência Inicial', desc: 'Sobreviva à Onda 5.', icon: '🛡', rewardShards: 35 },
  { id: 'kill_miniboss', name: 'Caçador de Sentinelas', desc: 'Destrua uma Sentinela Farm\'aura.', icon: '👾', rewardShards: 50 },
  { id: 'survive_10', name: 'Metade do Caminho', desc: 'Sobreviva até a Onda 10.', icon: '⭐', rewardShards: 75 },
  { id: 'arsenal', name: 'Arsenal Completo', desc: 'Equipe 3 ou mais armas secundárias simultâneas.', icon: '🚀', rewardShards: 80 },
  { id: 'evolution', name: 'Fusão Quântica', desc: 'Evolua qualquer arma primária ou secundária.', icon: '👑', rewardShards: 100 },
  { id: 'speed_demon', name: 'Velocidade Relativística', desc: 'Alcance +50% de bônus de velocidade.', icon: '⚡', rewardShards: 40 },
  { id: 'dash_master', name: 'Intocável', desc: 'Execute 40 dashes em uma única partida.', icon: '💨', rewardShards: 40 },
  { id: 'coin_hoarder', name: 'Magnata Cósmico', desc: 'Colete 50 moedas em uma única partida.', icon: '💰', rewardShards: 60 },
  { id: 'elite_hunter', name: 'Pesadelo dos Elites', desc: 'Elimine 8 inimigos de elite em uma única partida.', icon: '💀', rewardShards: 70 },
  { id: 'rescue_heroes', name: 'Heróis do Resgate', desc: 'Derrote o Farmador de Aura e liberte Carlinhos e Macedo.', icon: '🏆', rewardShards: 200 },
  { id: 'endless_25', name: 'Viajante do Infinito', desc: 'Alcance a Onda 25 no Modo Infinito.', icon: '🌌', rewardShards: 150 },
];

export interface MetaSave {
  shards: number;
  levels: Record<MetaId, number>;
  bestWave: number;
  totalKills: number;
  runs: number;
  victories: number;
  achievements: string[];
  defeatedEnemies: Record<string, number>;
}

const defaultLevels = (): Record<MetaId, number> => ({
  hp: 0, dmg: 0, speed: 0, magnet: 0, armor: 0, xp: 0, ultcd: 0, luck: 0,
});

const defaultSave = (): MetaSave => ({
  shards: 0,
  levels: defaultLevels(),
  bestWave: 0,
  totalKills: 0,
  runs: 0,
  victories: 0,
  achievements: [],
  defeatedEnemies: {},
});

export function loadMeta(): MetaSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<MetaSave>;
    return {
      ...defaultSave(),
      ...parsed,
      levels: { ...defaultLevels(), ...(parsed.levels ?? {}) },
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      defeatedEnemies: parsed.defeatedEnemies ?? {},
    };
  } catch {
    return defaultSave();
  }
}

export function saveMeta(m: MetaSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* storage indisponível */
  }
}

export function buyMeta(id: MetaId): MetaSave | null {
  const m = loadMeta();
  const def = META_UPGRADES.find(u => u.id === id);
  if (!def) return null;
  const lvl = m.levels[id];
  if (lvl >= def.max) return null;
  const cost = def.cost(lvl);
  if (m.shards < cost) return null;
  m.shards -= cost;
  m.levels[id] = lvl + 1;
  saveMeta(m);
  return m;
}

export function unlockAchievement(id: string): { unlocked: boolean; achievement?: AchievementDef } {
  const m = loadMeta();
  if (m.achievements.includes(id)) return { unlocked: false };
  const ach = ACHIEVEMENTS.find(a => a.id === id);
  if (!ach) return { unlocked: false };
  m.achievements.push(id);
  m.shards += ach.rewardShards;
  saveMeta(m);
  return { unlocked: true, achievement: ach };
}

export function recordEnemyKill(enemyType: string): void {
  const m = loadMeta();
  m.defeatedEnemies[enemyType] = (m.defeatedEnemies[enemyType] ?? 0) + 1;
  saveMeta(m);
}

export interface MetaBonuses {
  hp: number;
  dmg: number;
  speed: number;
  magnet: number;
  armor: number;
  xp: number;
  ultcd: number;
  luck: number;
}

export function getMetaBonuses(m: MetaSave = loadMeta()): MetaBonuses {
  const l = m.levels;
  return {
    hp: l.hp * 10,
    dmg: l.dmg * 0.05,
    speed: l.speed * 0.03,
    magnet: l.magnet * 0.1,
    armor: l.armor,
    xp: l.xp * 0.05,
    ultcd: l.ultcd * 0.04,
    luck: l.luck,
  };
}

export function recordRun(r: { wave: number; kills: number; shards: number; victory: boolean }): MetaSave {
  const m = loadMeta();
  m.shards += r.shards;
  m.bestWave = Math.max(m.bestWave, r.wave);
  m.totalKills += r.kills;
  m.runs += 1;
  if (r.victory) m.victories += 1;
  saveMeta(m);
  return m;
}

export function isHeroUnlocked(heroId: HeroId, meta: MetaSave = loadMeta()): boolean {
  if (heroId === 'carlinhos' || heroId === 'macedo') {
    return (meta.victories ?? 0) > 0;
  }
  return true;
}

export function addShards(amount: number): MetaSave {
  const m = loadMeta();
  m.shards = Math.max(0, m.shards + amount);
  saveMeta(m);
  return m;
}

export function unlockAllHeroes(): MetaSave {
  const m = loadMeta();
  m.victories = Math.max(m.victories, 1);
  saveMeta(m);
  return m;
}

export function maxAllMetaUpgrades(): MetaSave {
  const m = loadMeta();
  for (const u of META_UPGRADES) {
    m.levels[u.id] = u.max;
  }
  saveMeta(m);
  return m;
}

export function unlockAllAchievements(): MetaSave {
  const m = loadMeta();
  for (const ach of ACHIEVEMENTS) {
    if (!m.achievements.includes(ach.id)) {
      m.achievements.push(ach.id);
      m.shards += ach.rewardShards;
    }
  }
  saveMeta(m);
  return m;
}

export function resetAllSaveData(): MetaSave {
  const def = defaultSave();
  saveMeta(def);
  return def;
}

