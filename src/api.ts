const BASE_URL = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data';

// Common books covering most monsters
const COMMON_BOOKS = [
  'bestiary/bestiary-mm.json',
  'bestiary/bestiary-mpmm.json',
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

const SPELL_BOOKS = [
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

