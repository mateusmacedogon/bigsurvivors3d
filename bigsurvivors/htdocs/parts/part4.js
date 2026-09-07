
// ============================================================
// PART 4 — BOSS, UPGRADES, LEVEL UP
// ============================================================

// --- BOSS: FARMADOR DE AURA ---
let boss=null;
function spawnBoss(){
  bossSpawned=true;
  boss={
    x:WORLD_W/2,y:WORLD_H/2-300,
    hp:2000,maxHp:2000,
    size:40,color:'#ff00aa',
    phase:1,phaseThresholds:[0.6,0.3],
    attackTimer:2,attackCycle:0,
    speed:1.5,angle:0,
    invincible:false,phaseTransition:false,phaseTimer:0,
    hitFlash:0,dead:false,uid:++enemyUidCounter,
    summonTimer:8,
    spinAttackAngle:0,spinAttacking:false,spinTimer:0,
    specialTimer:5
  };
}
function updateBoss(dt){
  if(!boss||boss.dead||!player)return;
  boss.hitFlash=Math.max(0,boss.hitFlash-dt);
  const d=dist(boss,player);
  boss.angle=angle(boss,player);
  // Phase check
  const hpPct=boss.hp/boss.maxHp;
  if(boss.phase===1&&hpPct<=boss.phaseThresholds[0]){
    boss.phase=2;boss.phaseTransition=true;boss.phaseTimer=2;boss.invincible=true;
    waveLabel='⚠ FASE 2 — MAIS AGRESSIVO!';waveLabelTimer=3;
    spawnExplosion(boss.x,boss.y,'#ff00aa',30,8,8);screenShake(10,0.5);
  }
  if(boss.phase===2&&hpPct<=boss.phaseThresholds[1]){
    boss.phase=3;boss.phaseTransition=true;boss.phaseTimer=2;boss.invincible=true;
    waveLabel='⚠ FASE FINAL — FÚRIA TOTAL!';waveLabelTimer=3;
    spawnExplosion(boss.x,boss.y,'#ff00ff',40,10,10);screenShake(15,0.6);
  }
  if(boss.phaseTransition){
    boss.phaseTimer-=dt;
    if(boss.phaseTimer<=0){boss.phaseTransition=false;boss.invincible=false}
    return;
  }
  // Movement - slowly chase
  const moveSpeed=boss.speed*(boss.phase===3?2:boss.phase===2?1.5:1);
  if(d>150){
    boss.x+=Math.cos(boss.angle)*moveSpeed;
    boss.y+=Math.sin(boss.angle)*moveSpeed;
  }
  // Contact damage
  if(d<boss.size+player.size)damagePlayer(20);
  // Attack cycle
  boss.attackTimer-=dt;
  if(boss.attackTimer<=0){
    boss.attackCycle=(boss.attackCycle+1)%5;
    const attacks=['soundWave','soundCone','soundBeam','radiateShots','empurrão'];
    bossAttack(attacks[boss.attackCycle]);
    boss.attackTimer=boss.phase===3?1.5:boss.phase===2?2:2.5;
  }
  // Summon minions
  boss.summonTimer-=dt;
  if(boss.summonTimer<=0){
    boss.summonTimer=boss.phase===3?5:boss.phase===2?7:10;
    const count=boss.phase===3?4:boss.phase===2?3:2;
    for(let i=0;i<count;i++){
      spawnEnemy(choose(['normal','runner','shooter']),boss.x+rand(-80,80),boss.y+rand(-80,80),1+wave*0.1);
    }
    waveLabel='Farm\'auras invocados!';waveLabelTimer=1.5;
  }
  // Spin attack in phase 3
  if(boss.phase===3){
    boss.specialTimer-=dt;
    if(boss.specialTimer<=0&&!boss.spinAttacking){
      boss.spinAttacking=true;boss.spinTimer=3;boss.spinAttackAngle=0;
      boss.specialTimer=8;
    }
    if(boss.spinAttacking){
      boss.spinTimer-=dt;
      boss.spinAttackAngle+=dt*4;
      // Spiral projectiles
      for(let i=0;i<3;i++){
        const a=boss.spinAttackAngle+TAU*i/3;
        enemyProjectiles.push({x:boss.x,y:boss.y,vx:Math.cos(a)*5,vy:Math.sin(a)*5,size:5,dmg:10,life:2,color:'#ff44ff'});
      }
      if(boss.spinTimer<=0)boss.spinAttacking=false;
    }
  }
  // Check projectile hits on boss
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i];
    if(p.hit.has(boss.uid))continue;
    if(dist(p,boss)<p.size+boss.size&&!boss.invincible){
      p.hit.add(boss.uid);
      boss.hp-=p.dmg.amount;
      boss.hitFlash=0.1;
      spawnDmgNumber(boss.x,boss.y-boss.size,p.dmg.amount,p.dmg.crit?'#ffdd00':'#fff');
      spawnHitParticles(boss.x,boss.y,boss.color);
      runStats.damageDealt+=p.dmg.amount;
      if(p.pierce>0)p.pierce--;else{projectiles.splice(i,1)}
      if(boss.hp<=0){bossDeath();return}
    }
  }
  // Melee hits on boss
  if(CHARACTERS[player.charIdx].weaponType==='melee'&&mouseDown&&player.fireTimer<=0){
    const range=CHARACTERS[player.charIdx].meleeRange+(player.upgrades.meleeRange||0);
    if(dist(player,boss)<range+boss.size&&!boss.invincible){
      let aToB=angle(player,boss);
      let diff=aToB-player.angle;
      while(diff>PI)diff-=TAU;while(diff<-PI)diff+=TAU;
      if(Math.abs(diff)<CHARACTERS[player.charIdx].meleeArc/2){
        const dmg=calcDamage(player);
        boss.hp-=dmg.amount;boss.hitFlash=0.1;
        spawnDmgNumber(boss.x,boss.y-boss.size,dmg.amount,dmg.crit?'#ffdd00':'#fff');
        if(boss.hp<=0){bossDeath();return}
      }
    }
  }
}

