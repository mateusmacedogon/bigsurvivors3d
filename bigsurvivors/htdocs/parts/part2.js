
// ============================================================
// PART 2 — CHARACTER DEFINITIONS, PLAYER, WEAPONS
// ============================================================

// --- CHARACTER DEFINITIONS ---
const CHARACTERS=[
  {
    id:'big',name:'BIG',role:'Equilibrado',color:'#00eeff',
    desc:'O protagonista. Nave Anti-Aura padrão. Versátil e eficaz.',
    weaponName:'Pistola Anti-Aura',weaponDesc:'Tiro reto preciso. Mire com o mouse.',
    ultName:'A Garrafa do Big',ultDesc:'Meteoro cai do céu causando dano em área.',
    baseHp:100,baseSpeed:3.2,baseDmg:12,baseFireRate:0.22,
    projSpeed:10,projSize:4,projColor:'#00eeff',projCount:1,
    weaponType:'projectile',projLifetime:1.2,projPierce:0,
    spread:0.04,recoil:2,
    ultCooldown:25,ultDuration:0,
    drawShip:(x,y,rot,sz)=>{
      ctx.save();ctx.translate(x,y);ctx.rotate(rot);
      ctx.fillStyle='#00ccdd';ctx.beginPath();
      ctx.moveTo(sz,0);ctx.lineTo(-sz*.7,-sz*.6);ctx.lineTo(-sz*.4,0);ctx.lineTo(-sz*.7,sz*.6);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#00eeff';ctx.lineWidth=1.5;ctx.stroke();
      ctx.fillStyle='#00eeff';ctx.fillRect(sz*.2,-2,6,4);
      ctx.restore();
    }
  },
  {
    id:'otton',name:'OTTON',role:'Corpo a Corpo',color:'#ff4444',
    desc:'Lutador agressivo. Nave com braços mecânicos. Dano alto de perto.',
    weaponName:'Karatê',weaponDesc:'Golpe em arco. Curto alcance, alto dano.',
    ultName:'Apaixonado',ultDesc:'Dispara projéteis rosas em todas as direções.',
    baseHp:140,baseSpeed:3.5,baseDmg:25,baseFireRate:0.35,
    projSpeed:0,projSize:0,projColor:'#ff6644',projCount:1,
    weaponType:'melee',meleeRange:65,meleeArc:PI*.7,
    spread:0,recoil:0,
    ultCooldown:22,ultDuration:0,
    drawShip:(x,y,rot,sz)=>{
      ctx.save();ctx.translate(x,y);ctx.rotate(rot);
      ctx.fillStyle='#cc2222';ctx.beginPath();
      ctx.moveTo(sz*.6,0);ctx.lineTo(-sz*.5,-sz*.7);ctx.lineTo(-sz*.8,0);ctx.lineTo(-sz*.5,sz*.7);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#ff4444';ctx.lineWidth=2;ctx.stroke();
      // mechanical arms
      ctx.strokeStyle='#ff6644';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(0,-sz*.5);ctx.lineTo(sz*.4,-sz*.8);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,sz*.5);ctx.lineTo(sz*.4,sz*.8);ctx.stroke();
      ctx.restore();
    }
  },
  {
    id:'thiago',name:'THIAGO',role:'Controle de Área',color:'#44ff44',
    desc:'Especialista spray/ácido. Nave tóxica com reservatórios. Controle de horda.',
    weaponName:'Garrafa Lançadora',weaponDesc:'Spray rápido. Muitos tiros com chance de corrosão.',
    ultName:'Inconveniência',ultDesc:'Emite aura que repele todos os inimigos.',
    baseHp:90,baseSpeed:3.0,baseDmg:6,baseFireRate:0.08,
    projSpeed:8,projSize:3,projColor:'#66ff44',projCount:1,
    weaponType:'projectile',projLifetime:0.6,projPierce:0,
    spread:0.3,recoil:0.5,
    ultCooldown:20,ultDuration:3,
    drawShip:(x,y,rot,sz)=>{
      ctx.save();ctx.translate(x,y);ctx.rotate(rot);
      ctx.fillStyle='#228822';ctx.beginPath();
      ctx.arc(0,0,sz*.6,0,TAU);ctx.fill();
      ctx.strokeStyle='#44ff44';ctx.lineWidth=1.5;ctx.stroke();
      ctx.fillStyle='#44dd22';
      ctx.fillRect(sz*.1,-sz*.3,sz*.5,sz*.15);
      ctx.fillRect(sz*.1,sz*.15,sz*.5,sz*.15);
      ctx.restore();
    }
  },
  {
    id:'pietro',name:'PIETRO',role:'Controle / Mistico',color:'#bb66ff',
    desc:'Dano com palavras. Nave esotérica com runas. Projéteis únicos.',
    weaponName:'Fala Incômoda',weaponDesc:'Dispara runas/símbolos arcanos. Dano médio.',
    ultName:'As 4 Malditas Palavras',ultDesc:'4 palavras orbitam como escudo por tempo limitado.',
    baseHp:85,baseSpeed:3.1,baseDmg:10,baseFireRate:0.3,
    projSpeed:7,projSize:6,projColor:'#cc88ff',projCount:1,
    weaponType:'projectile',projLifetime:1.5,projPierce:0,
    spread:0.08,recoil:1,
    ultCooldown:24,ultDuration:6,
    drawShip:(x,y,rot,sz)=>{
      ctx.save();ctx.translate(x,y);ctx.rotate(rot);
      ctx.fillStyle='#6622aa';ctx.beginPath();
      ctx.moveTo(sz*.7,0);ctx.lineTo(0,-sz*.65);ctx.lineTo(-sz*.7,0);ctx.lineTo(0,sz*.65);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#bb66ff';ctx.lineWidth=1.5;ctx.stroke();
      // rune circles
      ctx.strokeStyle='rgba(187,102,255,.5)';ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(0,0,sz*.9,0,TAU);ctx.stroke();
      ctx.restore();
    }
  }
];

