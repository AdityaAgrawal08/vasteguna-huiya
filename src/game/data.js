// Roster, frame data and stage palettes for Sansad Showdown.
// All fighters share one skeleton; looks drive the procedural 3D rig and 2D portraits.

export const CHARACTERS = {
  modi: {
    id: 'modi',
    name: 'MODI',
    fullName: 'Modi',
    party: 'Team Saffron',
    accent: '#ff9933',
    look: {
      skin: 0xc29a69, skinShade: 0xa66446, hair: 0xf2f2ea, hairStyle: 'receding',
      beard: 0xf4f4ec, beardStyle: 'full-white', brows: 0xe8dcc0,
      topStyle: 'kurta-jacket', top: 0xf3e8d2, jacket: 0xf08a3c, pants: 0xf6f0e0,
      shoes: 0x3b2416, glasses: true, shoulders: 1.05, belly: 1.25, scale: 1.0,
    },
    walkFwd: 2.1, walkBack: 1.6, jumpV: 7.6, jumpVx: 2.4, damageMul: 1.08,
    moveNames: {
      special1: 'DEMONETIZATION PALM!', special2: 'SURGICAL STRIKE!',
      finisher: 'MANN KI BAAT COMBO!', sweep: 'GST SWEEP!',
      uppercut: 'VIKAS UPPERCUT!', grab: 'HUGPLOMACY!',
      roundhouse: 'ACHHE DIN ROUNDHOUSE!',
    },
    superName: 'SUDARSHAN CHAKRA',
    superDesc: 'Leaps skyward, spins a blazing chakra out of thin air and hurls it at the opponent for 30% damage.',
    introLine: 'Mitron!',
    winLine: 'Abki baar, jeet hamari!',
    dance: { label: 'GARBA TIME!', colors: [0xff9933, 0xffffff, 0xffd23f] },
    theme: 0.5,
  },
  rahul: {
    id: 'rahul',
    name: 'RAHUL',
    fullName: 'Rahul',
    party: 'Team Tiranga',
    accent: '#2e9bff',
    look: {
      skin: 0xd29470, skinShade: 0xb5817a, hair: 0x2f2a27, hairStyle: 'side-part',
      beard: 0x8d8480, beardStyle: 'stubble-grey', brows: 0x2a2220,
      topStyle: 'tshirt', top: 0xf7f4e4, jacket: 0xf7f4e4, pants: 0x5d6c70,
      shoes: 0x2d2c23, glasses: false, shoulders: 1.1, belly: 0.9, scale: 1.04,
    },
    walkFwd: 2.4, walkBack: 1.9, jumpV: 8.0, jumpVx: 2.7, damageMul: 1.0,
    moveNames: {
      special1: 'NYAY UPPERCUT!', special2: 'BHARAT JODO KICK!',
      finisher: 'KHATA-KHAT COMBO!', sweep: 'YATRA SWEEP!',
      uppercut: 'GARIBI HATAO UPPERCUT!', grab: 'AIKIDO KHATA-KHAT!',
      roundhouse: 'MOHABBAT ROUNDHOUSE!',
    },
    superName: 'ALOO SE SONA',
    superDesc: 'Zaps the opponent into a potato, feeds it into his machine and pulls out pure gold, for 30% damage.',
    introLine: 'Darro mat!',
    winLine: 'Mohabbat ki dukaan khul gayi!',
    dance: { label: 'BALLE BALLE!', colors: [0x2e9bff, 0xffffff, 0x138808] },
    theme: 0.6,
  },
  didi: {
    id: 'didi',
    name: 'DIDI',
    fullName: 'Didi',
    party: 'Team Bangla',
    accent: '#22b35e',
    look: {
      skin: 0xc48c62, skinShade: 0xa87a4c, hair: 0x1d1918, hairStyle: 'bun',
      beard: 0x1d1918, beardStyle: 'none', brows: 0x2a2220,
      topStyle: 'sari', top: 0xf6f0ce, jacket: 0xe88a56, pants: 0xf6f0ce,
      shoes: 0xf2f2b2, glasses: true, shoulders: 0.92, belly: 1.05, scale: 0.84,
    },
    walkFwd: 2.6, walkBack: 2.1, jumpV: 7.4, jumpVx: 2.6, damageMul: 0.95,
    moveNames: {
      special1: 'CHAPPAL SLAP!', special2: 'PADAYATRA KICK!',
      finisher: 'KHELA HOBE COMBO!', sweep: 'MA MATI SWEEP!',
      uppercut: 'JAI BANGLA UPPERCUT!', grab: 'CHAPPAL CHAMATKAR!',
      roundhouse: 'DIDI ROUNDHOUSE!',
    },
    superName: 'JADU HOBE',
    superDesc: 'Stirs a bubbling black pot to a "humba humba" chant, then turns the opponent into a frog for 30% damage.',
    introLine: 'Khela hobe!',
    winLine: 'Jai Bangla! Khela shesh!',
    dance: { label: 'KHELA HOBE!', colors: [0x22b35e, 0xffffff, 0x2e9bff] },
    theme: 0.45,
  },
  trump: {
    id: 'trump',
    name: 'TRUMP',
    fullName: 'Trump',
    party: 'Team Tariff',
    accent: '#e0262f',
    look: {
      skin: 0xe8a430, skinShade: 0xc8891a, hair: 0xf0c060, hairStyle: 'side-part',
      beard: 0xf0c060, beardStyle: 'none', brows: 0xd8a800,
      topStyle: 'kurta-jacket', top: 0xf4e6c8, jacket: 0x1c2020, pants: 0x1c2020,
      shoes: 0x111111, glasses: false, shoulders: 1.15, belly: 1.3, scale: 1.03,
    },
    walkFwd: 1.95, walkBack: 1.5, jumpV: 7.3, jumpVx: 2.3, damageMul: 1.1,
    moveNames: {
      special1: 'EXECUTIVE ORDER!', special2: 'BIGLY KICK!',
      finisher: 'TREMENDOUS COMBO!', sweep: 'DEAL SWEEP!',
      uppercut: 'MAGA UPPERCUT!', grab: 'POWER HANDSHAKE!',
      roundhouse: "YOU'RE FIRED ROUNDHOUSE!",
    },
    superName: 'TARIFF TSUNAMI',
    superDesc: 'Signs a golden order, whips TARIFF crates into a vortex, then slams a giant stamp for 30% damage.',
    introLine: 'Make Sansad Great Again!',
    winLine: 'Nobody fights better than me. Nobody!',
    dance: { label: 'TREMENDOUS!', colors: [0xe0262f, 0xffffff, 0x0a3161] },
    theme: 0.4,
  },
  yogi: {
    id: 'yogi',
    name: 'YOGI',
    fullName: 'Yogi',
    party: 'Team Bhagwa',
    accent: '#f05a00',
    look: {
      skin: 0x9c6b48, skinShade: 0x80513a, hair: 0x3a2a24, hairStyle: 'receding',
      beard: 0x3a2a24, beardStyle: 'none', brows: 0x2a2220,
      topStyle: 'kurta-jacket', top: 0xf28a3c, jacket: 0xf06a2c, pants: 0xf28a3c,
      shoes: 0x1a1a1a, glasses: false, shoulders: 1.08, belly: 1.1, scale: 0.98,
    },
    walkFwd: 2.2, walkBack: 1.7, jumpV: 7.5, jumpVx: 2.4, damageMul: 1.06,
    moveNames: {
      special1: 'BULLDOZER PUNCH!', special2: 'GORAKHPUR KICK!',
      finisher: 'SURYA NAMASKAR COMBO!', sweep: 'YOGI SWEEP!',
      uppercut: 'UP-PERCUT!', grab: 'PATKI PATAKH!',
      roundhouse: 'BHAGWA ROUNDHOUSE!',
    },
    superName: 'BABA KA BULLDOZER',
    superDesc: 'Eyes glow red, a bulldozer charges in and slams its bucket down three times for 30% damage.',
    introLine: 'Bulldozer taiyaar hai!',
    winLine: 'Kaam bolta hai, bulldozer chalta hai!',
    dance: { label: 'BABA KA SWAG!', colors: [0xf05a00, 0xffffff, 0xffc400] },
    theme: 0.55,
  },
  nitin: {
    id: 'nitin',
    name: 'NITIN',
    fullName: 'Nitin',
    party: 'Team Highway',
    accent: '#ff9a1f',
    look: {
      skin: 0xc88a4a, skinShade: 0xa87a50, hair: 0x1c1a19, hairStyle: 'side-part',
      beard: 0x2a2220, beardStyle: 'none', brows: 0x1f1a18,
      topStyle: 'tshirt', top: 0xf6f0ce, jacket: 0xf6f0ce, pants: 0xf2f2b2,
      shoes: 0x3a2a1e, glasses: false, shoulders: 1.15, belly: 1.25, scale: 1.02,
    },
    walkFwd: 2.1, walkBack: 1.7, jumpV: 7.6, jumpVx: 2.5, damageMul: 1.05,
    moveNames: {
      special1: 'TOLL TAX UPPERCUT!', special2: 'FLYOVER KICK!',
      finisher: 'GATI SHAKTI COMBO!', sweep: 'SPEED BREAKER SWEEP!',
      uppercut: 'BHOOMI PUJAN UPPERCUT!', grab: 'FASTAG FLIP!',
      roundhouse: 'RING ROAD ROUNDHOUSE!',
    },
    superName: 'GADDHA BLAST',
    superDesc: 'Opens a pothole under the opponent, brews sugarcane into E20, pours it in, lights a match and walks away, for 30% damage.',
    introLine: 'Paisa ki kami nahi hai!',
    winLine: 'Highway ban gaya, kaam ho gaya!',
    dance: { label: 'ZINGAAT!', colors: [0xff9a1f, 0xffffff, 0x138808] },
    theme: 0.65,
  },
}

