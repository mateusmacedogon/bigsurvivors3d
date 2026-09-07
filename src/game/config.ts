// ===== BIG SURVIVOR: Projeto Anti-Aura — Configuração central =====

export const ARENA_RADIUS = 70;
export const WAVE_DURATION = 30;
export const BOSS_WAVE = 20;
export const MAX_ENEMIES = 220;
export const PLAYER_RADIUS = 0.9;

export type HeroId = 'big' | 'otton' | 'thiago' | 'pietro' | 'carlinhos' | 'macedo';
export type GamePhase = 'menu' | 'playing' | 'levelup' | 'ascension' | 'paused' | 'gameover' | 'victory';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type GameMode = 'classic' | 'hyper' | 'boss_rush';

export type PactId = 'penumbra' | 'unstable_ground' | 'ferocious_horde' | 'no_dampeners';

export interface PactDef {
  id: PactId;
  name: string;
  desc: string;
  shardBonus: number;
  icon: string;
}

export const PACTS: Record<PactId, PactDef> = {
  penumbra: {
    id: 'penumbra',
    name: 'Penumbra Cósmica',
    desc: 'Escuridão total na arena: campo de visão restrito com holofote cônico na nave.',
    shardBonus: 0.25,
    icon: '🌑',
  },
  unstable_ground: {
    id: 'unstable_ground',
    name: 'Solo Instável',
    desc: 'Ondas de choque de lava/plasma percorrem a arena periodicamente.',
    shardBonus: 0.20,
    icon: '🌋',
  },
  ferocious_horde: {
    id: 'ferocious_horde',
    name: 'Horda Feroz',
    desc: 'Inimigos com +25% de velocidade e deixam poças cáusticas na morte.',
    shardBonus: 0.30,
    icon: '🐺',
  },
  no_dampeners: {
    id: 'no_dampeners',
    name: 'Voo sem Amortecedores',
    desc: 'Dash com tempo de recarga duplicado, exigindo precisão pura de pilotagem.',
    shardBonus: 0.25,
    icon: '🚀',
  },
};

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  desc: string;
  color: number;
  css: string;
  weapon: string;
  weaponDesc: string;
  ult: string;
  ultDesc: string;
  hp: number;
  speed: number;
  fireRate: number;
  damage: number;
  ultCd: number;
  locked?: boolean;
  unlockDesc?: string;
}

export const HEROES: HeroDef[] = [
  {
    id: 'big', name: 'BIG', title: 'Interceptador Equilibrado',
    desc: 'Caça aerodinâmico ciano com duplo canhão frontal. Versátil e letal a qualquer distância.',
    color: 0x00e5ff, css: '#00e5ff',
    weapon: 'Pistola Anti-Aura', weaponDesc: 'Lasers de alta velocidade que deixam trilhas de plasma luminoso.',
    ult: 'A Garrafa do Big', ultDesc: 'Uma garrafa energética colossal reentra na atmosfera e explode em onda de choque gigantesca.',
    hp: 120, speed: 14, fireRate: 4, damage: 14, ultCd: 40,
  },
  {
    id: 'otton', name: 'OTTON', title: 'Brutamontes Corpo a Corpo',
    desc: 'Nave blindada carmesim com braços mecânicos e lâminas de plasma. Agressivo e resistente.',
    color: 0xff4a2a, css: '#ff4a2a',
    weapon: 'Karatê', weaponDesc: 'Arcos de plasma cortantes que repelem e partem inimigos ao meio.',
    ult: 'Apaixonado', ultDesc: 'Disparo omnidirecional em 360° de dezenas de orbes de plasma rosa-choque.',
    hp: 170, speed: 13, fireRate: 2.2, damage: 32, ultCd: 34,
  },
  {
    id: 'thiago', name: 'THIAGO', title: 'Corrosão em Área',
    desc: 'Corveta verde-tóxica com tanques de ácido biológico. Controle de área e dano contínuo.',
    color: 0x8cff2a, css: '#8cff2a',
    weapon: 'Garrafa Lançadora', weaponDesc: 'Spray contínuo em leque de gotículas cáusticas que aplicam corrosão.',
    ult: 'Inconveniência', ultDesc: 'Domo de repulsão eletromagnética verde-veneno que arremessa e atordoa todos os monstros.',
    hp: 130, speed: 13.5, fireRate: 11, damage: 4.6, ultCd: 32,
  },
  {
    id: 'pietro', name: 'PIETRO', title: 'Místico Esotérico',
    desc: 'Obelisco flutuante cercado por anéis rúnicos. Perfuração e controle esotérico.',
    color: 0xc05cff, css: '#c05cff',
    weapon: 'Fala Incômoda', weaponDesc: 'Runas cósmicas (Ψ Ω Δ ∞ ⊗) giratórias que perfuram múltiplos inimigos.',
    ult: 'As 4 Malditas Palavras', ultDesc: 'Quatro hieróglifos gigantes orbitam a nave destruindo tudo e bloqueando projéteis.',
    hp: 110, speed: 14.5, fireRate: 2.4, damage: 28, ultCd: 45,
  },
  {
    id: 'carlinhos', name: 'CARLINHOS', title: 'Pacifista Gentil',
    desc: 'Nave esférica dourada com cúpula de compaixão. Gentileza como arma: ondas de bondade que danificam e repelem em área.',
    color: 0xffcc44, css: '#ffcc44',
    weapon: 'Onda de Gentileza', weaponDesc: 'Shockwave expansiva periódica que atinge e repele todos os inimigos ao redor.',
    ult: 'Bondade', ultDesc: 'Inimigos perdem a vontade de lutar: atordoa e pacifica todos os monstros da arena por 6 segundos.',
    hp: 140, speed: 13.5, fireRate: 1.8, damage: 28, ultCd: 36,
    locked: true, unlockDesc: 'Derrote o Farmador de Aura e vença uma partida para resgatar!',
  },
  {
    id: 'macedo', name: 'MACEDO', title: 'Estrategista Comunicativo',
    desc: 'Nave de transmissão quântica com antenas holográficas. Especialista em telemensagens e armadilhas eletromagnéticas.',
    color: 0x44ddff, css: '#44ddff',
    weapon: 'Telemensagem', weaponDesc: 'Instala armadilhas de pulso no alvo que disparam arcos elétricos contínuos nos inimigos.',
    ult: 'Surto Comunicativo', ultDesc: 'Sobrecarga de dados global: ondas de choque eletromagnéticas atordoam e causam dano em toda a tela.',
    hp: 115, speed: 14.2, fireRate: 2.5, damage: 22, ultCd: 30,
    locked: true, unlockDesc: 'Derrote o Farmador de Aura e vença uma partida para resgatar!',
  },
];

