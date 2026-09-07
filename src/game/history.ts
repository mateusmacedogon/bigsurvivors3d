import type { HeroId, GameMode, PactId, RunResult } from './config';

const HISTORY_KEY = 'bigsurvivor_match_history_v1';
const CAREER_KEY = 'bigsurvivor_career_stats_v1';

export interface MatchHistoryEntry {
  id: string;
  date: string;
  timestamp: number;
  hero: HeroId;
  gameMode: GameMode;
  pacts: PactId[];
  wave: number;
  time: number;
  kills: number;
  coins: number;
  shards: number;
  level: number;
  dps: number;
  victory: boolean;
  weapons: string[];
  relics: string[];
  ascension?: string | null;
}

export interface CareerStats {
  totalRuns: number;
  totalWins: number;
  totalPlayTime: number; // segundos
  totalDamageDealt: number;
  totalKills: number;
  maxWave: number;
  maxDps: number;
  killsByEnemy: Record<string, number>;
  weaponUsageCount: Record<string, number>;
  heroRuns: Record<HeroId, number>;
}

const defaultCareer = (): CareerStats => ({
  totalRuns: 0,
  totalWins: 0,
  totalPlayTime: 0,
  totalDamageDealt: 0,
  totalKills: 0,
  maxWave: 0,
  maxDps: 0,
  killsByEnemy: {},
  weaponUsageCount: {},
  heroRuns: {
    big: 0,
    otton: 0,
    thiago: 0,
    pietro: 0,
    carlinhos: 0,
    macedo: 0,
  },
});

export function loadMatchHistory(): MatchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMatchEntry(entry: MatchHistoryEntry): MatchHistoryEntry[] {
  try {
    const list = loadMatchHistory();
    // Inserir no início e manter as últimas 10 partidas
    list.unshift(entry);
    const trimmed = list.slice(0, 10);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch {
    return [];
  }
}

export function loadCareerStats(): CareerStats {
  try {
    const raw = localStorage.getItem(CAREER_KEY);
    if (!raw) return defaultCareer();
    const parsed = JSON.parse(raw);
    return {
      ...defaultCareer(),
      ...parsed,
      killsByEnemy: parsed.killsByEnemy ?? {},
      weaponUsageCount: parsed.weaponUsageCount ?? {},
      heroRuns: { ...defaultCareer().heroRuns, ...(parsed.heroRuns ?? {}) },
    };
  } catch {
    return defaultCareer();
  }
}

export function recordMatchHistory(result: RunResult): MatchHistoryEntry {
  const entry: MatchHistoryEntry = {
    id: 'run_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    timestamp: Date.now(),
    hero: result.hero,
    gameMode: result.gameMode ?? 'classic',
    pacts: result.pacts ?? [],
    wave: result.wave,
    time: result.time,
    kills: result.kills,
    coins: result.coins,
    shards: result.shards,
    level: result.level,
    dps: result.dps,
    victory: result.victory,
    weapons: result.activeWeapons ? result.activeWeapons.map(w => w.name) : [],
    relics: result.relics ?? [],
    ascension: result.ascension ?? null,
  };
  saveMatchEntry(entry);
  return entry;
}

export function recordCareerRun(
  entryOrResult: MatchHistoryEntry | RunResult,
  damageTotal?: number,
  killsThisRun: Record<string, number> = {}
): CareerStats {
  const c = loadCareerStats();
  c.totalRuns += 1;
  const isRunResult = 'damageBreakdown' in entryOrResult;
  if (entryOrResult.victory) c.totalWins += 1;
  c.totalPlayTime += Math.round(entryOrResult.time);
  const dmg = damageTotal ?? (isRunResult ? Object.values(entryOrResult.damageBreakdown ?? {}).reduce((a, b) => a + b, 0) : entryOrResult.dps * Math.max(1, entryOrResult.time));
  c.totalDamageDealt += Math.round(dmg);
  c.totalKills += entryOrResult.kills;
  c.maxWave = Math.max(c.maxWave, entryOrResult.wave);
  c.maxDps = Math.max(c.maxDps, Math.round(entryOrResult.dps));

  // Herói usado
  if (entryOrResult.hero && entryOrResult.hero in c.heroRuns) {
    c.heroRuns[entryOrResult.hero] = (c.heroRuns[entryOrResult.hero] ?? 0) + 1;
  }

  // Armas usadas
  const weapons = isRunResult 
    ? (entryOrResult.activeWeapons ? entryOrResult.activeWeapons.map(w => w.name) : [])
    : entryOrResult.weapons;

  for (const w of weapons) {
    c.weaponUsageCount[w] = (c.weaponUsageCount[w] ?? 0) + 1;
  }

  // Inimigos abatidos nesta partida
  for (const [k, v] of Object.entries(killsThisRun)) {
    c.killsByEnemy[k] = (c.killsByEnemy[k] ?? 0) + v;
  }

  try {
    localStorage.setItem(CAREER_KEY, JSON.stringify(c));
  } catch {
    /* storage indisponível */
  }

  return c;
}

export function clearAllHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(CAREER_KEY);
  } catch {
    /* storage indisponível */
  }
}