export const ROSTER = ['modi', 'rahul', 'didi', 'trump', 'yogi', 'nitin']

export const STAGES = {
  sansad: { id: 'sansad', name: 'SANSAD BHAVAN', subtitle: 'Parliament at sunset' },
  jantar: { id: 'jantar', name: 'JANTAR MANTAR', subtitle: 'Protest ground, New Delhi' },
  road: { id: 'road', name: 'DESI SADAK', subtitle: 'Gali, thela aur traffic' },
}

export const STAGE_PALETTES = {
  sansad: {
    skyTop: 0x1b2a1a, skyMid: 0xe8733c, skyBottom: 0xffc9b0, fog: 0xe9a86a,
    fogNear: 28, fogFar: 75, ground: 0x8a6f4a, platformSide: 0x8c3f3e,
    sunColor: 0xffd4a0, sunIntensity: 2.6, sunPos: [-6, 12, 9],
    hemiSky: 0xffd2a0, hemiGround: 0x5a3a2a, hemiIntensity: 1.25,
    sunDisc: [-30, 9, -80], sunDiscColor: 0xffd7a4, exposure: 1.05, floorRoughness: 0.62,
  },
  jantar: {
    skyTop: 0x2f6b44, skyMid: 0x93b8ea, skyBottom: 0xf2e0a0, fog: 0xd8c8a2,
    fogNear: 35, fogFar: 110, ground: 0x5d8a6a, platformSide: 0xa8483a,
    sunColor: 0xffd8a8, sunIntensity: 2.8, sunPos: [7, 16, 10],
    hemiSky: 0xdceaff, hemiGround: 0x6b5a3a, hemiIntensity: 1.3,
    sunDisc: [45, 38, -90], sunDiscColor: 0xfff0c0, exposure: 0.95, floorRoughness: 0.9,
  },
  road: {
    skyTop: 0x7fa4c4, skyMid: 0xd8b06a, skyBottom: 0xe8d0a8, fog: 0xcdb48a,
    fogNear: 22, fogFar: 70, ground: 0x6e5a42, platformSide: 0x3f3a32,
    sunColor: 0xffd0a0, sunIntensity: 2.5, sunPos: [-8, 14, 9],
    hemiSky: 0xf2d8a8, hemiGround: 0x5a4a30, hemiIntensity: 1.3,
    sunDisc: [-40, 30, -90], sunDiscColor: 0xffd8a8, exposure: 1.0, floorRoughness: 0.95,
  },
}