export const heroById = (id: HeroId): HeroDef => HEROES.find(h => h.id === id)!;

export type EnemyType =
  | 'normal' | 'runner' | 'tank' | 'shooter' | 'sniper' | 'shotgunner' | 'orbiter' | 'mortar'
  | 'beam' | 'summoner' | 'minelayer' | 'trapper' | 'kamikaze' | 'healer' | 'shielder' | 'miniboss' | 'mine';

export interface EnemyDef {
  name: string;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  xp: number;
  color: number;
  minWave: number;
  weight: number;
  coin: number;
  desc: string;
}

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  normal:     { name: 'Drone',           hp: 22,  speed: 5.8, radius: 0.8, damage: 10, xp: 1,  color: 0xff2d75, minWave: 1,  weight: 10, coin: 0.05, desc: 'Batedores descartáveis da frota de Aura. Parecem moscas mecânicas com lasers de baixa voltagem.' },
  runner:     { name: 'Runner',          hp: 16,  speed: 9.5, radius: 0.6, damage: 8,  xp: 1,  color: 0xffa02d, minWave: 2,  weight: 7,  coin: 0.05, desc: 'Velozes e erráticos, atacam em ziguezague tentando drenar seu carisma espacial.' },
  shooter:    { name: 'Atirador',        hp: 30,  speed: 4.2, radius: 0.8, damage: 11, xp: 2,  color: 0xff5533, minWave: 3,  weight: 6,  coin: 0.08, desc: 'Dispara esferas de plasma avermelhadas em linha reta. Seu lema é atirar primeiro e mirar nunca.' },
  tank:       { name: 'Encouraçado',     hp: 140, speed: 3.0, radius: 1.5, damage: 20, xp: 5,  color: 0x9b59ff, minWave: 4,  weight: 4,  coin: 0.2, desc: 'Tanque cibernético revestido de blindagem estelar. Lento, resistente e perigoso em bando.' },
  kamikaze:   { name: 'Kamikaze',        hp: 20,  speed: 7.8, radius: 0.6, damage: 32, xp: 2,  color: 0xff1a1a, minWave: 4,  weight: 5,  coin: 0.08, desc: 'Drone com pavio curtíssimo e carga de antimatéria no peito. Mantenha distância!' },
  shotgunner: { name: 'Espingardeiro',   hp: 40,  speed: 4.2, radius: 0.9, damage: 9,  xp: 3,  color: 0xff7a00, minWave: 5,  weight: 5,  coin: 0.1, desc: 'Dispara leques quádruplos de chumbo plasmático. Letal à queima-roupa.' },
  orbiter:    { name: 'Orbitador',       hp: 28,  speed: 8.5, radius: 0.7, damage: 15, xp: 2,  color: 0x00d0ff, minWave: 6,  weight: 5,  coin: 0.08, desc: 'Circunda a nave do jogador como um mosquito galáctico enquanto atira em espiral.' },
  sniper:     { name: 'Sniper',          hp: 34,  speed: 3.8, radius: 0.8, damage: 30, xp: 3,  color: 0xff0044, minWave: 7,  weight: 4,  coin: 0.12, desc: 'Trava uma mira laser vermelha e dispara um raio letal de longo alcance. Desvie do feixe!' },
  mortar:     { name: 'Morteiro',        hp: 48,  speed: 3.2, radius: 1.0, damage: 26, xp: 4,  color: 0xffb020, minWave: 8,  weight: 4,  coin: 0.12, desc: 'Dispara bombas incendiárias em parábola que desenham áreas de impacto no piso da arena.' },
  healer:     { name: 'Curandeiro',      hp: 38,  speed: 4.8, radius: 0.8, damage: 8,  xp: 3,  color: 0x33ff99, minWave: 9,  weight: 3,  coin: 0.15, desc: 'Emite pulsações de bio-regeneração que curam todos os monstros ao redor. Alvo de prioridade!' },
  minelayer:  { name: 'Minador',         hp: 44,  speed: 5.2, radius: 0.9, damage: 22, xp: 3,  color: 0xffe02d, minWave: 10, weight: 3,  coin: 0.12, desc: 'Semeia campos minados flutuantes que detonam ao menor toque de sua nave.' },
  summoner:   { name: 'Invocador',       hp: 55,  speed: 3.8, radius: 1.0, damage: 10, xp: 4,  color: 0xa020ff, minWave: 11, weight: 3,  coin: 0.2, desc: 'Abre fendas no espaço-tempo para conjurar hordas de reforços alienígenas.' },
  beam:       { name: 'Canhão de Feixe', hp: 70,  speed: 3.4, radius: 1.1, damage: 20, xp: 4,  color: 0xff3cff, minWave: 12, weight: 3,  coin: 0.2, desc: 'Carrega um laser contínuo devastador que varre a arena. Pisca em vermelho antes de disparar.' },
  trapper:    { name: 'Armadilheiro',    hp: 46,  speed: 4.8, radius: 0.9, damage: 10, xp: 3,  color: 0x40ffe0, minWave: 13, weight: 3,  coin: 0.12, desc: 'Projeta campos gravitacionais de estase que reduzem drasticamente sua velocidade de manobra.' },
  shielder:   { name: 'Escudeiro',       hp: 52,  speed: 4.2, radius: 0.9, damage: 10, xp: 4,  color: 0x4d8dff, minWave: 14, weight: 3,  coin: 0.15, desc: 'Gera cúpulas de proteção translúcidas que absorvem todo tipo de tiro convencional.' },
  miniboss:   { name: "Sentinela Farm'aura", hp: 1600, speed: 3.4, radius: 2.6, damage: 36, xp: 50, color: 0xffd700, minWave: 5, weight: 0, coin: 4, desc: 'Sentinela de ouro e antimatéria. Dispara ondas de choque concêntricas e chuvas de estilhaços.' },
  mine:       { name: 'Mina',            hp: 1,   speed: 0,   radius: 0.6, damage: 24, xp: 0,  color: 0xffe02d, minWave: 99, weight: 0,  coin: 0, desc: 'Mina estática de proximidade altamente sensível.' },
};