const RUNE_SYMBOLS=['⌀','Ψ','Ω','Δ','λ','∞','☿','⊗'];

// --- CHARACTER SELECT ---
function buildCharSelect(){
  const grid=document.getElementById('char-grid');
  grid.innerHTML='';
  CHARACTERS.forEach((c,i)=>{
    const card=document.createElement('div');
    card.className='char-card'+(i===selectedChar?' selected':'');
    card.innerHTML=`
      <div class="char-icon" style="background:${c.color}22;border:2px solid ${c.color};color:${c.color}">${c.name[0]}</div>
      <h3 style="color:${c.color}">${c.name}</h3>
      <div class="role">${c.role}</div>
      <div class="stat">HP: ${c.baseHp} | Vel: ${(c.baseSpeed*10).toFixed(0)} | Dano: ${c.baseDmg}</div>
      <div class="stat">Arma: <span class="weapon-name">${c.weaponName}</span></div>
      <div class="stat" style="font-size:.8em;color:#777">${c.weaponDesc}</div>
      <div class="stat">Ult: <span class="ult-name">${c.ultName}</span></div>
      <div class="stat" style="font-size:.8em;color:#777">${c.ultDesc}</div>`;
    card.onclick=()=>{selectedChar=i;buildCharSelect()};
    grid.appendChild(card);
  });
}

// --- PLAYER OBJECT ---
let player=null;
function createPlayer(charIdx){
  const c=CHARACTERS[charIdx];
  const p={
    x:WORLD_W/2,y:WORLD_H/2,
    vx:0,vy:0,
    hp:c.baseHp,maxHp:c.baseHp,
    speed:c.baseSpeed,baseDmg:c.baseDmg,
    dmgMult:1,fireRate:c.baseFireRate,fireTimer:0,
    angle:0,size:18,
    charIdx,charDef:c,
    level:1,xp:0,xpToNext:20,
    magnetRadius:70,xpMult:1,
    armor:0,
    ultCooldown:c.ultCooldown,ultTimer:0,ultActive:false,ultActiveTimer:0,ultCdMult:1,
    // upgrades tracking
    upgrades:{},
    projPierce:c.projPierce||0,
    projCount:c.projCount||1,
    projSpeed:c.projSpeed||10,
    projSize:c.projSize||4,
    projLifetime:c.projLifetime||1,
    critChance:0.05,critMult:1.5,
    lifeSteal:0,thorns:0,
    dashCd:3,dashTimer:0,dashSpeed:12,dashDur:0.15,dashing:false,dashActiveTimer:0,
    shieldHp:0,shieldMax:0,shieldRegen:0,
    burnChance:0,slowChance:0,
    ricochet:0,explosionOnKill:0,
    drones:[],droneCount:0,droneTimer:0,
    regenRate:0,
    invincTimer:0,
    hitFlash:0
  };
  // Apply meta upgrades
  META_UPGRADES.forEach(u=>{
    const lv=meta.upgrades[u.id]||0;
    if(lv>0)u.apply(p,lv);
  });
  return p;
}

