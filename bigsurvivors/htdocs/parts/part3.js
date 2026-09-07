
// ============================================================
// PART 3 — ENEMIES, WAVES, BOSS, DROPS/LOOT, XP
// ============================================================

// --- ENEMY DEFINITIONS ---
let enemies = [];
let enemyUidCounter = 0;

const ENEMY_TYPES = {
  normal: { name: 'Normal', hp: 25, speed: 1.5, size: 12, color: '#ff4444', xpValue: 5, dmg: 8, behavior: 'chase' },
  runner: { name: 'Runner', hp: 15, speed: 3.5, size: 10, color: '#ff8844', xpValue: 7, dmg: 6, behavior: 'chase', dashChance: 0.02 },
  tank: { name: 'Tank', hp: 120, speed: 0.8, size: 20, color: '#aa2222', xpValue: 15, dmg: 15, behavior: 'chase' },
  shooter: { name: 'Shooter', hp: 30, speed: 1.2, size: 13, color: '#ff6688', xpValue: 10, dmg: 5, behavior: 'keepDist', keepDist: 200, fireRate: 1.5, projSpeed: 5, fireTimer: 0 },
  sniper: { name: 'Sniper', hp: 20, speed: 0.9, size: 11, color: '#ff44aa', xpValue: 12, dmg: 18, behavior: 'keepDist', keepDist: 350, fireRate: 2.5, projSpeed: 10, fireTimer: 0, warnTime: 0.8 },
  shotgunner: { name: 'Shotgunner', hp: 35, speed: 1.3, size: 14, color: '#ff4466', xpValue: 12, dmg: 4, behavior: 'keepDist', keepDist: 150, fireRate: 2, projSpeed: 5, fireTimer: 0, shotCount: 5, shotSpread: 0.5 },
  orbiter: { name: 'Orbiter', hp: 25, speed: 2, size: 11, color: '#ff88ff', xpValue: 10, dmg: 10, behavior: 'orbit', orbitDist: 120, orbitSpeed: 2, chargeTimer: 0, charging: false },
  mortar: { name: 'Mortar', hp: 30, speed: 1, size: 14, color: '#ffaa44', xpValue: 12, dmg: 20, behavior: 'keepDist', keepDist: 250, fireRate: 3, fireTimer: 0 },
  beam: { name: 'Beam', hp: 25, speed: 1, size: 12, color: '#ff44ff', xpValue: 12, dmg: 2, behavior: 'keepDist', keepDist: 200, fireRate: 4, fireTimer: 0, beamDur: 1 },
  summoner: { name: 'Summoner', hp: 50, speed: 0.8, size: 15, color: '#ff8888', xpValue: 20, dmg: 5, behavior: 'keepDist', keepDist: 300, fireRate: 5, fireTimer: 0 },
  mine: { name: 'Mine Layer', hp: 20, speed: 1.8, size: 10, color: '#ffcc44', xpValue: 10, dmg: 0, behavior: 'chase', mineTimer: 0, mineRate: 3 },
  kamikaze: { name: 'Kamikaze', hp: 15, speed: 3, size: 10, color: '#ff2200', xpValue: 8, dmg: 30, behavior: 'chase', explodeRange: 25 },
  healer: { name: 'Healer', hp: 30, speed: 1.2, size: 13, color: '#44ff88', xpValue: 15, dmg: 3, behavior: 'support', healRate: 2, healTimer: 0, healAmount: 10, healRange: 150 },
  shielder: { name: 'Shield Support', hp: 35, speed: 1, size: 14, color: '#4488ff', xpValue: 15, dmg: 3, behavior: 'support', shieldRate: 4, shieldTimer: 0, shieldAmount: 15, shieldRange: 150 },
  slower: { name: 'Slower', hp: 25, speed: 1.5, size: 12, color: '#88aaff', xpValue: 10, dmg: 5, behavior: 'chase', slowAura: true, slowRange: 100 },
  elite: { name: 'Elite', hp: 80, speed: 1.8, size: 16, color: '#ffdd00', xpValue: 30, dmg: 12, behavior: 'chase', shieldRegen: true, shieldHp: 30, shieldMax: 30 },
  trapper: { name: 'Trapper', hp: 25, speed: 1.3, size: 12, color: '#aa8844', xpValue: 12, dmg: 5, behavior: 'keepDist', keepDist: 200, trapRate: 4, trapTimer: 0 },
  miniboss: { name: 'Mini Boss', hp: 200, speed: 1.5, size: 24, color: '#ff00ff', xpValue: 50, dmg: 18, behavior: 'chase', fireRate: 2, fireTimer: 0, projSpeed: 5 }
};