export const RARITY_MULT: Record<Rarity, number> = { common: 1, rare: 1.5, epic: 2.2, legendary: 3.2 };
export const RARITY_COLOR: Record<Rarity, string> = { common: '#c8d6e5', rare: '#3fa9ff', epic: '#c05cff', legendary: '#ffcf40' };
export const RARITY_NAME: Record<Rarity, string> = { common: 'Comum', rare: 'Rara', epic: 'Épica', legendary: 'Lendária' };

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  base: number;
  max: number;
  unit: 'pct' | 'flat' | 'count';
  desc: (v: number) => string;
  exclude?: HeroId[];
  onlyHero?: HeroId;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'multishot', name: 'Tiro Múltiplo', icon: '⋔', base: 1, max: 3, unit: 'count', desc: v => `+${v} projétil(eis) por disparo` },
  { id: 'pierce', name: 'Perfuração', icon: '➶', base: 1, max: 4, unit: 'count', desc: v => `Projéteis atravessam +${v} inimigo(s)`, exclude: ['otton', 'carlinhos'] },
  { id: 'ricochet', name: 'Ricochete', icon: '↯', base: 1, max: 3, unit: 'count', desc: v => `Projéteis ricocheteiam +${v} vez(es)`, exclude: ['otton', 'carlinhos'] },
  { id: 'lifesteal', name: 'Roubo de Vida', icon: '❤', base: 1.5, max: 4, unit: 'pct', desc: v => `Cura ${v}% de todo dano causado` },
  { id: 'drone', name: 'Drone Auxiliar', icon: '◈', base: 1, max: 3, unit: 'count', desc: v => `+${v} drone orbital que atira automaticamente` },
  { id: 'burn', name: 'Queimadura', icon: '🔥', base: 12, max: 4, unit: 'pct', desc: v => `+${v}% de chance de incendiar inimigos` },
  { id: 'freeze', name: 'Congelamento', icon: '❄', base: 8, max: 4, unit: 'pct', desc: v => `+${v}% de chance de congelar inimigos` },
  { id: 'firerate', name: 'Cadência', icon: '⚡', base: 12, max: 5, unit: 'pct', desc: v => `+${v}% de velocidade de ataque` },
  { id: 'damage', name: 'Dano Anti-Aura', icon: '✸', base: 15, max: 6, unit: 'pct', desc: v => `+${v}% de dano em todos os ataques` },
  { id: 'crit', name: 'Precisão Crítica', icon: '✦', base: 6, max: 5, unit: 'pct', desc: v => `+${v}% de chance crítica (dano x2)` },
  { id: 'maxhp', name: 'Blindagem Extra', icon: '⛨', base: 20, max: 5, unit: 'flat', desc: v => `+${v} HP máximo e restaura a vida ganha` },
  { id: 'speed', name: 'Propulsores', icon: '➤', base: 8, max: 5, unit: 'pct', desc: v => `+${v}% de velocidade de movimento` },
  { id: 'magnet', name: 'Ímã Quântico', icon: '◎', base: 25, max: 4, unit: 'pct', desc: v => `+${v}% de raio de coleta magnética` },
  { id: 'armor', name: 'Armadura', icon: '▣', base: 1.5, max: 4, unit: 'flat', desc: v => `-${v} de dano recebido por acerto` },
  { id: 'regen', name: 'Nanobots', icon: '✚', base: 0.8, max: 4, unit: 'flat', desc: v => `Regenera +${v} HP por segundo` },
  { id: 'area', name: 'Amplitude', icon: '⊕', base: 15, max: 4, unit: 'pct', desc: v => `+${v}% de área e tamanho dos ataques` },
  { id: 'projspeed', name: 'Velocidade Balística', icon: '»', base: 15, max: 4, unit: 'pct', desc: v => `+${v}% de velocidade dos projéteis`, exclude: ['otton', 'carlinhos'] },
  { id: 'ultcd', name: 'Reator Supremo', icon: '☢', base: 10, max: 4, unit: 'pct', desc: v => `-${v}% de recarga da Habilidade Suprema` },
  { id: 'xpgain', name: 'Sabedoria Cósmica', icon: '✧', base: 12, max: 4, unit: 'pct', desc: v => `+${v}% de XP obtido` },
  { id: 'explosive', name: 'Munição Explosiva', icon: '✺', base: 10, max: 4, unit: 'pct', desc: v => `+${v}% de chance de explosão ao acertar` },
  { id: 'knockback', name: 'Impacto', icon: '⇉', base: 30, max: 3, unit: 'pct', desc: v => `+${v}% de repulsão nos ataques` },

  // Armas Secundárias (Armas Ativas) - Desbloqueio Único (max: 1)
  { id: 'weapon_missile', name: 'Pod de Micro-Mísseis', icon: '🚀', base: 1, max: 1, unit: 'count', desc: () => 'Instala lançador de micro-mísseis teleguiados de alta precisão' },
  { id: 'weapon_saw', name: 'Lâminas Orbitais', icon: '⚙', base: 1, max: 1, unit: 'count', desc: () => 'Instala 3 lâminas rotativas de plasma que orbitam a nave cortando inimigos' },
  { id: 'weapon_tesla', name: 'Bobina de Tesla', icon: '⚡', base: 1, max: 1, unit: 'count', desc: () => 'Instala bobina de Tesla que dispara arcos elétricos em cadeia entre monstros' },
  { id: 'weapon_gravity', name: 'Poço Gravitacional', icon: '🌀', base: 1, max: 1, unit: 'count', desc: () => 'Instala emissor de vórtices gravitacionais que sugam e implodem inimigos' },
  { id: 'weapon_flamethrower', name: 'Lança-Chamas de Plasma', icon: '🔥', base: 1, max: 1, unit: 'count', desc: () => 'Instala lança-chamas contínuo de plasma de curto alcance e alto DPS' },
  { id: 'weapon_railgun', name: 'Canhão de Trilho Gauss', icon: '⚡', base: 1, max: 1, unit: 'count', desc: () => 'Instala canhão de trilho Gauss cinético de alta perfuração' },

  // Dash Especiais - Habilidades de Ativação Única (max: 1)
  { id: 'dash_flame', name: 'Rastro Flamejante', icon: '🔥', base: 1, max: 1, unit: 'count', desc: () => 'O propulsor do Dash incinera a arena deixando rastro contínuo de fogo no solo' },
  { id: 'dash_kinetic', name: 'Impacto Cinético', icon: '💥', base: 1, max: 1, unit: 'count', desc: () => 'O Dash arremessa e atordoa inimigos no caminho com uma violenta onda de choque cinética' },

  // =========================================================================
  // MELHORIAS PERSONALIZADAS EXCLUSIVAS POR PERSONAGEM (max: 1)
  // =========================================================================
  // BIG
  {
    id: 'hero_big_flame_bottle',
    name: 'Garrafa Flamejante',
    icon: '🔥',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'big',
    desc: () => 'A Garrafa do Big agora detona em um inferno estelar: incendeia todos os inimigos e deixa uma zona de fogo por 6s na arena',
  },
  {
    id: 'hero_big_plasma_accelerator',
    name: 'Acelerador de Plasma',
    icon: '⚡',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'big',
    desc: () => 'Tiros da Pistola Anti-Aura ganham +40% de velocidade balística e geram estilhaços ricocheteantes ao acertar',
  },
  {
    id: 'hero_big_rapid_silo',
    name: 'Silo Quântico de Garrafas',
    icon: '🍾',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'big',
    desc: () => '-30% no tempo de recarga e +35% de raio de impacto para A Garrafa do Big',
  },

  // OTTON
  {
    id: 'hero_otton_bleeding_strike',
    name: 'Karatê Dilacerante',
    icon: '🩸',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'otton',
    desc: () => 'Golpes de Karatê dilaceram os inimigos, causando sangramento contínuo (35 dano/s por 3.5s) e +40% de repulsão',
  },
  {
    id: 'hero_otton_burning_passion',
    name: 'Amor Fervoroso',
    icon: '💖',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'otton',
    desc: () => '\'Apaixonado\' dispara salvas adicionais de orbes em 360° que ricocheteiam nas bordas e detonam em micro-corações de plasma',
  },
  {
    id: 'hero_otton_gladiator_armor',
    name: 'Fúria do Brutamontes',
    icon: '🥊',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'otton',
    desc: () => 'Golpes de Karatê ativam Fúria: +25% de velocidade e cadência, e -15% de dano recebido por 4s',
  },

  // THIAGO
  {
    id: 'hero_thiago_caustic_puddle',
    name: 'Poças Cáusticas',
    icon: '🧪',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'thiago',
    desc: () => 'Gotículas da Garrafa Lançadora criam poças bio-tóxicas no solo por 5s, causando corrosão contínua e lentidão',
  },
  {
    id: 'hero_thiago_chain_reaction',
    name: 'Reação Bio-Tóxica em Cadeia',
    icon: '☣',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'thiago',
    desc: () => 'Inimigos derrotados sob corrosão explodem em nuvem tóxica de raio 4m, infectando todos os monstros vizinhos',
  },
  {
    id: 'hero_thiago_inconvenience_surge',
    name: 'Inconveniência Catastrófica',
    icon: '🌪',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'thiago',
    desc: () => 'O domo da Suprema expande 35% mais longe, arremessa com força extrema e restaura HP por monstro repelido',
  },

  // PIETRO
  {
    id: 'hero_pietro_echo_glyphs',
    name: 'Ecos Arcanos',
    icon: '🔮',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'pietro',
    desc: () => 'Runas da Fala Incômoda liberam fragmentos espectrais teleguiados em inimigos próximos ao perfurarem alvos',
  },
  {
    id: 'hero_pietro_eternal_orbit',
    name: 'Liturgia Ancestral',
    icon: '📜',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'pietro',
    desc: () => 'As 4 Malditas Palavras duram +4s, orbitam 25% mais velozes e disparam raios cósmicos periódicos',
  },
  {
    id: 'hero_pietro_cosmic_vulnerability',
    name: 'Anátema Cósmico',
    icon: '👁',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'pietro',
    desc: () => 'Inimigos atingidos por Pietro recebem Anátema Cósmico: +25% de dano sofrido de todas as fontes por 5s',
  },

  // CARLINHOS
  {
    id: 'hero_carlinhos_echoing_peace',
    name: 'Eco da Gentileza',
    icon: '🌊',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'carlinhos',
    desc: () => 'A Onda de Gentileza pulsa em dobro: dispara uma segunda onda de compaixão consecutiva com 70% de dano',
  },
  {
    id: 'hero_carlinhos_divine_grace',
    name: 'Graça Divina',
    icon: '🕊',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'carlinhos',
    desc: () => '\'Bondade\' restaura 100% da vida máxima, confere 3s de invulnerabilidade e faz chover colunas de luz sagrada',
  },
  {
    id: 'hero_carlinhos_pacifist_healing',
    name: 'Compaixão Curativa',
    icon: '💛',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'carlinhos',
    desc: () => 'Inimigos repelidos pela onda têm 25% de chance de soltar esferas de luz curativa que restauram sua nave',
  },

  // MACEDO
  {
    id: 'hero_macedo_magnetic_traps',
    name: 'Vórtice Telemático',
    icon: '🧲',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'macedo',
    desc: () => 'Armadilhas atraem magneticamente os monstros ao centro e disparam pulsos elétricos 30% mais rápido',
  },
  {
    id: 'hero_macedo_overload_cascade',
    name: 'Sobrecarga em Cascata',
    icon: '⚡',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'macedo',
    desc: () => '\'Surto Comunicativo\' faz cada inimigo na tela disparar arcos elétricos que saltam para 2 outros monstros',
  },
  {
    id: 'hero_macedo_quantum_network',
    name: 'Rede de Repetidoras',
    icon: '📡',
    base: 1,
    max: 1,
    unit: 'count',
    onlyHero: 'macedo',
    desc: () => '+2 armadilhas simultâneas em campo. Cada armadilha ativa concede +4% de velocidade e dano à nave',
  },
];