function bossAttack(type){
  if(!boss||!player)return;
  switch(type){
    case'soundWave':{ // Circular wave
      for(let i=0;i<24;i++){
        const a=TAU*i/24;
        enemyProjectiles.push({x:boss.x,y:boss.y,vx:Math.cos(a)*4,vy:Math.sin(a)*4,size:6,dmg:12,life:2,color:'#ff88ff'});
      }
      screenShake(4,0.15);break;
    }
    case'soundCone':{ // Cone toward player
      const baseA=boss.angle;
      for(let i=0;i<8;i++){
        const a=baseA+(i-3.5)*0.12;
        enemyProjectiles.push({x:boss.x,y:boss.y,vx:Math.cos(a)*6,vy:Math.sin(a)*6,size:5,dmg:10,life:1.5,color:'#ff66dd'});
      }
      break;
    }
    case'soundBeam':{ // Beam attack
      ultEffects.push({type:'bossBeam',x:boss.x,y:boss.y,angle:boss.angle,timer:1.2,maxTimer:1.2,dmg:3});
      break;
    }
    case'radiateShots':{ // Radiate in patterns
      const count=boss.phase===3?36:boss.phase===2?24:16;
      for(let i=0;i<count;i++){
        const a=TAU*i/count+rand(-0.05,0.05);
        enemyProjectiles.push({x:boss.x,y:boss.y,vx:Math.cos(a)*3,vy:Math.sin(a)*3,size:4,dmg:8,life:3,color:'#dd44ff'});
      }
      screenShake(5,0.2);break;
    }
    case'empurrão':{ // Push player away
      if(!player)break;
      const d=dist(boss,player);
      if(d<250){
        const a=angle(boss,player);
        player.x+=Math.cos(a)*80;player.y+=Math.sin(a)*80;
        screenShake(8,0.2);
        spawnExplosion(player.x,player.y,'#ff44ff',10,4,5);
      }
      break;
    }
  }
}

function bossDeath(){
  boss.dead=true;bossDefeated=true;
  spawnExplosion(boss.x,boss.y,'#ff00aa',50,12,10);
  spawnExplosion(boss.x,boss.y,'#ffdd00',40,10,8);
  spawnExplosion(boss.x,boss.y,'#ffffff',30,8,6);
  screenShake(20,0.8);
  // Drop lots of loot
  for(let i=0;i<20;i++)drops.push({x:boss.x+rand(-60,60),y:boss.y+rand(-60,60),type:'xp',value:10,size:5,life:60});
  for(let i=0;i<10;i++)drops.push({x:boss.x+rand(-60,60),y:boss.y+rand(-60,60),type:'shard',value:1,size:6,life:60});
  for(let i=0;i<5;i++)drops.push({x:boss.x+rand(-40,40),y:boss.y+rand(-40,40),type:'coin',value:5,size:6,life:60});
  meta.shards+=10;saveMeta();
  waveLabel='⭐ FARMADOR DE AURA DERROTADO! ⭐';waveLabelTimer=5;
  boss=null;
  // Victory after collecting
  setTimeout(()=>victory(),5000);
}

