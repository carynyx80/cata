import type { Card, Game, PricePoint } from "../types.js";

// [game, localId, name, set, number, rarity, imageUrl, raw, psa9, psa10]
type Row = [Game, string, string, string, string, string, string, number | null, number | null, number | null];

const pk = (set: string, num: string) => `https://images.pokemontcg.io/${set}/${num}_hires.png`;
const sf = (set: string, num: string) => `https://api.scryfall.com/cards/${set}/${num}?format=image&version=large`;
const yg = (id: number) => `https://images.ygoprodeck.com/images/cards/${id}.jpg`;
const op = (id: string) => `https://en.onepiece-cardgame.com/images/cardlist/card/${id}.png`;
const sp = (slug: string) => `https://cata.gg/static/sports/${slug}.jpg`;

const ROWS: Row[] = [
  // Pokémon
  ["pokemon", "base1-4", "Charizard", "Base Set", "4", "Rare Holo", pk("base1", "4"), 420, 2100, 9800],
  ["pokemon", "base1-2", "Blastoise", "Base Set", "2", "Rare Holo", pk("base1", "2"), 160, 650, 3400],
  ["pokemon", "base1-15", "Venusaur", "Base Set", "15", "Rare Holo", pk("base1", "15"), 140, 560, 2900],
  ["pokemon", "base1-58", "Pikachu", "Base Set", "58", "Common", pk("base1", "58"), 8, 85, 420],
  ["pokemon", "base1-10", "Mewtwo", "Base Set", "10", "Rare Holo", pk("base1", "10"), 65, 260, 1300],
  ["pokemon", "neo1-9", "Lugia", "Neo Genesis", "9", "Rare Holo", pk("neo1", "9"), 380, 1900, 14500],
  ["pokemon", "base3-5", "Gengar", "Fossil", "5", "Rare Holo", pk("base3", "5"), 70, 300, 1600],
  ["pokemon", "swsh7-215", "Umbreon VMAX (Alternate Art)", "Evolving Skies", "215", "Rare Secret", pk("swsh7", "215"), 1150, 1700, 2600],
  ["pokemon", "swsh7-218", "Rayquaza VMAX (Alternate Art)", "Evolving Skies", "218", "Rare Secret", pk("swsh7", "218"), 520, 780, 1350],
  ["pokemon", "swsh7-212", "Sylveon VMAX (Alternate Art)", "Evolving Skies", "212", "Rare Secret", pk("swsh7", "212"), 280, 420, 760],
  ["pokemon", "swsh12pt5gg-GG44", "Mewtwo VSTAR", "Crown Zenith Galarian Gallery", "GG44", "Rare Secret", pk("swsh12pt5gg", "GG44"), 70, 110, 210],
  ["pokemon", "sv3pt5-199", "Charizard ex (Special Illustration)", "151", "199", "Special Illustration Rare", pk("sv3pt5", "199"), 115, 170, 380],
  ["pokemon", "sv3pt5-205", "Mew ex", "151", "205", "Hyper Rare", pk("sv3pt5", "205"), 28, 55, 120],
  ["pokemon", "sv4pt5-234", "Charizard ex (Shiny)", "Paldean Fates", "234", "Special Illustration Rare", pk("sv4pt5", "234"), 95, 140, 300],
  ["pokemon", "sv8-238", "Pikachu ex (Special Illustration)", "Surging Sparks", "238", "Special Illustration Rare", pk("sv8", "238"), 420, 560, 980],
  ["pokemon", "sv8pt5-161", "Umbreon ex (Special Illustration)", "Prismatic Evolutions", "161", "Special Illustration Rare", pk("sv8pt5", "161"), 1050, 1400, 2300],
  ["pokemon", "ecard2-H9", "Crobat (Holo)", "Aquapolis", "H9", "Rare Holo", pk("ecard2", "H9"), 90, 380, 2200],
  ["pokemon", "swsh45sv-SV107", "Charizard VMAX (Shiny)", "Shining Fates", "SV107", "Rare Shiny", pk("swsh45sv", "SV107"), 85, 130, 260],
  // Magic
  ["magic", "lea-232", "Black Lotus", "Limited Edition Alpha", "232", "rare", sf("lea", "232"), 38000, 145000, 540000],
  ["magic", "leb-233", "Black Lotus", "Limited Edition Beta", "233", "rare", sf("leb", "233"), 22000, 68000, 185000],
  ["magic", "lea-265", "Mox Sapphire", "Limited Edition Alpha", "265", "rare", sf("lea", "265"), 9500, 32000, 90000],
  ["magic", "2ed-162", "Lightning Bolt", "Unlimited Edition", "162", "common", sf("2ed", "162"), 14, 120, 600],
  ["magic", "lea-161", "Lightning Bolt", "Limited Edition Alpha", "161", "common", sf("lea", "161"), 700, 2600, 9000],
  ["magic", "arn-27", "Juzám Djinn", "Arabian Nights", "27", "rare", sf("arn", "27"), 1800, 6500, 22000],
  ["magic", "leg-246", "The Tabernacle at Pendrell Vale", "Legends", "246", "rare", sf("leg", "246"), 2900, 8200, 26000],
  ["magic", "ltr-0", "The One Ring (Serialized)", "The Lord of the Rings: Tales of Middle-earth", "0", "mythic", sf("ltr", "0"), 1900000, null, null],
  ["magic", "ltr-246", "The One Ring", "The Lord of the Rings: Tales of Middle-earth", "246", "mythic", sf("ltr", "246"), 55, 90, 190],
  ["magic", "mh2-138", "Ragavan, Nimble Pilferer", "Modern Horizons 2", "138", "mythic", sf("mh2", "138"), 45, 85, 220],
  ["magic", "2xm-332", "Mana Crypt", "Double Masters", "332", "mythic", sf("2xm", "332"), 190, 260, 480],
  ["magic", "lea-83", "Time Walk", "Limited Edition Alpha", "83", "rare", sf("lea", "83"), 9000, 28000, 85000],
  ["magic", "cmr-319", "Jeweled Lotus", "Commander Legends", "319", "mythic", sf("cmr", "319"), 75, 120, 260],
  ["magic", "dmu-107", "Sheoldred, the Apocalypse", "Dominaria United", "107", "mythic", sf("dmu", "107"), 70, 110, 230],
  // Yu-Gi-Oh!
  ["yugioh", "LOB-001", "Blue-Eyes White Dragon", "Legend of Blue Eyes White Dragon", "LOB-001", "Ultra Rare", yg(89631139), 160, 1200, 6500],
  ["yugioh", "LOB-005", "Dark Magician", "Legend of Blue Eyes White Dragon", "LOB-005", "Ultra Rare", yg(46986414), 95, 650, 3800],
  ["yugioh", "LOB-124", "Exodia the Forbidden One", "Legend of Blue Eyes White Dragon", "LOB-124", "Ultra Rare", yg(33396948), 110, 800, 5200],
  ["yugioh", "LOB-070", "Red-Eyes B. Dragon", "Legend of Blue Eyes White Dragon", "LOB-070", "Ultra Rare", yg(74677422), 70, 420, 2400],
  ["yugioh", "MRD-000", "Gate Guardian", "Metal Raiders", "MRD-000", "Secret Rare", yg(25833572), 45, 300, 1800],
  ["yugioh", "SDK-001", "Blue-Eyes White Dragon", "Starter Deck: Kaiba", "SDK-001", "Ultra Rare", yg(89631139), 55, 380, 1900],
  ["yugioh", "DUPO-EN031", "Ash Blossom & Joyous Spring", "Duel Power", "DUPO-EN031", "Ultra Rare", yg(14558127), 9, 40, 110],
  ["yugioh", "RA01-EN001", "Dark Magician Girl (Quarter Century)", "25th Anniversary Rarity Collection", "RA01-EN001", "Quarter Century Secret Rare", yg(38033121), 120, 210, 480],
  ["yugioh", "LC01-EN004", "Black Luster Soldier", "Legendary Collection", "LC01-EN004", "Ultra Rare", yg(5405694), 30, 120, 450],
  ["yugioh", "TP1-001", "Tournament Black Luster Soldier", "Tournament Pack 1", "TP1-001", "Ultra Rare", yg(5405694), 2600, 9000, 32000],
  ["yugioh", "BLMR-EN100", "Snake-Eyes Flamberge Dragon", "Battles of Legend: Monster Mayhem", "BLMR-EN100", "Starlight Rare", yg(48452496), 140, 220, 420],
  // One Piece
  ["onepiece", "OP01-120", "Shanks (Alternate Art)", "Romance Dawn", "OP01-120", "SEC", op("OP01-120_p1"), 210, 330, 620],
  ["onepiece", "OP05-119", "Monkey.D.Luffy (Manga)", "Awakening of the New Era", "OP05-119", "SEC", op("OP05-119_p2"), 1700, 2400, 3900],
  ["onepiece", "OP02-013", "Portgas.D.Ace (Alternate Art)", "Paramount War", "OP02-013", "SR", op("OP02-013_p1"), 160, 240, 480],
  ["onepiece", "OP01-024", "Monkey.D.Luffy (Alternate Art)", "Romance Dawn", "OP01-024", "SR", op("OP01-024_p1"), 90, 150, 320],
  ["onepiece", "OP06-118", "Roronoa Zoro (Manga)", "Wings of the Captain", "OP06-118", "SEC", op("OP06-118_p2"), 820, 1100, 1900],
  ["onepiece", "ST01-012", "Monkey.D.Luffy", "Starter Deck: Straw Hat Crew", "ST01-012", "SR", op("ST01-012"), 4, 25, 70],
  ["onepiece", "OP03-122", "Sogeking (Alternate Art)", "Pillars of Strength", "OP03-122", "SEC", op("OP03-122_p1"), 70, 120, 250],
  ["onepiece", "OP07-051", "Boa Hancock (Alternate Art)", "500 Years in the Future", "OP07-051", "SR", op("OP07-051_p1"), 110, 170, 340],
  ["onepiece", "OP09-119", "Monkey.D.Luffy (Manga)", "Emperors in the New World", "OP09-119", "SEC", op("OP09-119_p2"), 1300, 1800, 3100],
  // Sports (user-submitted + Cata sales only)
  ["sports", "1952-topps-311", "Mickey Mantle", "1952 Topps", "311", "Base", sp("1952-topps-311"), 85000, 2400000, 12600000],
  ["sports", "1986-fleer-57", "Michael Jordan Rookie", "1986 Fleer", "57", "Base RC", sp("1986-fleer-57"), 3200, 9500, 160000],
  ["sports", "2003-topps-chrome-111", "LeBron James Rookie", "2003-04 Topps Chrome", "111", "Base RC", sp("2003-topps-chrome-111"), 1600, 4200, 22000],
  ["sports", "2000-bowman-chrome-236", "Tom Brady Rookie", "2000 Bowman Chrome", "236", "Base RC", sp("2000-bowman-chrome-236"), 1900, 6500, 42000],
  ["sports", "2018-prizm-280", "Luka Doncic Rookie", "2018-19 Panini Prizm", "280", "Base RC", sp("2018-prizm-280"), 140, 380, 1300],
  ["sports", "1989-upper-deck-1", "Ken Griffey Jr. Rookie", "1989 Upper Deck", "1", "Star Rookie", sp("1989-upper-deck-1"), 60, 160, 2600],
  ["sports", "2011-topps-update-us175", "Mike Trout Rookie", "2011 Topps Update", "US175", "Base RC", sp("2011-topps-update-us175"), 220, 520, 3400],
  ["sports", "2023-prizm-136", "Victor Wembanyama Rookie", "2023-24 Panini Prizm", "136", "Base RC", sp("2023-prizm-136"), 70, 140, 420],
  ["sports", "2017-optic-177", "Patrick Mahomes Rookie", "2017 Donruss Optic", "177", "Rated Rookie", sp("2017-optic-177"), 260, 520, 1800],
];

