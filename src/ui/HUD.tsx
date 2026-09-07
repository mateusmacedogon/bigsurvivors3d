import { useEffect, useRef } from 'react';
import type { Snapshot } from '../game/config';
import { heroById } from '../game/config';
import type { Game } from '../game/game';

const fmtTime = (t: number) => {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

function Radar({ game, color }: { game: Game; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    let sweep = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const W = c.width, H = c.height, cx = W / 2, cy = H / 2, R = W / 2 - 4;
      const scale = R / 50;
      ctx.clearRect(0, 0, W, H);
      // fundo
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      grd.addColorStop(0, 'rgba(0,40,60,0.55)');
      grd.addColorStop(1, 'rgba(0,10,30,0.75)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,229,255,0.25)';
      ctx.lineWidth = 1;
      for (const r of [R * 0.33, R * 0.66, R]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      // varredura
      sweep += 0.04;
      const sg = ctx.createConicGradient(sweep, cx, cy);
      sg.addColorStop(0, 'rgba(0,229,255,0.35)');
      sg.addColorStop(0.15, 'rgba(0,229,255,0)');
      sg.addColorStop(1, 'rgba(0,229,255,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      // borda da arena
      const rad = game.getRadar();
      ctx.strokeStyle = 'rgba(255,45,117,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx - rad.px * scale, cy - rad.pz * scale, 70 * scale, 0, Math.PI * 2); ctx.stroke();
      // pontos
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
        ctx.shadowColor = col;
        ctx.shadowBlur = (k >= 2 && k !== 6) ? 12 : 4;

        if (k === 5) {
          ctx.beginPath();
          ctx.moveTo(x, y - size * 1.3);
          ctx.lineTo(x + size * 1.1, y);
          ctx.lineTo(x, y + size * 1.3);
          ctx.lineTo(x - size * 1.1, y);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
      // jogador
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI - rad.angle);
      ctx.fillStyle = color;
      ctx.shadowColor = color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [game, color]);
  return <canvas ref={ref} width={176} height={176} className="block" />;
}

export function HUD({ snap, game }: { snap: Snapshot; game: Game }) {
  const hero = snap.hero ? heroById(snap.hero) : null;
  const color = hero?.css ?? '#00e5ff';
  const hpFrac = Math.max(0, snap.hp / snap.maxHp);
  const xpFrac = Math.min(1, snap.xp / snap.xpNext);
  const waveFrac = Math.min(1, snap.waveTime / snap.waveDuration);
  const dashFrac = snap.dashMax > 0 ? snap.dashCd / snap.dashMax : 0;
  const ultFrac = snap.ultMax > 0 ? snap.ultCd / snap.ultMax : 0;
  const hpColor = hpFrac > 0.5 ? color : hpFrac > 0.25 ? '#ffb020' : '#ff3050';
  const lowHp = hpFrac <= 0.25;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 font-body">
      {/* vinheta de dano */}
      <div className="absolute inset-0 transition-opacity" style={{ opacity: snap.hurt * 0.8, background: 'radial-gradient(ellipse at center, transparent 45%, rgba(255,20,60,0.55) 100%)' }} />
      {lowHp && <div className="absolute inset-0 blink" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(255,20,60,0.28) 100%)' }} />}

      {/* barra de XP no topo */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-black/60">
        <div className="h-full transition-all" style={{ width: `${xpFrac * 100}%`, background: `linear-gradient(90deg, ${color}, #ffffff)`, boxShadow: `0 0 14px ${color}` }} />
      </div>

      {/* topo esquerda: herói + HP */}
      <div className="absolute top-5 left-5 flex flex-col gap-2">
        <div className="glass rounded-xl p-3 min-w-[300px] scanlines relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="hex-badge w-9 h-9 flex items-center justify-center font-display font-black text-sm" style={{ background: color, color: '#050510' }}>{snap.level}</div>
              <div>
                <div className="font-display font-black text-base leading-none neon" style={{ color }}>{hero?.name}</div>
                <div className="text-[11px] uppercase tracking-[0.25em] text-white/50 leading-none mt-1">{hero?.title}</div>
              </div>
            </div>
            <div className="font-display text-sm text-white/80">{Math.ceil(snap.hp)}<span className="text-white/40">/{Math.round(snap.maxHp)}</span></div>
          </div>
          <div className="bar h-4">
            <div className="bar-fill" style={{ width: `${hpFrac * 100}%`, background: `linear-gradient(90deg, ${hpColor}, ${hpColor}cc)`, color: hpColor }} />
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[11px] uppercase tracking-widest text-white/50">
            <span>XP {Math.floor(snap.xp)} / {snap.xpNext}</span>
            <span>NÍVEL {snap.level}</span>
          </div>
          {snap.upgrades.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {snap.upgrades.map(u => (
                <div key={u.id} title={u.name} className="px-1.5 py-0.5 rounded bg-white/8 border border-white/10 text-[11px] flex items-center gap-1">
                  <span>{u.icon}</span><span className="text-white/60">{u.level}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => game.toggleAimMode()}
          className="pointer-events-auto self-start px-2.5 py-1 rounded-lg glass border border-cyan-400/30 hover:border-cyan-300 text-xs font-display tracking-wider flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105"
          title="Pressione [TAB] ou clique para alternar modo de mira"
        >
          <span className="text-[10px] text-white/50 font-mono">[TAB]</span>
          <span className={snap.aimMode === 'auto' ? 'text-cyan-300 neon font-bold' : 'text-amber-300 font-bold'}>
            MIRA: {snap.aimMode === 'auto' ? 'AUTOMÁTICA' : 'MANUAL'}
          </span>
        </button>
      </div>

      {/* topo centro: onda + chefe */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-[520px]">
        <div className="glass rounded-xl px-6 py-2 flex items-center gap-5 relative overflow-hidden">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/50">Onda</div>
            <div className="font-display font-black text-3xl leading-none neon" style={{ color: snap.wave % 5 === 0 ? '#ffd700' : '#fff' }}>{snap.wave}</div>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/50">Tempo</div>
            <div className="font-display text-xl leading-none text-cyan-200">{fmtTime(snap.time)}</div>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/50">Abates</div>
            <div className="font-display text-xl leading-none text-pink-300">{snap.kills}</div>
          </div>
          {!snap.boss && <div className="absolute left-0 bottom-0 h-[3px] bg-cyan-300/80" style={{ width: `${waveFrac * 100}%`, boxShadow: '0 0 8px #00e5ff' }} />}
        </div>
        {snap.boss && (
          <div className="glass rounded-xl px-4 py-2 w-full fade-in">
            <div className="flex items-center justify-between mb-1">
              <div className="font-display font-bold text-xs tracking-[0.3em] neon" style={{ color: snap.boss.phase ? '#ff30c0' : '#ffd700' }}>{snap.boss.name}</div>
              <div className="text-[11px] text-white/60 font-display">{snap.boss.phase ? `FASE ${snap.boss.phase}` : 'MINI-BOSS'} · {Math.ceil(snap.boss.hp)}</div>
            </div>
            <div className="bar h-3 relative">
              <div className="bar-fill" style={{ width: `${(snap.boss.hp / snap.boss.max) * 100}%`, background: snap.boss.phase ? 'linear-gradient(90deg,#ff30c0,#ffcf40)' : 'linear-gradient(90deg,#ffd700,#ff8020)', color: '#ff30c0' }} />
              {snap.boss.phase > 0 && <>
                <div className="absolute top-0 bottom-0 w-px bg-white/60" style={{ left: '60%' }} />
                <div className="absolute top-0 bottom-0 w-px bg-white/60" style={{ left: '30%' }} />
              </>}
            </div>
          </div>
        )}
      </div>

      {/* topo direita: recursos */}
      <div className="absolute top-5 right-5 glass rounded-xl px-4 py-3 flex flex-col gap-1 min-w-[170px]">
        <div className="flex items-center justify-between gap-6"><span className="text-white/50 text-xs uppercase tracking-widest">Moedas</span><span className="font-display text-yellow-300 neon">◉ {snap.coins}</span></div>
        <div className="flex items-center justify-between gap-6"><span className="text-white/50 text-xs uppercase tracking-widest">Shards</span><span className="font-display text-fuchsia-300 neon">◆ {snap.shards}</span></div>
        <div className="flex items-center justify-between gap-6"><span className="text-white/50 text-xs uppercase tracking-widest">DPS</span><span className="font-display font-bold text-cyan-300 neon">{Math.round(snap.dps)}</span></div>
        <div className="flex items-center justify-between gap-6 text-[11px] text-white/35"><span>FPS</span><span>{snap.fps}</span></div>
      </div>

      {/* avisos centrais */}
      {snap.crateAlert && (
        <div className="absolute top-[17%] left-1/2 -translate-x-1/2 pointer-events-none fade-in z-20">
          <div className="glass-strong border-2 border-yellow-400/90 rounded-2xl px-6 py-2.5 flex items-center gap-3 shadow-[0_0_35px_rgba(255,215,0,0.5)] animate-pulse">
            <span className="text-2xl">📦</span>
            <div className="text-center">
              <div className="font-display font-black text-sm text-yellow-300 neon tracking-widest">CÁPSULA SPACEX EM ÓRBITA!</div>
              <div className="text-[11px] text-white/80 uppercase tracking-wider">Suprimentos de Elon Musk na arena! Corra até o sinalizador!</div>
            </div>
            <span className="text-2xl">🚀</span>
          </div>
        </div>
      )}
      {snap.notice && (
        <div key={snap.notice.id} className="absolute top-[24%] left-1/2 -translate-x-1/2 text-center notice">
          <div className="font-display font-black text-4xl md:text-5xl neon tracking-[0.22em]" style={{ color: snap.notice.color ?? '#fff' }}>{snap.notice.text}</div>
          {snap.notice.sub && <div className="mt-2 text-lg tracking-[0.3em] uppercase text-white/75">{snap.notice.sub}</div>}
        </div>
      )}
      {snap.bossWarning && (
        <div className="absolute inset-x-0 top-[40%] text-center blink">
          <div className="font-display font-black text-6xl tracking-[0.4em] text-red-400 neon">⚠ ALERTA ⚠</div>
        </div>
      )}

      {/* baixo esquerda: armas secundárias + habilidades */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-3">
        {snap.activeWeapons && snap.activeWeapons.length > 0 && (
          <div className="flex gap-2 flex-wrap max-w-md">
            {snap.activeWeapons.map(w => (
              <div
                key={w.id}
                className={`glass px-2.5 py-1 rounded-lg flex items-center gap-1.5 border transition-all ${
                  w.evolved
                    ? 'border-yellow-400/90 shadow-[0_0_12px_rgba(255,215,0,0.4)] bg-yellow-500/15'
                    : 'border-white/15 bg-black/40'
                }`}
                title={`${w.name} ${w.evolved ? '(Evoluída)' : `(Nível ${w.level})`}`}
              >
                <span className="text-base leading-none">{w.icon}</span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-display font-bold text-white leading-tight">{w.name}</span>
                  <span className={`text-[9px] leading-tight font-display font-semibold ${w.evolved ? 'text-yellow-300' : 'text-cyan-300'}`}>
                    {w.evolved ? '👑 EVOLUÍDA' : `NV ${w.level}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-3">
          <div className="flex flex-col items-center gap-1">
            <div className={`slot ${dashFrac <= 0 ? 'pulse-glow' : ''}`} style={{ color: '#7fe9ff', borderColor: dashFrac <= 0 ? '#7fe9ff' : undefined }}>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl">➶</div>
                <div className="font-display text-[10px] tracking-widest text-white/80">DASH</div>
              </div>
              <div className="slot-fill" style={{ height: `${dashFrac * 100}%` }} />
            </div>
            <div className="text-[10px] font-display tracking-widest text-white/50">ESPAÇO</div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className={`slot w-[92px] h-[92px] ${ultFrac <= 0 && !snap.ultActive ? 'pulse-glow' : ''}`} style={{ color, borderColor: ultFrac <= 0 ? color : undefined }}>
              <div className="absolute inset-0 flex flex-col items-center justify-center px-1 text-center">
                <div className="text-3xl">
                  {snap.hero === 'big' ? '🍾' : snap.hero === 'otton' ? '💗' : snap.hero === 'thiago' ? '☣' : snap.hero === 'pietro' ? '☥' : snap.hero === 'carlinhos' ? '💛' : '📡'}
                </div>
                <div className="font-display text-[9px] tracking-wider text-white/85 leading-tight mt-1">{hero?.ult.toUpperCase()}</div>
                {ultFrac > 0 && <div className="font-display text-xs mt-0.5" style={{ color }}>{Math.ceil(snap.ultCd)}s</div>}
                {ultFrac <= 0 && !snap.ultActive && <div className="font-display text-[10px] mt-0.5 neon" style={{ color }}>PRONTA</div>}
              </div>
              <div className="slot-fill" style={{ height: `${ultFrac * 100}%` }} />
              {snap.ultActive && <div className="absolute inset-0 shimmer" />}
            </div>
            <div className="text-[10px] font-display tracking-widest text-white/50">Q · SUPREMA</div>
          </div>
        </div>
      </div>

      {/* dicas */}
      {snap.time < 14 && (
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 glass rounded-full px-5 py-2 text-xs tracking-[0.2em] uppercase text-white/70 fade-in">
          WASD mover · Mouse mirar · Espaço dash · Q suprema · P pausar
        </div>
      )}

      {/* radar */}
      <div className="absolute bottom-6 right-6 glass rounded-full p-1.5" style={{ boxShadow: `0 0 30px ${color}33` }}>
        <Radar game={game} color={color} />
      </div>
    </div>
  );
}