function drawBoss(){
  if(!boss||boss.dead)return;
  const s=worldToScreen(boss.x,boss.y);
  ctx.save();
  // Big glow
  const glowPulse=1+0.3*Math.sin(gameTime*3);
  ctx.shadowColor=boss.color;ctx.shadowBlur=30*glowPulse;
  if(boss.hitFlash>0){ctx.shadowColor='#fff';ctx.shadowBlur=40}
  if(boss.invincible){
    ctx.shadowColor='#ffdd00';ctx.shadowBlur=40;
  }
  // Draw boss shape
  ctx.fillStyle=boss.hitFlash>0?'#fff':boss.invincible?'#ffdd00':boss.color;
  // Main body
  ctx.beginPath();ctx.arc(s.x,s.y,boss.size,0,TAU);ctx.fill();
  // Inner pattern
  ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(s.x,s.y,boss.size*.6,0,TAU);ctx.stroke();
  // Rotating outer ring
  ctx.strokeStyle=boss.color;ctx.lineWidth=3;
  for(let i=0;i<6;i++){
    const a=gameTime*1.5+TAU*i/6;
    const ox=Math.cos(a)*(boss.size+10);const oy=Math.sin(a)*(boss.size+10);
    ctx.beginPath();ctx.arc(s.x+ox,s.y+oy,5,0,TAU);ctx.stroke();
  }
  // Eye/face
  ctx.fillStyle='#000';
  ctx.beginPath();ctx.arc(s.x-10,s.y-8,5,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s.x+10,s.y-8,5,0,TAU);ctx.fill();
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(s.x-10,s.y-8,2,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s.x+10,s.y-8,2,0,TAU);ctx.fill();
  // Mouth
  ctx.strokeStyle='#000';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(s.x,s.y+5,12,0.1,PI-0.1);ctx.stroke();
  ctx.restore();
  // HP bar
  const barW=200;const barH=12;const barX=canvas.width/2-barW/2;const barY=50;
  ctx.fillStyle='rgba(50,0,30,.8)';ctx.fillRect(barX-2,barY-2,barW+4,barH+4);
  ctx.fillStyle='#440022';ctx.fillRect(barX,barY,barW,barH);
  ctx.fillStyle=boss.color;ctx.fillRect(barX,barY,barW*(boss.hp/boss.maxHp),barH);
  ctx.strokeStyle=boss.color;ctx.lineWidth=1;ctx.strokeRect(barX,barY,barW,barH);
  ctx.font='bold 11px Orbitron,sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff';
  ctx.fillText(`FARMADOR DE AURA — FASE ${boss.phase}`,canvas.width/2,barY-5);
}