// --- PLAYER UPDATE ---
function updatePlayer(dt){
  if(!player)return;
  const p=player;
  // Hit flash
  if(p.hitFlash>0)p.hitFlash-=dt;
  if(p.invincTimer>0)p.invincTimer-=dt;
  // Regen
  if(p.regenRate>0){p.hp=Math.min(p.maxHp,p.hp+p.regenRate*dt)}
  // Shield regen
  if(p.shieldMax>0&&p.shieldHp<p.shieldMax)p.shieldHp=Math.min(p.shieldMax,p.shieldHp+p.shieldRegen*dt);
  // Movement
  let mx=0,my=0;
  if(keys['w']||keys['arrowup'])my=-1;
  if(keys['s']||keys['arrowdown'])my=1;
  if(keys['a']||keys['arrowleft'])mx=-1;
  if(keys['d']||keys['arrowright'])mx=1;
  if(mx||my){const len=Math.hypot(mx,my);mx/=len;my/=len;}
  // Dash
  if(p.dashTimer>0)p.dashTimer-=dt;
  if(keys[' ']&&p.dashTimer<=0&&!p.dashing&&(mx||my)){
    p.dashing=true;p.dashActiveTimer=p.dashDur;p.dashTimer=p.dashCd;
    p.invincTimer=Math.max(p.invincTimer,p.dashDur);
    spawnExplosion(p.x,p.y,CHARACTERS[p.charIdx].color,6,2,3);
  }
  if(p.dashing){
    p.dashActiveTimer-=dt;
    const spd=p.dashSpeed;
    p.vx=mx*spd;p.vy=my*spd;
    if(p.dashActiveTimer<=0)p.dashing=false;
  }else{
    p.vx=mx*p.speed;p.vy=my*p.speed;
  }
  p.x+=p.vx;p.y+=p.vy;
  p.x=clamp(p.x,p.size,WORLD_W-p.size);
  p.y=clamp(p.y,p.size,WORLD_H-p.size);
  // Angle to mouse
  p.angle=Math.atan2(mouseWorld.y-p.y,mouseWorld.x-p.x);
  // Shooting
  p.fireTimer-=dt;
  if(mouseDown&&p.fireTimer<=0){
    fireWeapon(p);
    p.fireTimer=p.fireRate;
  }
  // Ultimate timer
  if(p.ultTimer>0)p.ultTimer-=dt;
  if(p.ultActive){
    p.ultActiveTimer-=dt;
    updateUltimateActive(p,dt);
    if(p.ultActiveTimer<=0)p.ultActive=false;
  }
  // Drones
  updateDrones(p,dt);
}

// --- PROJECTILES ---
let projectiles=[];
let enemyProjectiles=[];

