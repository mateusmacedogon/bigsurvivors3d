
// ============================================================
// PART 5 — HUD, RENDERING, MAIN LOOP, GAME FLOW
// ============================================================

// --- HUD ---
function drawHUD(){
  if(!player)return;
  const p=player;const c=CHARACTERS[p.charIdx];
  // HP Bar
  const hbW=200,hbH=16,hbX=15,hbY=canvas.height-40;
  ctx.fillStyle=COLORS.healthBg;ctx.fillRect(hbX,hbY,hbW,hbH);
  const hpPct=clamp(p.hp/p.maxHp,0,1);
  const hpGrad=ctx.createLinearGradient(hbX,0,hbX+hbW,0);
  hpGrad.addColorStop(0,'#ff2244');hpGrad.addColorStop(1,'#ff6644');
  ctx.fillStyle=hpGrad;ctx.fillRect(hbX,hbY,hbW*hpPct,hbH);
  ctx.strokeStyle='#ff4466';ctx.lineWidth=1;ctx.strokeRect(hbX,hbY,hbW,hbH);
  ctx.font='bold 11px Rajdhani,sans-serif';ctx.textAlign='left';ctx.fillStyle='#fff';
  ctx.fillText(`HP: ${Math.ceil(p.hp)}/${p.maxHp}`,hbX+5,hbY+12);
  // Shield bar
  if(p.shieldMax>0){
    const sbY=hbY-12;
    ctx.fillStyle='rgba(30,30,80,.5)';ctx.fillRect(hbX,sbY,hbW,8);
    ctx.fillStyle=COLORS.shield;ctx.fillRect(hbX,sbY,hbW*(p.shieldHp/p.shieldMax),8);
  }
  // XP Bar
  const xbY=hbY-22-(p.shieldMax>0?12:0);
  ctx.fillStyle='rgba(30,30,60,.5)';ctx.fillRect(hbX,xbY,hbW,8);
  ctx.fillStyle='#44ff88';ctx.fillRect(hbX,xbY,hbW*(p.xp/p.xpToNext),8);
  ctx.font='10px Rajdhani,sans-serif';ctx.fillStyle='#88ffaa';
  ctx.fillText(`LV ${p.level}`,hbX+hbW+8,xbY+8);
  // Ultimate cooldown
  const ultX=hbX+hbW+30;const ultY=canvas.height-45;const ultR=18;
  const ultReady=p.ultTimer<=0&&!p.ultActive;
  ctx.beginPath();ctx.arc(ultX,ultY,ultR,0,TAU);
  ctx.fillStyle=ultReady?'rgba(255,136,0,.3)':'rgba(50,50,80,.3)';ctx.fill();
  if(!ultReady){
    const pct=1-p.ultTimer/(c.ultCooldown*p.ultCdMult);
    ctx.beginPath();ctx.moveTo(ultX,ultY);ctx.arc(ultX,ultY,ultR,-PI/2,-PI/2+TAU*pct);ctx.closePath();
    ctx.fillStyle='rgba(255,136,0,.5)';ctx.fill();
  }
  ctx.strokeStyle=ultReady?'#ffaa00':'#555';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(ultX,ultY,ultR,0,TAU);ctx.stroke();
  ctx.font='bold 12px Orbitron,sans-serif';ctx.textAlign='center';ctx.fillStyle=ultReady?'#ffaa00':'#666';
  ctx.fillText('Q',ultX,ultY+4);
  // Dash cooldown
  const dashReady=p.dashTimer<=0;
  ctx.font='10px Rajdhani,sans-serif';ctx.textAlign='left';
  ctx.fillStyle=dashReady?'#00eeff':'#555';
  ctx.fillText(`DASH: ${dashReady?'PRONTO':p.dashTimer.toFixed(1)+'s'}`,ultX+ultR+10,ultY+4);
  // Wave info
  ctx.font='bold 14px Orbitron,sans-serif';ctx.textAlign='center';
  ctx.fillStyle='#8888cc';
  ctx.fillText(`WAVE ${wave}`,canvas.width/2,25);
  ctx.font='11px Rajdhani,sans-serif';ctx.fillStyle='#666';
  ctx.fillText(`${enemies.length} inimigos | ${Math.ceil(runTimer)}s`,canvas.width/2,42);
  // Wave label
  if(waveLabelTimer>0){
    ctx.font='bold 20px Orbitron,sans-serif';ctx.textAlign='center';
    ctx.fillStyle=`rgba(255,221,0,${clamp(waveLabelTimer,0,1)})`;
    ctx.fillText(waveLabel,canvas.width/2,80);
  }
  // Stats top right
  ctx.font='11px Rajdhani,sans-serif';ctx.textAlign='right';ctx.fillStyle='#888';
  ctx.fillText(`Kills: ${runStats.kills}`,canvas.width-15,25);
  ctx.fillText(`Shards: ${meta.shards}`,canvas.width-15,40);
  // Crosshair
  ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(mouseX,mouseY,8,0,TAU);ctx.stroke();
  ctx.beginPath();ctx.moveTo(mouseX-12,mouseY);ctx.lineTo(mouseX+12,mouseY);ctx.stroke();
  ctx.beginPath();ctx.moveTo(mouseX,mouseY-12);ctx.lineTo(mouseX,mouseY+12);ctx.stroke();
}