// Frame data is expressed in 60 Hz frames, exactly like a classic 3D fighter.
export const MOVES = {
  jab: { id: 'jab', startup: 5, active: 3, recovery: 10, damage: 5, height: 'high', reach: 1.0, hitstun: 16, blockstun: 10, knockdown: false, launch: 0, push: 1.6, lunge: 0.8, chains: { punch: 'cross', kick: 'kick' } },
  cross: { id: 'cross', startup: 6, active: 3, recovery: 12, damage: 6, height: 'high', reach: 1.05, hitstun: 18, blockstun: 11, knockdown: false, launch: 0, push: 1.8, lunge: 1.0, chains: { punch: 'uppercut', kick: 'finisher' } },
  kick: { id: 'kick', startup: 9, active: 4, recovery: 15, damage: 9, height: 'mid', reach: 1.3, hitstun: 22, blockstun: 13, knockdown: false, launch: 0, push: 2.0, lunge: 0.6, chains: { kick: 'roundhouse' } },
  uppercut: { id: 'uppercut', startup: 9, active: 4, recovery: 20, damage: 11, height: 'mid', reach: 1.05, hitstun: 24, blockstun: 15, knockdown: true, launch: 8, push: 1.4, lunge: 0.9 },
  roundhouse: { id: 'roundhouse', startup: 11, active: 5, recovery: 22, damage: 13, height: 'high', reach: 1.45, hitstun: 26, blockstun: 16, knockdown: true, launch: 5, push: 4.5, lunge: 0.8 },
  finisher: { id: 'finisher', startup: 10, active: 4, recovery: 20, damage: 12, height: 'mid', reach: 1.35, hitstun: 24, blockstun: 15, knockdown: true, launch: 5.5, push: 3.5, lunge: 1.2 },
  lowJab: { id: 'lowJab', startup: 6, active: 3, recovery: 11, damage: 4, height: 'low', reach: 1.0, hitstun: 18, blockstun: 9, knockdown: false, launch: 0, push: 1.2, lunge: 0.4, crouching: true, chains: { punch: 'uppercut', kick: 'sweep' } },
  sweep: { id: 'sweep', startup: 11, active: 4, recovery: 20, damage: 8, height: 'low', reach: 1.4, hitstun: 22, blockstun: 14, knockdown: true, launch: 3.2, push: 1.6, lunge: 0.4, crouching: true },
  special1: { id: 'special1', startup: 13, active: 4, recovery: 19, damage: 13, height: 'mid', reach: 1.1, hitstun: 26, blockstun: 16, knockdown: true, launch: 7.5, push: 2.2, lunge: 1.8, chains: { kick: 'finisher' } },
  special2: { id: 'special2', startup: 15, active: 5, recovery: 20, damage: 14, height: 'mid', reach: 1.55, hitstun: 26, blockstun: 16, knockdown: true, launch: 4.5, push: 5.2, lunge: 1.4 },
  airPunch: { id: 'airPunch', startup: 4, active: 30, recovery: 0, damage: 7, height: 'mid', reach: 1.05, hitstun: 18, blockstun: 12, knockdown: false, launch: 0, push: 2.0, lunge: 0, air: true },
  airKick: { id: 'airKick', startup: 6, active: 30, recovery: 0, damage: 10, height: 'mid', reach: 1.3, hitstun: 20, blockstun: 13, knockdown: false, launch: 0, push: 2.6, lunge: 0, air: true },
  grab: { id: 'grab', startup: 6, active: 3, recovery: 24, damage: 0, height: 'high', reach: 0.95, hitstun: 0, blockstun: 0, knockdown: false, launch: 0, push: 0, lunge: 0.6, grab: true },
}