export type SecondaryWeaponId = 'missile_pod' | 'orbital_saw' | 'tesla_coil' | 'gravity_well' | 'flamethrower' | 'railgun';

export interface SecondaryWeaponDef {
  id: SecondaryWeaponId;
  name: string;
  icon: string;
  desc: string;
  baseDmg: number;
  cooldown: number;
  color: number;
  pairedUpgrade: string;
  evoId: string;
  evoName: string;
  evoDesc: string;
  evoColor: number;
}

export const SECONDARY_WEAPONS: Record<SecondaryWeaponId, SecondaryWeaponDef> = {
  missile_pod: {
    id: 'missile_pod',
    name: 'Pod de Micro-Mísseis',
    icon: '🚀',
    desc: 'Lança salvas de micro-mísseis teleguiados de alta precisão.',
    baseDmg: 28,
    cooldown: 2.2,
    color: 0xff7020,
    pairedUpgrade: 'explosive',
    evoId: 'macabre_swarm',
    evoName: 'Enxame Macabro',
    evoDesc: 'Dispara uma tempestade implacável de dezenas de ogivas nucleares que rastreiam múltiplos alvos.',
    evoColor: 0xff3000,
  },
  orbital_saw: {
    id: 'orbital_saw',
    name: 'Lâminas Orbitais',
    icon: '⚙',
    desc: 'Lâminas de energia rotativas que orbitam a nave cortando tudo ao redor.',
    baseDmg: 22,
    cooldown: 0.15,
    color: 0x00f0ff,
    pairedUpgrade: 'speed',
    evoId: 'stellar_saw',
    evoName: 'Anel de Destruição Estelar',
    evoDesc: 'Três anéis concêntricos de serras de plasma que se expandem e trituram qualquer horda.',
    evoColor: 0x00ffff,
  },
  tesla_coil: {
    id: 'tesla_coil',
    name: 'Bobina de Tesla',
    icon: '⚡',
    desc: 'Dispara arcos elétricos que saltam entre múltiplos inimigos e causam curto-circuito.',
    baseDmg: 34,
    cooldown: 1.8,
    color: 0x60a5fa,
    pairedUpgrade: 'multishot',
    evoId: 'mjolnir_storm',
    evoName: 'Tempestade de Mjolnir',
    evoDesc: 'Raios cósmicos que encadeiam em cascata por até 12 inimigos simultaneamente.',
    evoColor: 0x93c5fd,
  },
  gravity_well: {
    id: 'gravity_well',
    name: 'Poço Gravitacional',
    icon: '🌀',
    desc: 'Projeta mini-buracos negros periódicos que sugam inimigos e causam implosão.',
    baseDmg: 45,
    cooldown: 3.5,
    color: 0xa855f7,
    pairedUpgrade: 'area',
    evoId: 'singularity_well',
    evoName: 'Buraco Negro Supermassivo',
    evoDesc: 'Domo de colapso quântico que suga a tela inteira e detona em supernova devastadora.',
    evoColor: 0xc084fc,
  },
  flamethrower: {
    id: 'flamethrower',
    name: 'Lança-Chamas de Plasma',
    icon: '🔥',
    desc: 'Cone contínuo de fogo de plasma de curto alcance e alto DPS que derrete blindagens.',
    baseDmg: 16,
    cooldown: 0.08,
    color: 0xff4500,
    pairedUpgrade: 'burn',
    evoId: 'solar_inferno',
    evoName: 'Inferno Solar',
    evoDesc: 'Anel colossal de 360° em volta da nave com labaredas solares devastadoras e dano massivo.',
    evoColor: 0xff2200,
  },
  railgun: {
    id: 'railgun',
    name: 'Canhão de Trilho Gauss',
    icon: '⚡',
    desc: 'Dispara um feixe cinético perfurante em linha reta infinita que aniquila colunas inimigas.',
    baseDmg: 85,
    cooldown: 2.6,
    color: 0x00ffff,
    pairedUpgrade: 'crit',
    evoId: 'hadron_collider',
    evoName: 'Colisor de Hádrons',
    evoDesc: 'O feixe abre uma fenda de vácuo no espaço que implode após 0.8s causando dano em linha duplicado.',
    evoColor: 0x55ffff,
  },
};

