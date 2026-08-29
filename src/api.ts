const BASE_URL = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data';

// Common books prioritized by most recent core rules (2024/2025)
const COMMON_BOOKS = [
  'bestiary/bestiary-xmm.json',
  'bestiary/bestiary-xphb.json',
  'bestiary/bestiary-mpmm.json',
  'bestiary/bestiary-mm.json',
  'bestiary/bestiary-vgm.json',
  'bestiary/bestiary-mtf.json',
  'bestiary/bestiary-phb.json'
];

let cachedMonsters: any[] = [];

export async function loadMonsters() {
  if (cachedMonsters.length > 0) return cachedMonsters;
  
  const promises = COMMON_BOOKS.map(async (book) => {
    try {
      const res = await fetch(`${BASE_URL}/${book}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.monster || [];
    } catch (e) {
      console.error(`Failed to load ${book}`, e);
      return [];
    }
  });

  const results = await Promise.all(promises);
  cachedMonsters = results.flat();
  return cachedMonsters;
}

export function findMonster(name: string) {
  const query = name.toLowerCase().trim();
  return cachedMonsters.find(m => m.name.toLowerCase() === query);
}

export function searchMonsters(query: string, limit = 10) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const seen = new Set<string>();
  const matches: any[] = [];
  for (const m of cachedMonsters) {
    const nameLower = m.name.toLowerCase();
    if (nameLower.includes(q) && !seen.has(nameLower)) {
      seen.add(nameLower);
      matches.push(m);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

export function getAllMonsterNames(): string[] {
  const names = new Set<string>();
  for (const m of cachedMonsters) {
    names.add(m.name);
  }
  return Array.from(names);
}

const SPELL_BOOKS = [
  'spells/spells-xphb.json',
  'spells/spells-phb.json',
  'spells/spells-xge.json',
  'spells/spells-tce.json'
];

let cachedSpells: any[] = [];

export async function fetchSpells() {
  if (cachedSpells.length > 0) return cachedSpells;
  
  const promises = SPELL_BOOKS.map(async (book) => {
    try {
      const res = await fetch(`${BASE_URL}/${book}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.spell || [];
    } catch (e) {
      console.error(`Failed to load ${book}`, e);
      return [];
    }
  });

  const results = await Promise.all(promises);
  cachedSpells = results.flat();
  return cachedSpells;
}

export function findSpell(name: string) {
  // name might be "light {@c}" or just "light"
  const cleanName = name.replace(/{@.*?}/g, '').trim().toLowerCase();
  return cachedSpells.find(s => s.name.toLowerCase() === cleanName);
}

