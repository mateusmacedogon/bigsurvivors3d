import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from './game/game';
import type { HeroId, MetaId, Snapshot } from './game/config';
import { buyMeta, getMetaBonuses, loadMeta, type MetaSave } from './game/save';
import { HUD } from './ui/HUD';
import { EndScreen, Hangar, HeroSelect, LevelUpScreen, MainMenu, PauseScreen, AchievementsScreen, CodexScreen, SettingsModal } from './ui/Screens';
import { ModMenu } from './ui/ModMenu';

type MenuScreen = 'main' | 'heroes' | 'hangar' | 'achievements' | 'codex';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [screen, setScreen] = useState<MenuScreen>('main');
  const [showSettings, setShowSettings] = useState(false);
  const [showModMenu, setShowModMenu] = useState(false);
  const [meta, setMeta] = useState<MetaSave>(() => loadMeta());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let keyBuffer = '';
    const SECRET = 'sociedadegdc';
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key && e.key.length === 1) {
        keyBuffer = (keyBuffer + e.key.toLowerCase()).slice(-20);
        const normalized = keyBuffer.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (normalized.endsWith(SECRET)) {
          keyBuffer = '';
          setShowModMenu(prev => {
            const next = !prev;
            if (next && gameRef.current) {
              gameRef.current.audio.cardPick();
              gameRef.current.notice('SOCIEDADE GDC DETECTADA!', 'Mod Menu e Painel de Cheats ativado!', '#00ffcc');
            }
            return next;
          });
        } else if (normalized.endsWith('julia')) {
          keyBuffer = '';
          gameRef.current?.triggerJuliaEasterEgg();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas);
    gameRef.current = game;
    game.onPhaseChange = () => setSnap(game.getSnapshot());
    setSnap(game.getSnapshot());
    const id = window.setInterval(() => setSnap(game.getSnapshot()), 50);
    setReady(true);
    const unlock = () => { game.audio.init(); game.audio.resume(); if (game.phase === 'menu') game.audio.startMusic('calm'); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      clearInterval(id);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const game = gameRef.current;

  const startRun = useCallback((hero: HeroId) => {
    const g = gameRef.current;
    if (!g) return;
    g.audio.ui();
    g.start(hero);
    setSnap(g.getSnapshot());
  }, []);

  const toMenu = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.toMenu();
    setMeta(loadMeta());
    setScreen('main');
    setSnap(g.getSnapshot());
  }, []);

  const buy = useCallback((id: MetaId) => {
    const g = gameRef.current;
    const m = buyMeta(id);
    if (m) { setMeta(m); g?.audio.pickup('shard'); } else g?.audio.hurt();
  }, []);

  const phase = snap?.phase ?? 'menu';

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas" />
      {ready && game && snap && (
        <>
          {phase === 'menu' && snap.notice && (
            <div key={snap.notice.id} className="fixed top-[20%] left-1/2 -translate-x-1/2 text-center notice pointer-events-none z-50">
              <div className="font-display font-black text-4xl md:text-5xl neon tracking-[0.22em]" style={{ color: snap.notice.color ?? '#fff' }}>{snap.notice.text}</div>
              {snap.notice.sub && <div className="mt-2 text-lg tracking-[0.3em] uppercase text-white/75">{snap.notice.sub}</div>}
            </div>
          )}
          {phase === 'menu' && screen === 'main' && (
            <MainMenu
              meta={meta}
              onStart={() => { game.audio.ui(); setScreen('heroes'); }}
              onHangar={() => { game.audio.ui(); setMeta(loadMeta()); setScreen('hangar'); }}
              onAchievements={() => { game.audio.ui(); setMeta(loadMeta()); setScreen('achievements'); }}
              onCodex={() => { game.audio.ui(); setMeta(loadMeta()); setScreen('codex'); }}
              onSettings={() => { game.audio.ui(); setShowSettings(true); }}
            />
          )}
          {phase === 'menu' && screen === 'heroes' && (
            <HeroSelect meta={meta} onPick={startRun} onHover={id => game.setShowcaseHero(id)} onBack={() => { game.audio.ui(); setScreen('main'); }} />
          )}
          {phase === 'menu' && screen === 'hangar' && (
            <Hangar meta={meta} onBuy={buy} onBack={() => { game.audio.ui(); setScreen('main'); }} />
          )}
          {phase === 'menu' && screen === 'achievements' && (
            <AchievementsScreen meta={meta} onBack={() => { game.audio.ui(); setScreen('main'); }} />
          )}
          {phase === 'menu' && screen === 'codex' && (
            <CodexScreen meta={meta} onBack={() => { game.audio.ui(); setScreen('main'); }} />
          )}
          {phase !== 'menu' && <HUD snap={snap} game={game} />}
          {phase === 'paused' && (
            <PauseScreen
              snap={snap}
              onResume={() => game.resume()}
              onQuit={toMenu}
              onSettings={() => { game.audio.ui(); setShowSettings(true); }}
            />
          )}
          {phase === 'levelup' && <LevelUpScreen choices={snap.choices} level={snap.level} onPick={id => game.chooseUpgrade(id)} />}
          {(phase === 'gameover' || phase === 'victory') && snap.result && (
            <EndScreen result={snap.result} onMenu={toMenu} onContinue={phase === 'victory' ? () => game.continueEndless() : undefined} />
          )}
          {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
          {showModMenu && (
            <ModMenu
              isOpen={showModMenu}
              onClose={() => setShowModMenu(false)}
              game={game}
              meta={meta}
              onMetaUpdate={newMeta => {
                setMeta({ ...newMeta });
                if (game && game.player) {
                  game.player.setMeta(getMetaBonuses(newMeta));
                }
              }}
              snap={snap}
            />
          )}
        </>
      )}
    </>
  );
}