function fireWeapon(p){
  const c=p.charDef;
  if(c.weaponType==='melee'){
    // Melee attack
    const range=c.meleeRange+(p.upgrades.meleeRange||0);
    const arc=c.meleeArc;
    let hitCount=0;
    enemies.forEach(e=>{
      const d=dist(p,e);
      if(d<range+e.size){
        let aToE=angle(p,e);
        let diff=aToE-p.angle;
        while(diff>PI)diff-=TAU;while(diff<-PI)diff+=TAU;
        if(Math.abs(diff)<arc/2){
          const dmg=calcDamage(p);
          dealDamageToEnemy(e,dmg,p);
          hitCount++;
        }
      }
    });
    // Visual arc
    spawnMeleeArc(p.x,p.y,p.angle,range,arc,c.color);
    if(hitCount>0)screenShake(3,0.08);
    // Shockwave upgrade
    if(p.upgrades.shockwave&&hitCount>0){
      enemies.forEach(e=>{
        const d=dist(p,e);
        if(d<range*1.5+e.size){
          dealDamageToEnemy(e,calcDamage(p)*0.3,p);
        }
      });
      spawnExplosion(p.x,p.y,'#ff8844',8,4,5);
    }
  }else{
    // Projectile weapon
    const count=p.projCount;
    const baseAngle=p.angle;
    const spreadPerShot=count>1?0.15:0;
    for(let i=0;i<count;i++){
      const offsetAngle=count>1?(i-(count-1)/2)*spreadPerShot:0;
      const a=baseAngle+offsetAngle+rand(-c.spread,c.spread);
      projectiles.push({
        x:p.x+Math.cos(p.angle)*p.size,y:p.y+Math.sin(p.angle)*p.size,
        vx:Math.cos(a)*p.projSpeed,vy:Math.sin(a)*p.projSpeed,
        dmg:calcDamage(p),size:p.projSize,color:c.projColor,
        life:p.projLifetime,owner:'player',
        pierce:p.projPierce,ricochet:p.ricochet,
        hit:new Set(),
        burn:chance(p.burnChance),slow:chance(p.slowChance),
        isRune:c.id==='pietro'
      });
    }
    // Recoil
    if(c.recoil){
      p.x-=Math.cos(p.angle)*c.recoil;
      p.y-=Math.sin(p.angle)*c.recoil;
    }
  }
}

function calcDamage(p){
  let dmg=p.baseDmg*p.dmgMult;
  const crit=chance(p.critChance);
  if(crit)dmg*=p.critMult;
  return{amount:dmg,crit};
}

function spawnMeleeArc(x,y,angle,range,arc,color){
  const steps=8;
  for(let i=0;i<steps;i++){
    const a=angle-arc/2+arc*(i/steps)+rand(-0.1,0.1);
    const d=rand(range*0.4,range);
    spawnParticle(x+Math.cos(a)*d,y+Math.sin(a)*d,{
      vx:Math.cos(a)*2,vy:Math.sin(a)*2,
      color,size:rand(3,6),life:0.2,glow:true
    });
  }
}

function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i];
    p.x+=p.vx;p.y+=p.vy;
    p.life-=dt;
    if(p.life<=0||p.x<-50||p.x>WORLD_W+50||p.y<-50||p.y>WORLD_H+50){
      projectiles.splice(i,1);continue;
    }
    // Check enemy hits
    for(let j=enemies.length-1;j>=0;j--){
      const e=enemies[j];
      if(p.hit.has(e.uid))continue;
      if(dist(p,e)<p.size+e.size){
        p.hit.add(e.uid);
        dealDamageToEnemy(e,p.dmg,player,p);
        if(p.pierce>0){p.pierce--}
        else if(p.ricochet>0){
          p.ricochet--;
          const nearest=findNearestEnemy(p,80,e);
          if(nearest){const a=angle(p,nearest);p.vx=Math.cos(a)*Math.hypot(p.vx,p.vy);p.vy=Math.sin(a)*Math.hypot(p.vx,p.vy);p.life=Math.max(p.life,.5)}
          else{projectiles.splice(i,1);break}
        }else{projectiles.splice(i,1);break}
      }
    }
  }
  // Enemy projectiles
  for(let i=enemyProjectiles.length-1;i>=0;i--){
    const p=enemyProjectiles[i];
    p.x+=p.vx;p.y+=p.vy;
    p.life-=dt;
    if(p.life<=0||p.x<-50||p.x>WORLD_W+50||p.y<-50||p.y>WORLD_H+50){
      enemyProjectiles.splice(i,1);continue;
    }
    if(player&&dist(p,player)<p.size+player.size){
      damagePlayer(p.dmg);
      enemyProjectiles.splice(i,1);
    }
  }
}

function findNearestEnemy(pos,range,exclude=null){
  let best=null,bestD=range;
  for(const e of enemies){
    if(e===exclude)continue;
    const d=dist(pos,e);
    if(d<bestD){bestD=d;best=e}
  }
  return best;
}