export const SEED_AT = "2026-11-20T00:00:00.000Z";

export function seedCards(): Card[] {
  return ROWS.map(([game, localId, name, set, number, rarity, imageUrl, raw, psa9, psa10]) => {
    const prices: Card["prices"] = {};
    if (raw != null) prices.raw = raw;
    if (psa9 != null) prices.psa9 = psa9;
    if (psa10 != null) prices.psa10 = psa10;
    return { id: `${game}:${localId}`, game, name, set, number, rarity, imageUrl, prices, updatedAt: SEED_AT };
  });
}

/** Deterministic PRNG so seeded history is stable across boots. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Synthesize weekly history (26 weeks) ending at the seeded price — clearly sample data. */
export function seedHistory(card: Card, weeks = 26): PricePoint[] {
  const rnd = mulberry32(hash(card.id));
  const end = new Date(card.updatedAt).getTime();
  const factors: number[] = [1];
  for (let i = 1; i < weeks; i++) factors.push(factors[i - 1] * (1 - (rnd() - 0.45) * 0.08));
  const round = (n: number) => Math.round(n * 100) / 100;
  return factors.map((f, i) => {
    const p: PricePoint = { t: new Date(end - i * 7 * 86400000).toISOString().slice(0, 10) };
    if (card.prices.raw != null) p.raw = round(card.prices.raw * f);
    if (card.prices.psa9 != null) p.psa9 = round(card.prices.psa9 * f);
    if (card.prices.psa10 != null) p.psa10 = round(card.prices.psa10 * f);
    return p;
  }).reverse();
}