function spawnEnemy(type, x, y, scaleMult = 1) {
  const def = ENEMY_TYPES[type]; if (!def) return;
  const e = {
    ...structuredClone(def),
    type, uid: ++enemyUidCounter,
    x: x || 0, y: y || 0,
    maxHp: def.hp * scaleMult, hp: def.hp * scaleMult,
    hitFlash: 0, dead: false,
    burning: false, burnTimer: 0, burnDmg: 0,
    slowed: false, slowTimer: 0,
    angle: 0,
    _pietroHitTimer: 0,
    // type-specific timers
    fireTimer: def.fireTimer || rand(0, def.fireRate || 5),
    mineTimer: def.mineTimer || 0,
    healTimer: def.healTimer || 0,
    shieldTimer: def.shieldTimer || 0,
    trapTimer: def.trapTimer || 0,
    chargeTimer: def.chargeTimer || 0,
    charging: def.charging || false,
    orbitAngle: rand(0, TAU),
    beamActive: false, beamTimer: 0, beamAngle: 0,
    warnTimer: 0, warned: false
  };
  if (!x) {
    // Spawn outside screen
    const side = randInt(0, 3);
    const margin = 60;
    if (side === 0) { e.x = camera.x - margin; e.y = rand(camera.y, camera.y + canvas.height) }
    else if (side === 1) { e.x = camera.x + canvas.width + margin; e.y = rand(camera.y, camera.y + canvas.height) }
    else if (side === 2) { e.y = camera.y - margin; e.x = rand(camera.x, camera.x + canvas.width) }
    else { e.y = camera.y + canvas.height + margin; e.x = rand(camera.x, camera.x + canvas.width) }
  }
  enemies.push(e);
  return e;
}

// --- MINES & TRAPS ---
let mines = [];
let traps = [];