function drawProjectiles(){
  for(const p of projectiles){
    const s=worldToScreen(p.x,p.y);
    ctx.save();
    ctx.shadowColor=p.color;ctx.shadowBlur=8;
    if(p.isRune){
      ctx.font=`${p.size*3}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle=p.color;
      ctx.fillText(choose(RUNE_SYMBOLS),s.x,s.y);
    }else{
      ctx.fillStyle=p.color;
      ctx.beginPath();ctx.arc(s.x,s.y,p.size,0,TAU);ctx.fill();
    }
    ctx.restore();
  }
  // Enemy projectiles
  for(const p of enemyProjectiles){
    const s=worldToScreen(p.x,p.y);
    ctx.save();ctx.shadowColor=p.color||'#ff4444';ctx.shadowBlur=6;
    ctx.fillStyle=p.color||'#ff4444';
    ctx.beginPath();ctx.arc(s.x,s.y,p.size,0,TAU);ctx.fill();
    ctx.restore();
  }
}

// --- PLAYER DAMAGE ---
function damagePlayer(dmgObj){
  if(!player||player.invincTimer>0)return;
  let amount=typeof dmgObj==='object'?dmgObj.amount:dmgObj;
  // Shield first
  if(player.shieldHp>0){
    const absorbed=Math.min(player.shieldHp,amount);
    player.shieldHp-=absorbed;amount-=absorbed;
  }
  amount=Math.max(1,amount-player.armor);
  player.hp-=amount;
  player.hitFlash=0.15;
  player.invincTimer=0.3;
  screenShake(5,0.12);
  spawnHitParticles(player.x,player.y,'#ff4444');
  spawnDmgNumber(player.x,player.y-20,amount,'#ff4444');
  // Thorns
  if(player.thorns>0){
    const nearE=findNearestEnemy(player,80);
    if(nearE)dealDamageToEnemy(nearE,{amount:player.thorns,crit:false},player);
  }
  if(player.hp<=0)gameOver();
}

function dealDamageToEnemy(e,dmgObj,p,proj=null){
  const dmg=typeof dmgObj==='object'?dmgObj:({amount:dmgObj,crit:false});
  e.hp-=dmg.amount;
  e.hitFlash=0.1;
  const color=dmg.crit?'#ffdd00':'#fff';
  spawnDmgNumber(e.x,e.y-e.size,dmg.amount,color);
  spawnHitParticles(e.x,e.y,e.color||'#ff4444');
  if(dmg.crit)screenShake(3,0.06);
  // Burn
  if(proj&&proj.burn&&!e.burning){e.burning=true;e.burnTimer=3;e.burnDmg=dmg.amount*.2}
  // Slow
  if(proj&&proj.slow&&!e.slowed){e.slowed=true;e.slowTimer=2}
  // Life steal
  if(p&&p.lifeSteal>0){p.hp=Math.min(p.maxHp,p.hp+dmg.amount*p.lifeSteal)}
  if(e.hp<=0)killEnemy(e,p);
}

function killEnemy(e,p){
  e.dead=true;
  runStats.kills++;
  spawnExplosion(e.x,e.y,e.color||'#ff4444',10,3,4);
  // Drop XP
  const xpAmount=e.xpValue||5;
  for(let i=0;i<Math.ceil(xpAmount/5);i++){
    drops.push({x:e.x+rand(-10,10),y:e.y+rand(-10,10),type:'xp',value:Math.min(5,xpAmount-i*5),size:4,life:30});
  }
  // Coin drop
  if(chance(0.15+meta.upgrades.luck*0.03)){
    drops.push({x:e.x,y:e.y,type:'coin',value:randInt(1,3),size:5,life:30});
  }
  // Shard drop (rare)
  if(chance(0.03+meta.upgrades.luck*0.02)){
    drops.push({x:e.x,y:e.y,type:'shard',value:1,size:5,life:30});
  }
  // Explosion on kill upgrade
  if(p&&p.explosionOnKill>0){
    enemies.forEach(e2=>{
      if(!e2.dead&&dist(e,e2)<60){
        dealDamageToEnemy(e2,{amount:p.explosionOnKill,crit:false},p);
      }
    });
    spawnExplosion(e.x,e.y,'#ff8800',6,4,6);
  }
  // Health drop (rare)
  if(chance(0.04)){
    drops.push({x:e.x,y:e.y,type:'health',value:15,size:5,life:30});
  }
}

// --- DRAW PLAYER ---
function drawPlayer(){
  if(!player)return;
  const p=player;
  const c=CHARACTERS[p.charIdx];
  const s=worldToScreen(p.x,p.y);
  // Glow
  ctx.save();
  ctx.shadowColor=c.color;ctx.shadowBlur=15;
  // Hit flash
  if(p.hitFlash>0){
    ctx.shadowColor='#fff';ctx.shadowBlur=25;
  }
  // Draw using sprite or fallback
  if(sprites[c.id]){
    drawSprite(c.id,p.x,p.y,p.size*2.5,p.size*2.5,p.angle);
  }else{
    c.drawShip(s.x,s.y,p.angle,p.size);
  }
  ctx.restore();
  // Shield visual
  if(p.shieldHp>0){
    ctx.save();
    ctx.strokeStyle='rgba(68,136,255,'+(0.3+0.3*(p.shieldHp/p.shieldMax))+')';
    ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(s.x,s.y,p.size+6,0,TAU);ctx.stroke();
    ctx.restore();
  }
  // Ultimate active visuals
  if(p.ultActive)drawUltimateActive(p,s);
  // Weapon aim line
  const aimLen=25;
  ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(s.x+Math.cos(p.angle)*p.size,s.y+Math.sin(p.angle)*p.size);
  ctx.lineTo(s.x+Math.cos(p.angle)*(p.size+aimLen),s.y+Math.sin(p.angle)*(p.size+aimLen));ctx.stroke();
}

// --- DRONES ---
function updateDrones(p,dt){
  if(p.droneCount<=0)return;
  while(p.drones.length<p.droneCount)p.drones.push({angle:rand(0,TAU),fireTimer:0});
  p.droneTimer+=dt;
  p.drones.forEach((d,i)=>{
    d.angle+=dt*1.5;
    d.fireTimer-=dt;
    if(d.fireTimer<=0){
      d.fireTimer=1.2;
      const dx=p.x+Math.cos(d.angle)*40;
      const dy=p.y+Math.sin(d.angle)*40;
      const nearest=findNearestEnemy({x:dx,y:dy},300);
      if(nearest){
        const a=angle({x:dx,y:dy},nearest);
        projectiles.push({x:dx,y:dy,vx:Math.cos(a)*8,vy:Math.sin(a)*8,dmg:{amount:p.baseDmg*.3*p.dmgMult,crit:false},size:3,color:'#88ddff',life:.8,owner:'drone',pierce:0,ricochet:0,hit:new Set()});
      }
    }
  });
}
function drawDrones(p){
  if(!p||p.droneCount<=0)return;
  p.drones.forEach(d=>{
    const dx=p.x+Math.cos(d.angle)*40;
    const dy=p.y+Math.sin(d.angle)*40;
    const s=worldToScreen(dx,dy);
    ctx.fillStyle='#88ddff';ctx.shadowColor='#88ddff';ctx.shadowBlur=6;
    ctx.beginPath();ctx.arc(s.x,s.y,4,0,TAU);ctx.fill();
    ctx.shadowBlur=0;
  });
}

// --- ULTIMATES ---
let ultEffects=[];
function activateUltimate(){
  const p=player;if(!p||p.ultTimer>0||p.ultActive)return;
  const c=p.charDef;
  p.ultTimer=c.ultCooldown*p.ultCdMult;
  switch(c.id){
    case'big':{ // Meteor
      const tx=mouseWorld.x,ty=mouseWorld.y;
      // Warning circle
      ultEffects.push({type:'bigWarning',x:tx,y:ty,timer:1,maxTimer:1,radius:80});
      setTimeout(()=>{
        // Impact
        spawnExplosion(tx,ty,'#ff8800',30,8,8);
        spawnExplosion(tx,ty,'#ffdd00',20,5,5);
        screenShake(12,0.4);
        enemies.forEach(e=>{
          if(dist({x:tx,y:ty},e)<100){
            dealDamageToEnemy(e,{amount:p.baseDmg*5*p.dmgMult,crit:false},p);
          }
        });
      },1000);
      break;
    }
    case'otton':{ // Hearts
      for(let i=0;i<16;i++){
        const a=TAU*i/16;
        projectiles.push({x:p.x,y:p.y,vx:Math.cos(a)*6,vy:Math.sin(a)*6,dmg:{amount:p.baseDmg*2*p.dmgMult,crit:false},size:8,color:'#ff66aa',life:1.5,owner:'player',pierce:3,ricochet:0,hit:new Set(),isHeart:true});
      }
      spawnExplosion(p.x,p.y,'#ff66aa',20,5,6);
      screenShake(6,0.2);
      break;
    }
    case'thiago':{ // Push aura
      p.ultActive=true;p.ultActiveTimer=c.ultDuration;
      break;
    }
    case'pietro':{ // Orbiting words
      p.ultActive=true;p.ultActiveTimer=c.ultDuration;
      break;
    }
  }
}

function updateUltimateActive(p,dt){
  const c=p.charDef;
  if(c.id==='thiago'){
    // Push enemies away
    enemies.forEach(e=>{
      const d=dist(p,e);
      if(d<200){
        const a=angle(p,e);
        const force=8*(1-d/200);
        e.x+=Math.cos(a)*force;e.y+=Math.sin(a)*force;
      }
    });
  }
  if(c.id==='pietro'){
    // Orbiting words damage
    const words=['CHATO','BRUH','CRINGE','SUS'];
    for(let i=0;i<4;i++){
      const a=gameTime*2+i*PI/2;
      const wx=p.x+Math.cos(a)*55;
      const wy=p.y+Math.sin(a)*55;
      enemies.forEach(e=>{
        if(dist({x:wx,y:wy},e)<20+e.size){
          if(!e._pietroHitTimer||e._pietroHitTimer<=0){
            dealDamageToEnemy(e,{amount:p.baseDmg*1.5*p.dmgMult,crit:false},p);
            e._pietroHitTimer=0.5;
          }
        }
        if(e._pietroHitTimer>0)e._pietroHitTimer-=dt;
      });
    }
  }
}

function drawUltimateActive(p,s){
  const c=p.charDef;
  if(c.id==='thiago'){
    ctx.save();
    const alpha=0.1+0.1*Math.sin(gameTime*5);
    ctx.strokeStyle=`rgba(68,255,68,${alpha+0.2})`;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(s.x,s.y,200,0,TAU);ctx.stroke();
    ctx.fillStyle=`rgba(68,255,68,${alpha})`;
    ctx.beginPath();ctx.arc(s.x,s.y,200,0,TAU);ctx.fill();
    ctx.restore();
  }
  if(c.id==='pietro'){
    const words=['CHATO','BRUH','CRINGE','SUS'];
    ctx.save();ctx.font='bold 14px Orbitron,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.shadowColor='#bb66ff';ctx.shadowBlur=10;
    for(let i=0;i<4;i++){
      const a=gameTime*2+i*PI/2;
      const wx=55*Math.cos(a);const wy=55*Math.sin(a);
      ctx.fillStyle='#dd88ff';
      ctx.fillText(words[i],s.x+wx,s.y+wy);
    }
    ctx.restore();
  }
}

function updateUltEffects(dt){
  for(let i=ultEffects.length-1;i>=0;i--){
    const e=ultEffects[i];
    e.timer-=dt;
    if(e.timer<=0)ultEffects.splice(i,1);
  }
}
function drawUltEffects(){
  for(const e of ultEffects){
    if(e.type==='bigWarning'){
      const s=worldToScreen(e.x,e.y);
      const alpha=0.2+0.3*Math.sin(gameTime*15);
      ctx.save();
      ctx.strokeStyle=`rgba(255,136,0,${alpha+0.3})`;ctx.lineWidth=3;
      ctx.setLineDash([5,5]);
      ctx.beginPath();ctx.arc(s.x,s.y,e.radius,0,TAU);ctx.stroke();
      ctx.fillStyle=`rgba(255,136,0,${alpha*0.3})`;
      ctx.beginPath();ctx.arc(s.x,s.y,e.radius,0,TAU);ctx.fill();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
}