export interface PrimaryEvolutionDef {
  heroId: HeroId;
  pairedUpgrade: string;
  evoId: string;
  name: string;
  desc: string;
  icon: string;
  color: number;
}

export const PRIMARY_EVOLUTIONS: Record<HeroId, PrimaryEvolutionDef> = {
  big: {
    heroId: 'big',
    pairedUpgrade: 'firerate',
    evoId: 'singularity_cannon',
    name: 'Canhão de Singularidade Quântica',
    desc: 'Lasers perfurantes acelerados que detonam mini-supernovas ao longo da trajetória.',
    icon: '💫',
    color: 0x00e5ff,
  },
  otton: {
    heroId: 'otton',
    pairedUpgrade: 'area',
    evoId: 'dimensional_cleave',
    name: 'Corte Dimensional 360°',
    desc: 'Tempestade contínua de vácuo cortante em 360 graus que desintegra inimigos próximos.',
    icon: '⚔',
    color: 0xff4a2a,
  },
  thiago: {
    heroId: 'thiago',
    pairedUpgrade: 'burn',
    evoId: 'acid_tempest',
    name: 'Chuva Ácida Planetária',
    desc: 'Bruma cáustica persistente que derrete a blindagem e queima inimigos em área imensa.',
    icon: '☣',
    color: 0x8cff2a,
  },
  pietro: {
    heroId: 'pietro',
    pairedUpgrade: 'damage',
    evoId: 'apocalypse_lexicon',
    name: 'Léxico do Apocalipse',
    desc: 'Hieróglifos ancestrais gigantes que ricocheteiam infinitamente e aniquilam defesas.',
    icon: '🔮',
    color: 0xc05cff,
  },
  carlinhos: {
    heroId: 'carlinhos',
    pairedUpgrade: 'area',
    evoId: 'unconditional_love',
    name: 'Amor Incondicional',
    desc: 'Ondas colossais de compaixão em 360° que cobrem a arena, curam a nave por acerto e desintegram a hostilidade inimiga.',
    icon: '💖',
    color: 0xffcc44,
  },
  macedo: {
    heroId: 'macedo',
    pairedUpgrade: 'firerate',
    evoId: 'telematics_network',
    name: 'Rede Neural Telemática',
    desc: 'Armadilhas de telemensagem criam conexões laser e relâmpagos em cadeia contínuos entre si, formando uma teia eletromagnética letal.',
    icon: '📡',
    color: 0x44ddff,
  },
};

