import { useEffect, useState } from 'react';
import {
  HEROES, LORE, META_UPGRADES, ENEMY_DEFS, RARITY_COLOR, RARITY_NAME, heroById,
  PACTS,
  type HeroId, type MetaId, type RunResult, type Snapshot, type UpgradeChoice,
  type GameMode, type PactId, type AscensionPerkDef,
} from '../game/config';
import { ACHIEVEMENTS, isHeroUnlocked, type MetaSave } from '../game/save';
import { loadSettings, updateSetting, type GameSettings } from '../game/settings';
import { loadMatchHistory, loadCareerStats } from '../game/history';
import { RELIC_DEFS } from '../game/relics';
import { HERO_ICONS, HERO_ELEMENTS } from './HUD';

const fmtTime = (t: number) => {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const WEAPON_LABELS: Record<string, string> = {
  primary: 'Arma Primária',
  main: 'Arma Primária',
  singularity_cannon: 'Canhão de Singularidade (Evolução)',
  dimensional_cleave: 'Corte Dimensional (Evolução)',
  acid_tempest: 'Tempestade Ácida (Evolução)',
  apocalypse_lexicon: 'Grimório do Apocalipse (Evolução)',
  unconditional_love: 'Amor Incondicional (Evolução)',
  telematics_network: 'Rede Neural Telemática (Evolução)',
  gentle_wave: 'Onda de Gentileza',
  telemessage: 'Telemensagem',
  macabre_swarm: 'Enxame Macabro (Evolução)',
  stellar_saw: 'Serra Estelar (Evolução)',
  mjolnir_storm: 'Tempestade Mjolnir (Evolução)',
  singularity_well: 'Vórtice Cósmico (Evolução)',
  missile_pod: 'Pod de Mísseis',
  orbital_saw: 'Serra Orbital',
  tesla_coil: 'Bobina de Tesla',
  gravity_well: 'Poço Gravitacional',
  saw: 'Serra Orbital',
  missile: 'Míssil Teleguiado',
  tesla: 'Descarga Elétrica',
  vortex: 'Vórtice Gravitacional',
  ult: 'Habilidade Suprema',
  dash: 'Rastro Flamejante (Dash)',
  dash_flame: 'Rastro Flamejante (Dash)',
  dash_kinetic: 'Impacto Cinético (Dash)',
  slash: 'Golpe de Lâmina',
  drone: 'Drone de Combate',
  burn: 'Dano de Queimadura',
  corrode: 'Dano de Corrosão',
  singularity: 'Singularidade',
  julia_heart: '💖 Corações da Julia (Easter Egg)',
  supernova: 'Supernova',
  explosion: 'Explosão de Mísseis',
  garrafa_flamejante: 'Garrafa Flamejante (Fogo)',
  bleeding: 'Karatê Dilacerante (Sangramento)',
  burning_passion: 'Amor Fervoroso (Projéteis de Paixão)',
  acid_puddle: 'Poças Cáusticas (Ácido)',
  chain_reaction: 'Reação Bio-Tóxica (Explosão)',
  echo_glyphs: 'Ecos Arcanos (Fragmentos)',
  liturgy: 'Liturgia Ancestral (Lasers Cósmicos)',
  echoing_peace: 'Eco da Gentileza (Onda Dupla)',
  holy_grace: 'Graça Divina (Zona Consagrada)',
  overload_cascade: 'Sobrecarga em Cascata (Raios)',
  inconvenience: 'Inconveniência (Domo)',
  flamethrower: 'Lança-Chamas',
  solar_inferno: 'Inferno Solar (Evolução)',
  railgun: 'Canhão Eletromagnético',
  hadron_collider: 'Colisor de Hádrons (Evolução)',
  mind_awakener: 'O Acordador de Mentes',
  conspiracy_storm: 'Tempestade Conspiracionista (Raio Gigante)',
  awakened_singularity: 'O Iluminador Cósmico (Evolução)',
  wood_oven: 'Forno á Lenha',
  cosmic_blast_furnace: 'Fornalha Cósmica (Evolução)',
  breno_companion: 'Breno (Chamas)',
  breno_explosion: 'Explosão do Breno',
  infernal_combustion: 'Combustão Espontânea',
  thunderlord: 'Senhor dos Relâmpagos (Descarga)',
  pyromancer_trail: 'Trilha de Lava (Piromante)',
};

function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="text-center select-none">
      <div className={`font-display font-black title-glow leading-none ${small ? 'text-4xl' : 'text-6xl md:text-8xl'}`} style={{ color: '#eafcff' }}>BIG SURVIVOR</div>
      <div className={`font-display tracking-[0.5em] mt-3 ${small ? 'text-xs' : 'text-lg md:text-2xl'}`} style={{ color: '#ff30c0', textShadow: '0 0 18px #ff30c0' }}>PROJETO ANTI-AURA</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function MainMenu({
  meta,
  onStart,
  onHangar,
  onAchievements,
  onCodex,
  onSettings,
}: {
  meta: MetaSave;
  onStart: () => void;
  onHangar: () => void;
  onAchievements: () => void;
  onCodex: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20 overflow-y-auto flex flex-col items-center font-body px-4">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(2,1,10,0.85) 100%)' }} />
      <div className="relative my-auto flex flex-col items-center gap-5 md:gap-6 fade-in max-w-4xl w-full px-2 text-center py-6">
        <div className="float"><Logo /></div>
        <div className="glass-strong rounded-2xl px-8 py-4 max-w-2xl text-center text-white/80 leading-relaxed text-sm md:text-base scanlines relative overflow-hidden border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          {LORE.map((l, i) => <p key={i} className={i ? 'mt-2' : ''}>{l}</p>)}
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <button className="btn btn-primary text-base md:text-lg shadow-lg flex items-center gap-2" onClick={onStart}>
            <span>▶</span> Iniciar Missão
          </button>
          <button className="btn flex items-center gap-2" onClick={onHangar}>
            <span>⚙</span> Hangar · Upgrades
          </button>
          <button className="btn flex items-center gap-2" onClick={onAchievements}>
            <span>🏆</span> Conquistas
          </button>
          <button className="btn flex items-center gap-2" onClick={onCodex}>
            <span>📖</span> Bestiário & Códex
          </button>
          <button className="btn flex items-center gap-2" onClick={onSettings}>
            <span>⚙</span> Configurações
          </button>
        </div>
        <div className="flex gap-4 md:gap-6 text-xs md:text-sm uppercase tracking-[0.2em] font-display text-white/60 flex-wrap justify-center glass px-6 py-2 rounded-2xl border border-white/10 shadow-md">
          <span className="flex items-center gap-1.5">🌊 Melhor onda: <b className="text-cyan-300 font-bold">{meta.bestWave}</b></span>
          <span className="flex items-center gap-1.5">⚔ Abates: <b className="text-pink-300 font-bold">{meta.totalKills.toLocaleString()}</b></span>
          <span className="flex items-center gap-1.5">💎 Shards: <b className="text-fuchsia-300 font-bold">◆ {meta.shards}</b></span>
          <span className="flex items-center gap-1.5">👑 Vitórias: <b className="text-yellow-300 font-bold">{meta.victories}</b></span>
        </div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-white/40 text-center flex items-center gap-2 flex-wrap justify-center">
          <span className="keycap">WASD</span> Mover ·
          <span className="keycap">MOUSE</span> Mirar ·
          <span className="keycap">TAB</span> Alternar Mira ·
          <span className="keycap">ESPAÇO</span> Dash ·
          <span className="keycap">Q</span> Suprema ·
          <span className="keycap">ESC / P</span> Pausar
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function HeroSelect({
  meta,
  onPick,
  onHover,
  onBack,
}: {
  meta?: MetaSave;
  onPick: (id: HeroId, mode: GameMode, pacts: PactId[]) => void;
  onHover: (id: HeroId) => void;
  onBack: () => void;
}) {
  const [sel, setSel] = useState<HeroId>('big');
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [selectedPacts, setSelectedPacts] = useState<PactId[]>([]);

  const togglePact = (pactId: PactId) => {
    setSelectedPacts(prev =>
      prev.includes(pactId) ? prev.filter(p => p !== pactId) : [...prev, pactId]
    );
  };

  let totalBonus = gameMode === 'hyper' ? 0.5 : 0;
  for (const p of selectedPacts) {
    if (PACTS[p]) totalBonus += PACTS[p].shardBonus;
  }

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto flex flex-col items-center font-body px-4 py-6">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 25%, rgba(2,1,10,0.85) 100%)' }} />
      <div className="relative my-auto flex flex-col items-center gap-3.5 max-w-7xl w-full">
        <div className="relative fade-in text-center">
        <div className="font-display font-black text-2xl md:text-3xl tracking-[0.3em] text-white neon-soft">SELECIONE SUA NAVE</div>
        <div className="text-white/50 tracking-[0.3em] uppercase text-xs mt-1">Frota experimental Anti-Aura · Cortesia de Elon Musk</div>
      </div>

      {/* Seletor de Modos de Jogo & Pactos Cósmicos */}
      <div className="relative flex flex-col items-center gap-2.5 max-w-5xl w-full z-10">
        {/* Modos */}
        <div className="flex flex-wrap gap-2.5 justify-center">
          {(['classic', 'hyper', 'boss_rush'] as const).map(m => {
            const active = gameMode === m;
            const label = m === 'classic' ? '🚀 CLÁSSICO' : m === 'hyper' ? '⚡ MODO HIPER (+50% SHARDS)' : '👾 BOSS RUSH';
            const desc = m === 'classic' ? '20 Ondas progressivas' : m === 'hyper' ? '+25% Vel. Geral & +50% XP/Shards' : 'Mini-Bosses e Farmador direto';
            return (
              <button
                key={m}
                type="button"
                onClick={() => setGameMode(m)}
                className={`px-4 py-2 rounded-xl glass-strong border transition-all text-left cursor-pointer ${
                  active
                    ? 'border-cyan-400 bg-cyan-500/25 shadow-[0_0_20px_rgba(0,229,255,0.4)]'
                    : 'border-white/10 hover:border-white/30 text-white/60'
                }`}
              >
                <div className={`font-display font-bold text-xs ${active ? 'text-cyan-200' : 'text-white'}`}>{label}</div>
                <div className="text-[10px] text-white/50">{desc}</div>
              </button>
            );
          })}
        </div>

        {/* Pactos Cósmicos */}
        <div className="glass-strong px-4 py-2 rounded-xl border border-purple-500/30 flex flex-wrap items-center justify-center gap-2 shadow-md">
          <span className="text-[10px] uppercase tracking-widest text-purple-300 font-display font-bold mr-1">
            PACTOS CÓSMICOS:
          </span>
          {(Object.keys(PACTS) as PactId[]).map(pId => {
            const p = PACTS[pId];
            const on = selectedPacts.includes(pId);
            return (
              <button
                key={pId}
                type="button"
                onClick={() => togglePact(pId)}
                className={`px-3 py-1 rounded-lg text-[11px] font-display font-semibold transition-all border cursor-pointer flex items-center gap-1.5 ${
                  on
                    ? 'bg-purple-600/30 border-purple-400 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.45)]'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
                }`}
                title={p.desc}
              >
                <span>{p.icon}</span>
                <span>{p.name}</span>
                <span className={on ? 'text-amber-300 font-bold' : 'text-white/40'}>+{Math.round(p.shardBonus * 100)}%</span>
              </button>
            );
          })}
          {totalBonus > 0 && (
            <span className="text-xs font-display font-bold text-amber-300 ml-2 px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 animate-pulse shadow-sm">
              BÔNUS SHARDS: +{Math.round(totalBonus * 100)}%
            </span>
          )}
        </div>
      </div>

      <div className="relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-4 gap-3.5 max-w-7xl w-full">
        {HEROES.map((h, i) => {
          const active = sel === h.id;
          const unlocked = isHeroUnlocked(h.id, meta);
          const icon = HERO_ICONS[h.id] ?? '🚀';
          const elem = HERO_ELEMENTS[h.id];

          return (
            <button
              key={h.id}
              onMouseEnter={() => { setSel(h.id); onHover(h.id); }}
              onFocus={() => { setSel(h.id); onHover(h.id); }}
              onClick={() => { if (unlocked) onPick(h.id, gameMode, selectedPacts); }}
              className={`card glass-strong rounded-2xl p-4 text-left relative overflow-hidden transition-all flex flex-col justify-between border ${
                unlocked ? 'cursor-pointer hover:border-cyan-300' : 'cursor-not-allowed opacity-75'
              }`}
              style={{
                animationDelay: `${i * 0.05}s`,
                borderColor: active ? h.css : undefined,
                boxShadow: active
                  ? `0 0 35px ${h.css}55, 0 25px 60px rgba(0,0,0,0.6)`
                  : undefined,
              }}
            >
              <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-35" style={{ background: h.css }} />
              <div className="relative flex flex-col h-full">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl">{icon}</span>
                    <span className="font-display font-black text-xl neon" style={{ color: h.css }}>{h.name}</span>
                  </div>
                  {!unlocked ? (
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[9px] font-display font-bold">
                      🔒 BLOQUEADO
                    </span>
                  ) : h.locked ? (
                    <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/40 text-[9px] font-display font-bold">
                      ✓ LIBERTADO
                    </span>
                  ) : (
                    elem && (
                      <span className={`px-2 py-0.5 rounded text-[9px] font-display font-bold border ${elem.border} ${elem.text} bg-white/5`}>
                        {elem.label}
                      </span>
                    )
                  )}
                </div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/50">{h.title}</div>
                <p className="text-xs text-white/75 mt-2 min-h-[44px] leading-relaxed">{h.desc}</p>

                {/* Mini Medidores de Atributos */}
                <div className="space-y-1.5 mt-2.5 text-[10px] font-display uppercase tracking-wider text-white/70">
                  <div>
                    <div className="flex justify-between mb-0.5"><span>HP</span><b className="text-white">{h.hp}</b></div>
                    <div className="meter-track"><div className="meter-fill" style={{ width: `${(h.hp / 180) * 100}%`, background: h.css }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-0.5"><span>VEL</span><b className="text-white">{h.speed}</b></div>
                    <div className="meter-track"><div className="meter-fill" style={{ width: `${(h.speed / 16) * 100}%`, background: h.css }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-0.5"><span>DANO</span><b className="text-white">{h.damage}</b></div>
                    <div className="meter-track"><div className="meter-fill" style={{ width: `${(h.damage / 35) * 100}%`, background: h.css }} /></div>
                  </div>
                </div>

                <div className="mt-2.5 space-y-1.5 text-xs flex-1">
                  <div className="glass rounded-lg px-2.5 py-1.5">
                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/45">Arma básica</div>
                    <div className="font-semibold text-xs leading-tight" style={{ color: h.css }}>{h.weapon}</div>
                    <div className="text-white/65 text-[11px] leading-tight mt-0.5">{h.weaponDesc}</div>
                  </div>
                  <div className="glass rounded-lg px-2.5 py-1.5">
                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/45">Suprema (Q)</div>
                    <div className="font-semibold text-yellow-200 text-xs leading-tight">{h.ult}</div>
                    <div className="text-white/65 text-[11px] leading-tight mt-0.5">{h.ultDesc}</div>
                  </div>
                </div>

                {!unlocked && (
                  <div className="mt-2.5 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] text-red-200 leading-tight">
                    <span className="font-bold">🔒 Resgate:</span> {h.unlockDesc || 'Derrote o Farmador de Aura e vença o jogo!'}
                  </div>
                )}

                <div
                  className="mt-3 font-display text-[11px] tracking-[0.25em] text-center py-2.5 rounded-xl font-bold transition-all"
                  style={{
                    background: !unlocked ? 'rgba(255,255,255,0.05)' : `${h.css}25`,
                    color: !unlocked ? 'rgba(255,255,255,0.4)' : h.css,
                    border: !unlocked ? '1px dashed rgba(255,255,255,0.2)' : `1px solid ${h.css}66`,
                  }}
                >
                  {!unlocked ? '🔒 BLOQUEADO' : active ? '▶ DECOLAR' : 'SELECIONAR'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
        <button className="btn btn-ghost relative mt-2" onClick={onBack}>← Voltar</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function AscensionModal({
  choices,
  onPick,
}: {
  choices: AscensionPerkDef[];
  onPick: (id: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const keyMap: Record<string, number> = {
        '1': 0, 'Digit1': 0, 'Numpad1': 0,
        '2': 1, 'Digit2': 1, 'Numpad2': 1,
      };
      const idx = keyMap[e.key] ?? keyMap[e.code] ?? -1;
      if (idx >= 0 && choices[idx]) onPick(choices[idx].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choices, onPick]);

  return (
    <div
      className="fixed inset-0 z-30 overflow-y-auto flex flex-col items-center font-body p-4"
      style={{ backdropFilter: 'blur(14px)', background: 'radial-gradient(ellipse at center, rgba(30,20,5,0.85) 0%, rgba(5,2,15,0.95) 100%)' }}
    >
      <div className="relative my-auto flex flex-col items-center gap-6 max-w-4xl w-full py-6">
        <div className="text-center fade-in max-w-2xl">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 font-display text-xs tracking-[0.3em] uppercase mb-3 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
            <span>★</span>
            <span>MARCO DE NÍVEL 10 ALCANÇADO</span>
            <span>★</span>
          </div>
          <div className="font-display font-black text-3xl md:text-5xl tracking-[0.25em] text-white neon-soft drop-shadow-[0_0_30px_rgba(251,191,36,0.4)]">
            ASCENSÃO CÓSMICA
          </div>
          <div className="text-amber-200/80 uppercase tracking-[0.3em] text-xs mt-2 font-medium">
            Escolha a especialização cósmica definitiva da sua nave para esta missão
          </div>
        </div>

        <div className="flex gap-6 flex-wrap justify-center max-w-4xl w-full">
          {choices.map((c, i) => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className="card glass-strong rounded-2xl w-[360px] p-7 text-left relative overflow-hidden cursor-pointer border border-amber-400/50 hover:border-amber-300 transition-all hover:scale-[1.03] shadow-[0_0_45px_rgba(245,158,11,0.25)] flex flex-col justify-between group"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <div className="absolute -top-20 -right-20 w-52 h-52 rounded-full blur-3xl opacity-35 bg-amber-400 pointer-events-none group-hover:opacity-50 transition-opacity" />
              <div className="relative flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[10px] font-display font-bold text-amber-300 tracking-wider">
                    ESPECIALIZAÇÃO {i + 1}
                  </span>
                  <span className="keycap">[{i + 1}]</span>
                </div>
                <div className="text-6xl text-center my-3 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] transform group-hover:scale-110 transition-transform">
                  {c.icon}
                </div>
                <div className="font-display font-black text-2xl text-center text-amber-300 mb-2 leading-tight">
                  {c.name}
                </div>
                <div className="text-xs text-white/85 leading-relaxed text-center min-h-[64px] px-2">
                  {c.desc}
                </div>
                <div className="mt-6 text-center font-display text-xs tracking-[0.25em] py-3 rounded-xl font-bold bg-gradient-to-r from-amber-500/30 via-amber-400/40 to-amber-500/30 border border-amber-400/70 text-amber-100 group-hover:border-amber-300 group-hover:shadow-[0_0_20px_rgba(251,191,36,0.5)] transition-all">
                  [{i + 1}] ATIVAR ASCENSÃO
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-white/40 flex items-center gap-2">
          Pressione <span className="keycap">1</span> ou <span className="keycap">2</span> no teclado para confirmar
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function Hangar({ meta, onBuy, onBack }: { meta: MetaSave; onBuy: (id: MetaId) => void; onBack: () => void }) {
  const totalBought = META_UPGRADES.reduce((acc, u) => acc + (meta.levels[u.id] || 0), 0);
  const maxPossible = META_UPGRADES.reduce((acc, u) => acc + u.max, 0);
  const fleetPowerPct = Math.round((totalBought / maxPossible) * 100);

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto flex flex-col items-center font-body px-4 md:px-6 py-6">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 20%, rgba(2,1,10,0.88) 100%)' }} />

      <div className="relative my-auto flex flex-col items-center gap-4 max-w-6xl w-full z-10 py-4">
        {/* Header & Fleet Power Banner */}
        <div className="relative text-center fade-in z-10 max-w-4xl w-full">
          <div className="font-display font-black text-3xl md:text-4xl tracking-[0.3em] text-white neon-soft">
            HANGAR ESTELAR
          </div>
          <div className="text-white/50 tracking-[0.3em] uppercase text-xs mt-1">
            Engenharia Reversa & Upgrades Permanentes de Frota
          </div>

          {/* Currency & Power telemetry */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 md:gap-5">
            {/* Shard Bank */}
            <div className="glass-strong px-5 py-2 rounded-2xl border border-fuchsia-500/40 flex items-center gap-3 shadow-[0_0_20px_rgba(255,48,192,0.2)]">
              <span className="text-2xl">💎</span>
              <div className="text-left">
                <div className="text-[9px] uppercase tracking-widest text-fuchsia-300 font-bold">Shards Disponíveis</div>
                <div className="font-display font-black text-lg md:text-xl text-fuchsia-200">
                  ◆ {meta.shards.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Fleet Upgrade Progress */}
            <div className="glass-strong px-5 py-2 rounded-2xl border border-cyan-400/40 flex items-center gap-3 shadow-[0_0_20px_rgba(0,229,255,0.2)]">
              <span className="text-2xl">⚡</span>
              <div className="text-left">
                <div className="flex justify-between items-center gap-3">
                  <span className="text-[9px] uppercase tracking-widest text-cyan-300 font-bold">Poder da Frota</span>
                  <span className="font-display font-bold text-xs text-white">{totalBought} / {maxPossible} ({fleetPowerPct}%)</span>
                </div>
                <div className="w-36 h-2 bg-black/50 rounded-full overflow-hidden border border-white/10 mt-1">
                  <div className="h-full bg-cyan-400 shadow-[0_0_8px_#00e5ff] transition-all" style={{ width: `${fleetPowerPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Grid of Upgrades */}
        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-6xl w-full z-10 max-h-[58vh] overflow-y-auto pr-1">
          {META_UPGRADES.map((u, i) => {
            const lvl = meta.levels[u.id] || 0;
            const maxed = lvl >= u.max;
            const cost = u.cost(lvl);
            const can = !maxed && meta.shards >= cost;

            return (
              <div
                key={u.id}
                className={`card glass-strong rounded-2xl p-4 flex flex-col justify-between border transition-all ${
                  maxed
                    ? 'border-yellow-400/50 bg-yellow-500/5 shadow-[0_0_20px_rgba(255,215,0,0.15)]'
                    : can
                    ? 'border-cyan-400/40 hover:border-cyan-300 shadow-[0_0_20px_rgba(0,229,255,0.15)]'
                    : 'border-white/10 opacity-75'
                }`}
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl drop-shadow-[0_0_8px_rgba(0,229,255,0.4)]">{u.icon}</span>
                      <div className="font-display font-bold text-sm text-white leading-tight">{u.name}</div>
                    </div>
                    <span
                      className={`text-[10px] font-display font-bold px-2 py-0.5 rounded-full border ${
                        maxed
                          ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40'
                          : 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30'
                      }`}
                    >
                      {maxed ? 'MÁXIMO' : `NV ${lvl}/${u.max}`}
                    </span>
                  </div>

                  <div className="text-xs text-white/70 leading-relaxed min-h-[38px] mt-1">
                    <span className="text-white/90 font-medium">{u.desc(lvl)}</span>
                    {!maxed && (
                      <span className="text-cyan-300 font-bold ml-1.5 inline-block">
                        → {u.desc(lvl + 1).replace(/^[+-]/, m => m)}
                      </span>
                    )}
                  </div>

                  {/* Segmented Power Pips */}
                  <div className="flex gap-1 mt-3">
                    {Array.from({ length: u.max }).map((_, k) => {
                      const active = k < lvl;
                      return (
                        <div
                          key={k}
                          className="h-2 flex-1 rounded-xs transition-all"
                          style={{
                            background: active ? (maxed ? '#ffd700' : '#00e5ff') : 'rgba(255,255,255,0.1)',
                            boxShadow: active ? `0 0 6px ${maxed ? '#ffd700' : '#00e5ff'}` : undefined,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Purchase Action */}
                <button
                  className={`btn text-xs py-2.5 px-3 mt-4 w-full flex items-center justify-center gap-1.5 transition-all ${
                    maxed
                      ? 'border-yellow-400/40 text-yellow-300 bg-yellow-500/10 cursor-default'
                      : can
                      ? 'btn-primary'
                      : 'opacity-50 cursor-not-allowed border-white/10 text-white/40'
                  }`}
                  disabled={!can}
                  onClick={() => { if (can) onBuy(u.id); }}
                >
                  {maxed ? (
                    <span>✓ TOTALMENTE OTIMIZADO</span>
                  ) : (
                    <>
                      <span>Instalar Módulo ·</span>
                      <span className={can ? 'text-fuchsia-300 font-bold' : 'text-white/50'}>◆ {cost}</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="relative z-10 flex items-center gap-4 mt-2">
          <button className="btn btn-ghost" onClick={onBack}>← Voltar ao Menu</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function AchievementsScreen({ meta, onBack }: { meta: MetaSave; onBack: () => void }) {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const unlockedCount = ACHIEVEMENTS.filter(a => meta.achievements.includes(a.id)).length;
  const progressPct = Math.round((unlockedCount / ACHIEVEMENTS.length) * 100);
  const totalEarnedShards = ACHIEVEMENTS.filter(a => meta.achievements.includes(a.id)).reduce((acc, a) => acc + a.rewardShards, 0);

  const filtered = ACHIEVEMENTS.filter(a => {
    const isUnlocked = meta.achievements.includes(a.id);
    if (filter === 'unlocked') return isUnlocked;
    if (filter === 'locked') return !isUnlocked;
    return true;
  });

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto flex flex-col items-center font-body px-4 md:px-6 py-6">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 20%, rgba(2,1,10,0.88) 100%)' }} />

      <div className="relative my-auto flex flex-col items-center gap-4 max-w-6xl w-full z-10 py-4">
        <div className="relative text-center fade-in z-10 max-w-4xl w-full">
          <div className="font-display font-black text-3xl md:text-4xl tracking-[0.3em] text-white neon-soft">
            CONQUISTAS & FEITOS
          </div>
        <div className="text-white/50 tracking-[0.3em] uppercase text-xs mt-1">
          Distintivos de Honra e Recompensas Cósmicas da Resistência Anti-Aura
        </div>

        {/* Telemetry ribbon */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
          <div className="glass-strong px-5 py-2 rounded-2xl border border-cyan-400/30 flex items-center gap-3 shadow-[0_0_15px_rgba(0,229,255,0.15)]">
            <span className="text-xl">🏆</span>
            <div className="text-left">
              <div className="text-[9px] uppercase tracking-widest text-cyan-300 font-bold">Progresso de Feitos</div>
              <div className="flex items-center gap-3">
                <span className="font-display font-bold text-sm text-white">{unlockedCount} / {ACHIEVEMENTS.length} ({progressPct}%)</span>
                <div className="w-28 h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
                  <div className="h-full bg-cyan-400 shadow-[0_0_8px_#00e5ff] transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="glass-strong px-5 py-2 rounded-2xl border border-fuchsia-400/30 flex items-center gap-3 shadow-[0_0_15px_rgba(255,48,192,0.15)]">
            <span className="text-xl">💎</span>
            <div className="text-left">
              <div className="text-[9px] uppercase tracking-widest text-fuchsia-300 font-bold">Shards Obtidos</div>
              <div className="font-display font-bold text-sm text-fuchsia-200">+{totalEarnedShards.toLocaleString()} ◆</div>
            </div>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex justify-center gap-2 mt-3">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-[0_0_12px_rgba(0,229,255,0.25)]'
                : 'glass text-white/50 hover:text-white border border-white/10'
            }`}
          >
            Todas ({ACHIEVEMENTS.length})
          </button>
          <button
            onClick={() => setFilter('unlocked')}
            className={`px-3.5 py-1 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filter === 'unlocked'
                ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'glass text-white/50 hover:text-white border border-white/10'
            }`}
          >
            ✓ Concluídas ({unlockedCount})
          </button>
          <button
            onClick={() => setFilter('locked')}
            className={`px-3.5 py-1 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filter === 'locked'
                ? 'bg-purple-500/25 text-purple-200 border border-purple-400/50 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                : 'glass text-white/50 hover:text-white border border-white/10'
            }`}
          >
            🔒 Pendentes ({ACHIEVEMENTS.length - unlockedCount})
          </button>
        </div>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 max-w-6xl w-full z-10 max-h-[58vh] overflow-y-auto pr-1">
        {filtered.map((a, i) => {
          const unlocked = meta.achievements.includes(a.id);
          return (
            <div
              key={a.id}
              className={`card glass-strong rounded-2xl p-4 flex flex-col justify-between border transition-all ${
                unlocked
                  ? 'border-yellow-400/60 shadow-[0_0_25px_rgba(255,215,0,0.18)] bg-yellow-500/5'
                  : 'border-white/10 opacity-65 hover:opacity-90'
              }`}
              style={{ animationDelay: `${i * 0.03}s` }}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className={`text-3xl ${unlocked ? 'drop-shadow-[0_0_12px_gold]' : 'grayscale opacity-40'}`}>
                    {a.icon}
                  </div>
                  <span
                    className={`text-[9px] font-display font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                      unlocked
                        ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40 shadow-[0_0_8px_rgba(255,215,0,0.3)]'
                        : 'bg-white/5 text-white/40 border-white/10'
                    }`}
                  >
                    {unlocked ? '✓ CONCLUÍDO' : '🔒 BLOQUEADO'}
                  </span>
                </div>
                <div className={`font-display font-bold text-sm leading-tight ${unlocked ? 'text-white' : 'text-white/70'}`}>
                  {a.name}
                </div>
                <div className="text-xs text-white/65 leading-relaxed min-h-[38px] mt-1">
                  {a.desc}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-white/40 uppercase tracking-widest text-[10px]">Recompensa</span>
                <span className="font-display font-bold text-fuchsia-300 flex items-center gap-1">
                  <span>+{a.rewardShards}</span>
                  <span>◆</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

        <div className="relative z-10 flex items-center gap-4 mt-2">
          <button className="btn btn-ghost" onClick={onBack}>← Voltar ao Menu</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function CodexScreen({ meta, onBack }: { meta: MetaSave; onBack: () => void }) {
  const [subTab, setSubTab] = useState<'bestiary' | 'history' | 'career'>('bestiary');
  const [bestiaryFilter, setBestiaryFilter] = useState<'all' | 'common' | 'elite' | 'boss'>('all');
  const [history] = useState(() => loadMatchHistory());
  const [career] = useState(() => loadCareerStats());
  const entries = Object.entries(ENEMY_DEFS);
  const totalKills = meta.totalKills || 0;

  const filteredBestiary = entries.filter(([, def]) => {
    const isBoss = def.minWave >= 20 || def.name.toLowerCase().includes('farmador');
    const isElite = !isBoss && (def.hp >= 150 || def.name.toLowerCase().includes('sentinela') || def.name.toLowerCase().includes('elite'));
    if (bestiaryFilter === 'boss') return isBoss;
    if (bestiaryFilter === 'elite') return isElite;
    if (bestiaryFilter === 'common') return !isBoss && !isElite;
    return true;
  });

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto flex flex-col items-center font-body px-4 md:px-6 py-6">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 20%, rgba(2,1,10,0.88) 100%)' }} />

      <div className="relative my-auto flex flex-col items-center gap-4 max-w-6xl w-full z-10 py-4">
        <div className="relative text-center fade-in z-10 max-w-4xl w-full">
          <div className="font-display font-black text-3xl md:text-4xl tracking-[0.3em] text-white neon-soft">
            CÓDEX & REGISTROS
          </div>
        <div className="text-white/50 tracking-[0.3em] uppercase text-xs mt-1">
          Banco de Dados Tático da Resistência Anti-Aura · Abates Confirmados: <b className="text-pink-300 font-display text-sm">{totalKills.toLocaleString()}</b>
        </div>
      </div>

      {/* Subtabs bar */}
      <div className="relative flex gap-2 glass-strong p-1.5 rounded-2xl border border-white/10 z-10 shadow-lg">
        <button
          onClick={() => setSubTab('bestiary')}
          className={`px-4 py-2 rounded-xl font-display text-xs font-bold tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
            subTab === 'bestiary'
              ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,229,255,0.3)]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <span>👾</span>
          <span>BESTIÁRIO TÁTICO</span>
        </button>
        <button
          onClick={() => setSubTab('history')}
          className={`px-4 py-2 rounded-xl font-display text-xs font-bold tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
            subTab === 'history'
              ? 'bg-purple-500/25 text-purple-200 border border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <span>📜</span>
          <span>HISTÓRICO DE MISSÕES</span>
        </button>
        <button
          onClick={() => setSubTab('career')}
          className={`px-4 py-2 rounded-xl font-display text-xs font-bold tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
            subTab === 'career'
              ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <span>📊</span>
          <span>CARREIRA CÓSMICA</span>
        </button>
      </div>

      {/* Bestiary Tab */}
      {subTab === 'bestiary' && (
        <div className="relative flex flex-col gap-3 max-w-6xl w-full z-10">
          {/* Bestiary Filters */}
          <div className="flex justify-center gap-2">
            {(['all', 'common', 'elite', 'boss'] as const).map(k => {
              const label = k === 'all' ? `Todos (${entries.length})` : k === 'common' ? 'Comuns' : k === 'elite' ? 'Elites' : 'Chefes & Titãs';
              return (
                <button
                  key={k}
                  onClick={() => setBestiaryFilter(k)}
                  className={`px-3 py-1 rounded-lg text-xs font-display font-semibold transition-all cursor-pointer border ${
                    bestiaryFilter === k
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                      : 'glass border-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[54vh] overflow-y-auto pr-1">
            {filteredBestiary.map(([type, def], i) => {
              const kills = meta.defeatedEnemies?.[type] ?? 0;
              const hex = `#${def.color.toString(16).padStart(6, '0')}`;
              const isBoss = def.minWave >= 20 || def.name.toLowerCase().includes('farmador');
              const isElite = !isBoss && (def.hp >= 150 || def.name.toLowerCase().includes('sentinela') || def.name.toLowerCase().includes('elite'));

              return (
                <div
                  key={type}
                  className="card glass-strong rounded-2xl p-4 flex flex-col justify-between border transition-all hover:scale-[1.02] relative overflow-hidden"
                  style={{
                    animationDelay: `${i * 0.03}s`,
                    borderColor: `${hex}55`,
                    boxShadow: kills > 0 ? `0 0 20px ${hex}20` : undefined,
                  }}
                >
                  <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-20 pointer-events-none" style={{ background: hex }} />

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: hex, boxShadow: `0 0 8px ${hex}` }} />
                        <span className="font-display font-black text-base" style={{ color: hex }}>{def.name}</span>
                      </div>
                      <span className={`text-[9px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        isBoss
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : isElite
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-white/5 text-white/50 border-white/10'
                      }`}>
                        {isBoss ? '👑 CHEFE' : isElite ? '⭐ ELITE' : 'COMUM'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between my-2 text-xs">
                      <span className="text-white/40 uppercase tracking-widest text-[9px]">Registro de Combate:</span>
                      <span className={`text-[10px] font-display font-bold px-2 py-0.5 rounded-full border ${
                        kills > 0 ? 'bg-pink-500/20 text-pink-300 border-pink-500/40' : 'bg-white/5 text-white/30 border-white/10'
                      }`}>
                        {kills > 0 ? `⚔ ${kills.toLocaleString()} eliminados` : 'Não registrado'}
                      </span>
                    </div>

                    <p className="text-xs text-white/70 leading-relaxed min-h-[46px]">{def.desc}</p>
                  </div>

                  {/* Holographic Stats Grid */}
                  <div className="mt-3 pt-2.5 border-t border-white/10 grid grid-cols-3 gap-1.5 text-[10px] uppercase tracking-wider text-white/55">
                    <div className="glass px-2 py-1 rounded">❤️ HP <b className="text-white ml-1">{def.hp}</b></div>
                    <div className="glass px-2 py-1 rounded">⚡ VEL <b className="text-white ml-1">{def.speed}</b></div>
                    <div className="glass px-2 py-1 rounded">💥 DANO <b className="text-white ml-1">{def.damage}</b></div>
                    <div className="glass px-2 py-1 rounded">🌊 ONDA <b className="text-cyan-300 ml-1">{def.minWave > 20 ? '∞' : def.minWave}</b></div>
                    <div className="glass px-2 py-1 rounded">✨ XP <b className="text-yellow-300 ml-1">+{def.xp}</b></div>
                    <div className="glass px-2 py-1 rounded">💰 MOEDA <b className="text-amber-400 ml-1">{Math.round(def.coin * 100)}%</b></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History Tab */}
      {subTab === 'history' && (
        <div className="relative flex flex-col gap-3 max-w-4xl w-full z-10 max-h-[58vh] overflow-y-auto pr-1">
          {history.length === 0 ? (
            <div className="glass-strong rounded-2xl p-10 text-center text-white/50 text-sm border border-white/10">
              <span className="text-3xl block mb-2">📜</span>
              Nenhuma missão registrada nos registros de bordo ainda.
              <div className="text-xs text-white/35 mt-1">Inicie uma missão para gravar seu histórico!</div>
            </div>
          ) : (
            history.map(entry => {
              const hHero = heroById(entry.hero);
              const elem = HERO_ELEMENTS[entry.hero];
              return (
                <div
                  key={entry.id}
                  className={`card glass-strong rounded-2xl p-4 border flex flex-col gap-2 transition-all ${
                    entry.victory
                      ? 'border-yellow-400/40 bg-yellow-500/5 shadow-[0_0_20px_rgba(255,215,0,0.1)]'
                      : 'border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-0.5 rounded-full font-display text-xs font-bold uppercase tracking-wider ${
                        entry.victory ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40' : 'bg-red-500/25 text-red-300 border border-red-400/40'
                      }`}>
                        {entry.victory ? '✓ VITÓRIA' : '✗ NAVE ABATIDA'}
                      </span>
                      <span className="text-lg">{HERO_ICONS[entry.hero] ?? '🚀'}</span>
                      <span className="font-display font-black text-base" style={{ color: hHero.css }}>{hHero.name}</span>
                      {elem && (
                        <span className={`px-2 py-0.5 rounded text-[9px] font-display font-bold border ${elem.border} ${elem.text} bg-white/5`}>
                          {elem.label}
                        </span>
                      )}
                      <span className="text-[10px] px-2 py-0.5 rounded glass text-cyan-300 uppercase tracking-widest font-display">
                        {entry.gameMode === 'hyper' ? '⚡ HIPER' : entry.gameMode === 'boss_rush' ? '👾 BOSS RUSH' : '🚀 CLÁSSICO'}
                      </span>
                    </div>
                    <div className="text-xs text-white/50 font-mono">{entry.date}</div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs py-2.5 border-y border-white/10 text-center">
                    <div className="glass py-1 rounded-lg"><span className="text-white/40 block text-[9px] uppercase">Onda</span><b className="text-white text-sm">{entry.wave}</b></div>
                    <div className="glass py-1 rounded-lg"><span className="text-white/40 block text-[9px] uppercase">Tempo</span><b className="text-cyan-300 text-sm font-mono">{fmtTime(entry.time)}</b></div>
                    <div className="glass py-1 rounded-lg"><span className="text-white/40 block text-[9px] uppercase">Abates</span><b className="text-pink-300 text-sm">{entry.kills.toLocaleString()}</b></div>
                    <div className="glass py-1 rounded-lg"><span className="text-white/40 block text-[9px] uppercase">Shards</span><b className="text-fuchsia-300 text-sm">◆ {entry.shards}</b></div>
                    <div className="glass py-1 rounded-lg"><span className="text-white/40 block text-[9px] uppercase">DPS</span><b className="text-cyan-200 text-sm">{Math.round(entry.dps)}</b></div>
                    <div className="glass py-1 rounded-lg"><span className="text-white/40 block text-[9px] uppercase">Nível</span><b className="text-yellow-300 text-sm">{entry.level}</b></div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                    {entry.pacts && entry.pacts.length > 0 && (
                      <div className="flex gap-1 items-center">
                        <span className="text-[10px] text-purple-300 uppercase font-bold">Pactos:</span>
                        {entry.pacts.map(p => (
                          <span key={p} className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-400/30 text-[10px]">
                            {PACTS[p]?.icon} {PACTS[p]?.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {entry.ascension && (
                      <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px] font-display font-bold">
                        ★ {entry.ascension}
                      </span>
                    )}
                    {entry.weapons && entry.weapons.length > 0 && (
                      <div className="text-[11px] text-white/70 ml-auto">
                        <span className="text-white/40 mr-1">Arsenal:</span>
                        {entry.weapons.map(w => WEAPON_LABELS[w] ?? w).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Career Tab */}
      {subTab === 'career' && (
        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl w-full z-10 max-h-[58vh] overflow-y-auto pr-1">
          <div className="card glass-strong rounded-2xl p-5 border border-white/10 flex flex-col gap-3">
            <div className="font-display font-bold text-sm text-cyan-200 uppercase tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
              <span>🏆</span>
              <span>Registros Gerais de Carreira</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="glass p-3 rounded-xl"><span className="text-white/40 text-xs block uppercase">Missões Totais</span><b className="text-2xl text-white font-display">{career.totalRuns}</b></div>
              <div className="glass p-3 rounded-xl"><span className="text-white/40 text-xs block uppercase">Vitórias</span><b className="text-2xl text-amber-300 font-display">{career.totalWins} <span className="text-xs text-white/50 font-body">({career.totalRuns > 0 ? Math.round((career.totalWins / career.totalRuns) * 100) : 0}%)</span></b></div>
              <div className="glass p-3 rounded-xl"><span className="text-white/40 text-xs block uppercase">Tempo de Voo</span><b className="text-xl text-cyan-200 font-display font-mono">{fmtTime(career.totalPlayTime)}</b></div>
              <div className="glass p-3 rounded-xl"><span className="text-white/40 text-xs block uppercase">Abates Totais</span><b className="text-xl text-pink-300 font-display">{career.totalKills.toLocaleString()}</b></div>
              <div className="glass p-3 rounded-xl"><span className="text-white/40 text-xs block uppercase">Maior Onda</span><b className="text-xl text-white font-display">Onda {career.maxWave}</b></div>
              <div className="glass p-3 rounded-xl"><span className="text-white/40 text-xs block uppercase">Maior DPS</span><b className="text-xl text-cyan-300 font-display">{career.maxDps.toLocaleString()}</b></div>
              <div className="glass p-3 rounded-xl col-span-2"><span className="text-white/40 text-xs block uppercase">Dano Total Infligido</span><b className="text-xl text-amber-200 font-display">💥 {Math.round(career.totalDamageDealt || 0).toLocaleString()}</b></div>
            </div>
          </div>

          <div className="card glass-strong rounded-2xl p-5 border border-white/10 flex flex-col gap-3">
            <div className="font-display font-bold text-sm text-cyan-200 uppercase tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
              <span>🚀</span>
              <span>Utilização por Piloto</span>
            </div>
            <div className="space-y-2.5">
              {HEROES.map(h => {
                const count = career.heroRuns[h.id] ?? 0;
                const pct = career.totalRuns > 0 ? Math.round((count / career.totalRuns) * 100) : 0;
                return (
                  <div key={h.id} className="text-xs">
                    <div className="flex justify-between text-white/80 mb-1">
                      <span className="font-bold flex items-center gap-1.5" style={{ color: h.css }}>
                        <span>{HERO_ICONS[h.id] ?? '🚀'}</span>
                        <span>{h.name}</span>
                      </span>
                      <span className="text-white/60">{count} voos ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: h.css, boxShadow: `0 0 6px ${h.css}` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card glass-strong rounded-2xl p-5 border border-white/10 flex flex-col gap-3">
            <div className="font-display font-bold text-sm text-cyan-200 uppercase tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
              <span>⚔️</span>
              <span>Arsenal Mais Utilizado</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {Object.keys(career.weaponUsageCount || {}).length === 0 ? (
                <div className="text-xs text-white/40 py-2">Nenhuma arma registrada ainda.</div>
              ) : (
                Object.entries(career.weaponUsageCount)
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, count]) => {
                    const label = WEAPON_LABELS[name] ?? name;
                    return (
                      <div key={name} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                        <span className="text-white font-medium">{label}</span>
                        <span className="text-cyan-300 font-mono font-bold">{count} {count === 1 ? 'partida' : 'partidas'}</span>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          <div className="card glass-strong rounded-2xl p-5 border border-white/10 flex flex-col gap-3">
            <div className="font-display font-bold text-sm text-cyan-200 uppercase tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
              <span>👾</span>
              <span>Abates por Tipo de Inimigo</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {Object.keys(career.killsByEnemy || {}).length === 0 ? (
                <div className="text-xs text-white/40 py-2">Nenhum abate registrado ainda.</div>
              ) : (
                Object.entries(career.killsByEnemy)
                  .sort(([, a], [, b]) => b - a)
                  .map(([typeId, count]) => {
                    const enemyDef = ENEMY_DEFS[typeId as keyof typeof ENEMY_DEFS];
                    const name = enemyDef?.name ?? typeId;
                    return (
                      <div key={typeId} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                        <span className="text-white/80">{name}</span>
                        <span className="text-pink-300 font-mono font-bold">{count.toLocaleString()}</span>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

        <div className="relative z-10 flex items-center gap-4 mt-2">
          <button className="btn btn-ghost" onClick={onBack}>← Voltar ao Menu</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setVal = <K extends keyof GameSettings>(key: K, val: GameSettings[K]) => {
    const updated = updateSetting(key, val);
    setSettings(updated);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center font-body p-4"
      style={{ backdropFilter: 'blur(14px)', background: 'rgba(2,1,10,0.72)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-strong rounded-2xl p-6 md:p-8 w-[620px] max-w-[96vw] max-h-[90vh] overflow-y-auto fade-in scanlines relative border border-cyan-400/40 shadow-[0_0_50px_rgba(0,229,255,0.25)]">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div>
            <div className="font-display font-black text-2xl tracking-[0.25em] text-white neon-soft">CONFIGURAÇÕES</div>
            <div className="text-white/50 tracking-[0.2em] uppercase text-xs mt-1">Ajuste de sistemas de bordo, áudio e controles</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg glass flex items-center justify-center text-white/70 hover:text-white hover:border-cyan-300 transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Áudio */}
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-display font-bold flex items-center gap-2">
              <span>🔊</span>
              <span>Sistema de Áudio</span>
            </div>

            <div className="glass rounded-xl p-4 space-y-3.5 border border-white/10">
              <div>
                <div className="flex justify-between text-xs text-white/80 mb-1">
                  <span>Volume Geral</span>
                  <span className="font-display font-bold text-cyan-200">{Math.round(settings.masterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.masterVolume}
                  onChange={e => setVal('masterVolume', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-white/80 mb-1">
                  <span>Música de Fundo</span>
                  <span className="font-display font-bold text-cyan-200">{Math.round(settings.musicVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.musicVolume}
                  onChange={e => setVal('musicVolume', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-white/80 mb-1">
                  <span>Efeitos Sonoros (SFX)</span>
                  <span className="font-display font-bold text-cyan-200">{Math.round(settings.sfxVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.sfxVolume}
                  onChange={e => setVal('sfxVolume', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Mira */}
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-display font-bold flex items-center gap-2">
              <span>🎯</span>
              <span>Sistema de Mira <span className="text-white/40 text-[10px] font-normal">(Atalho durante o jogo: <span className="keycap">TAB</span>)</span></span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setVal('aimMode', 'auto')}
                className={`p-3.5 rounded-xl glass text-left transition-all border cursor-pointer ${
                  settings.aimMode === 'auto' ? 'border-cyan-300 bg-cyan-500/20 shadow-[0_0_15px_rgba(0,229,255,0.3)]' : 'border-white/10 hover:border-white/30 text-white/70'
                }`}
              >
                <div className="font-display font-bold text-xs text-cyan-100 flex items-center gap-1.5">
                  <span>🎯</span>
                  <span>Automática</span>
                </div>
                <div className="text-[11px] text-white/60 mt-1 leading-relaxed">Trava nos alvos mais próximos e elites prioritários automaticamente</div>
              </button>
              <button
                onClick={() => setVal('aimMode', 'manual')}
                className={`p-3.5 rounded-xl glass text-left transition-all border cursor-pointer ${
                  settings.aimMode === 'manual' ? 'border-cyan-300 bg-cyan-500/20 shadow-[0_0_15px_rgba(0,229,255,0.3)]' : 'border-white/10 hover:border-white/30 text-white/70'
                }`}
              >
                <div className="font-display font-bold text-xs text-cyan-100 flex items-center gap-1.5">
                  <span>🖱️</span>
                  <span>Manual</span>
                </div>
                <div className="text-[11px] text-white/60 mt-1 leading-relaxed">Dispara na direção do cursor do mouse para controle cirúrgico</div>
              </button>
            </div>
          </div>

          {/* Gráficos */}
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-display font-bold flex items-center gap-2">
              <span>✨</span>
              <span>Qualidade Gráfica</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map(q => (
                <button
                  key={q}
                  onClick={() => setVal('graphicsQuality', q)}
                  className={`p-3 rounded-xl glass text-center transition-all border cursor-pointer ${
                    settings.graphicsQuality === q ? 'border-cyan-300 bg-cyan-500/20 shadow-[0_0_15px_rgba(0,229,255,0.3)]' : 'border-white/10 hover:border-white/30 text-white/70'
                  }`}
                >
                  <div className="font-display font-bold text-xs text-cyan-100 uppercase">{q === 'low' ? 'Baixa' : q === 'medium' ? 'Média' : 'Alta'}</div>
                  <div className="text-[10px] text-white/50 mt-1">{q === 'low' ? 'Bloom leve · 60 FPS+' : q === 'medium' ? 'Balanceado' : 'Bloom Total & Brilho'}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Números de Dano */}
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-display font-bold flex items-center gap-2">
              <span>💥</span>
              <span>Indicadores de Dano</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['full', 'crits', 'off'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setVal('damageNumbers', d)}
                  className={`p-3 rounded-xl glass text-center transition-all border cursor-pointer ${
                    settings.damageNumbers === d ? 'border-cyan-300 bg-cyan-500/20 shadow-[0_0_15px_rgba(0,229,255,0.3)]' : 'border-white/10 hover:border-white/30 text-white/70'
                  }`}
                >
                  <div className="font-display font-bold text-xs text-cyan-100 uppercase">{d === 'full' ? 'Todos' : d === 'crits' ? 'Críticos' : 'Ocultar'}</div>
                  <div className="text-[10px] text-white/50 mt-1">{d === 'full' ? 'Completo' : d === 'crits' ? 'Apenas Críticos' : 'Tela Limpa'}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Guia Rápido de Teclas */}
          <div className="glass rounded-xl p-4 border border-white/10 space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Guia Rápido de Teclas & Comandos</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-white/70">
              <div className="flex items-center gap-2"><span className="keycap">WASD</span> Mover nave</div>
              <div className="flex items-center gap-2"><span className="keycap">MOUSE</span> Mirar / Atirar</div>
              <div className="flex items-center gap-2"><span className="keycap">TAB</span> Alternar Mira</div>
              <div className="flex items-center gap-2"><span className="keycap">ESPAÇO</span> Dash Evasivo</div>
              <div className="flex items-center gap-2"><span className="keycap">Q</span> Suprema</div>
              <div className="flex items-center gap-2"><span className="keycap">ESC / P</span> Pausar</div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-white/10 flex justify-end">
          <button className="btn btn-primary text-sm px-6" onClick={onClose}>Salvar e Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function PauseScreen({
  snap,
  onResume,
  onQuit,
  onSettings,
}: {
  snap: Snapshot;
  onResume: () => void;
  onQuit: () => void;
  onSettings: () => void;
}) {
  const hero = snap.hero ? heroById(snap.hero) : null;
  const elem = snap.hero ? HERO_ELEMENTS[snap.hero] : null;
  const hpPct = Math.max(0, Math.min(100, Math.round((snap.hp / snap.maxHp) * 100)));

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto flex flex-col items-center font-body p-4" style={{ backdropFilter: 'blur(12px)', background: 'rgba(2,1,10,0.65)' }}>
      <div className="my-auto glass-strong rounded-2xl p-6 md:p-8 w-[560px] max-w-[94vw] fade-in scanlines relative overflow-hidden border border-cyan-400/40 shadow-[0_0_60px_rgba(0,229,255,0.2)]">
        <div className="font-display font-black text-3xl tracking-[0.35em] text-center text-white neon-soft">
          PAUSA TÁTICA
        </div>
        <div className="text-center text-cyan-200/60 uppercase tracking-[0.3em] text-xs mt-1.5">
          Sistemas em Espera · Duração de Voo: {fmtTime(snap.time)}
        </div>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-3 gap-2.5 mt-5 text-center">
          <div className="glass rounded-xl py-2.5 border border-white/10">
            <div className="text-[9px] uppercase tracking-widest text-white/50">Onda Atual</div>
            <div className="font-display text-2xl text-white font-bold">{snap.wave}</div>
          </div>
          <div className="glass rounded-xl py-2.5 border border-white/10">
            <div className="text-[9px] uppercase tracking-widest text-white/50">Abates</div>
            <div className="font-display text-2xl text-pink-300 font-bold">{snap.kills.toLocaleString()}</div>
          </div>
          <div className="glass rounded-xl py-2.5 border border-white/10">
            <div className="text-[9px] uppercase tracking-widest text-white/50">Shards Coletados</div>
            <div className="font-display text-2xl text-fuchsia-300 font-bold">◆ {snap.shards}</div>
          </div>
        </div>

        {/* Pilot Telemetry Card */}
        {hero && (
          <div className="mt-4 glass-strong rounded-xl p-4 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{HERO_ICONS[hero.id] ?? '🚀'}</span>
                <div>
                  <div className="font-display font-bold text-base flex items-center gap-2" style={{ color: hero.css }}>
                    <span>{hero.name}</span>
                    {elem && (
                      <span className={`px-2 py-0.5 rounded text-[9px] font-display font-bold border ${elem.border} ${elem.text} bg-white/5`}>
                        {elem.label}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/50">Piloto Chefe · Nível {snap.level}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-white/40">Integridade do Casco</div>
                <div className="text-xs font-mono font-bold text-white">{Math.ceil(snap.hp)} / {snap.maxHp} <span className="text-cyan-300">({hpPct}%)</span></div>
              </div>
            </div>

            {/* HP Bar */}
            <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full transition-all"
                style={{
                  width: `${hpPct}%`,
                  background: hpPct > 50 ? '#00e5ff' : hpPct > 25 ? '#ffd700' : '#ff3050',
                  boxShadow: `0 0 8px ${hpPct > 50 ? '#00e5ff' : hpPct > 25 ? '#ffd700' : '#ff3050'}`,
                }}
              />
            </div>

            {/* Active Upgrades & Modifiers */}
            {snap.upgrades.length > 0 && (
              <div className="pt-2 border-t border-white/10">
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5 font-bold">Módulos Instalados ({snap.upgrades.length})</div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {snap.upgrades.map(u => (
                    <div key={u.id} className="text-xs px-2.5 py-1 rounded-lg glass border border-white/10 flex items-center gap-1.5">
                      <span>{u.icon}</span>
                      <span className="text-white/80 font-medium">{u.name}</span>
                      <b className="text-cyan-300 font-mono">NV {u.level}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 mt-6 justify-center flex-wrap">
          <button className="btn btn-primary text-sm px-5 flex items-center gap-2" onClick={onResume}>
            <span>▶</span> Continuar [ESC]
          </button>
          <button className="btn text-sm px-5 flex items-center gap-2" onClick={onSettings}>
            <span>⚙</span> Configurações
          </button>
          <button className="btn btn-ghost text-sm px-4 text-white/60 hover:text-red-300" onClick={onQuit}>
            Abandonar Missão
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function LevelUpScreen({ choices, level, onPick }: { choices: UpgradeChoice[]; level: number; onPick: (id: string) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const keyMap: Record<string, number> = {
        '1': 0, 'Digit1': 0, 'Numpad1': 0,
        '2': 1, 'Digit2': 1, 'Numpad2': 1,
        '3': 2, 'Digit3': 2, 'Numpad3': 2,
      };
      const idx = keyMap[e.key] ?? keyMap[e.code] ?? -1;
      if (idx >= 0 && choices[idx]) onPick(choices[idx].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choices, onPick]);

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto flex flex-col items-center font-body p-4" style={{ backdropFilter: 'blur(12px)', background: 'radial-gradient(ellipse at center, rgba(3,1,12,0.65) 0%, rgba(2,1,10,0.85) 100%)' }}>
      <div className="relative my-auto flex flex-col items-center gap-5 md:gap-6 max-w-5xl w-full py-6">
        <div className="text-center fade-in">
          <div className="inline-block px-4 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-display text-xs tracking-[0.3em] uppercase mb-2">
            ★ SINAL DE ATUALIZAÇÃO DISPONÍVEL ★
          </div>
          <div className="font-display font-black text-4xl md:text-5xl tracking-[0.35em] text-white neon-soft">
            NÍVEL {level}
          </div>
          <div className="text-cyan-200/70 uppercase tracking-[0.35em] text-xs mt-1.5 font-medium">
            Selecione um módulo tático para aprimorar sua nave
          </div>
        </div>

        <div className="flex gap-5 flex-wrap justify-center px-4 max-w-5xl w-full">
          {choices.map((c, i) => {
            const isHero = c.isHeroExclusive;
            const col = c.isEvolution ? '#ffd700' : isHero ? (c.heroColor ?? '#00ffff') : RARITY_COLOR[c.rarity];
            const legendary = c.rarity === 'legendary' || c.isEvolution || isHero;

            return (
              <button
                key={c.id + i}
                onClick={() => onPick(c.id)}
                className="card glass-strong rounded-2xl w-[270px] h-[370px] p-6 text-left relative overflow-hidden cursor-pointer transition-all hover:scale-[1.04] flex flex-col justify-between group"
                style={{
                  animationDelay: `${i * 0.12}s`,
                  borderColor: c.isEvolution ? '#ffd700' : isHero ? `${c.heroColor ?? '#00ffff'}cc` : `${col}88`,
                  boxShadow: c.isEvolution
                    ? '0 0 50px rgba(255,215,0,0.5), 0 30px 80px rgba(0,0,0,0.7)'
                    : isHero
                    ? `0 0 45px ${c.heroColor ?? '#00ffff'}66, 0 30px 80px rgba(0,0,0,0.6)`
                    : `0 0 ${legendary ? 50 : 25}px ${col}44, 0 30px 80px rgba(0,0,0,0.6)`
                }}
              >
                {legendary && <div className="absolute inset-0 shimmer pointer-events-none" />}
                <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl opacity-35 pointer-events-none" style={{ background: col }} />

                <div className="relative flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-display tracking-[0.2em] uppercase font-bold" style={{ color: col }}>
                        {c.isEvolution
                          ? '★ EVOLUÇÃO LENDÁRIA ★'
                          : isHero
                          ? `★ EXCLUSIVO: ${c.heroName ?? 'PILOTO'} ★`
                          : RARITY_NAME[c.rarity]}
                      </span>
                      <span className="text-[10px] tracking-widest text-white/50 font-mono px-2 py-0.5 rounded bg-white/5">
                        {c.isEvolution ? 'MAX' : `NV ${c.level}`}
                      </span>
                    </div>

                    <div className="text-6xl text-center mt-5 mb-4 group-hover:scale-110 transition-transform drop-shadow-[0_0_15px_rgba(0,229,255,0.4)]" style={{ color: col }}>
                      {c.icon}
                    </div>

                    <div className="font-display font-bold text-lg text-center text-white leading-snug">
                      {c.name}
                    </div>

                    <div className="text-xs text-center text-white/75 mt-2.5 leading-relaxed">
                      {c.desc}
                    </div>
                  </div>

                  <div
                    className="mt-auto text-center font-display text-xs tracking-[0.25em] py-2.5 rounded-xl font-bold transition-all shadow-md"
                    style={{
                      background: c.isEvolution
                        ? 'linear-gradient(90deg, rgba(255,215,0,0.4), rgba(255,140,0,0.4))'
                        : isHero
                        ? `linear-gradient(90deg, ${c.heroColor ?? '#00ffff'}44, ${c.heroColor ?? '#00ffff'}22)`
                        : `${col}28`,
                      color: c.isEvolution ? '#ffe066' : isHero ? '#ffffff' : col,
                      border: c.isEvolution
                        ? '1px solid rgba(255,215,0,0.8)'
                        : isHero
                        ? `1px solid ${c.heroColor ?? '#00ffff'}aa`
                        : `1px solid ${col}77`,
                    }}
                  >
                    [{i + 1}] {c.isEvolution ? '★ EVOLUIR ★' : isHero ? '★ SINTONIZAR ★' : 'INSTALAR'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-[11px] uppercase tracking-[0.25em] text-white/40 flex items-center gap-2">
          Pressione <span className="keycap">1</span>, <span className="keycap">2</span> ou <span className="keycap">3</span> no teclado para escolher
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function EndScreen({ result, onMenu, onContinue }: { result: RunResult; onMenu: () => void; onContinue?: () => void }) {
  const hero = heroById(result.hero);
  const elem = HERO_ELEMENTS[result.hero];
  const v = result.victory;
  const breakdownEntries = Object.entries(result.damageBreakdown || {}).sort((a, b) => b[1] - a[1]);
  const totalDmg = breakdownEntries.reduce((acc, [, val]) => acc + val, 0);

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto flex flex-col items-center font-body p-4" style={{ backdropFilter: 'blur(12px)', background: v ? 'radial-gradient(ellipse at center, rgba(30,18,3,0.75) 0%, rgba(5,2,10,0.9) 100%)' : 'radial-gradient(ellipse at center, rgba(25,3,8,0.75) 0%, rgba(5,2,10,0.9) 100%)' }}>
      <div className="my-auto glass-strong rounded-2xl p-6 md:p-8 w-[680px] max-w-[96vw] max-h-[90vh] overflow-y-auto fade-in text-center scanlines relative border border-white/15 shadow-[0_0_60px_rgba(0,0,0,0.8)]">
        {/* Banner Title */}
        <div className="font-display font-black text-3xl md:text-5xl tracking-[0.25em] neon" style={{ color: v ? '#ffd700' : '#ff3050' }}>
          {v ? 'MISSÃO CUMPRIDA' : 'NAVE DESTRUÍDA'}
        </div>
        <div className="text-white/75 mt-2 text-sm md:text-base max-w-lg mx-auto leading-relaxed">
          {v
            ? 'O Farmador de Aura foi aniquilado. Carlinhos e Macedo voltam para casa — a Terra está livre dos Farm\'auras.'
            : 'Os Farm\'auras venceram desta vez. Reforce os módulos da sua frota no Hangar e volte à ativa, piloto.'}
        </div>

        {/* Victory Celebration Card */}
        {v && (
          <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-cyan-500/20 to-amber-500/20 border border-amber-400/60 text-center shadow-[0_0_30px_rgba(245,158,11,0.25)]">
            <div className="font-display font-black text-amber-300 text-sm md:text-base flex items-center justify-center gap-2">
              <span>🎉</span>
              <span>CARLINHOS & MACEDO FORAM RESGATADOS!</span>
              <span>🚀</span>
            </div>
            <div className="text-xs text-white/85 mt-1 leading-relaxed">
              Ambos os heróis foram libertados e agora estão disponíveis no seletor de naves para jogar!
            </div>
          </div>
        )}

        {/* Core Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5 mt-5 text-center">
          <div className="glass rounded-xl py-2.5 border border-white/10">
            <div className="text-[9px] uppercase tracking-widest text-white/50">Onda Final</div>
            <div className="font-display text-2xl text-white font-bold">{result.wave}</div>
          </div>
          <div className="glass rounded-xl py-2.5 border border-white/10">
            <div className="text-[9px] uppercase tracking-widest text-white/50">Abates Totais</div>
            <div className="font-display text-2xl text-pink-300 font-bold">{result.kills.toLocaleString()}</div>
          </div>
          <div className="glass rounded-xl py-2.5 border border-white/10">
            <div className="text-[9px] uppercase tracking-widest text-white/50">Tempo de Voo</div>
            <div className="font-display text-2xl text-cyan-200 font-bold font-mono">{fmtTime(result.time)}</div>
          </div>
          <div className="glass rounded-xl py-2.5 border border-white/10">
            <div className="text-[9px] uppercase tracking-widest text-white/50">DPS Médio</div>
            <div className="font-display text-2xl text-cyan-300 font-bold">{Math.round(result.dps).toLocaleString()}</div>
          </div>
          <div className="glass rounded-xl py-2.5 border border-white/10">
            <div className="text-[9px] uppercase tracking-widest text-white/50">Piloto</div>
            <div className="font-display text-lg font-bold flex items-center justify-center gap-1.5" style={{ color: hero.css }}>
              <span>{HERO_ICONS[hero.id] ?? '🚀'}</span>
              <span>{hero.name}</span>
            </div>
          </div>
          <div className="glass rounded-xl py-2.5 border border-white/10">
            <div className="text-[9px] uppercase tracking-widest text-white/50">Shards Ganhos</div>
            <div className="font-display text-2xl text-fuchsia-300 font-bold">◆ {result.shards}</div>
          </div>
        </div>

        {/* Match Modifiers: Mode, Pacts, Ascension */}
        <div className="mt-4 flex flex-wrap gap-2 justify-center items-center">
          <span className="px-3 py-1 rounded-full glass border border-cyan-400/40 text-cyan-200 font-display text-xs font-bold">
            {result.gameMode === 'hyper' ? '⚡ MODO HIPER (+50% SHARDS)' : result.gameMode === 'boss_rush' ? '👾 BOSS RUSH' : '🚀 MODO CLÁSSICO'}
          </span>
          {result.pacts && result.pacts.map(p => (
            <span key={p} className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/40 text-xs font-display flex items-center gap-1">
              <span>{PACTS[p]?.icon}</span>
              <span>{PACTS[p]?.name}</span>
            </span>
          ))}
          {result.ascension && (
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/50 text-xs font-display font-bold shadow-[0_0_12px_rgba(245,158,11,0.3)]">
              ★ {result.ascension}
            </span>
          )}
          {elem && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-display font-bold border ${elem.border} ${elem.text} bg-white/5`}>
              {elem.label}
            </span>
          )}
        </div>

        {/* Relíquias Cósmicas Coletadas */}
        {result.relics && result.relics.length > 0 && (
          <div className="mt-3 text-left glass-strong rounded-xl p-3.5 border border-white/10">
            <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2 font-bold">Relíquias Cósmicas Coletadas ({result.relics.length})</div>
            <div className="flex gap-2 flex-wrap">
              {result.relics.map(rId => {
                const r = RELIC_DEFS[rId as keyof typeof RELIC_DEFS];
                return (
                  <div key={rId} className="px-2.5 py-1 rounded-lg glass flex items-center gap-1.5 border border-white/20 text-xs" title={r?.desc}>
                    <span className="text-base">{r?.icon}</span>
                    <span className="font-display font-bold text-white text-[11px]">{r?.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Armas Secundárias Equipadas */}
        {result.activeWeapons && result.activeWeapons.length > 0 && (
          <div className="mt-3 text-left glass-strong rounded-xl p-3.5 border border-white/10">
            <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2 font-bold">Arsenal Equipado ({result.activeWeapons.length})</div>
            <div className="flex gap-2 flex-wrap">
              {result.activeWeapons.map(w => (
                <div key={w.id} className={`px-3 py-1 rounded-lg glass flex items-center gap-2 border ${w.evolved ? 'border-yellow-400/80 bg-yellow-500/10 shadow-[0_0_10px_rgba(255,215,0,0.3)]' : 'border-white/15'}`}>
                  <span className="text-lg">{w.icon}</span>
                  <span className="text-xs font-display font-bold text-white">{w.name}</span>
                  <span className={`text-[10px] font-display font-bold ${w.evolved ? 'text-yellow-300' : 'text-cyan-300'}`}>
                    {w.evolved ? '👑 EVOLUÍDA' : `NV ${w.level}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estatísticas de Dano por Arma com Medalhas */}
        {breakdownEntries.length > 0 && (
          <div className="mt-3 text-left glass-strong rounded-xl p-4 border border-white/10 space-y-2.5">
            <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-white/50">
              <span className="font-bold">Distribuição de Dano do Arsenal</span>
              <span className="font-mono text-cyan-200">Dano Total: {Math.round(totalDmg).toLocaleString()}</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {breakdownEntries.map(([k, val], rankIdx) => {
                const pct = totalDmg > 0 ? Math.round((val / totalDmg) * 100) : 0;
                const label = WEAPON_LABELS[k] ?? k;
                const medal = rankIdx === 0 ? '🥇' : rankIdx === 1 ? '🥈' : rankIdx === 2 ? '🥉' : null;

                return (
                  <div key={k} className="text-xs">
                    <div className="flex justify-between text-white/85 mb-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        {medal && <span>{medal}</span>}
                        <span>{label}</span>
                      </span>
                      <span className="font-mono text-cyan-200 font-bold">
                        {Math.round(val).toLocaleString()}{' '}
                        <span className="text-white/40 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: rankIdx === 0 ? 'linear-gradient(90deg, #ffd700, #ff8c00)' : '#00e5ff',
                          boxShadow: rankIdx === 0 ? '0 0 8px rgba(255,215,0,0.6)' : '0 0 6px rgba(0,229,255,0.4)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-[11px] text-white/40 mt-3.5 uppercase tracking-widest">
          Moedas convertidas em Shards (25:1) e salvas no banco de dados do Hangar
        </div>

        <div className="flex gap-3 mt-5 justify-center flex-wrap">
          {v && onContinue && (
            <button className="btn btn-primary text-sm px-6" onClick={onContinue}>
              ∞ Continuar · Modo Infinito
            </button>
          )}
          <button className="btn text-sm px-6" onClick={onMenu}>
            Voltar ao Menu Principal
          </button>
        </div>
      </div>
    </div>
  );
}