export const MOVE_LABELS = {
  jab: 'JAB', cross: 'CROSS', kick: 'KICK', finisher: 'FINISHER', uppercut: 'UPPERCUT',
  roundhouse: 'ROUNDHOUSE', lowJab: 'LOW JAB', sweep: 'SWEEP', special1: 'SPECIAL',
  special2: 'SPECIAL', airPunch: 'AIR PUNCH', airKick: 'AIR KICK', grab: 'GRAB',
}

export const ARENA_HALF_WIDTH = 9.2

export function pickMove(button, crouching, forward) {
  if (button === 'grab') return 'grab'
  if (crouching) return button === 'punch' ? 'lowJab' : 'sweep'
  if (forward) return button === 'punch' ? 'special1' : 'special2'
  return button === 'punch' ? 'jab' : 'kick'
}

export const COMMENTARY = {
  anchors: {
    godi: { name: 'SHOR SHARMA', channel: 'GODI MEDIA' },
    troll: { name: 'TWEETY TROLLWALA', channel: 'TROLL ARMY' },
  },
  godi: {
    hit: [
      'MASTERSTROKE! {M} lands and the nation applauds!',
      'Historic! Unprecedented! {AN} ka {M}!',
      'Experts agree: finest {M} in decades!',
      'The opposition has gone very, very quiet!',
      'Mitron, the josh is officially HIGH!',
    ],
    hurt: [
      'Foreign hand! International conspiracy!',
      '{DN} is merely TESTING the opposition!',
      'That replay is clearly doctored!',
      'A strategic pause. Nothing more!',
      'Who sanctioned this {M}?!',
    ],
  },
  troll: {
    hit: [
      '#{M} is trending number one worldwide!',
      'Delivery direct from the mohabbat shop!',
      '{AN} just landed a khata-khat!',
      'Screenshot it, history is being written!',
      '{D} got ratioed in real life!',
    ],
    hurt: [
      'Paid PR stunt! {DN} allowed that one.',
      'That was a jumla punch, barely tickled!',
      'The bots are boosting that hit!',
      'Fake news! Fact-check still pending!',
      'Bro got hit by a WhatsApp forward.',
    ],
  },
  ticker: [
    'BREAKING: {A} lands {M}. Panel of experts immediately divided',
    'SENSEX {DIR} {N} points after {A} connects with {M}',
    '{D} demands a committee to investigate {M}',
    'Walkout staged after {M} shakes the chamber',
    'Social media splits neatly in half over {M}',
    'Fact-checkers promise a verdict on {M} by 2029',
  ],
  filler: [
    'Weather: a hundred percent chance of jumlas over Delhi',
    'Petrol price rises during the commercial break',
    'Cricket: India wins the toss, elects to watch the fight',
    'Traffic snarls at Raisina Hill as fans gather',
    'Samosa prices at the canteen remain mysteriously subsidised',
    'Exit polls predict both sides will claim victory',
    'Stray cow spotted near Vijay Chowk. Fighters alerted.',
    'Chaiwala reports record sales in the stands',
    'Breaking: nothing happened. Details at nine.',
    'WhatsApp University launches a degree in fight analysis',
  ],
  roundStart: {
    godi: 'Round {R}! {G} is READY!',
    troll: 'Round {R}, bhai. Popcorn ready!',
  },
  finalRound: {
    godi: 'FINAL ROUND! The whole country is watching!',
    troll: 'Final round, bhai. Buckle up!',
  },
  ko: {
    godi: 'K.O.! Abki baar, knockout paar!',
    troll: 'K.O.! Pack it up, IT cell!',
  },
  koHurt: {
    godi: 'EVM malfunction! Recount demanded!',
    troll: 'Rigged! We demand a rematch!',
  },
  block: [
    'BLOCKED! An iron wall of a defence!',
    'The defence ministry has approved this block!',
    'Not today, bro. BLOCKED.',
  ],
  super: {
    modi: { hype: 'SUDARSHAN CHAKRA! Goosebumps, mitron!', spin: 'Bro brought a pizza cutter to a fight.', ticker: 'Seismologists alarmed' },
    rahul: { hype: 'ALOO SE SONA! The machine actually works!', spin: 'Potato in, gold out?! The RBI is investigating.', ticker: 'Aloo prices hit an all-time high' },
    didi: { hype: 'HUMBA HUMBA! Jadu hobe, full power!', spin: 'Black magic?! Call the Election Commission!', ticker: 'Delhi frog population rises by one' },
    trump: { hype: 'TARIFF TSUNAMI! The best tariff, everybody says so!', spin: 'He taxed a punch at fifty percent?!', ticker: 'Sensex crashes as crates rain on Sansad' },
    yogi: { hype: 'BABA KA BULLDOZER! Laser eyes, full power!', spin: 'Bro parked a JCB on the opponent.', ticker: 'Bulldozer leaves Sansad, no number plate' },
    nitin: { hype: 'GADDHA BLAST! Ganna to E20, matchstick, cool walk!', spin: 'Bro walked away from the fire like a movie hero.', ticker: 'Pothole on Desi Sadak catches fire, tender floated' },
  },
}

export const RESULT_COPY = {
  win: {
    headline: '{W} TAKES THE CROWN',
    sub: 'A famous victory, though the losing side has already requested a review.',
    excuse: 'Sources close to the defeated camp blame the lighting, the crowd and, briefly, the moon.',
    caption: 'The winner acknowledges the crowd, mostly the crowd holding the placards.',
  },
  lose: {
    headline: '{W} SILENCES THE STADIUM',
    sub: 'A difficult evening for the home camp, which is already looking for a scapegoat.',
    excuse: 'Our correspondent was told the result is temporary and will be reversed after lunch.',
    caption: 'The defeated neta waves bravely while checking whether the cameras are still on.',
  },
}

export function stageSeed(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