export interface AscensionPerkDef {
  id: string;
  heroId: HeroId;
  name: string;
  title: string;
  desc: string;
  icon: string;
}

export const ASCENSION_PERKS: Record<HeroId, [AscensionPerkDef, AscensionPerkDef]> = {
  big: [
    {
      id: 'big_lightning_interceptor',
      heroId: 'big',
      name: 'Interceptador Relâmpago',
      title: 'Velocidade & Pós-Combustão',
      desc: '+30% velocidade de voo e pós-combustão contínua que incendeia inimigos ao redor.',
      icon: '⚡',
    },
    {
      id: 'big_siege_cannoneer',
      heroId: 'big',
      name: 'Canhoneiro de Cerco',
      title: 'Artilharia Pesada de Plasma',
      desc: 'Tiros primários ganham +100% de dano e causam explosões de plasma ao impacto.',
      icon: '💥',
    },
  ],
  otton: [
    {
      id: 'otton_dimensional_blade',
      heroId: 'otton',
      name: 'Lâmina Dimensional',
      title: 'Vácuo Cortante de Longo Alcance',
      desc: 'Golpes de karatê disparam lâminas de vácuo cortantes de longo alcance em linha reta.',
      icon: '⚔',
    },
    {
      id: 'otton_armored_colossus',
      heroId: 'otton',
      name: 'Colosso Blindado',
      title: 'Fortaleza Inabalável',
      desc: '+120 HP, armadura duplicada e reflete 40% do dano de contato em área.',
      icon: '🛡',
    },
  ],
  thiago: [
    {
      id: 'thiago_caustic_alchemist',
      heroId: 'thiago',
      name: 'Alquimista Cáustico',
      title: 'Regeneração & Persistência Bio-Química',
      desc: 'Poças de ácido curam a nave quando pisadas e duram o dobro do tempo na arena.',
      icon: '🧪',
    },
    {
      id: 'thiago_epidemic_vector',
      heroId: 'thiago',
      name: 'Vetor Epidêmico',
      title: 'Contágio Catastrófico',
      desc: 'Inimigos corroídos explodem ao morrer espalhando veneno com dano triplicado.',
      icon: '☣',
    },
  ],
  pietro: [
    {
      id: 'pietro_esoteric_guardian',
      heroId: 'pietro',
      name: 'Guardião Esotérico',
      title: 'Deflexão Rúnica Permanente',
      desc: 'Runas giram permanentemente como escudo defletor de tiros e projéteis inimigos.',
      icon: '🛡',
    },
    {
      id: 'pietro_herald_of_void',
      heroId: 'pietro',
      name: 'Arauto do Vácuo',
      title: 'Cataclismo Astral Prolongado',
      desc: 'A Suprema dura 10s e faz chover colunas de raios cósmicos contínuos.',
      icon: '🌌',
    },
  ],
  carlinhos: [
    {
      id: 'carlinhos_celestial_harmony',
      heroId: 'carlinhos',
      name: 'Harmonia Celestial',
      title: 'Bênção Protetora',
      desc: 'Ondas de bondade geram escudos temporários acumuláveis para a nave.',
      icon: '✨',
    },
    {
      id: 'carlinhos_resonant_love',
      heroId: 'carlinhos',
      name: 'Amor Ressonante',
      title: 'Purificação Ofensiva',
      desc: 'Ondas causam 150% mais dano e limpam todos os tiros inimigos na tela ao passarem.',
      icon: '💖',
    },
  ],
  macedo: [
    {
      id: 'macedo_telematic_mesh',
      heroId: 'macedo',
      name: 'Rede Telemática Mesh',
      title: 'Conexão Laser Partilhada',
      desc: 'Armadilhas conectam lasers entre si e transmitem 50% de dano compartilhado.',
      icon: '🌐',
    },
    {
      id: 'macedo_static_pulsar',
      heroId: 'macedo',
      name: 'Pulsar Estático',
      title: 'Sobrecarga Eletromagnética Dupla',
      desc: 'Armadilhas disparam pulsos em dobro com atordoamento eletromagnético prolongado.',
      icon: '⚡',
    },
  ],
};