// --- ENEMY UPDATE ---
function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead) { enemies.splice(i, 1); continue }
    if (e.hitFlash > 0) e.hitFlash -= dt;
    // Burning
    if (e.burning) {
      e.burnTimer -= dt;
      if (e.burnTimer <= 0) { e.burning = false }
      else { e.hp -= e.burnDmg * dt; if (e.hp <= 0) { killEnemy(e, player); continue } }
    }
    // Slow
    if (e.slowed) { e.slowTimer -= dt; if (e.slowTimer <= 0) e.slowed = false }
    const spd = e.speed * (e.slowed ? 0.5 : 1);
    // Shield regen (elite)
    if (e.shieldRegen && e.shieldHp !== undefined) {
      e.shieldHp = Math.min(e.shieldMax, e.shieldHp + 5 * dt);
    }
    if (!player) { continue }
    const d = dist(e, player);
    e.angle = angle(e, player);
    // Behavior
    switch (e.behavior) {
      case 'chase': {
        e.x += Math.cos(e.angle) * spd; e.y += Math.sin(e.angle) * spd;
        // Runner dash
        if (e.dashChance && chance(e.dashChance) && d < 150) {
          e.x += Math.cos(e.angle) * 15; e.y += Math.sin(e.angle) * 15;
        }
        // Contact damage
        if (d < e.size + player.size) damagePlayer(e.dmg);
        // Kamikaze
        if (e.explodeRange && d < e.explodeRange + player.size) {
          damagePlayer(e.dmg);
          spawnExplosion(e.x, e.y, '#ff4400', 20, 6, 8);
          screenShake(8, 0.2);
          e.hp = 0; killEnemy(e, null); continue;
        }
        // Mine layer
        if (e.mineRate) {
          e.mineTimer -= dt;
          if (e.mineTimer <= 0) {
            e.mineTimer = e.mineRate;
            mines.push({ x: e.x, y: e.y, size: 8, dmg: 15, life: 10, armTimer: 0.5, color: '#ffcc44' });
          }
        }
        // Slow aura
        if (e.slowAura && d < e.slowRange) {
          // Applied in player update as needed
        }
        break;
      }
      case 'keepDist': {
        if (d > e.keepDist + 30) {
          e.x += Math.cos(e.angle) * spd; e.y += Math.sin(e.angle) * spd;
        } else if (d < e.keepDist - 30) {
          e.x -= Math.cos(e.angle) * spd; e.y -= Math.sin(e.angle) * spd;
        }
        // Shooting
        if (e.fireRate) {
          e.fireTimer -= dt;
          if (e.fireTimer <= 0) {
            e.fireTimer = e.fireRate;
            if (e.type === 'sniper') {
              e.warned = true; e.warnTimer = e.warnTime;
            } else if (e.type === 'shotgunner') {
              for (let s = 0; s < (e.shotCount || 5); s++) {
                const a = e.angle + (s - (e.shotCount - 1) / 2) * (e.shotSpread / (e.shotCount - 1));
                enemyProjectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * e.projSpeed, vy: Math.sin(a) * e.projSpeed, size: 4, dmg: e.dmg, life: 1, color: '#ff6666' });
              }
            } else if (e.type === 'mortar') {
              // Drop mortar at player pos
              const tx = player.x + rand(-30, 30), ty = player.y + rand(-30, 30);
              ultEffects.push({ type: 'mortarWarn', x: tx, y: ty, timer: 1, maxTimer: 1, radius: 50, dmg: e.dmg });
              setTimeout(() => {
                spawnExplosion(tx, ty, '#ff8800', 15, 5, 6);
                if (player && dist({ x: tx, y: ty }, player) < 50) damagePlayer(e.dmg);
              }, 1000);
            } else if (e.type === 'beam') {
              e.beamActive = true; e.beamTimer = e.beamDur || 1; e.beamAngle = e.angle;
            } else if (e.type === 'summoner') {
              // Summon 2-3 normals
              for (let s = 0; s < randInt(2, 3); s++) {
                spawnEnemy('normal', e.x + rand(-30, 30), e.y + rand(-30, 30));
              }
              spawnExplosion(e.x, e.y, '#ff8888', 8, 3, 4);
            } else if (e.type === 'miniboss') {
              // Shoot spread
              for (let s = 0; s < 8; s++) {
                const a = TAU * s / 8;
                enemyProjectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * e.projSpeed, vy: Math.sin(a) * e.projSpeed, size: 5, dmg: e.dmg * .5, life: 1.5, color: '#ff88ff' });
              }
            } else {
              // Normal shot
              enemyProjectiles.push({ x: e.x, y: e.y, vx: Math.cos(e.angle) * e.projSpeed, vy: Math.sin(e.angle) * e.projSpeed, size: 4, dmg: e.dmg, life: 2, color: '#ff6666' });
            }
          }
        }
        // Sniper warn then shoot
        if (e.warned) {
          e.warnTimer -= dt;
          if (e.warnTimer <= 0) {
            e.warned = false;
            const a = angle(e, player);
            enemyProjectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * e.projSpeed, vy: Math.sin(a) * e.projSpeed, size: 5, dmg: e.dmg, life: 2.5, color: '#ff44aa' });
          }
        }
        // Beam
        if (e.beamActive) {
          e.beamTimer -= dt;
          if (e.beamTimer <= 0) e.beamActive = false;
          // Damage player if in beam
          const beamLen = 300;
          const toPlayer = angle(e, player);
          let angleDiff = toPlayer - e.beamAngle;
          while (angleDiff > PI) angleDiff -= TAU; while (angleDiff < -PI) angleDiff += TAU;
          if (Math.abs(angleDiff) < 0.15 && d < beamLen) damagePlayer(e.dmg * dt);
        }
        // Trapper
        if (e.trapRate) {
          e.trapTimer -= dt;
          if (e.trapTimer <= 0) {
            e.trapTimer = e.trapRate;
            traps.push({ x: player.x + rand(-50, 50), y: player.y + rand(-50, 50), size: 40, life: 6, dmg: 5, color: 'rgba(170,136,68,.3)', slowDur: 2 });
          }
        }
        if (d < e.size + player.size) damagePlayer(e.dmg * .5);
        break;
      }
      case 'orbit': {
        e.orbitAngle += e.orbitSpeed * dt;
        const targetX = player.x + Math.cos(e.orbitAngle) * e.orbitDist;
        const targetY = player.y + Math.sin(e.orbitAngle) * e.orbitDist;
        e.x = lerp(e.x, targetX, 0.05); e.y = lerp(e.y, targetY, 0.05);
        // Occasionally charge
        if (!e.charging) {
          e.chargeTimer -= dt;
          if (e.chargeTimer <= 0) { e.charging = true; e.chargeTimer = 0.3 }
        } else {
          e.x += Math.cos(angle(e, player)) * 8;
          e.y += Math.sin(angle(e, player)) * 8;
          e.chargeTimer -= dt;
          if (e.chargeTimer <= 0) { e.charging = false; e.chargeTimer = rand(2, 4) }
        }
        if (d < e.size + player.size) damagePlayer(e.dmg);
        break;
      }
      case 'support': {
        // Stay near other enemies, heal/shield them
        const nearbyEnemies = enemies.filter(e2 => e2 !== e && !e2.dead && dist(e, e2) < 200);
        if (nearbyEnemies.length > 0) {
          const target = nearbyEnemies[0];
          const aToTarget = angle(e, target);
          if (dist(e, target) > 60) { e.x += Math.cos(aToTarget) * spd; e.y += Math.sin(aToTarget) * spd }
        } else {
          // Move toward player but not too close
          if (d > 250) { e.x += Math.cos(e.angle) * spd; e.y += Math.sin(e.angle) * spd }
          else if (d < 150) { e.x -= Math.cos(e.angle) * spd; e.y -= Math.sin(e.angle) * spd }
        }
        // Heal nearby
        if (e.healRate) {
          e.healTimer -= dt;
          if (e.healTimer <= 0) {
            e.healTimer = e.healRate;
            enemies.forEach(e2 => {
              if (e2 !== e && !e2.dead && dist(e, e2) < (e.healRange || 150)) {
                e2.hp = Math.min(e2.maxHp, e2.hp + (e.healAmount || 10));
                spawnParticle(e2.x, e2.y, { color: '#44ff88', size: 5, life: 0.4, glow: true, vx: 0, vy: -1 });
              }
            });
          }
        }
        // Shield nearby
        if (e.shieldRate) {
          e.shieldTimer -= dt;
          if (e.shieldTimer <= 0) {
            e.shieldTimer = e.shieldRate;
            enemies.forEach(e2 => {
              if (e2 !== e && !e2.dead && dist(e, e2) < (e.shieldRange || 150)) {
                e2.hp += e.shieldAmount || 15;
                spawnParticle(e2.x, e2.y, { color: '#4488ff', size: 5, life: 0.4, glow: true, vx: 0, vy: -1 });
              }
            });
          }
        }
        if (d < e.size + player.size) damagePlayer(e.dmg);
        break;
      }
    }
    // Keep in world
    e.x = clamp(e.x, e.size, WORLD_W - e.size);
    e.y = clamp(e.y, e.size, WORLD_H - e.size);
  }
  // Slow aura effect on player
  if (player) {
    const hasSlowNear = enemies.some(e => e.slowAura && !e.dead && dist(e, player) < (e.slowRange || 100));
    if (hasSlowNear) player.speed = CHARACTERS[player.charIdx].baseSpeed * 0.6;
    else if (!player.dashing) player.speed = CHARACTERS[player.charIdx].baseSpeed * (1 + meta.upgrades.speed * 0.03);
  }
  // Update mines
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i];
    m.life -= dt; m.armTimer -= dt;
    if (m.life <= 0) { mines.splice(i, 1); continue }
    if (m.armTimer <= 0 && player && dist(m, player) < m.size + player.size) {
      damagePlayer(m.dmg); spawnExplosion(m.x, m.y, '#ffcc44', 10, 4, 5); screenShake(4, 0.1); mines.splice(i, 1);
    }
  }
  // Update traps
  for (let i = traps.length - 1; i >= 0; i--) {
    const t = traps[i]; t.life -= dt;
    if (t.life <= 0) { traps.splice(i, 1); continue }
    if (player && dist(t, player) < t.size) {
      if (!player.slowed) { player.slowed = true; player.slowTimer = t.slowDur }
      // Small damage
      if (chance(0.02)) damagePlayer(t.dmg);
    }
  }
}