// --- LEVEL UP / UPGRADE SYSTEM ---
const ALL_UPGRADES=[
  {id:'dmgUp',name:'Dano+',desc:'+15% dano base',rarity:'common',apply:p=>{p.dmgMult+=0.15},weight:10},
  {id:'hpUp',name:'HP+',desc:'+20 HP máximo',rarity:'common',apply:p=>{p.maxHp+=20;p.hp+=20},weight:10},
  {id:'speedUp',name:'Velocidade+',desc:'+10% velocidade',rarity:'common',apply:p=>{p.speed*=1.1},weight:8},
  {id:'fireRateUp',name:'Cadência+',desc:'+15% velocidade de ataque',rarity:'common',apply:p=>{p.fireRate*=0.85},weight:9},
  {id:'magnetUp',name:'Ímã+',desc:'+40 raio magnético',rarity:'common',apply:p=>{p.magnetRadius+=40},weight:8},
  {id:'projSizeUp',name:'Projétil+',desc:'+30% tamanho dos projéteis',rarity:'common',apply:p=>{p.projSize*=1.3},weight:7},
  {id:'projSpeedUp',name:'Proj. Veloz',desc:'+25% velocidade do projétil',rarity:'common',apply:p=>{p.projSpeed*=1.25},weight:6},
  {id:'armorUp',name:'Armadura+',desc:'+3 armadura',rarity:'common',apply:p=>{p.armor+=3},weight:7},
  {id:'regen',name:'Regeneração',desc:'Regenera 2 HP/s',rarity:'rare',apply:p=>{p.regenRate+=2},weight:5},
  {id:'pierce',name:'Perfuração',desc:'Projéteis atravessam +1 inimigo',rarity:'rare',apply:p=>{p.projPierce+=1},weight:5},
  {id:'multishot',name:'Tiro Duplo',desc:'+1 projétil extra',rarity:'rare',apply:p=>{p.projCount+=1},weight:4},
  {id:'crit',name:'Crítico+',desc:'+10% chance de crítico',rarity:'rare',apply:p=>{p.critChance+=0.1},weight:5},
  {id:'critDmg',name:'Dano Crítico+',desc:'+50% multiplicador crítico',rarity:'rare',apply:p=>{p.critMult+=0.5},weight:4},
  {id:'ricochet',name:'Ricochete',desc:'Projéteis ricocheteiam 1x',rarity:'epic',apply:p=>{p.ricochet+=1},weight:3},
  {id:'lifeSteal',name:'Roubo de Vida',desc:'Recupera 5% do dano como HP',rarity:'epic',apply:p=>{p.lifeSteal+=0.05},weight:3},
  {id:'thorns',name:'Espinhos',desc:'Reflete 8 de dano ao ser atingido',rarity:'rare',apply:p=>{p.thorns+=8},weight:4},
  {id:'shield',name:'Escudo',desc:'Ganha escudo de 20 HP (regen 3/s)',rarity:'epic',apply:p=>{p.shieldMax+=20;p.shieldHp+=20;p.shieldRegen+=3},weight:3},
  {id:'explosionKill',name:'Explosão Fatal',desc:'Inimigos mortos explodem (15 dano)',rarity:'epic',apply:p=>{p.explosionOnKill+=15},weight:3},
  {id:'drone',name:'Mini Drone',desc:'Ganha um drone auxiliar',rarity:'epic',apply:p=>{p.droneCount+=1},weight:2},
  {id:'ultCd',name:'Ult Rápida',desc:'-20% cooldown da ultimate',rarity:'rare',apply:p=>{p.ultCdMult*=0.8},weight:4},
  {id:'burn',name:'Incendiário',desc:'+15% chance de queimar inimigos',rarity:'rare',apply:p=>{p.burnChance+=0.15},weight:4},
  {id:'slow',name:'Congelante',desc:'+15% chance de desacelerar',rarity:'rare',apply:p=>{p.slowChance+=0.15},weight:4},
  {id:'dashCd',name:'Dash Rápido',desc:'-30% cooldown do dash',rarity:'rare',apply:p=>{p.dashCd*=0.7},weight:4},
  {id:'projLife',name:'Alcance+',desc:'+40% alcance dos projéteis',rarity:'common',apply:p=>{p.projLifetime*=1.4},weight:6},
  {id:'shockwave',name:'Onda de Choque',desc:'Ataques melee criam ondas de impacto',rarity:'epic',charReq:'otton',apply:p=>{p.upgrades.shockwave=true},weight:3},
  {id:'meleeRange',name:'Alcance Melee+',desc:'+20 alcance do ataque melee',rarity:'rare',charReq:'otton',apply:p=>{p.upgrades.meleeRange=(p.upgrades.meleeRange||0)+20},weight:4},
  {id:'corrosionSpread',name:'Corrosão Contagiosa',desc:'Queimaduras se espalham para inimigos próximos',rarity:'legendary',apply:p=>{p.upgrades.corrosionSpread=true},weight:1},
  {id:'bigUltDmg',name:'Mega Garrafa',desc:'+50% dano e raio da ultimate',rarity:'epic',charReq:'big',apply:p=>{p.upgrades.bigUltBuff=true},weight:2},
  {id:'pietroExtra',name:'5ª Palavra',desc:'Ultimate de Pietro ganha +1 palavra orbital',rarity:'epic',charReq:'pietro',apply:p=>{p.upgrades.pietroExtraWord=true},weight:2},
  {id:'thiagoPoison',name:'Veneno Forte',desc:'Spray sempre aplica corrosão',rarity:'epic',charReq:'thiago',apply:p=>{p.burnChance=1},weight:2},
];

function getRandomUpgrades(count=3){
  const charId=CHARACTERS[player.charIdx].id;
  const available=ALL_UPGRADES.filter(u=>!u.charReq||u.charReq===charId);
  // Weighted selection
  const result=[];
  const pool=[...available];
  for(let i=0;i<count&&pool.length>0;i++){
    const totalWeight=pool.reduce((s,u)=>s+u.weight,0);
    let r=rand(0,totalWeight);
    for(let j=0;j<pool.length;j++){
      r-=pool[j].weight;
      if(r<=0){result.push(pool[j]);pool.splice(j,1);break}
    }
  }
  return result;
}

function triggerLevelUp(){
  gameState='levelup';
  showScreen('levelup-screen');
  const choices=getRandomUpgrades(3);
  const container=document.getElementById('upgrade-choices');
  container.innerHTML='';
  choices.forEach(u=>{
    const card=document.createElement('div');
    card.className='upgrade-card';
    const rarityClass='rarity-'+u.rarity;
    card.innerHTML=`<div class="${rarityClass}" style="font-size:.8em;text-transform:uppercase">${u.rarity}</div>
      <h3>${u.name}</h3><p>${u.desc}</p>`;
    card.onclick=()=>{
      u.apply(player);
      gameState='playing';
      document.getElementById('levelup-screen').classList.remove('active');
    };
    container.appendChild(card);
  });
}