export type MetaId = 'hp' | 'dmg' | 'speed' | 'magnet' | 'armor' | 'xp' | 'ultcd' | 'luck';

export interface MetaUpgradeDef {
  id: MetaId;
  name: string;
  icon: string;
  max: number;
  desc: (lvl: number) => string;
  cost: (lvl: number) => number;
}

const metaCost = (lvl: number) => 20 + lvl * 15 + Math.floor(lvl * lvl * 2.5);

export const META_UPGRADES: MetaUpgradeDef[] = [
  { id: 'hp', name: 'Blindagem Reforçada', icon: '⛨', max: 10, desc: l => `+${l * 10} HP máximo`, cost: metaCost },
  { id: 'dmg', name: 'Núcleo Anti-Aura', icon: '✸', max: 10, desc: l => `+${l * 5}% de dano`, cost: metaCost },
  { id: 'speed', name: 'Propulsão Iônica', icon: '➤', max: 10, desc: l => `+${l * 3}% de velocidade`, cost: metaCost },
  { id: 'magnet', name: 'Vácuo Magnético', icon: '◎', max: 10, desc: l => `+${l * 10}% de raio de coleta`, cost: metaCost },
  { id: 'armor', name: 'Casco de Titânio', icon: '▣', max: 10, desc: l => `-${l} de dano por acerto`, cost: metaCost },
  { id: 'xp', name: 'Processador Neural', icon: '✧', max: 10, desc: l => `+${l * 5}% de XP`, cost: metaCost },
  { id: 'ultcd', name: 'Reator Quântico', icon: '☢', max: 10, desc: l => `-${l * 4}% de recarga da Suprema`, cost: metaCost },
  { id: 'luck', name: 'Sorte Cósmica', icon: '🍀', max: 10, desc: l => `+${l} de sorte (cartas raras)`, cost: metaCost },
];

