// ===== BIG SURVIVOR: Configurações do Jogo e Persistência =====

export type GraphicQuality = 'high' | 'medium' | 'low';
export type AimMode = 'auto' | 'manual';
export type DamageNumbersMode = 'full' | 'crits' | 'off';

export interface GameSettings {
  masterVolume: number; // 0 - 1
  musicVolume: number;  // 0 - 1
  sfxVolume: number;    // 0 - 1
  graphicsQuality: GraphicQuality;
  aimMode: AimMode;
  damageNumbers: DamageNumbersMode;
}

const SETTINGS_KEY = 'bigsurvivor_antiaura_settings_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.4,
  sfxVolume: 0.7,
  graphicsQuality: 'high',
  aimMode: 'auto',
  damageNumbers: 'full',
};

type SettingsListener = (settings: GameSettings) => void;
const listeners: Set<SettingsListener> = new Set();

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      masterVolume: typeof parsed.masterVolume === 'number' ? Math.max(0, Math.min(1, parsed.masterVolume)) : DEFAULT_SETTINGS.masterVolume,
      musicVolume: typeof parsed.musicVolume === 'number' ? Math.max(0, Math.min(1, parsed.musicVolume)) : DEFAULT_SETTINGS.musicVolume,
      sfxVolume: typeof parsed.sfxVolume === 'number' ? Math.max(0, Math.min(1, parsed.sfxVolume)) : DEFAULT_SETTINGS.sfxVolume,
      graphicsQuality: parsed.graphicsQuality && ['high', 'medium', 'low'].includes(parsed.graphicsQuality) ? parsed.graphicsQuality : DEFAULT_SETTINGS.graphicsQuality,
      aimMode: parsed.aimMode && ['auto', 'manual'].includes(parsed.aimMode) ? parsed.aimMode : DEFAULT_SETTINGS.aimMode,
      damageNumbers: parsed.damageNumbers && ['full', 'crits', 'off'].includes(parsed.damageNumbers) ? parsed.damageNumbers : DEFAULT_SETTINGS.damageNumbers,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    listeners.forEach(fn => fn(settings));
  } catch {
    /* localStorage indisponível */
  }
}

export function updateSetting<K extends keyof GameSettings>(key: K, value: GameSettings[K]): GameSettings {
  const current = loadSettings();
  const updated: GameSettings = { ...current, [key]: value };
  saveSettings(updated);
  return updated;
}

export function onSettingsChange(fn: SettingsListener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
