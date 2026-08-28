export function parseEntry(text: string): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(/{@atk mw,rw}/g, '<span class="tag-attack">Melee or Ranged Weapon Attack:</span>')
    .replace(/{@atk mw}/g, '<span class="tag-attack">Melee Weapon Attack:</span>')
    .replace(/{@atk rw}/g, '<span class="tag-attack">Ranged Weapon Attack:</span>')
    .replace(/{@atk ms}/g, '<span class="tag-attack">Melee Spell Attack:</span>')
    .replace(/{@atk rs}/g, '<span class="tag-attack">Ranged Spell Attack:</span>')
    .replace(/{@h}/g, '<span class="tag-hit-label">Hit:</span> ')
    .replace(/{@hit (.*?)}/g, '<span class="tag-hit">+$1</span>')
    .replace(/{@damage (.*?)}/g, '<span class="tag-damage">$1</span>')
    .replace(/{@dice (.*?)(?:\|.*?)?}/g, '<span class="tag-damage">$1</span>')
    .replace(/{@dc (.*?)}/g, '<span class="tag-dc">DC $1</span>')
    .replace(/{@condition (.*?)(?:\|.*?)?}/g, '<span class="tag-condition">$1</span>')
    .replace(/{@spell (.*?)(?:\|.*?)?}/g, '<em>$1</em>')
    .replace(/{@\w+ (.*?)(?:\|.*?)?}/g, '$1');
}

export function renderEntries(entries: any[]): string {
  if (!entries) return '';
  return entries.map(e => {
    if (typeof e === 'string') return parseEntry(e);
    if (e.type === 'list') {
      return e.items.map((i: any) => {
        if (typeof i === 'string') return `• ${parseEntry(i)}`;
        if (i.type === 'item') return `• ${i.name ? `<strong>${i.name}:</strong> ` : ''}${renderEntries(i.entries || [])}`;
        return '';
      }).join('<br/>');
    }
    if (e.entries) {
      return `${e.name ? `<strong>${e.name}:</strong> ` : ''}${renderEntries(e.entries)}`;
    }
    return '';
  }).join('<br/>');
}

export function getHp(monster: any): number {
  if (typeof monster.hp?.average === 'number') return monster.hp.average;
  if (typeof monster.hp?.special === 'string') return parseInt(monster.hp.special) || 10;
  return 10;
}

export function getHpFormula(monster: any): string {
  if (monster.hp?.formula) return monster.hp.formula;
  return '';
}

export function getAc(monster: any): number {
  if (Array.isArray(monster.ac) && monster.ac.length > 0) {
    if (typeof monster.ac[0] === 'number') return monster.ac[0];
    if (typeof monster.ac[0].ac === 'number') return monster.ac[0].ac;
  }
  return 10;
}

export function getAcSource(monster: any): string {
  if (Array.isArray(monster.ac) && monster.ac.length > 0) {
    const ac = monster.ac[0];
    if (typeof ac === 'object' && ac.from) {
      return ac.from.map((f: any) => parseEntry(typeof f === 'string' ? f : '')).join(', ');
    }
  }
  return '';
}

export function getSpeed(monster: any): string {
  if (!monster.speed) return '30 ft.';
  const parts: string[] = [];
  if (monster.speed.walk) parts.push(`${typeof monster.speed.walk === 'number' ? monster.speed.walk : monster.speed.walk.number} ft.`);
  if (monster.speed.fly) parts.push(`fly ${typeof monster.speed.fly === 'number' ? monster.speed.fly : monster.speed.fly.number} ft.`);
  if (monster.speed.swim) parts.push(`swim ${typeof monster.speed.swim === 'number' ? monster.speed.swim : monster.speed.swim.number} ft.`);
  if (monster.speed.burrow) parts.push(`burrow ${typeof monster.speed.burrow === 'number' ? monster.speed.burrow : monster.speed.burrow.number} ft.`);
  if (monster.speed.climb) parts.push(`climb ${typeof monster.speed.climb === 'number' ? monster.speed.climb : monster.speed.climb.number} ft.`);
  return parts.join(', ') || '0 ft.';
}

export function getCr(monster: any): string {
  if (!monster.cr) return '—';
  if (typeof monster.cr === 'string') return monster.cr;
  if (typeof monster.cr === 'object' && monster.cr.cr) return monster.cr.cr;
  return '—';
}

export function getMonsterType(monster: any): string {
  if (!monster.type) return '';
  if (typeof monster.type === 'string') return monster.type;
  if (typeof monster.type === 'object') return monster.type.type || '';
  return '';
}

export function getSizeLabel(size: string[]): string {
  if (!size || !size.length) return '';
  const map: Record<string, string> = {
    T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan'
  };
  return size.map(s => map[s] || s).join('/');
}

export function getModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function extractSpellDc(spellcasting: any[]): { dc: number | null; toHit: string | null; ability: string | null } {
  if (!spellcasting || !spellcasting.length) return { dc: null, toHit: null, ability: null };
  const sc = spellcasting[0];
  const headerText = (sc.headerEntries || []).join(' ');
  const dcMatch = headerText.match(/{@dc (\d+)}/);
  const hitMatch = headerText.match(/{@hit (\d+)}/);
  const abilityMap: Record<string, string> = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution',
    int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'
  };
  return {
    dc: dcMatch ? parseInt(dcMatch[1]) : null,
    toHit: hitMatch ? `+${hitMatch[1]}` : null,
    ability: sc.ability ? (abilityMap[sc.ability] || sc.ability) : null
  };
}

const CR_TO_XP: Record<string, number> = {
  "0": 10, "1/8": 25, "1/4": 50, "1/2": 100,
  "1": 200, "2": 450, "3": 700, "4": 1100,
  "5": 1800, "6": 2300, "7": 2900, "8": 3900,
  "9": 5000, "10": 5900, "11": 7200, "12": 8400,
  "13": 10000, "14": 11500, "15": 13000, "16": 15000,
  "17": 18000, "18": 20000, "19": 22000, "20": 25000,
  "21": 33000, "22": 41000, "23": 50000, "24": 62000,
  "25": 75000, "26": 90000, "27": 105000, "28": 120000,
  "29": 135000, "30": 155000
};

export function getXp(monster: any): number {
  if (!monster.cr) return 0;
  const crStr = typeof monster.cr === 'string' ? monster.cr : monster.cr.cr;
  return CR_TO_XP[crStr] || 0;
}

export function getSchoolName(code: string): string {
  const map: Record<string, string> = {
    A: 'Abjuration', C: 'Conjuration', D: 'Divination',
    E: 'Enchantment', V: 'Evocation', I: 'Illusion',
    N: 'Necromancy', T: 'Transmutation'
  };
  return map[code] || code;
}
