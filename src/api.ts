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

// Index from source code → filename (e.g. "JttRC" → "bestiary-jttrc.json")
// Loaded lazily on first on-demand fetch
let bestiaryIndex: Record<string, string> | null = null;

// Tracks which extra bestiary files have already been fetched
const loadedExtraBooks = new Set<string>();

async function getBestiaryIndex(): Promise<Record<string, string>> {
  if (bestiaryIndex) return bestiaryIndex;
  try {
    const res = await fetch(`${BASE_URL}/bestiary/index.json`);
    if (!res.ok) { bestiaryIndex = {}; return {}; }
    bestiaryIndex = await res.json();
    return bestiaryIndex!;
  } catch {
    bestiaryIndex = {};
    return {};
  }
}

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

/**
 * Loads a specific extra bestiary file by filename (e.g. "bestiary-jttrc.json")
 * and merges its monsters into cachedMonsters (deduplicating by name).
 */
async function loadExtraBook(filename: string): Promise<void> {
  if (loadedExtraBooks.has(filename)) return;
  loadedExtraBooks.add(filename);
  try {
    const res = await fetch(`${BASE_URL}/bestiary/${filename}`);
    if (!res.ok) return;
    const data = await res.json();
    const monsters: any[] = data.monster || [];
    // Merge, skipping names already present
    const existingNames = new Set(cachedMonsters.map((m: any) => m.name.toLowerCase()));
    const newOnes = monsters.filter((m: any) => !existingNames.has(m.name.toLowerCase()));
    cachedMonsters = cachedMonsters.concat(newOnes);
  } catch (e) {
    console.error(`Failed to load extra book ${filename}`, e);
  }
}

/**
 * Searches for a monster by exact name. If not found in the cached set,
 * queries the bestiary index to discover which source file it might be in,
 * fetches that file on demand, then retries the lookup.
 */
export async function findMonsterAsync(name: string): Promise<any | null> {
  const query = name.toLowerCase().trim();

  // Try cache first
  const direct = cachedMonsters.find((m: any) => m.name.toLowerCase() === query);
  if (direct) return direct;

  // Load index and look for any source that might have this monster
  const index = await getBestiaryIndex();

  // Strategy: fetch all not-yet-loaded books from the index looking for the monster.
  // To avoid loading all 110 books, we batch in groups and stop once found.
  const allFilenames = Object.values(index).filter(
    (f) => !COMMON_BOOKS.some(b => b.endsWith(f)) && !loadedExtraBooks.has(f)
  );

  // Fetch books in batches of 5 until we find the monster
  const BATCH = 5;
  for (let i = 0; i < allFilenames.length; i += BATCH) {
    const batch = allFilenames.slice(i, i + BATCH);
    await Promise.all(batch.map(loadExtraBook));
    const found = cachedMonsters.find((m: any) => m.name.toLowerCase() === query);
    if (found) return found;
  }

  return null;
}

export function findMonster(name: string) {
  const query = name.toLowerCase().trim();
  return cachedMonsters.find((m: any) => m.name.toLowerCase() === query) ?? null;
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
