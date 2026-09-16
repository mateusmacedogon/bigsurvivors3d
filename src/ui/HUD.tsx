import { useEffect, useRef } from 'react';
import type { Snapshot } from '../game/config';
import { heroById } from '../game/config';
import type { Game } from '../game/game';
import { RELIC_DEFS } from '../game/relics';

const fmtTime = (t: number) => {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const HERO_ICONS: Record<string, string> = {
  big: '🍾',
  otton: '💗',
  thiago: '☣',
  pietro: '☥',
  carlinhos: '💛',
  macedo: '📡',
  roberto: '⚡',
  kaio: '🔥',
};

export const HERO_ELEMENTS: Record<string, { label: string; icon: string; border: string; text: string }> = {
  big: { label: 'INTERCEPTADOR', icon: '🚀', border: 'border-cyan-400/40', text: 'text-cyan-300' },
  otton: { label: 'BRUTAMONTES', icon: '💗', border: 'border-red-400/40', text: 'text-red-300' },
  thiago: { label: 'CORROSÃO', icon: '☣', border: 'border-lime-400/40', text: 'text-lime-300' },
  pietro: { label: 'RUNAS', icon: '☥', border: 'border-purple-400/40', text: 'text-purple-300' },
  carlinhos: { label: 'PACIFISTA', icon: '💛', border: 'border-amber-400/40', text: 'text-amber-300' },
  macedo: { label: 'TELEMÁTICA', icon: '📡', border: 'border-sky-400/40', text: 'text-sky-300' },
  roberto: { label: 'RELÂMPAGO', icon: '⚡', border: 'border-yellow-400/40', text: 'text-yellow-300' },
  kaio: { label: 'PIROMANTE', icon: '🔥', border: 'border-orange-400/40', text: 'text-orange-300' },
};

function Radar({ game, color }: { game: Game; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let raf = 0;
    let sweep = 0;
    const W = 176, H = 176, cx = W / 2, cy = H / 2, R = W / 2 - 4;
    const scale = R / 50;

    // Cache static background in offscreen canvas (massive 2D canvas optimization)
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = W;
    bgCanvas.height = H;
    const bgCtx = bgCanvas.getContext('2d');
    if (bgCtx) {
      const grd = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, R);
      grd.addColorStop(0, 'rgba(0,35,55,0.65)');
      grd.addColorStop(1, 'rgba(0,10,28,0.85)');
      bgCtx.fillStyle = grd;
      bgCtx.beginPath();
      bgCtx.arc(cx, cy, R, 0, Math.PI * 2);
      bgCtx.fill();

      bgCtx.strokeStyle = 'rgba(0,229,255,0.22)';
      bgCtx.lineWidth = 1;
      for (const r of [R * 0.33, R * 0.66, R]) {
        bgCtx.beginPath();
        bgCtx.arc(cx, cy, r, 0, Math.PI * 2);
        bgCtx.stroke();
      }

      bgCtx.beginPath();
      bgCtx.moveTo(cx - R, cy); bgCtx.lineTo(cx + R, cy);
      bgCtx.moveTo(cx, cy - R); bgCtx.lineTo(cx, cy + R);
      bgCtx.stroke();
    }
    bgCanvasRef.current = bgCanvas;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, W, H);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      if (bgCanvasRef.current) {
        ctx.drawImage(bgCanvasRef.current, 0, 0);
      }

      // Varredura suave otimizada sem createConicGradient a cada frame
      sweep += 0.04;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sweep);
      const sweepGrd = ctx.createLinearGradient(0, 0, R, 0);
      sweepGrd.addColorStop(0, 'rgba(0,229,255,0.32)');
      sweepGrd.addColorStop(1, 'rgba(0,229,255,0)');
      ctx.fillStyle = sweepGrd;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, 0, Math.PI * 0.26);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Borda da arena
      const rad = game.getRadar();
      ctx.strokeStyle = 'rgba(255,45,117,0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx - rad.px * scale, cy - rad.pz * scale, 70 * scale, 0, Math.PI * 2);
      ctx.stroke();

      // Pontos e Ameaças
      const pts = rad.points;
      const t = performance.now() / 1000;
      for (let i = 0; i < pts.length; i += 3) {
        let dx = pts[i] * scale;
        let dy = pts[i + 1] * scale;
        const k = pts[i + 2];
        const dist = Math.hypot(dx, dy);
        const offscreen = dist > R;
        if (offscreen) {
          if (k === 4 || k === 5 || k === 2) {
            dx = (dx / dist) * (R - 5);
            dy = (dy / dist) * (R - 5);
          } else {
            continue;
          }
        }
        const x = cx + dx, y = cy + dy;
        let col = '#ff2d75', size = 2.2;
        if (k === 1) { col = '#ffd700'; size = 3.2; }
        else if (k === 2) { col = '#ff9900'; size = 5 + Math.sin(t * 8) * 1.5; }
        else if (k === 3) { col = '#ffe02d'; size = 1.6; }
        else if (k === 4) { col = '#ff30c0'; size = 7 + Math.sin(t * 6) * 2; }
        else if (k === 5) { col = '#00ffff'; size = 5.5 + Math.sin(t * 10) * 1.8; }
        else if (k === 6) { col = '#7df9ff'; size = 2.0; }

        ctx.fillStyle = col;

        if (k === 5) {
          // Drop SpaceX
          ctx.beginPath();
          ctx.moveTo(x, y - size * 1.3);
          ctx.lineTo(x + size * 1.1, y);
          ctx.lineTo(x, y + size * 1.3);
          ctx.lineTo(x - size * 1.1, y);
          ctx.closePath();
          ctx.fill();
        } else {
          // Halo glow suave sem shadowBlur pesado
          if (k >= 2 && k !== 6) {
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.arc(x, y, size * 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Jogador
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI - rad.angle);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.restore(); // Fim do recorte circular do radar

      // Aro holográfico externo do radar
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [game, color]);

  return <canvas ref={ref} width={176} height={176} className="block" />;
}

export function HUD({ snap, game }: { snap: Snapshot; game: Game }) {
  const hero = snap.hero ? heroById(snap.hero) : null;
  const color = hero?.css ?? '#00e5ff';
  const heroIcon = snap.hero ? HERO_ICONS[snap.hero] ?? '🚀' : '🚀';
  const heroElem = snap.hero ? HERO_ELEMENTS[snap.hero] : null;

  const hpFrac = Math.max(0, Math.min(1, snap.hp / snap.maxHp));
  const hpPct = Math.round(hpFrac * 100);
  const xpFrac = Math.min(1, snap.xp / snap.xpNext);
  const waveFrac = Math.min(1, snap.waveTime / snap.waveDuration);
  const dashFrac = snap.dashMax > 0 ? snap.dashCd / snap.dashMax : 0;
  const ultFrac = snap.ultMax > 0 ? snap.ultCd / snap.ultMax : 0;
  const hpColor = hpFrac > 0.5 ? color : hpFrac > 0.25 ? '#ffb020' : '#ff3050';
  const lowHp = hpFrac <= 0.25;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 font-body select-none">
      {/* Vinheta de Dano e Alerta de HP Crítico */}
      <div
        className="absolute inset-0 transition-opacity duration-150"
        style={{
          opacity: snap.hurt * 0.8,
          background: 'radial-gradient(ellipse at center, transparent 45%, rgba(255,20,60,0.55) 100%)',
        }}
      />
      {lowHp && (
        <div
          className="absolute inset-0 blink"
          style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(255,20,60,0.32) 100%)' }}
        />
      )}

      {/* Barra de XP de alta precisão no topo */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-black/75 shadow-lg border-b border-white/10">
        <div
          className="h-full transition-all duration-150 relative"
          style={{
            width: `${xpFrac * 100}%`,
            background: `linear-gradient(90deg, ${color}aa, ${color}, #ffffff)`,
            boxShadow: `0 0 16px ${color}`,
          }}
        >
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-white blur-[2px]" />
        </div>
      </div>

      {/* ================================================================= */}
      {/* TOPO ESQUERDA: PERFIL DO PILOTO & BARRAS DE STATUS                */}
      {/* ================================================================= */}
      <div className="absolute top-5 left-5 flex flex-col gap-2.5">
        <div className="glass-strong rounded-2xl p-3 sm:p-3.5 w-[270px] sm:w-[290px] md:w-[310px] scanlines relative overflow-hidden border border-white/15 shadow-[0_15px_35px_rgba(0,0,0,0.5)]">
          {/* Cabeçalho do Piloto */}
          <div className="flex items-center justify-between gap-2.5 mb-2">
            <div className="flex items-center gap-2.5">
              <div
                className="hex-badge w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center font-display font-black text-sm relative shadow-md"
                style={{ background: color, color: '#03040e' }}
              >
                <span>{snap.level}</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base leading-none">{heroIcon}</span>
                  <span className="font-display font-black text-sm sm:text-base tracking-wider leading-none neon" style={{ color }}>
                    {hero?.name}
                  </span>
                </div>
                {heroElem && (
                  <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-display font-bold uppercase tracking-widest mt-1 border ${heroElem.border} ${heroElem.text} bg-white/5`}>
                    <span>{heroElem.icon}</span>
                    <span>{heroElem.label}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Numérico de HP e % */}
            <div className="text-right flex flex-col items-end">
              <div className="flex items-baseline gap-1 font-display text-xs">
                <span className="font-black text-sm" style={{ color: hpColor }}>{Math.ceil(snap.hp)}</span>
                <span className="text-white/40 text-[11px]">/{Math.round(snap.maxHp)}</span>
              </div>
              <span className={`text-[10px] font-display font-bold px-1.5 rounded ${hpFrac <= 0.25 ? 'bg-red-500/25 text-red-300 animate-pulse' : 'text-white/50'}`}>
                {hpPct}%
              </span>
            </div>
          </div>

          {/* Barra de Vida */}
          <div className="bar h-3.5 relative shadow-inner">
            <div
              className="bar-fill"
              style={{
                width: `${hpFrac * 100}%`,
                background: `linear-gradient(90deg, ${hpColor}dd, ${hpColor})`,
                color: hpColor,
                boxShadow: `0 0 12px ${hpColor}`,
              }}
            />
          </div>

          {/* Barra de XP e Nível */}
          <div className="flex items-center justify-between mt-2 text-[10px] uppercase font-display tracking-widest text-white/50">
            <span>XP <b className="text-white/80">{Math.floor(snap.xp)}</b> / {snap.xpNext}</span>
            <span className="text-cyan-300 font-bold">NÍVEL {snap.level}</span>
          </div>

          {/* Módulos Passivos Coletados */}
          {snap.upgrades.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5 pt-2 border-t border-white/10 max-h-20 overflow-y-auto">
              {snap.upgrades.map(u => (
                <div
                  key={u.id}
                  title={`${u.name} (Nível ${u.level})`}
                  className="px-2 py-0.5 rounded-md bg-white/8 border border-white/15 text-[10px] flex items-center gap-1.5 transition-all hover:border-cyan-400/50"
                >
                  <span className="text-xs">{u.icon}</span>
                  <span className="font-display font-bold text-cyan-200">{u.level}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alternador Rápido de Modo de Mira */}
        <button
          onClick={() => game.toggleAimMode()}
          className="pointer-events-auto self-start px-3 py-1.5 rounded-xl glass-strong border border-cyan-400/30 hover:border-cyan-300 text-xs font-display tracking-wider flex items-center gap-2 transition-all cursor-pointer hover:scale-105 shadow-md"
          title="Pressione [TAB] ou clique para alternar o modo de mira"
        >
          <span className="keycap">[TAB]</span>
          <span className={snap.aimMode === 'auto' ? 'text-cyan-300 neon font-bold' : 'text-amber-300 font-bold'}>
            MIRA: {snap.aimMode === 'auto' ? 'AUTOMÁTICA' : 'MANUAL'}
          </span>
          <span className="text-[10px] opacity-60">
            {snap.aimMode === 'auto' ? '🎯' : '🕹️'}
          </span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* TOPO CENTRO: ONDA, TEMPO, ABATES, CHEFE E EVENTOS                 */}
      {/* ================================================================= */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-auto max-w-[420px]">
        {/* Painel Tático Central */}
        <div className="glass-strong rounded-2xl px-5 py-2 flex items-center gap-4 sm:gap-6 relative overflow-hidden border border-white/15 shadow-[0_15px_40px_rgba(0,0,0,0.6)]">
          <div className="text-center min-w-[65px]">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-display">Onda</div>
            <div
              className="font-display font-black text-3xl leading-none neon"
              style={{ color: snap.wave % 5 === 0 ? '#ffd700' : '#ffffff' }}
            >
              {snap.wave}
            </div>
          </div>
          <div className="w-px h-10 bg-white/15" />
          <div className="text-center min-w-[85px]">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-display flex items-center justify-center gap-1">
              <span>⏱</span> Tempo
            </div>
            <div className="font-display font-bold text-2xl leading-none text-cyan-200">{fmtTime(snap.time)}</div>
          </div>
          <div className="w-px h-10 bg-white/15" />
          <div className="text-center min-w-[75px]">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-display flex items-center justify-center gap-1">
              <span>⚔</span> Abates
            </div>
            <div className="font-display font-bold text-2xl leading-none text-pink-300">{snap.kills}</div>
          </div>

          {/* Barra de Progresso da Onda */}
          {!snap.boss && (
            <div
              className="absolute left-0 bottom-0 h-[3px] bg-gradient-to-r from-cyan-400 to-cyan-200 transition-all duration-150"
              style={{ width: `${waveFrac * 100}%`, boxShadow: '0 0 10px #00e5ff' }}
            />
          )}
        </div>

        {/* Barra de Chefe / Mini-Boss */}
        {snap.boss && (
          <div className="glass-strong rounded-2xl px-5 py-2.5 w-full fade-in border border-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.3)]">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-base">{snap.boss.phase ? '👾' : '⚠️'}</span>
                <span
                  className="font-display font-black text-xs md:text-sm tracking-[0.25em] neon uppercase"
                  style={{ color: snap.boss.phase ? '#ff30c0' : '#ffd700' }}
                >
                  {snap.boss.name}
                </span>
              </div>
              <div className="text-xs text-white/75 font-display flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold">
                  {snap.boss.phase ? `FASE ${snap.boss.phase}` : 'MINI-BOSS'}
                </span>
                <span>{Math.ceil(snap.boss.hp)} / {snap.boss.max}</span>
              </div>
            </div>
            <div className="bar h-3.5 relative overflow-hidden">
              <div
                className="bar-fill"
                style={{
                  width: `${(snap.boss.hp / snap.boss.max) * 100}%`,
                  background: snap.boss.phase
                    ? 'linear-gradient(90deg, #ff30c0, #ffcf40)'
                    : 'linear-gradient(90deg, #ffd700, #ff6020)',
                  color: snap.boss.phase ? '#ff30c0' : '#ffd700',
                }}
              />
              {snap.boss.phase > 0 && (
                <>
                  <div className="absolute top-0 bottom-0 w-0.5 bg-white/70 shadow-sm" style={{ left: '66.6%' }} />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-white/70 shadow-sm" style={{ left: '33.3%' }} />
                </>
              )}
            </div>
          </div>
        )}

        {/* Relíquias Cósmicas Ativas */}
        {snap.relics && snap.relics.length > 0 && (
          <div className="flex gap-2 justify-center flex-wrap mt-0.5">
            {snap.relics.map(rId => {
              const r = RELIC_DEFS[rId as keyof typeof RELIC_DEFS];
              return (
                <div
                  key={rId}
                  className="px-2.5 py-1 rounded-xl glass-strong border border-amber-400/60 flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.3)] text-xs transition-all hover:scale-105"
                  title={`${r?.name}: ${r?.desc}`}
                >
                  <span className="text-base">{r?.icon}</span>
                  <span className="font-display font-bold text-[11px] text-amber-200">{r?.name}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Banner do Evento de Arena Ativo */}
        {snap.activeArenaEvent && (
          <div
            className="glass-strong border rounded-2xl px-5 py-2 flex items-center gap-3 shadow-[0_0_25px_rgba(0,229,255,0.4)] animate-pulse mt-1"
            style={{ borderColor: snap.activeArenaEvent.color }}
          >
            <span className="text-2xl">{snap.activeArenaEvent.icon}</span>
            <div className="flex flex-col text-left">
              <span className="font-display font-black text-xs tracking-wider" style={{ color: snap.activeArenaEvent.color }}>
                {snap.activeArenaEvent.name.toUpperCase()} · {snap.activeArenaEvent.timer}s
              </span>
              <span className="text-[11px] text-white/80">{snap.activeArenaEvent.desc}</span>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* TOPO DIREITA: RECURSOS & TELEMETRIA                               */}
      {/* ================================================================= */}
      <div className="absolute top-5 right-5 glass-strong rounded-2xl px-4 py-3 flex flex-col gap-1.5 min-w-[185px] border border-white/15 shadow-[0_15px_35px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between gap-4">
          <span className="text-white/50 text-[11px] uppercase tracking-wider font-display flex items-center gap-1">
            <span>🪙</span> Moedas
          </span>
          <span className="font-display font-bold text-yellow-300 neon">◉ {snap.coins}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-white/50 text-[11px] uppercase tracking-wider font-display flex items-center gap-1">
            <span>💎</span> Shards
          </span>
          <span className="font-display font-bold text-fuchsia-300 neon">◆ {snap.shards}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-white/50 text-[11px] uppercase tracking-wider font-display flex items-center gap-1">
            <span>⚡</span> DPS
          </span>
          <span className="font-display font-bold text-cyan-300 neon">{Math.round(snap.dps)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-white/10 text-[10px] text-white/40 font-mono">
          <span>FPS</span>
          <span className={snap.fps >= 50 ? 'text-green-300' : snap.fps >= 30 ? 'text-yellow-300' : 'text-red-300'}>
            {snap.fps}
          </span>
        </div>
      </div>

      {/* ================================================================= */}
      {/* AVISOS CENTRAIS: DROPS SPACEX, MENSAGENS E ALERTAS                */}
      {/* ================================================================= */}
      {snap.crateAlert && (
        <div className="absolute top-[18%] left-1/2 -translate-x-1/2 pointer-events-none fade-in z-20">
          <div className="glass-strong border-2 border-yellow-400 rounded-2xl px-7 py-3 flex items-center gap-3.5 shadow-[0_0_40px_rgba(255,215,0,0.55)] animate-pulse">
            <span className="text-3xl">📦</span>
            <div className="text-center">
              <div className="font-display font-black text-sm text-yellow-300 neon tracking-widest">CÁPSULA SPACEX EM ÓRBITA!</div>
              <div className="text-xs text-white/85 uppercase tracking-wider mt-0.5">Suprimentos de Elon Musk na arena! Corra até o sinalizador!</div>
            </div>
            <span className="text-3xl">🚀</span>
          </div>
        </div>
      )}

      {snap.notice && (
        <div key={snap.notice.id} className="absolute top-[25%] left-1/2 -translate-x-1/2 text-center notice pointer-events-none">
          <div
            className="font-display font-black text-4xl md:text-5xl neon tracking-[0.22em]"
            style={{ color: snap.notice.color ?? '#ffffff' }}
          >
            {snap.notice.text}
          </div>
          {snap.notice.sub && (
            <div className="mt-2 text-lg tracking-[0.3em] uppercase text-white/80 font-display">
              {snap.notice.sub}
            </div>
          )}
        </div>
      )}

      {snap.bossWarning && (
        <div className="absolute inset-x-0 top-[40%] text-center blink pointer-events-none">
          <div className="font-display font-black text-6xl md:text-7xl tracking-[0.4em] text-red-500 neon">
            ⚠ ALERTA MÁXIMO ⚠
          </div>
          <div className="font-display text-sm tracking-[0.3em] text-white/80 uppercase mt-2">
            Presença de Entidade de Aura Hostil Detectada
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* BAIXO ESQUERDA: ARSENAL, DASH E SUPREMA                           */}
      {/* ================================================================= */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-3.5">
        {/* Armas Secundárias Equipadas */}
        {snap.activeWeapons && snap.activeWeapons.length > 0 && (
          <div className="flex gap-2 flex-wrap max-w-lg">
            {snap.activeWeapons.map(w => (
              <div
                key={w.id}
                className={`glass-strong px-3 py-1.5 rounded-xl flex items-center gap-2 border transition-all ${
                  w.evolved
                    ? 'border-yellow-400 bg-yellow-500/15 shadow-[0_0_15px_rgba(255,215,0,0.35)]'
                    : 'border-white/15 bg-black/50'
                }`}
                title={`${w.name} ${w.evolved ? '(Evoluída)' : `(Nível ${w.level})`}`}
              >
                <span className="text-lg leading-none">{w.icon}</span>
                <div className="flex flex-col">
                  <span className="text-[11px] font-display font-bold text-white leading-tight">{w.name}</span>
                  <span className={`text-[10px] leading-tight font-display font-bold ${w.evolved ? 'text-yellow-300' : 'text-cyan-300'}`}>
                    {w.evolved ? '👑 EVOLUÍDA' : `NV ${w.level}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Habilidades Ativas: Dash e Suprema */}
        <div className="flex items-end gap-3.5">
          {/* Dash */}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`slot ${dashFrac <= 0 ? 'pulse-glow ready-pulse' : ''}`}
              style={{ color: '#7fe9ff', borderColor: dashFrac <= 0 ? '#7fe9ff' : undefined }}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl">➶</div>
                <div className="font-display text-[10px] tracking-widest text-white/80">DASH</div>
              </div>
              <div className="slot-fill" style={{ height: `${dashFrac * 100}%` }} />
            </div>
            <div className="keycap">ESPAÇO</div>
          </div>

          {/* Suprema (Q) */}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`slot w-[96px] h-[96px] ${ultFrac <= 0 && !snap.ultActive ? 'pulse-glow ready-pulse' : ''}`}
              style={{ color, borderColor: ultFrac <= 0 ? color : undefined }}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center px-1 text-center">
                <div className="text-3xl drop-shadow-md">
                  {heroIcon}
                </div>
                <div className="font-display text-[9px] tracking-wider text-white/90 leading-tight mt-1 px-1 line-clamp-1">
                  {hero?.ult.toUpperCase()}
                </div>
                {ultFrac > 0 && (
                  <div className="font-display text-xs mt-0.5 font-bold" style={{ color }}>
                    {Math.ceil(snap.ultCd)}s
                  </div>
                )}
                {ultFrac <= 0 && !snap.ultActive && (
                  <div className="font-display text-[10px] mt-0.5 neon font-black" style={{ color }}>
                    PRONTA [Q]
                  </div>
                )}
              </div>
              <div className="slot-fill" style={{ height: `${ultFrac * 100}%` }} />
              {snap.ultActive && <div className="absolute inset-0 shimmer" />}
            </div>
            <div className="keycap">Q · SUPREMA</div>
          </div>
        </div>
      </div>

      {/* Dicas de Controle Iniciais */}
      {snap.time < 14 && (
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 glass-strong rounded-full px-6 py-2 text-xs tracking-[0.2em] uppercase text-white/80 fade-in border border-white/20 shadow-lg">
          <span className="keycap mr-1">WASD</span> Mover ·{' '}
          <span className="keycap mr-1">MOUSE</span> Mirar ·{' '}
          <span className="keycap mr-1">ESPAÇO</span> Dash ·{' '}
          <span className="keycap mr-1">Q</span> Suprema ·{' '}
          <span className="keycap mr-1">P</span> Pausar
        </div>
      )}

      {/* Alertas Direcionais de Ameaças Fora da Tela */}
      {snap.offscreenThreats && snap.offscreenThreats.length > 0 && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-30">
          {snap.offscreenThreats.map((threat, idx) => (
            <div
              key={idx}
              className="absolute transition-all duration-75"
              style={{
                left: `calc(50% + ${Math.sin(threat.angle) * 42}vw)`,
                top: `calc(50% - ${Math.cos(threat.angle) * 42}vh)`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className={`px-3 py-1.5 rounded-xl glass-strong font-display font-bold text-xs flex items-center gap-2 border animate-pulse shadow-lg ${
                  threat.isBoss
                    ? 'border-red-500 bg-red-600/30 text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                    : 'border-amber-400 bg-amber-500/25 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                }`}
              >
                <span
                  className="inline-block text-xs font-bold"
                  style={{ transform: `rotate(${(threat.angle * 180) / Math.PI}deg)` }}
                >
                  ▲
                </span>
                <span>{threat.name} ({threat.distance}m)</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Radar de Bordo */}
      <div className="absolute bottom-6 right-6 glass-strong rounded-full p-2 border border-white/20" style={{ boxShadow: `0 0 35px ${color}33` }}>
        <Radar game={game} color={color} />
      </div>
    </div>
  );
}