// --- DRAW ENEMIES ---
function drawEnemies() {
  for (const e of enemies) {
    if (e.dead) continue;
    const s = worldToScreen(e.x, e.y);
    ctx.save();
    // Glow
    ctx.shadowColor = e.color; ctx.shadowBlur = 8;
    // Hit flash
    if (e.hitFlash > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 15 }
    // Sprite or fallback
    const spriteKey = 'farmaura_' + e.type;
    if (sprites[spriteKey]) {
      drawSprite(spriteKey, e.x, e.y, e.size * 2.5, e.size * 2.5, e.angle);
    } else {
      // Fallback drawing based on type
      ctx.fillStyle = e.hitFlash > 0 ? '#fff' : e.color;
      if (e.type === 'tank') {
        ctx.fillRect(s.x - e.size, s.y - e.size, e.size * 2, e.size * 2);
        ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.strokeRect(s.x - e.size, s.y - e.size, e.size * 2, e.size * 2);
      } else if (e.type === 'runner') {
        ctx.beginPath(); ctx.moveTo(s.x + e.size, s.y); ctx.lineTo(s.x - e.size, s.y - e.size * .7); ctx.lineTo(s.x - e.size, s.y + e.size * .7); ctx.closePath(); ctx.fill();
      } else if (e.type === 'elite' || e.type === 'miniboss') {
        ctx.beginPath(); ctx.moveTo(s.x, s.y - e.size); ctx.lineTo(s.x + e.size, s.y); ctx.lineTo(s.x, s.y + e.size); ctx.lineTo(s.x - e.size, s.y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.stroke();
        // Shield
        if (e.shieldHp > 0) {
          ctx.strokeStyle = 'rgba(255,221,0,.5)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(s.x, s.y, e.size + 5, 0, TAU); ctx.stroke();
        }
      } else if (e.type === 'healer') {
        ctx.beginPath(); ctx.arc(s.x, s.y, e.size, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(s.x - 2, s.y - e.size * .6, 4, e.size * 1.2); ctx.fillRect(s.x - e.size * .6, s.y - 2, e.size * 1.2, 4);
      } else if (e.type === 'summoner') {
        ctx.beginPath(); ctx.arc(s.x, s.y, e.size, 0, TAU); ctx.fill();
        // inner ring
        ctx.strokeStyle = '#ffbbbb'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(s.x, s.y, e.size * 1.3, 0, TAU); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(s.x, s.y, e.size, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
    // Burning indicator
    if (e.burning) {
      for (let f = 0; f < 2; f++) {
        spawnParticle(e.x + rand(-e.size, e.size), e.y + rand(-e.size, e.size), { color: '#ff8800', size: 3, life: 0.2, vy: -2, glow: true });
      }
    }
    // Sniper warn line
    if (e.warned && player) {
      ctx.save(); ctx.strokeStyle = 'rgba(255,68,170,.5)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      const ps = worldToScreen(player.x, player.y);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(ps.x, ps.y); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
    // Beam
    if (e.beamActive) {
      const beamLen = 300;
      ctx.save(); ctx.strokeStyle = 'rgba(255,68,255,.6)'; ctx.lineWidth = 6; ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.cos(e.beamAngle) * beamLen, s.y + Math.sin(e.beamAngle) * beamLen); ctx.stroke();
      ctx.restore();
    }
    // HP bar for tough enemies
    if (e.maxHp > 40 && e.hp < e.maxHp) {
      const barW = e.size * 2; const barH = 3;
      ctx.fillStyle = '#330000'; ctx.fillRect(s.x - barW / 2, s.y - e.size - 8, barW, barH);
      ctx.fillStyle = e.color; ctx.fillRect(s.x - barW / 2, s.y - e.size - 8, barW * (e.hp / e.maxHp), barH);
    }
  }
  // Draw mines
  for (const m of mines) {
    const s = worldToScreen(m.x, m.y);
    ctx.fillStyle = m.armTimer > 0 ? 'rgba(255,204,68,.3)' : '#ffcc44';
    ctx.beginPath(); ctx.arc(s.x, s.y, m.size, 0, TAU); ctx.fill();
    if (m.armTimer <= 0) { ctx.shadowColor = '#ffcc44'; ctx.shadowBlur = 5; ctx.beginPath(); ctx.arc(s.x, s.y, m.size * .5, 0, TAU); ctx.fill(); ctx.shadowBlur = 0 }
  }
  // Draw traps
  for (const t of traps) {
    const s = worldToScreen(t.x, t.y);
    ctx.fillStyle = t.color; ctx.fillRect(s.x - t.size, s.y - t.size, t.size * 2, t.size * 2);
  }
}

// --- DROPS & LOOT ---
let drops = [];
function updateDrops(dt) {
  if (!player) return;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.life -= dt;
    if (d.life <= 0) { drops.splice(i, 1); continue }
    // Magnet
    const dd = dist(d, player);
    if (dd < player.magnetRadius) {
      const a = angle(d, player);
      const pullSpeed = 6 * (1 - dd / player.magnetRadius) + 2;
      d.x += Math.cos(a) * pullSpeed; d.y += Math.sin(a) * pullSpeed;
    }
    // Collection
    if (dd < player.size + 8) {
      switch (d.type) {
        case 'xp':
          player.xp += d.value * player.xpMult;
          runStats.xpCollected += d.value;
          while (player.xp >= player.xpToNext) {
            player.xp -= player.xpToNext;
            player.level++;
            player.xpToNext = Math.floor(20 + player.level * 8 + player.level * player.level * 0.5);
            triggerLevelUp();
          }
          break;
        case 'coin': runStats.coinsCollected += d.value; break;
        case 'shard': meta.shards += d.value; runStats.shardsEarned += d.value; saveMeta(); break;
        case 'health': player.hp = Math.min(player.maxHp, player.hp + d.value); break;
      }
      drops.splice(i, 1);
    }
  }
}
function drawDrops() {
  for (const d of drops) {
    const s = worldToScreen(d.x, d.y);
    ctx.save();
    const pulse = 1 + 0.15 * Math.sin(gameTime * 6);
    switch (d.type) {
      case 'xp':
        ctx.shadowColor = COLORS.xp; ctx.shadowBlur = 8;
        ctx.fillStyle = COLORS.xp; ctx.beginPath(); ctx.arc(s.x, s.y, d.size * pulse, 0, TAU); ctx.fill(); break;
      case 'coin':
        ctx.shadowColor = COLORS.coin; ctx.shadowBlur = 8;
        ctx.fillStyle = COLORS.coin; ctx.beginPath(); ctx.arc(s.x, s.y, d.size * pulse, 0, TAU); ctx.fill(); break;
      case 'shard':
        ctx.shadowColor = COLORS.shard; ctx.shadowBlur = 10;
        ctx.fillStyle = COLORS.shard;
        ctx.beginPath(); ctx.moveTo(s.x, s.y - d.size * pulse); ctx.lineTo(s.x + d.size * .6, s.y); ctx.lineTo(s.x, s.y + d.size * pulse); ctx.lineTo(s.x - d.size * .6, s.y); ctx.closePath(); ctx.fill(); break;
      case 'health':
        ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 8;
        ctx.fillStyle = '#ff4444'; ctx.fillRect(s.x - 2, s.y - d.size, 4, d.size * 2); ctx.fillRect(s.x - d.size, s.y - 2, d.size * 2, 4); break;
    }
    ctx.restore();
  }
}

// --- WAVE SYSTEM ---
const WAVE_COMPOSITIONS = [
  { types: ['normal'], counts: [8], label: 'Farm\'auras Avançam!' },
  { types: ['normal', 'runner'], counts: [6, 4], label: 'Patrulha Rápida!' },
  { types: ['normal', 'shooter'], counts: [6, 3], label: 'Atiradores Inimigos!' },
  { types: ['normal', 'tank'], counts: [5, 2], label: 'Tanques Pesados!' },
  { types: ['runner', 'shotgunner'], counts: [5, 3], label: 'Emboscada!' },
  { types: ['normal', 'sniper', 'runner'], counts: [4, 2, 3], label: 'Snipers na Área!' },
  { types: ['orbiter', 'normal'], counts: [4, 5], label: 'Orbitadores!' },
  { types: ['mortar', 'shooter', 'normal'], counts: [2, 3, 5], label: 'Bombardeio!' },
  { types: ['summoner', 'normal', 'runner'], counts: [1, 4, 3], label: 'Invocadores!' },
  { types: ['mine', 'runner', 'normal'], counts: [3, 3, 4], label: 'Campo Minado!' },
  { types: ['healer', 'tank', 'normal'], counts: [2, 2, 4], label: 'Pelotão de Cura!' },
  { types: ['shielder', 'elite', 'normal'], counts: [1, 2, 5], label: 'Elites Blindados!' },
  { types: ['kamikaze', 'runner'], counts: [6, 4], label: 'Onda Suicida!' },
  { types: ['beam', 'sniper', 'shooter'], counts: [2, 2, 3], label: 'Feixes Mortais!' },
  { types: ['slower', 'tank', 'normal'], counts: [3, 2, 4], label: 'Zona Lenta!' },
  { types: ['trapper', 'shooter', 'normal'], counts: [2, 3, 4], label: 'Armadilhas!' },
  { types: ['elite', 'kamikaze', 'runner'], counts: [3, 4, 3], label: 'Ataque Total!' },
  { types: ['summoner', 'healer', 'shielder'], counts: [2, 2, 1], label: 'Comando Inimigo!' },
  { types: ['miniboss'], counts: [1], label: '⚠ MINI BOSS!' },
];

let waveLabel = ''; let waveLabelTimer = 0;
let spawningEnemies = 0;

function startWave() {
  wave++;
  waveTimer = waveDuration;
  // Boss wave
  if (wave === 20 && !bossSpawned) {
    spawnBoss();
    waveLabel = '⚠ BOSS: FARMADOR DE AURA ⚠';
    waveLabelTimer = 4;
    return;
  }
  // Scale difficulty
  const scaleMult = 1 + wave * 0.12;
  const compIdx = wave <= WAVE_COMPOSITIONS.length ? wave - 1 : (wave - 1) % WAVE_COMPOSITIONS.length;
  const comp = WAVE_COMPOSITIONS[Math.min(compIdx, WAVE_COMPOSITIONS.length - 1)];
  waveLabel = `Wave ${wave}: ${comp.label}`;
  waveLabelTimer = 3;
  const extraCount = Math.floor(wave / 3);
  comp.types.forEach((type, idx) => {
    const count = comp.counts[idx] + extraCount;
    for (let c = 0; c < count; c++) {
      spawningEnemies++;
      setTimeout(() => { 
        spawnEnemy(type, 0, 0, scaleMult); 
        spawningEnemies--; 
      }, c * 300 + idx * 200);
    }
  });
  // Random elite after wave 5
  if (wave > 5 && chance(0.3)) {
    spawningEnemies++;
    setTimeout(() => { spawnEnemy('elite', 0, 0, scaleMult); spawningEnemies--; }, 2000);
  }
  // Mini boss every 5 waves
  if (wave % 5 === 0 && wave < 20) {
    spawningEnemies++;
    setTimeout(() => { spawnEnemy('miniboss', 0, 0, scaleMult); spawningEnemies--; }, 3000);
  }
}

function updateWaves(dt) {
  if (bossSpawned && !bossDefeated) return; // Don't advance during boss
  waveTimer -= dt;
  if (waveLabelTimer > 0) waveLabelTimer -= dt;
  if (enemies.length === 0 && spawningEnemies === 0 && !waveTransition) {
    if (wave >= 20 && bossDefeated) { victory(); return; }
    waveTransition = true; waveTransTimer = 2; // Reduced wait time to 2 seconds for faster pacing
  }
  if (waveTransition) {
    waveTransTimer -= dt;
    if (waveTransTimer <= 0) { waveTransition = false; startWave() }
  }
}

