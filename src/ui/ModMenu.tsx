import { useState, useEffect } from 'react';
import type { Game } from '../game/game';
import {
  addShards,
  unlockAllHeroes,
  maxAllMetaUpgrades,
  unlockAllAchievements,
  resetAllSaveData,
  type MetaSave,
} from '../game/save';
import type { Snapshot } from '../game/config';

interface ModMenuProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game | null;
  meta: MetaSave;
  onMetaUpdate: (newMeta: MetaSave) => void;
  snap: Snapshot | null;
}

type TabKey = 'run' | 'meta' | 'waves' | 'drops' | 'system';

export function ModMenu({ isOpen, onClose, game, meta, onMetaUpdate, snap }: ModMenuProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('run');
  const [toast, setToast] = useState<string | null>(null);
  const [godModeState, setGodModeState] = useState<boolean>(false);

  useEffect(() => {
    if (game) {
      setGodModeState(game.isGodMode());
    }
  }, [game, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  if (!isOpen) return null;

  const inRun = snap && snap.phase !== 'menu';

  // --- Handlers: Meta & Personagens ---
  const handleUnlockHeroes = () => {
    const updated = unlockAllHeroes();
    onMetaUpdate(updated);
    if (game) game.audio.cardPick();
    showToast('👑 Todos os heróis (Carlinhos & Macedo) desbloqueados!');
  };

  const handleAddShards = (amount: number) => {
    const updated = addShards(amount);
    onMetaUpdate(updated);
    if (game) game.audio.pickup('shard');
    showToast(`💎 +${amount.toLocaleString()} Shards adicionados com sucesso!`);
  };

  const handleMaxMeta = () => {
    const updated = maxAllMetaUpgrades();
    onMetaUpdate(updated);
    if (game) game.audio.levelUp();
    showToast('⚡ Todos os Meta-Upgrades do Hangar maximizados no Nível 10!');
  };

  const handleUnlockAchievements = () => {
    const updated = unlockAllAchievements();
    onMetaUpdate(updated);
    if (game) game.audio.levelUp();
    showToast('🏆 Todas as 12 Conquistas desbloqueadas + Shards recebidos!');
  };

  const handleResetSave = () => {
    if (window.confirm('Tem certeza que deseja zerar todo o progresso do save para teste limpo?')) {
      const def = resetAllSaveData();
      onMetaUpdate(def);
      if (game) game.audio.hit();
      showToast('🔄 Progresso e save resetados com sucesso.');
    }
  };

  // --- Handlers: In-Run Cheats ---
  const handleToggleGodMode = () => {
    if (!game || !inRun) {
      showToast('⚠️ Inicie uma partida para ativar o Modo Deus.');
      return;
    }
    const state = game.toggleGodMode();
    setGodModeState(state);
    showToast(state ? '🛡️ MODO DEUS ATIVADO (Imortalidade)' : '❌ Modo Deus Desativado');
  };

  const handleMaxCurrentRun = () => {
    if (!game || !inRun) {
      showToast('⚠️ Inicie uma partida para maximizar a nave.');
      return;
    }
    game.maxOutCurrentRun();
    showToast('⚡ Nave e Arsenal Maximizados (Primária + 4 Secundárias Evoluídas + Upgrades)!');
  };

  const handleAddLevels = (levels: number) => {
    if (!game || !inRun) {
      showToast('⚠️ Inicie uma partida para adicionar níveis.');
      return;
    }
    game.addLevels(levels);
    showToast(`⬆️ +${levels} Níveis concedidos!`);
  };

  const handleAddXp = (amount: number) => {
    if (!game || !inRun) {
      showToast('⚠️ Inicie uma partida para ganhar XP.');
      return;
    }
    game.addXpCheat(amount);
    showToast(`✨ +${amount.toLocaleString()} XP concedido!`);
  };

  const handleHealFull = () => {
    if (!game || !inRun) {
      showToast('⚠️ Inicie uma partida para restaurar vida.');
      return;
    }
    game.healPlayerFull();
    showToast('❤️ Vida restaurada para 100%!');
  };

  const handleChargeUlt = () => {
    if (!game || !inRun) {
      showToast('⚠️ Inicie uma partida para recarregar a suprema.');
      return;
    }
    game.chargeUltFull();
    showToast('🔥 Habilidade Suprema (Q) 100% carregada!');
  };

  const handleNuke = () => {
    if (!game || !inRun) {
      showToast('⚠️ Inicie uma partida para usar Nuke.');
      return;
    }
    game.nukeEnemies();
    showToast('💥 NUKE EXECUTADO! Inimigos eliminados.');
  };

  const handleJuliaEasterEgg = () => {
    if (!game) {
      showToast('⚠️ Jogo não inicializado.');
      return;
    }
    game.triggerJuliaEasterEgg();
    showToast('💖 Easter Egg Julia Ativado! O Amor Conquista o Cosmos!');
  };

  // --- Handlers: Ondas & Chefes ---
  const handleAdvanceWave = (toWave?: number) => {
    if (!game || !inRun) {
      showToast('⚠️ Inicie uma partida para avançar ondas.');
      return;
    }
    game.advanceWave(toWave);
    showToast(toWave ? `🌊 Saltou para Onda ${toWave}!` : '⏩ Avançou para a próxima onda!');
  };

  const handleSpawnBoss = () => {
    if (!game || !inRun) {
      showToast('⚠️ Inicie uma partida para invocar o Boss.');
      return;
    }
    game.spawnBossCheat();
    showToast('👹 Farmador de Aura (Chefe Final) Invocado!');
  };

  const handleSpawnMiniboss = () => {
    if (!game || !inRun) {
      showToast('⚠️ Inicie uma partida para invocar o Mini-Boss.');
      return;
    }
    game.spawnMinibossCheat();
    showToast('👾 Sentinela Mini-Boss Invocada!');
  };

  // --- Handlers: Drops ---
  const handleSpawnPickup = (kind: 'xp' | 'coin' | 'shard' | 'heal' | 'magnet') => {
    if (!game || !inRun) {
      showToast('⚠️ Inicie uma partida para gerar drops.');
      return;
    }
    game.spawnPickupCheat(kind);
    showToast(`🎁 Drop de ${kind.toUpperCase()} gerado na arena!`);
  };

  const handleSpawnSupplyDrop = () => {
    if (!game || !inRun) {
      showToast('⚠️ Inicie uma partida para enviar cápsula.');
      return;
    }
    game.spawnSupplyDropCheat();
    showToast('🚀 Cápsula SpaceX enviada com suprimentos!');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center font-body"
      style={{ backdropFilter: 'blur(12px)', background: 'rgba(2, 1, 10, 0.72)' }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-strong border border-cyan-400/40 rounded-2xl p-6 w-[700px] max-w-[95vw] max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(0,229,255,0.25)] relative overflow-hidden scanlines">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-pulse">⚡</span>
            <div>
              <div className="font-display font-black text-xl text-cyan-300 tracking-[0.2em] flex items-center gap-2">
                SOCIEDADE GDC <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">MOD MENU</span>
              </div>
              <div className="text-[11px] text-white/50 tracking-wider">
                Código secreto: <span className="text-cyan-300 font-mono font-bold">sociedadegdc</span> · Pressione ESC ou clique fora para fechar
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Status Bar */}
        <div className="bg-black/40 rounded-xl p-3 mt-3 flex items-center justify-between border border-white/5 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <span className="text-white/40 uppercase tracking-widest text-[10px]">Status: </span>
              <span className={`font-bold ${inRun ? 'text-green-400' : 'text-yellow-400'}`}>
                {inRun ? `EM PARTIDA (Onda ${snap?.wave ?? 1})` : 'NO MENU PRINCIPAL'}
              </span>
            </div>
            {inRun && (
              <div>
                <span className="text-white/40 uppercase tracking-widest text-[10px]">Herói: </span>
                <span className="font-bold text-cyan-300 uppercase">{snap?.hero}</span> (Nv. {snap?.level})
              </div>
            )}
            <div>
              <span className="text-white/40 uppercase tracking-widest text-[10px]">Shards: </span>
              <span className="font-bold text-fuchsia-300">◆ {meta.shards.toLocaleString()}</span>
            </div>
          </div>
          {inRun && (
            <div
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                godModeState
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(255,191,0,0.5)]'
                  : 'bg-white/5 border-white/20 text-white/40'
              }`}
            >
              Modo Deus: {godModeState ? 'LIGADO' : 'DESLIGADO'}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mt-4 border-b border-white/10 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('run')}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'run'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,229,255,0.2)]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            🚀 Partida Atual
          </button>
          <button
            onClick={() => setActiveTab('meta')}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'meta'
                ? 'bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/50 shadow-[0_0_15px_rgba(255,48,192,0.2)]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            👑 Meta & Personagens
          </button>
          <button
            onClick={() => setActiveTab('waves')}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'waves'
                ? 'bg-red-500/20 text-red-200 border border-red-400/50 shadow-[0_0_15px_rgba(255,64,96,0.2)]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            🌊 Ondas & Chefes
          </button>
          <button
            onClick={() => setActiveTab('drops')}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'drops'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            🎁 Gerar Drops
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'system'
                ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            ⚙️ Ferramentas
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-4 max-h-[50vh]">
          {/* TAB: RUN */}
          {activeTab === 'run' && (
            <div className="space-y-4">
              {!inRun && (
                <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-xs flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Você está no menu. Inicie uma partida para testar os cheats de combate e arsenal.</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* God Mode */}
                <button
                  onClick={handleToggleGodMode}
                  className={`p-3 rounded-xl glass border text-left cursor-pointer transition-all flex flex-col justify-between ${
                    godModeState
                      ? 'border-amber-400 bg-amber-500/15 shadow-[0_0_20px_rgba(255,191,0,0.3)]'
                      : 'border-white/10 hover:border-amber-400/50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-display font-bold text-sm text-amber-200">🛡️ Modo Deus</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        godModeState ? 'bg-amber-400 text-black' : 'bg-white/10 text-white/50'
                      }`}
                    >
                      {godModeState ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/50 mt-1">Imortalidade total contra qualquer dano inimigo.</div>
                </button>

                {/* Maximizar Atual */}
                <button
                  onClick={handleMaxCurrentRun}
                  className="p-3 rounded-xl glass border border-cyan-400/30 hover:border-cyan-400 bg-cyan-500/10 text-left cursor-pointer transition-all"
                >
                  <div className="font-display font-bold text-sm text-cyan-200">⚡ Maximizar Arsenal</div>
                  <div className="text-[11px] text-white/50 mt-1">
                    Primária evoluída + 4 Secundárias Nv. 5 evoluídas + todos os upgrades no talo!
                  </div>
                </button>
              </div>

              {/* Adicionar Níveis e XP */}
              <div className="p-3.5 glass rounded-xl border border-white/10 space-y-2">
                <div className="text-xs uppercase tracking-widest text-white/60 font-bold">Níveis & Experiência</div>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => handleAddLevels(1)}
                    className="btn px-2 py-2 text-xs text-center justify-center cursor-pointer"
                  >
                    +1 Nível
                  </button>
                  <button
                    onClick={() => handleAddLevels(5)}
                    className="btn px-2 py-2 text-xs text-center justify-center cursor-pointer"
                  >
                    +5 Níveis
                  </button>
                  <button
                    onClick={() => handleAddLevels(10)}
                    className="btn px-2 py-2 text-xs text-center justify-center cursor-pointer"
                  >
                    +10 Níveis
                  </button>
                  <button
                    onClick={() => handleAddXp(10000)}
                    className="btn btn-primary px-2 py-2 text-xs text-center justify-center cursor-pointer"
                  >
                    +10.000 XP
                  </button>
                </div>
              </div>

              {/* Combate Rápido */}
              <div className="p-3.5 glass rounded-xl border border-white/10 space-y-2">
                <div className="text-xs uppercase tracking-widest text-white/60 font-bold">Controle de Combate</div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={handleHealFull}
                    className="p-2.5 rounded-lg glass border border-green-400/30 hover:border-green-400 bg-green-500/10 text-left cursor-pointer transition-all"
                  >
                    <div className="font-display font-bold text-xs text-green-300">❤️ Curar 100%</div>
                    <div className="text-[10px] text-white/40 mt-0.5">Restaura HP máximo</div>
                  </button>
                  <button
                    onClick={handleChargeUlt}
                    className="p-2.5 rounded-lg glass border border-fuchsia-400/30 hover:border-fuchsia-400 bg-fuchsia-500/10 text-left cursor-pointer transition-all"
                  >
                    <div className="font-display font-bold text-xs text-fuchsia-300">🔥 Suprema Pronta</div>
                    <div className="text-[10px] text-white/40 mt-0.5">Recarga da Ult zerada</div>
                  </button>
                  <button
                    onClick={handleNuke}
                    className="p-2.5 rounded-lg glass border border-red-400/30 hover:border-red-400 bg-red-500/10 text-left cursor-pointer transition-all"
                  >
                    <div className="font-display font-bold text-xs text-red-300">💥 Nuke Total</div>
                    <div className="text-[10px] text-white/40 mt-0.5">Elimina todos na tela</div>
                  </button>
                </div>
              </div>

              {/* Easter Egg Julia */}
              <div className="p-3.5 glass rounded-xl border border-pink-400/40 bg-pink-500/10 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-display font-bold text-sm text-pink-300">💖 Easter Egg: Julia</div>
                    <div className="text-xs text-white/60 mt-0.5">
                      Invoca a Chuva de Corações Cósmicos 3D que perseguem e aniquilam os inimigos com amor. (Ou digite <span className="font-mono text-pink-300 font-bold">julia</span> no teclado a qualquer momento)
                    </div>
                  </div>
                  <button
                    onClick={handleJuliaEasterEgg}
                    className="btn border border-pink-400 bg-pink-500/25 hover:bg-pink-500/45 text-pink-200 text-xs px-4 py-2.5 cursor-pointer shrink-0 transition-all shadow-[0_0_15px_rgba(255,45,117,0.3)]"
                  >
                    💖 Disparar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: META */}
          {activeTab === 'meta' && (
            <div className="space-y-3">
              {/* Desbloquear Personagens */}
              <div className="p-3.5 glass rounded-xl border border-yellow-400/30 bg-yellow-500/5 flex items-center justify-between">
                <div>
                  <div className="font-display font-bold text-sm text-yellow-300">👑 Desbloquear Todos os Personagens</div>
                  <div className="text-xs text-white/60 mt-0.5">
                    Libera Carlinhos e Macedo instantaneamente para seleção no Hangar.
                  </div>
                </div>
                <button onClick={handleUnlockHeroes} className="btn btn-primary text-xs px-4 py-2 cursor-pointer">
                  Desbloquear
                </button>
              </div>

              {/* Ganhar Shards */}
              <div className="p-3.5 glass rounded-xl border border-white/10 space-y-2">
                <div className="flex justify-between items-center text-xs uppercase tracking-widest text-white/60 font-bold">
                  <span>Ganhar Shards (Meta Moeda)</span>
                  <span className="text-fuchsia-300 font-mono">Atual: {meta.shards.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => handleAddShards(1000)}
                    className="p-2 rounded-lg glass border border-fuchsia-400/20 hover:border-fuchsia-400 text-center cursor-pointer transition-all"
                  >
                    <div className="font-display font-bold text-xs text-fuchsia-200">+1.000</div>
                  </button>
                  <button
                    onClick={() => handleAddShards(10000)}
                    className="p-2 rounded-lg glass border border-fuchsia-400/20 hover:border-fuchsia-400 text-center cursor-pointer transition-all"
                  >
                    <div className="font-display font-bold text-xs text-fuchsia-200">+10.000</div>
                  </button>
                  <button
                    onClick={() => handleAddShards(100000)}
                    className="p-2 rounded-lg glass border border-fuchsia-400/40 hover:border-fuchsia-400 bg-fuchsia-500/10 text-center cursor-pointer transition-all"
                  >
                    <div className="font-display font-bold text-xs text-fuchsia-200">+100.000</div>
                  </button>
                  <button
                    onClick={() => handleAddShards(999999)}
                    className="p-2 rounded-lg glass border border-fuchsia-400/60 hover:border-fuchsia-400 bg-fuchsia-500/20 text-center cursor-pointer transition-all"
                  >
                    <div className="font-display font-bold text-xs text-fuchsia-100">+999.999</div>
                  </button>
                </div>
              </div>

              {/* Maximizar Meta-Upgrades */}
              <div className="p-3.5 glass rounded-xl border border-cyan-400/30 bg-cyan-500/5 flex items-center justify-between">
                <div>
                  <div className="font-display font-bold text-sm text-cyan-300">⚡ Maximizar Hangar (Meta)</div>
                  <div className="text-xs text-white/60 mt-0.5">
                    Coloca todos os 8 atributos permanentes do Hangar no nível máximo (10/10).
                  </div>
                </div>
                <button onClick={handleMaxMeta} className="btn text-xs px-4 py-2 cursor-pointer">
                  Maximizar
                </button>
              </div>

              {/* Desbloquear Conquistas */}
              <div className="p-3.5 glass rounded-xl border border-purple-400/30 bg-purple-500/5 flex items-center justify-between">
                <div>
                  <div className="font-display font-bold text-sm text-purple-300">🏆 Desbloquear Todas as Conquistas</div>
                  <div className="text-xs text-white/60 mt-0.5">
                    Desbloqueia os 12 troféus e credita as recompensas em Shards.
                  </div>
                </div>
                <button onClick={handleUnlockAchievements} className="btn text-xs px-4 py-2 cursor-pointer">
                  Completar
                </button>
              </div>
            </div>
          )}

          {/* TAB: WAVES */}
          {activeTab === 'waves' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleAdvanceWave()}
                  className="p-3 rounded-xl glass border border-cyan-400/30 hover:border-cyan-400 bg-cyan-500/10 text-left cursor-pointer transition-all"
                >
                  <div className="font-display font-bold text-sm text-cyan-200">⏩ Próxima Onda (+1)</div>
                  <div className="text-[11px] text-white/50 mt-1">Avança instantaneamente para a onda seguinte.</div>
                </button>
                <button
                  onClick={handleSpawnBoss}
                  className="p-3 rounded-xl glass border border-red-400/40 hover:border-red-400 bg-red-500/15 text-left cursor-pointer transition-all"
                >
                  <div className="font-display font-bold text-sm text-red-300">👹 Invocar Farmador de Aura</div>
                  <div className="text-[11px] text-white/50 mt-1">Inicia imediatamente a Onda 20 (Chefe Final).</div>
                </button>
              </div>

              <div className="p-3.5 glass rounded-xl border border-white/10 space-y-2">
                <div className="text-xs uppercase tracking-widest text-white/60 font-bold">Pular para Onda Específica</div>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 5, 10, 15, 20].map(w => (
                    <button
                      key={w}
                      onClick={() => handleAdvanceWave(w)}
                      className={`p-2 rounded-lg glass border text-center cursor-pointer transition-all ${
                        snap?.wave === w
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                          : 'border-white/10 hover:border-cyan-400/50 text-white/70'
                      }`}
                    >
                      <div className="font-display font-bold text-xs">Onda {w}</div>
                      <div className="text-[9px] text-white/40">
                        {w === 20 ? 'BOSS' : w % 5 === 0 ? 'Mini-Boss' : 'Comum'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 glass rounded-xl border border-amber-400/30 bg-amber-500/5 flex items-center justify-between">
                <div>
                  <div className="font-display font-bold text-sm text-amber-300">👾 Invocar Sentinela Mini-Boss</div>
                  <div className="text-xs text-white/60 mt-0.5">Gera uma sentinela de elite dourada na arena.</div>
                </div>
                <button onClick={handleSpawnMiniboss} className="btn text-xs px-4 py-2 cursor-pointer">
                  Invocar
                </button>
              </div>
            </div>
          )}

          {/* TAB: DROPS */}
          {activeTab === 'drops' && (
            <div className="space-y-3">
              <div className="text-xs text-white/50">
                Clique para gerar itens colecionáveis imediatamente ao lado da sua nave:
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <button
                  onClick={() => handleSpawnPickup('xp')}
                  className="p-3 rounded-xl glass border border-cyan-400/20 hover:border-cyan-400 text-left cursor-pointer transition-all"
                >
                  <div className="text-xl">💎</div>
                  <div className="font-display font-bold text-xs text-cyan-200 mt-1">Super Gema XP</div>
                  <div className="text-[10px] text-white/40">Garante +150 XP</div>
                </button>
                <button
                  onClick={() => handleSpawnPickup('magnet')}
                  className="p-3 rounded-xl glass border border-blue-400/20 hover:border-blue-400 text-left cursor-pointer transition-all"
                >
                  <div className="text-xl">🧲</div>
                  <div className="font-display font-bold text-xs text-blue-200 mt-1">Ímã Cósmico</div>
                  <div className="text-[10px] text-white/40">Atrai tudo na arena</div>
                </button>
                <button
                  onClick={() => handleSpawnPickup('heal')}
                  className="p-3 rounded-xl glass border border-green-400/20 hover:border-green-400 text-left cursor-pointer transition-all"
                >
                  <div className="text-xl">💚</div>
                  <div className="font-display font-bold text-xs text-green-200 mt-1">Kit Médico</div>
                  <div className="text-[10px] text-white/40">Restaura 30 HP</div>
                </button>
                <button
                  onClick={() => handleSpawnPickup('coin')}
                  className="p-3 rounded-xl glass border border-yellow-400/20 hover:border-yellow-400 text-left cursor-pointer transition-all"
                >
                  <div className="text-xl">💰</div>
                  <div className="font-display font-bold text-xs text-yellow-200 mt-1">Moeda Dourada</div>
                  <div className="text-[10px] text-white/40">Concede ouro/shards</div>
                </button>
                <button
                  onClick={() => handleSpawnPickup('shard')}
                  className="p-3 rounded-xl glass border border-fuchsia-400/20 hover:border-fuchsia-400 text-left cursor-pointer transition-all"
                >
                  <div className="text-xl">◆</div>
                  <div className="font-display font-bold text-xs text-fuchsia-200 mt-1">Shard Puro</div>
                  <div className="text-[10px] text-white/40">Adiciona ao inventário</div>
                </button>
                <button
                  onClick={handleSpawnSupplyDrop}
                  className="p-3 rounded-xl glass border border-emerald-400/30 hover:border-emerald-400 bg-emerald-500/10 text-left cursor-pointer transition-all"
                >
                  <div className="text-xl">🚀</div>
                  <div className="font-display font-bold text-xs text-emerald-200 mt-1">Cápsula SpaceX</div>
                  <div className="text-[10px] text-white/40">Drop de Suprimentos</div>
                </button>
              </div>
            </div>
          )}

          {/* TAB: SYSTEM */}
          {activeTab === 'system' && (
            <div className="space-y-3">
              <div className="p-4 glass rounded-xl border border-red-500/30 bg-red-500/10 space-y-2">
                <div className="font-display font-bold text-sm text-red-300">🔄 Reset Geral de Dados de Teste</div>
                <div className="text-xs text-white/70">
                  Limpa o localStorage do jogo e redefine shards para 0, vitórias para 0 e bloqueia os personagens especiais, permitindo testar o fluxo de progressão inicial desde o zero absoluto.
                </div>
                <button
                  onClick={handleResetSave}
                  className="mt-2 px-4 py-2 rounded-lg bg-red-600/40 hover:bg-red-600 text-red-100 font-display font-bold text-xs border border-red-400/50 cursor-pointer transition-all"
                >
                  Resetar Save Completo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Toast Notification */}
        {toast && (
          <div className="mt-3 p-2.5 rounded-lg bg-cyan-500/20 border border-cyan-400 text-cyan-200 text-xs font-bold text-center animate-bounce">
            {toast}
          </div>
        )}

        {/* Footer Buttons */}
        <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center text-xs">
          <span className="text-white/40">
            Dica: Digite <span className="text-cyan-300 font-mono">sociedadegdc</span> a qualquer momento para abrir este menu.
          </span>
          <button className="btn btn-primary text-xs px-6 py-2 cursor-pointer" onClick={onClose}>
            Fechar Console
          </button>
        </div>
      </div>
    </div>
  );
}