export interface UpgradeChoice {
  id: string;
  name: string;
  desc: string;
  icon: string;
  rarity: Rarity;
  value: number;
  level: number;
  isEvolution?: boolean;
  isHeroExclusive?: boolean;
  heroName?: string;
  heroColor?: string;
}

export interface Notice {
  id: number;
  text: string;
  sub?: string;
  color?: string;
}

export interface ActiveWeaponState {
  id: string;
  name: string;
  icon: string;
  level: number;
  evolved: boolean;
  damageTotal?: number;
}

export interface RunResult {
  victory: boolean;
  wave: number;
  kills: number;
  time: number;
  coins: number;
  shards: number;
  level: number;
  hero: HeroId;
  dps: number;
  damageBreakdown: Record<string, number>;
  activeWeapons?: ActiveWeaponState[];
  gameMode?: GameMode;
  pacts?: PactId[];
  relics?: string[];
  ascension?: string | null;
}

export interface Snapshot {
  phase: GamePhase;
  hero: HeroId | null;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpNext: number;
  wave: number;
  waveTime: number;
  waveDuration: number;
  kills: number;
  coins: number;
  shards: number;
  time: number;
  dashCd: number;
  dashMax: number;
  ultCd: number;
  ultMax: number;
  ultActive: boolean;
  boss: { name: string; hp: number; max: number; phase: number } | null;
  notice: Notice | null;
  hurt: number;
  choices: UpgradeChoice[];
  upgrades: { id: string; name: string; icon: string; level: number }[];
  activeWeapons: ActiveWeaponState[];
  aimMode: 'auto' | 'manual';
  fps: number;
  endless: boolean;
  result: RunResult | null;
  bossWarning: boolean;
  dps: number;
  damageBreakdown?: Record<string, number>;
  crateAlert?: boolean;
  gameMode: GameMode;
  pacts: PactId[];
  relics: string[];
  ascensionPerk: string | null;
  ascensionChoice: [AscensionPerkDef, AscensionPerkDef] | null;
  activeArenaEvent: { type: string; name: string; desc: string; icon: string; timer: number; color: string } | null;
  offscreenThreats: { angle: number; distance: number; isBoss: boolean; name: string }[];
}

export const LORE = [
  'Ano 2026. A Terra foi infiltrada por alienígenas parasitas conhecidos como FARM\'AURAS.',
  'O "Farmador de Aura" da escola era, na verdade, um espião alienígena. Ele sequestrou Carlinhos e Macedo e fugiu para o vácuo espacial.',
  'Elon Musk disponibilizou naves de combate de última geração e armas experimentais anti-aura: o PROJETO ANTI-AURA.',
  'Sua missão: resgatar a dupla, aniquilar a frota invasora e destruir a base estelar do Farmador.',
];

export function xpForLevel(level: number): number {
  return Math.floor(8 + level * 5 + Math.pow(level, 1.5) * 2);
}

export function enemyHpMul(wave: number): number {
  const w = Math.max(0, wave - 1);
  return 1 + w * 0.28 + Math.pow(w, 1.85) * 0.035;
}

export function enemyDmgMul(wave: number): number {
  const w = Math.max(0, wave - 1);
  return 1 + w * 0.10 + Math.pow(w, 1.4) * 0.03;
}

export function enemySpeedMul(wave: number): number {
  const w = Math.max(0, wave - 1);
  return 1 + Math.min(0.65, w * 0.03);
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
