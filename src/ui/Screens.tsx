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
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center font-body">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(2,1,10,0.75) 100%)' }} />
      <div className="relative flex flex-col items-center gap-7 fade-in max-w-4xl px-4">
        <div className="float"><Logo /></div>
        <div className="glass rounded-2xl px-8 py-4 max-w-2xl text-center text-white/80 leading-relaxed text-sm md:text-base scanlines relative overflow-hidden">
          {LORE.map((l, i) => <p key={i} className={i ? 'mt-2' : ''}>{l}</p>)}
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <button className="btn btn-primary text-base md:text-lg" onClick={onStart}>▶ Iniciar Missão</button>
          <button className="btn" onClick={onHangar}>⚙ Hangar · Upgrades</button>
          <button className="btn" onClick={onAchievements}>🏆 Conquistas</button>
          <button className="btn" onClick={onCodex}>📖 Bestiário</button>
          <button className="btn" onClick={onSettings}>⚙ Configurações</button>
        </div>
        <div className="flex gap-6 md:gap-8 text-xs md:text-sm uppercase tracking-[0.25em] text-white/50 flex-wrap justify-center">
          <span>Melhor onda: <b className="text-cyan-300">{meta.bestWave}</b></span>
          <span>Abates: <b className="text-pink-300">{meta.totalKills}</b></span>
          <span>Shards: <b className="text-fuchsia-300">◆ {meta.shards}</b></span>
          <span>Vitórias: <b className="text-yellow-300">{meta.victories}</b></span>
        </div>
        <div className="text-[11px] uppercase tracking-[0.3em] text-white/30 text-center">
          WASD mover · Mouse mirar [Tab alterna mira] · Espaço dash · Q suprema · P / Esc pausar
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
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center font-body gap-3.5 px-4 overflow-y-auto py-6">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 25%, rgba(2,1,10,0.85) 100%)' }} />
      <div className="relative fade-in text-center">
        <div className="font-display font-black text-2xl md:text-3xl tracking-[0.3em] text-white neon-soft">SELECIONE SUA NAVE</div>
        <div className="text-white/50 tracking-[0.3em] uppercase text-xs mt-1">Frota experimental Anti-Aura · Cortesia de Elon Musk</div>
      </div>

      {/* Seletor de Modos de Jogo & Pactos Cósmicos */}
      <div className="relative flex flex-col items-center gap-2.5 max-w-5xl w-full z-10">
        {/* Modos */}
        <div className="flex flex-wrap gap-2 justify-center">
          {(['classic', 'hyper', 'boss_rush'] as const).map(m => {
            const active = gameMode === m;
            const label = m === 'classic' ? '🚀 CLÁSSICO' : m === 'hyper' ? '⚡ MODO HIPER (+50% SHARDS)' : '👾 BOSS RUSH';
            const desc = m === 'classic' ? '20 Ondas progressivas' : m === 'hyper' ? '+25% Vel. Geral & +50% XP/Shards' : 'Mini-Bosses e Farmador direto';
            return (
              <button
                key={m}
                type="button"
                onClick={() => setGameMode(m)}
                className={`px-3 py-1.5 rounded-xl glass border transition-all text-left cursor-pointer ${
                  active
                    ? 'border-cyan-400 bg-cyan-500/25 shadow-[0_0_15px_rgba(0,229,255,0.4)]'
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
        <div className="glass px-4 py-2 rounded-xl border border-purple-500/30 flex flex-wrap items-center justify-center gap-2">
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
                className={`px-2.5 py-1 rounded-lg text-[11px] font-display font-semibold transition-all border cursor-pointer flex items-center gap-1.5 ${
                  on
                    ? 'bg-purple-600/30 border-purple-400 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
                }`}
                title={p.desc}
              >
                <span>{p.icon}</span>
                <span>{p.name}</span>
                <span className={on ? 'text-amber-300' : 'text-white/40'}>+{Math.round(p.shardBonus * 100)}%</span>
              </button>
            );
          })}
          {totalBonus > 0 && (
            <span className="text-xs font-display font-bold text-amber-300 ml-2 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 animate-pulse">
              BÔNUS SHARDS: +{Math.round(totalBonus * 100)}%
            </span>
          )}
        </div>
      </div>

      <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 max-w-[96rem] w-full">
        {HEROES.map((h, i) => {
          const active = sel === h.id;
          const unlocked = isHeroUnlocked(h.id, meta);
          return (
            <button
              key={h.id}
              onMouseEnter={() => { setSel(h.id); onHover(h.id); }}
              onFocus={() => { setSel(h.id); onHover(h.id); }}
              onClick={() => { if (unlocked) onPick(h.id, gameMode, selectedPacts); }}
              className={`card glass-strong rounded-2xl p-4 text-left relative overflow-hidden transition-all flex flex-col justify-between ${
                unlocked ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'
              }`}
              style={{
                animationDelay: `${i * 0.06}s`,
                borderColor: active ? h.css : undefined,
                boxShadow: active
                  ? `0 0 40px ${h.css}55, 0 30px 80px rgba(0,0,0,0.6)`
                  : undefined,
              }}
            >
              <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-35" style={{ background: h.css }} />
              <div className="relative flex flex-col h-full">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-display font-black text-xl neon" style={{ color: h.css }}>{h.name}</div>
                  {!unlocked ? (
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[9px] font-display font-bold">
                      🔒 BLOQUEADO
                    </span>
                  ) : h.locked ? (
                    <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/40 text-[9px] font-display font-bold">
                      ✓ LIBERTADO
                    </span>
                  ) : null}
                </div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/50">{h.title}</div>
                <p className="text-xs text-white/75 mt-2.5 min-h-[50px] leading-relaxed">{h.desc}</p>

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

                <div className="grid grid-cols-3 gap-1 mt-2.5 text-[10px] uppercase tracking-wider text-white/55 text-center">
                  <div className="glass rounded py-1">HP <b className="text-white block">{h.hp}</b></div>
                  <div className="glass rounded py-1">VEL <b className="text-white block">{h.speed}</b></div>
                  <div className="glass rounded py-1">DANO <b className="text-white block">{h.damage}</b></div>
                </div>

                <div
                  className="mt-3 font-display text-[11px] tracking-[0.25em] text-center py-2 rounded font-bold transition-all"
                  style={{
                    background: !unlocked ? 'rgba(255,255,255,0.05)' : `${h.css}25`,
                    color: !unlocked ? 'rgba(255,255,255,0.4)' : h.css,
                    border: !unlocked ? '1px dashed rgba(255,255,255,0.2)' : `1px solid ${h.css}55`,
                  }}
                >
                  {!unlocked ? '🔒 BLOQUEADO' : active ? '▶ DECOLAR' : 'SELECIONAR'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <button className="btn btn-ghost relative" onClick={onBack}>← Voltar</button>
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
  return (
    <div
      className="fixed inset-0 z-30 flex flex-col items-center justify-center font-body gap-6 p-4"
      style={{ backdropFilter: 'blur(12px)', background: 'rgba(5,2,15,0.75)' }}
    >
      <div className="text-center fade-in">
        <div className="inline-block px-4 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-display text-xs tracking-[0.3em] uppercase mb-2">
          ★ MARCO DE NÍVEL 10 ALCANÇADO ★
        </div>
        <div className="font-display font-black text-3xl md:text-5xl tracking-[0.25em] text-white neon-soft">
          ASCENSÃO HERÓICA
        </div>
        <div className="text-cyan-200/80 uppercase tracking-[0.3em] text-xs mt-2">
          Escolha a especialização cósmica definitiva da sua nave
        </div>
      </div>
      <div className="flex gap-6 flex-wrap justify-center max-w-4xl w-full">
        {choices.map((c, i) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            className="card glass-strong rounded-2xl w-[340px] p-6 text-left relative overflow-hidden cursor-pointer border border-amber-400/50 hover:border-amber-300 transition-all hover:scale-105 shadow-[0_0_40px_rgba(245,158,11,0.25)] flex flex-col justify-between"
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl opacity-30 bg-amber-400 pointer-events-none" />
            <div className="relative flex flex-col h-full">
              <div className="text-5xl text-center mb-4">{c.icon}</div>
              <div className="font-display font-black text-xl text-center text-amber-300 mb-2 leading-tight">{c.name}</div>
              <div className="text-xs text-white/80 leading-relaxed text-center min-h-[60px]">{c.desc}</div>
              <div className="mt-6 text-center font-display text-xs tracking-[0.25em] py-2.5 rounded-xl font-bold bg-amber-500/25 border border-amber-400/60 text-amber-200 hover:bg-amber-500/40">
                [ESCOLHER ASCENSÃO]
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function Hangar({ meta, onBuy, onBack }: { meta: MetaSave; onBuy: (id: MetaId) => void; onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center font-body gap-5 px-6">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 25%, rgba(2,1,10,0.85) 100%)' }} />
      <div className="relative text-center fade-in">
        <div className="font-display font-black text-3xl tracking-[0.3em] text-white neon-soft">HANGAR ESTELAR</div>
        <div className="text-white/50 tracking-[0.3em] uppercase text-xs mt-2">Upgrades permanentes · Shards disponíveis: <b className="text-fuchsia-300 text-base">◆ {meta.shards}</b></div>
      </div>
      <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl w-full">
        {META_UPGRADES.map((u, i) => {
          const lvl = meta.levels[u.id];
          const maxed = lvl >= u.max;
          const cost = u.cost(lvl);
          const can = !maxed && meta.shards >= cost;
          return (
            <div key={u.id} className="card glass-strong rounded-xl p-4 flex flex-col gap-2" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-center gap-2">
                <div className="text-2xl">{u.icon}</div>
                <div className="font-display font-bold text-sm text-cyan-100 leading-tight">{u.name}</div>
              </div>
              <div className="text-xs text-white/65">{u.desc(lvl)} {!maxed && <span className="text-white/40">→ {u.desc(lvl + 1).replace(/^[+-]/, m => m)}</span>}</div>
              <div className="flex gap-0.5 mt-1">
                {Array.from({ length: u.max }).map((_, k) => (
                  <div key={k} className="h-1.5 flex-1 rounded-sm" style={{ background: k < lvl ? '#00e5ff' : 'rgba(255,255,255,0.12)', boxShadow: k < lvl ? '0 0 6px #00e5ff' : undefined }} />
                ))}
              </div>
              <button className="btn text-xs py-2 px-3 mt-auto" disabled={!can} onClick={() => onBuy(u.id)}>
                {maxed ? 'MÁXIMO' : `Comprar · ◆ ${cost}`}
              </button>
            </div>
          );
        })}
      </div>
      <button className="btn btn-ghost relative" onClick={onBack}>← Voltar</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function AchievementsScreen({ meta, onBack }: { meta: MetaSave; onBack: () => void }) {
  const unlockedCount = ACHIEVEMENTS.filter(a => meta.achievements.includes(a.id)).length;
  const progressPct = Math.round((unlockedCount / ACHIEVEMENTS.length) * 100);

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center font-body gap-5 px-6">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 25%, rgba(2,1,10,0.85) 100%)' }} />
      <div className="relative text-center fade-in">
        <div className="font-display font-black text-3xl md:text-4xl tracking-[0.3em] text-white neon-soft">CONQUISTAS & FEITOS</div>
        <div className="text-white/50 tracking-[0.3em] uppercase text-xs mt-1">Missões de honra da frota Anti-Aura</div>
        <div className="mt-3 inline-flex items-center gap-4 glass px-5 py-2 rounded-full border border-cyan-400/30">
          <span className="text-xs uppercase tracking-widest text-cyan-200">Progresso: <b className="text-white">{unlockedCount} / {ACHIEVEMENTS.length}</b> ({progressPct}%)</span>
          <div className="w-28 h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
            <div className="h-full bg-cyan-400 transition-all shadow-[0_0_8px_#00e5ff]" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-6xl w-full max-h-[62vh] overflow-y-auto pr-1">
        {ACHIEVEMENTS.map((a, i) => {
          const unlocked = meta.achievements.includes(a.id);
          return (
            <div
              key={a.id}
              className={`card glass-strong rounded-xl p-4 flex flex-col gap-2 transition-all border ${
                unlocked
                  ? 'border-yellow-400/60 shadow-[0_0_20px_rgba(255,215,0,0.15)] bg-yellow-500/5'
                  : 'border-white/10 opacity-60'
              }`}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="flex items-center justify-between">
                <div className={`text-3xl ${unlocked ? 'drop-shadow-[0_0_8px_gold]' : 'grayscale opacity-50'}`}>{a.icon}</div>
                <div className={`text-[10px] font-display uppercase tracking-widest px-2 py-0.5 rounded ${
                  unlocked ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/40' : 'bg-white/5 text-white/40'
                }`}>
                  {unlocked ? '✓ CONCLUÍDO' : '🔒 BLOQUEADO'}
                </div>
              </div>
              <div className={`font-display font-bold text-sm ${unlocked ? 'text-white' : 'text-white/60'}`}>{a.name}</div>
              <div className="text-xs text-white/60 leading-relaxed min-h-[36px]">{a.desc}</div>
              <div className="mt-auto pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                <span className="text-white/40 uppercase tracking-widest">Recompensa</span>
                <span className="font-display font-bold text-fuchsia-300">+{a.rewardShards} ◆</span>
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn btn-ghost relative" onClick={onBack}>← Voltar</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function CodexScreen({ meta, onBack }: { meta: MetaSave; onBack: () => void }) {
  const [subTab, setSubTab] = useState<'bestiary' | 'history' | 'career'>('bestiary');
  const [history] = useState(() => loadMatchHistory());
  const [career] = useState(() => loadCareerStats());
  const entries = Object.entries(ENEMY_DEFS);
  const totalKills = meta.totalKills || 0;

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center font-body gap-4 px-6 py-6 overflow-y-auto">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 25%, rgba(2,1,10,0.85) 100%)' }} />
      <div className="relative text-center fade-in">
        <div className="font-display font-black text-3xl md:text-4xl tracking-[0.3em] text-white neon-soft">CÓDEX & REGISTROS</div>
        <div className="text-white/50 tracking-[0.3em] uppercase text-xs mt-1">Banco de dados tático da Resistência Anti-Aura · Abates Totais: <b className="text-pink-300 font-display text-sm">{totalKills}</b></div>
      </div>

      {/* Subtabs bar */}
      <div className="relative flex gap-2 glass p-1.5 rounded-xl border border-white/10 z-10">
        <button
          onClick={() => setSubTab('bestiary')}
          className={`px-4 py-1.5 rounded-lg font-display text-xs font-bold tracking-wider transition-all cursor-pointer ${
            subTab === 'bestiary'
              ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,229,255,0.3)]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          👾 BESTIÁRIO
        </button>
        <button
          onClick={() => setSubTab('history')}
          className={`px-4 py-1.5 rounded-lg font-display text-xs font-bold tracking-wider transition-all cursor-pointer ${
            subTab === 'history'
              ? 'bg-purple-500/25 text-purple-200 border border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          📜 HISTÓRICO DE PARTIDAS
        </button>
        <button
          onClick={() => setSubTab('career')}
          className={`px-4 py-1.5 rounded-lg font-display text-xs font-bold tracking-wider transition-all cursor-pointer ${
            subTab === 'career'
              ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          📊 CARREIRA CÓSMICA
        </button>
      </div>

      {/* Content */}
      {subTab === 'bestiary' && (
        <div className="relative grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-6xl w-full max-h-[58vh] overflow-y-auto pr-1">
          {entries.map(([type, def], i) => {
            const kills = meta.defeatedEnemies?.[type] ?? 0;
            const hex = `#${def.color.toString(16).padStart(6, '0')}`;
            return (
              <div
                key={type}
                className="card glass-strong rounded-xl p-4 flex flex-col gap-2 transition-all border border-white/10 hover:border-cyan-400/40"
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <div className="flex items-center justify-between">
                  <div className="font-display font-black text-base" style={{ color: hex }}>{def.name}</div>
                  <div className={`text-[10px] font-display uppercase tracking-wider px-2 py-0.5 rounded ${
                    kills > 0 ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'bg-white/5 text-white/40'
                  }`}>
                    {kills > 0 ? `⚔ ${kills}` : '0 abates'}
                  </div>
                </div>
                <p className="text-xs text-white/70 leading-relaxed min-h-[48px]">{def.desc}</p>
                <div className="mt-auto pt-2 border-t border-white/10 grid grid-cols-3 gap-1 text-[10px] uppercase tracking-wider text-white/50">
                  <div>HP <b className="text-white">{def.hp}</b></div>
                  <div>VEL <b className="text-white">{def.speed}</b></div>
                  <div>DANO <b className="text-white">{def.damage}</b></div>
                  <div>ONDA <b className="text-cyan-300">{def.minWave > 20 ? '-' : def.minWave}</b></div>
                  <div>XP <b className="text-yellow-300">+{def.xp}</b></div>
                  <div>MOEDA <b className="text-yellow-400">{Math.round(def.coin * 100)}%</b></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {subTab === 'history' && (
        <div className="relative flex flex-col gap-3 max-w-4xl w-full max-h-[58vh] overflow-y-auto pr-1">
          {history.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center text-white/50 text-sm">
              Nenhuma partida registrada ainda. Inicie um voo para registrar seus feitos!
            </div>
          ) : (
            history.map(entry => {
              const hHero = heroById(entry.hero);
              return (
                <div
                  key={entry.id}
                  className={`card glass-strong rounded-xl p-4 border flex flex-col gap-2 transition-all ${
                    entry.victory
                      ? 'border-yellow-400/40 bg-yellow-500/5'
                      : 'border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-0.5 rounded font-display text-xs font-bold uppercase tracking-wider ${
                        entry.victory ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40' : 'bg-red-500/25 text-red-300 border border-red-400/40'
                      }`}>
                        {entry.victory ? '✓ VITÓRIA' : '✗ DERROTA'}
                      </span>
                      <span className="font-display font-black text-base" style={{ color: hHero.css }}>{hHero.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded glass text-cyan-300 uppercase tracking-widest font-display">
                        {entry.gameMode === 'hyper' ? '⚡ HIPER' : entry.gameMode === 'boss_rush' ? '👾 BOSS RUSH' : '🚀 CLÁSSICO'}
                      </span>
                    </div>
                    <div className="text-xs text-white/50">{entry.date}</div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs py-2 border-y border-white/10">
                    <div><span className="text-white/40 block text-[10px] uppercase">Onda</span><b className="text-white">{entry.wave}</b></div>
                    <div><span className="text-white/40 block text-[10px] uppercase">Tempo</span><b className="text-cyan-300">{fmtTime(entry.time)}</b></div>
                    <div><span className="text-white/40 block text-[10px] uppercase">Abates</span><b className="text-pink-300">{entry.kills}</b></div>
                    <div><span className="text-white/40 block text-[10px] uppercase">Shards</span><b className="text-fuchsia-300">◆ {entry.shards}</b></div>
                    <div><span className="text-white/40 block text-[10px] uppercase">DPS</span><b className="text-cyan-200">{Math.round(entry.dps)}</b></div>
                    <div><span className="text-white/40 block text-[10px] uppercase">Nível</span><b className="text-yellow-300">{entry.level}</b></div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {entry.pacts && entry.pacts.length > 0 && (
                      <div className="flex gap-1 items-center">
                        <span className="text-[10px] text-purple-300 uppercase">Pactos:</span>
                        {entry.pacts.map(p => (
                          <span key={p} className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-400/30 text-[10px]">
                            {PACTS[p]?.icon} {PACTS[p]?.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {entry.ascension && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px] font-display">
                        ★ {entry.ascension}
                      </span>
                    )}
                    {entry.weapons && entry.weapons.length > 0 && (
                      <div className="text-[11px] text-white/60 ml-auto">
                        Armas: {entry.weapons.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {subTab === 'career' && (
        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl w-full max-h-[58vh] overflow-y-auto pr-1">
          <div className="card glass-strong rounded-xl p-5 border border-white/10 flex flex-col gap-3">
            <div className="font-display font-bold text-sm text-cyan-200 uppercase tracking-widest border-b border-white/10 pb-2">
              🏆 Registros Gerais de Carreira
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="glass p-3 rounded-lg"><span className="text-white/40 text-xs block uppercase">Partidas Totais</span><b className="text-2xl text-white font-display">{career.totalRuns}</b></div>
              <div className="glass p-3 rounded-lg"><span className="text-white/40 text-xs block uppercase">Vitórias</span><b className="text-2xl text-amber-300 font-display">{career.totalWins} <span className="text-xs text-white/50">({career.totalRuns > 0 ? Math.round((career.totalWins / career.totalRuns) * 100) : 0}%)</span></b></div>
              <div className="glass p-3 rounded-lg"><span className="text-white/40 text-xs block uppercase">Tempo de Voo</span><b className="text-xl text-cyan-200 font-display">{fmtTime(career.totalPlayTime)}</b></div>
              <div className="glass p-3 rounded-lg"><span className="text-white/40 text-xs block uppercase">Abates Totais</span><b className="text-xl text-pink-300 font-display">{career.totalKills.toLocaleString()}</b></div>
              <div className="glass p-3 rounded-lg"><span className="text-white/40 text-xs block uppercase">Maior Onda</span><b className="text-xl text-white font-display">Onda {career.maxWave}</b></div>
              <div className="glass p-3 rounded-lg"><span className="text-white/40 text-xs block uppercase">Maior DPS</span><b className="text-xl text-cyan-300 font-display">{career.maxDps.toLocaleString()}</b></div>
              <div className="glass p-3 rounded-lg col-span-2"><span className="text-white/40 text-xs block uppercase">Dano Total Infligido</span><b className="text-xl text-amber-200 font-display">💥 {Math.round(career.totalDamageDealt || 0).toLocaleString()}</b></div>
            </div>
          </div>

          <div className="card glass-strong rounded-xl p-5 border border-white/10 flex flex-col gap-3">
            <div className="font-display font-bold text-sm text-cyan-200 uppercase tracking-widest border-b border-white/10 pb-2">
              🚀 Utilização por Herói
            </div>
            <div className="space-y-2">
              {HEROES.map(h => {
                const count = career.heroRuns[h.id] ?? 0;
                const pct = career.totalRuns > 0 ? Math.round((count / career.totalRuns) * 100) : 0;
                return (
                  <div key={h.id} className="text-xs">
                    <div className="flex justify-between text-white/80 mb-0.5">
                      <span className="font-bold" style={{ color: h.css }}>{h.name}</span>
                      <span className="text-white/60">{count} voos ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: h.css }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card glass-strong rounded-xl p-5 border border-white/10 flex flex-col gap-3">
            <div className="font-display font-bold text-sm text-cyan-200 uppercase tracking-widest border-b border-white/10 pb-2">
              ⚔️ Arsenal Mais Utilizado
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
                      <div key={name} className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                        <span className="text-white font-medium">{label}</span>
                        <span className="text-cyan-300 font-mono font-bold">{count} {count === 1 ? 'partida' : 'partidas'}</span>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          <div className="card glass-strong rounded-xl p-5 border border-white/10 flex flex-col gap-3">
            <div className="font-display font-bold text-sm text-cyan-200 uppercase tracking-widest border-b border-white/10 pb-2">
              👾 Abates por Inimigo
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
                      <div key={typeId} className="flex items-center justify-between text-xs py-1 border-b border-white/5">
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

      <button className="btn btn-ghost relative mt-2" onClick={onBack}>← Voltar</button>
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
      style={{ backdropFilter: 'blur(12px)', background: 'rgba(2,1,10,0.65)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-strong rounded-2xl p-6 md:p-8 w-[580px] max-w-[96vw] max-h-[90vh] overflow-y-auto fade-in scanlines relative border border-cyan-400/40 shadow-[0_0_50px_rgba(0,229,255,0.25)]">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div>
            <div className="font-display font-black text-2xl tracking-[0.25em] text-white neon-soft">CONFIGURAÇÕES</div>
            <div className="text-white/50 tracking-[0.2em] uppercase text-xs mt-1">Ajuste de sistemas de bordo e áudio</div>
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
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-display font-bold">🔊 Sistema de Áudio</div>

            <div className="glass rounded-xl p-3.5 space-y-3">
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
                  <span>Música</span>
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
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-display font-bold">🎯 Sistema de Mira</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setVal('aimMode', 'auto')}
                className={`p-3 rounded-xl glass text-left transition-all border cursor-pointer ${
                  settings.aimMode === 'auto' ? 'border-cyan-300 bg-cyan-500/20 shadow-[0_0_15px_rgba(0,229,255,0.3)]' : 'border-white/10 hover:border-white/30'
                }`}
              >
                <div className="font-display font-bold text-xs text-cyan-100">Automática</div>
                <div className="text-[11px] text-white/60 mt-0.5">Trava nos alvos mais próximos e elites prioritários</div>
              </button>
              <button
                onClick={() => setVal('aimMode', 'manual')}
                className={`p-3 rounded-xl glass text-left transition-all border cursor-pointer ${
                  settings.aimMode === 'manual' ? 'border-cyan-300 bg-cyan-500/20 shadow-[0_0_15px_rgba(0,229,255,0.3)]' : 'border-white/10 hover:border-white/30'
                }`}
              >
                <div className="font-display font-bold text-xs text-cyan-100">Manual</div>
                <div className="text-[11px] text-white/60 mt-0.5">Dispara na direção do mouse ou do analógico direito</div>
              </button>
            </div>
          </div>

          {/* Gráficos */}
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-display font-bold">✨ Qualidade Gráfica</div>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map(q => (
                <button
                  key={q}
                  onClick={() => setVal('graphicsQuality', q)}
                  className={`p-2.5 rounded-xl glass text-center transition-all border cursor-pointer ${
                    settings.graphicsQuality === q ? 'border-cyan-300 bg-cyan-500/20 shadow-[0_0_15px_rgba(0,229,255,0.3)]' : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="font-display font-bold text-xs text-cyan-100 uppercase">{q === 'low' ? 'Baixa' : q === 'medium' ? 'Média' : 'Alta'}</div>
                  <div className="text-[10px] text-white/50 mt-0.5">{q === 'low' ? 'Bloom leve' : q === 'medium' ? 'Balanceado' : 'Bloom total'}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Números de Dano */}
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-display font-bold">💥 Números de Dano</div>
            <div className="grid grid-cols-3 gap-2">
              {(['full', 'crits', 'off'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setVal('damageNumbers', d)}
                  className={`p-2.5 rounded-xl glass text-center transition-all border cursor-pointer ${
                    settings.damageNumbers === d ? 'border-cyan-300 bg-cyan-500/20 shadow-[0_0_15px_rgba(0,229,255,0.3)]' : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="font-display font-bold text-xs text-cyan-100 uppercase">{d === 'full' ? 'Todos' : d === 'crits' ? 'Críticos' : 'Desativado'}</div>
                  <div className="text-[10px] text-white/50 mt-0.5">{d === 'full' ? 'Completo' : d === 'crits' ? 'Apenas críticos' : 'Ocultar tudo'}</div>
                </button>
              ))}
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
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center font-body" style={{ backdropFilter: 'blur(10px)', background: 'rgba(2,1,10,0.45)' }}>
      <div className="glass-strong rounded-2xl p-8 w-[520px] max-w-[92vw] fade-in scanlines relative overflow-hidden">
        <div className="font-display font-black text-3xl tracking-[0.35em] text-center text-white neon-soft">PAUSADO</div>
        <div className="text-center text-white/50 uppercase tracking-[0.3em] text-xs mt-2">Sistemas em espera</div>
        <div className="grid grid-cols-3 gap-3 mt-6 text-center">
          <div className="glass rounded-lg py-3"><div className="text-[10px] uppercase tracking-widest text-white/50">Onda</div><div className="font-display text-2xl text-white">{snap.wave}</div></div>
          <div className="glass rounded-lg py-3"><div className="text-[10px] uppercase tracking-widest text-white/50">Abates</div><div className="font-display text-2xl text-pink-300">{snap.kills}</div></div>
          <div className="glass rounded-lg py-3"><div className="text-[10px] uppercase tracking-widest text-white/50">Tempo</div><div className="font-display text-2xl text-cyan-200">{fmtTime(snap.time)}</div></div>
        </div>
        {hero && (
          <div className="mt-4 glass rounded-lg px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-white/50">Piloto</div>
            <div className="font-display font-bold" style={{ color: hero.css }}>{hero.name} <span className="text-white/50 text-xs font-body">· Nível {snap.level}</span></div>
            {snap.upgrades.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {snap.upgrades.map(u => <div key={u.id} className="text-xs px-2 py-0.5 rounded bg-white/8 border border-white/10">{u.icon} {u.name} <b className="text-cyan-300">{u.level}</b></div>)}
              </div>
            )}
          </div>
        )}
        <div className="flex gap-3 mt-6 justify-center flex-wrap">
          <button className="btn btn-primary" onClick={onResume}>▶ Continuar</button>
          <button className="btn" onClick={onSettings}>⚙ Configurações</button>
          <button className="btn btn-ghost" onClick={onQuit}>Abandonar</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function LevelUpScreen({ choices, level, onPick }: { choices: UpgradeChoice[]; level: number; onPick: (id: string) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const idx = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (idx >= 0 && choices[idx]) onPick(choices[idx].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choices, onPick]);
  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center font-body gap-8" style={{ backdropFilter: 'blur(8px)', background: 'rgba(2,1,10,0.35)' }}>
      <div className="text-center fade-in">
        <div className="font-display font-black text-4xl tracking-[0.35em] text-white neon-soft">NÍVEL {level}</div>
        <div className="text-cyan-200/70 uppercase tracking-[0.35em] text-xs mt-2">Escolha um módulo anti-aura</div>
      </div>
      <div className="flex gap-5 flex-wrap justify-center px-4">
        {choices.map((c, i) => {
          const isHero = c.isHeroExclusive;
          const col = c.isEvolution ? '#ffd700' : isHero ? (c.heroColor ?? '#00ffff') : RARITY_COLOR[c.rarity];
          const legendary = c.rarity === 'legendary' || c.isEvolution || isHero;
          return (
            <button
              key={c.id + i}
              onClick={() => onPick(c.id)}
              className="card glass-strong rounded-2xl w-[250px] h-[340px] p-5 text-left relative overflow-hidden cursor-pointer"
              style={{
                animationDelay: `${i * 0.13}s`,
                borderColor: c.isEvolution ? '#ffd700' : isHero ? `${c.heroColor ?? '#00ffff'}cc` : `${col}88`,
                boxShadow: c.isEvolution
                  ? '0 0 50px rgba(255,215,0,0.6), 0 30px 80px rgba(0,0,0,0.7)'
                  : isHero
                  ? `0 0 45px ${c.heroColor ?? '#00ffff'}77, 0 30px 80px rgba(0,0,0,0.6)`
                  : `0 0 ${legendary ? 60 : 30}px ${col}55, 0 30px 80px rgba(0,0,0,0.6)`
              }}
            >
              {legendary && <div className="absolute inset-0 shimmer pointer-events-none" />}
              <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl opacity-35" style={{ background: col }} />
              <div className="relative flex flex-col h-full">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-display tracking-[0.25em] uppercase font-bold" style={{ color: col }}>
                    {c.isEvolution
                      ? '★ EVOLUÇÃO LENDÁRIA ★'
                      : isHero
                      ? `★ EXCLUSIVO: ${c.heroName ?? 'HERÓI'} ★`
                      : RARITY_NAME[c.rarity]}
                  </div>
                  <div className="text-[10px] tracking-widest text-white/40">{c.isEvolution ? 'MAX' : `NV ${c.level}`}</div>
                </div>
                <div className="text-6xl text-center mt-6 neon" style={{ color: col }}>{c.icon}</div>
                <div className="font-display font-bold text-lg text-center mt-5 text-white leading-tight">{c.name}</div>
                <div className="text-sm text-center text-white/70 mt-3">{c.desc}</div>
                <div
                  className="mt-auto text-center font-display text-[11px] tracking-[0.3em] py-2 rounded font-bold"
                  style={{
                    background: c.isEvolution
                      ? 'linear-gradient(90deg, rgba(255,215,0,0.35), rgba(255,140,0,0.35))'
                      : isHero
                      ? `linear-gradient(90deg, ${c.heroColor ?? '#00ffff'}44, ${c.heroColor ?? '#00ffff'}18)`
                      : `${col}22`,
                    color: c.isEvolution ? '#ffe066' : isHero ? '#ffffff' : col,
                    border: c.isEvolution
                      ? '1px solid rgba(255,215,0,0.8)'
                      : isHero
                      ? `1px solid ${c.heroColor ?? '#00ffff'}aa`
                      : undefined,
                  }}
                >
                  [{i + 1}] {c.isEvolution ? '★ EVOLUIR ★' : isHero ? '★ SINTONIZAR ★' : 'INSTALAR'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function EndScreen({ result, onMenu, onContinue }: { result: RunResult; onMenu: () => void; onContinue?: () => void }) {
  const hero = heroById(result.hero);
  const v = result.victory;
  const breakdownEntries = Object.entries(result.damageBreakdown || {}).sort((a, b) => b[1] - a[1]);
  const totalDmg = breakdownEntries.reduce((acc, [, val]) => acc + val, 0);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center font-body p-4" style={{ backdropFilter: 'blur(8px)', background: v ? 'rgba(20,10,2,0.45)' : 'rgba(10,1,4,0.55)' }}>
      <div className="glass-strong rounded-2xl p-6 md:p-8 w-[640px] max-w-[95vw] max-h-[90vh] overflow-y-auto fade-in text-center scanlines relative border border-white/15">
        <div className="font-display font-black text-3xl md:text-5xl tracking-[0.25em] neon" style={{ color: v ? '#ffd700' : '#ff3050' }}>{v ? 'MISSÃO CUMPRIDA' : 'NAVE DESTRUÍDA'}</div>
        <div className="text-white/70 mt-2 text-sm md:text-base">
          {v ? 'O Farmador de Aura foi aniquilado. Carlinhos e Macedo voltam para casa — a Terra está livre dos Farm\'auras.' : 'Os Farm\'auras venceram desta vez. Reforce sua nave no Hangar e tente novamente, piloto.'}
        </div>

        {v && (
          <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-amber-500/20 via-cyan-500/20 to-amber-500/20 border border-amber-400/50 text-center animate-pulse">
            <div className="font-display font-bold text-amber-300 text-sm md:text-base flex items-center justify-center gap-2">
              <span>🎉</span>
              <span>CARLINHOS & MACEDO FORAM RESGATADOS!</span>
              <span>🚀</span>
            </div>
            <div className="text-xs text-white/85 mt-1">
              Ambos os heróis foram libertados e agora estão disponíveis no seletor de naves para jogar!
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2.5 mt-5">
          <div className="glass rounded-lg py-2.5"><div className="text-[10px] uppercase tracking-widest text-white/50">Onda</div><div className="font-display text-2xl text-white">{result.wave}</div></div>
          <div className="glass rounded-lg py-2.5"><div className="text-[10px] uppercase tracking-widest text-white/50">Abates</div><div className="font-display text-2xl text-pink-300">{result.kills}</div></div>
          <div className="glass rounded-lg py-2.5"><div className="text-[10px] uppercase tracking-widest text-white/50">Tempo</div><div className="font-display text-2xl text-cyan-200">{fmtTime(result.time)}</div></div>
          <div className="glass rounded-lg py-2.5"><div className="text-[10px] uppercase tracking-widest text-white/50">DPS Médio</div><div className="font-display text-2xl text-cyan-300">{Math.round(result.dps)}</div></div>
          <div className="glass rounded-lg py-2.5"><div className="text-[10px] uppercase tracking-widest text-white/50">Piloto</div><div className="font-display text-lg" style={{ color: hero.css }}>{hero.name}</div></div>
          <div className="glass rounded-lg py-2.5"><div className="text-[10px] uppercase tracking-widest text-white/50">Shards ganhos</div><div className="font-display text-2xl text-fuchsia-300">◆ {result.shards}</div></div>
        </div>

        {/* Informações da Partida Expandida: Modo, Pactos, Ascensão e Relíquias */}
        <div className="mt-4 flex flex-wrap gap-2 justify-center items-center">
          <span className="px-2.5 py-1 rounded-lg glass border border-cyan-400/40 text-cyan-200 font-display text-xs font-bold">
            {result.gameMode === 'hyper' ? '⚡ MODO HIPER' : result.gameMode === 'boss_rush' ? '👾 BOSS RUSH' : '🚀 MODO CLÁSSICO'}
          </span>
          {result.pacts && result.pacts.map(p => (
            <span key={p} className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-200 border border-purple-400/40 text-xs font-display flex items-center gap-1">
              <span>{PACTS[p]?.icon}</span>
              <span>{PACTS[p]?.name}</span>
            </span>
          ))}
          {result.ascension && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/50 text-xs font-display font-bold">
              ★ ASCENSÃO ATIVA
            </span>
          )}
        </div>

        {/* Relíquias Cósmicas Ativas */}
        {result.relics && result.relics.length > 0 && (
          <div className="mt-3 text-left glass rounded-xl p-3 border border-white/10">
            <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">Relíquias Cósmicas Coletadas</div>
            <div className="flex gap-2 flex-wrap">
              {result.relics.map(rId => {
                const r = RELIC_DEFS[rId as keyof typeof RELIC_DEFS];
                return (
                  <div key={rId} className="px-2 py-1 rounded-lg glass flex items-center gap-1.5 border border-white/20 text-xs" title={r?.desc}>
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
          <div className="mt-4 text-left glass rounded-xl p-3 border border-white/10">
            <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">Arsenal Equipado</div>
            <div className="flex gap-2 flex-wrap">
              {result.activeWeapons.map(w => (
                <div key={w.id} className={`px-2.5 py-1 rounded-lg glass flex items-center gap-2 border ${w.evolved ? 'border-yellow-400/80 bg-yellow-500/10' : 'border-white/15'}`}>
                  <span className="text-lg">{w.icon}</span>
                  <span className="text-xs font-display font-bold text-white">{w.name}</span>
                  <span className={`text-[10px] font-display ${w.evolved ? 'text-yellow-300' : 'text-cyan-300'}`}>{w.evolved ? '👑' : `NV ${w.level}`}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estatísticas de Dano por Arma */}
        {breakdownEntries.length > 0 && (
          <div className="mt-4 text-left glass rounded-xl p-3.5 border border-white/10 space-y-2">
            <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-white/50">
              <span>Distribuição de Dano</span>
              <span>Total: {Math.round(totalDmg).toLocaleString()}</span>
            </div>
            <div className="space-y-1.5">
              {breakdownEntries.map(([k, val]) => {
                const pct = totalDmg > 0 ? Math.round((val / totalDmg) * 100) : 0;
                const label = WEAPON_LABELS[k] ?? k;
                return (
                  <div key={k} className="text-xs">
                    <div className="flex justify-between text-white/80 mb-0.5">
                      <span>{label}</span>
                      <span className="font-mono text-cyan-200">{Math.round(val).toLocaleString()} <span className="text-white/40">({pct}%)</span></span>
                    </div>
                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-xs text-white/40 mt-3 uppercase tracking-widest">Moedas convertidas em shards (25:1) e salvas no Hangar</div>
        <div className="flex gap-3 mt-5 justify-center flex-wrap">
          {v && onContinue && <button className="btn btn-primary" onClick={onContinue}>∞ Continuar · Modo Infinito</button>}
          <button className="btn" onClick={onMenu}>Voltar ao Menu</button>
        </div>
      </div>
    </div>
  );
}