// --- WORLD RENDERING ---
function drawWorld(){
  // Background
  ctx.fillStyle=COLORS.bg;ctx.fillRect(0,0,canvas.width,canvas.height);
  // Grid
  const gridSize=80;
  ctx.strokeStyle=COLORS.grid;ctx.lineWidth=0.5;
  const startX=-(camera.x%gridSize);const startY=-(camera.y%gridSize);
  for(let x=startX;x<canvas.width;x+=gridSize){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke()}
  for(let y=startY;y<canvas.height;y+=gridSize){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke()}
  // World border warning
  if(player){
    const margin=100;
    if(player.x<margin||player.x>WORLD_W-margin||player.y<margin||player.y>WORLD_H-margin){
      ctx.fillStyle='rgba(255,0,0,.05)';ctx.fillRect(0,0,canvas.width,canvas.height);
    }
  }
}

// --- GAME FLOW ---
function startGame(){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  gameState='playing';
  player=createPlayer(selectedChar);
  enemies=[];projectiles=[];enemyProjectiles=[];particles=[];drops=[];mines=[];traps=[];dmgNumbers=[];ultEffects=[];
  wave=0;waveTimer=0;bossSpawned=false;bossDefeated=false;boss=null;
  runTimer=0;
  runStats={kills:0,damageDealt:0,xpCollected:0,wavesCleared:0,coinsCollected:0,shardsEarned:0};
  startWave();
}

function gameOver(){
  gameState='gameover';
  showScreen('gameover-screen');
  // Award shards based on performance
  const earnedShards=Math.floor(runStats.kills/5)+wave;
  meta.shards+=earnedShards;saveMeta();
  const statsDiv=document.getElementById('gameover-stats');
  statsDiv.innerHTML=`
    <div>Wave alcançada: <b>${wave}</b></div>
    <div>Kills: <b>${runStats.kills}</b></div>
    <div>Tempo: <b>${Math.floor(runTimer)}s</b></div>
    <div>Level: <b>${player?player.level:1}</b></div>
    <div style="color:#ffaa00;margin-top:8px">+${earnedShards} Shards ganhos!</div>`;
}

function victory(){
  gameState='victory';
  showScreen('victory-screen');
  const earnedShards=Math.floor(runStats.kills/3)+wave*2+20;
  meta.shards+=earnedShards;saveMeta();
  const statsDiv=document.getElementById('victory-stats');
  statsDiv.innerHTML=`
    <div>Waves: <b>${wave}</b></div>
    <div>Kills: <b>${runStats.kills}</b></div>
    <div>Tempo: <b>${Math.floor(runTimer)}s</b></div>
    <div>Level: <b>${player?player.level:1}</b></div>
    <div style="color:#ffaa00;margin-top:8px">+${earnedShards} Shards ganhos!</div>
    <div style="color:#00ff80;margin-top:5px">Carlinhos e Macedo foram salvos!</div>`;
}

// --- MAIN GAME LOOP ---
function gameLoop(timestamp){
  requestAnimationFrame(gameLoop);
  if(!lastTime)lastTime=timestamp;
  deltaTime=Math.min((timestamp-lastTime)/1000,0.05);
  lastTime=timestamp;
  if(gameState==='playing'){
    gameTime+=deltaTime;
    runTimer+=deltaTime;
    updateCamera();
    updatePlayer(deltaTime);
    updateEnemies(deltaTime);
    updateProjectiles(deltaTime);
    updateDrops(deltaTime);
    updateParticles(deltaTime);
    updateDmgNumbers(deltaTime);
    updateWaves(deltaTime);
    updateUltEffects(deltaTime);
    if(boss)updateBoss(deltaTime);
    // Render
    drawWorld();
    drawDrops();
    drawEnemies();
    drawProjectiles();
    drawPlayer();
    drawDrones(player);
    if(boss)drawBoss();
    drawParticles();
    drawDmgNumbers();
    drawUltEffects();
    drawHUD();
  }else if(gameState==='paused'){
    drawWorld();drawDrops();drawEnemies();drawProjectiles();drawPlayer();drawDrones(player);
    if(boss)drawBoss();drawParticles();drawDmgNumbers();drawHUD();
  }else if(gameState==='levelup'){
    // Still draw game behind
    updateCamera();
    drawWorld();drawDrops();drawEnemies();drawProjectiles();drawPlayer();drawDrones(player);
    if(boss)drawBoss();drawParticles();drawDmgNumbers();drawHUD();
    ctx.fillStyle='rgba(0,0,20,.4)';ctx.fillRect(0,0,canvas.width,canvas.height);
  }else{
    // Title/other screens — animate bg
    ctx.fillStyle=COLORS.bg;ctx.fillRect(0,0,canvas.width,canvas.height);
    gameTime+=deltaTime;
    // Animated stars
    ctx.fillStyle='#222244';
    for(let i=0;i<50;i++){
      const sx=(Math.sin(i*17.3+gameTime*0.3)*0.5+0.5)*canvas.width;
      const sy=(Math.cos(i*23.7+gameTime*0.2)*0.5+0.5)*canvas.height;
      ctx.beginPath();ctx.arc(sx,sy,1+Math.sin(gameTime+i)*0.5,0,TAU);ctx.fill();
    }
  }
}

// --- START ---
canvas.style.cursor='none';
requestAnimationFrame(gameLoop);

// ============================================================
// OPTIONAL PNG FILES (for external sprites):
// ============================================================
// Player ships: big.png, otton.png, thiago.png, pietro.png
// Enemies: farmaura_normal.png, farmaura_runner.png, farmaura_tank.png,
//   farmaura_shooter.png, farmaura_sniper.png, farmaura_shotgunner.png,
//   farmaura_orbiter.png, farmaura_mortar.png, farmaura_beam.png,
//   farmaura_summoner.png, farmaura_mine.png, farmaura_boss.png
// Weapons: arma_big_pistola_anti_aura.png, arma_otton_karate.png,
//   arma_thiago_garrafa_lancadora.png, arma_pietro_fala_incomoda.png
</script>
</body>
</html>
