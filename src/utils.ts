export function parseEntry(text: string): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(/{@atk mw}/g, 'Melee Weapon Attack:')
    .replace(/{@atk rw}/g, 'Ranged Weapon Attack:')
    .replace(/{@atk mw,rw}/g, 'Melee or Ranged Weapon Attack:')
    .replace(/{@atk ms}/g, 'Melee Spell Attack:')
    .replace(/{@atk rs}/g, 'Ranged Spell Attack:')
    .replace(/{@h}/g, 'Hit: ')
    .replace(/{@hit (.*?)}/g, '+$1')
    .replace(/{@\w+ (.*?)(?:\|.*?)?}/g, '$1');
}

export function renderEntries(entries: any[]): string {
  if (!entries) return '';
  return entries.map(e => {
    if (typeof e === 'string') return parseEntry(e);
    if (e.type === 'list') {
      return e.items.map((i: any) => `- ${parseEntry(i)}`).join('\n');
    }
    if (e.entries) {
      return `${e.name ? `**${e.name}**: ` : ''}${renderEntries(e.entries)}`;
    }
    return '';
  }).join('\n');
}

export function getHp(monster: any): number {
  if (typeof monster.hp?.average === 'number') return monster.hp.average;
  if (typeof monster.hp?.special === 'string') return parseInt(monster.hp.special) || 10;
  return 10;
}

export function getAc(monster: any): number {
  if (Array.isArray(monster.ac) && monster.ac.length > 0) {
    if (typeof monster.ac[0] === 'number') return monster.ac[0];
    if (typeof monster.ac[0].ac === 'number') return monster.ac[0].ac;
  }
  return 10;
}

const CR_TO_XP: Record<string, number> = {
  "0": 10,
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "25": 75000,
  "26": 90000,
  "27": 105000,
  "28": 120000,
  "29": 135000,
  "30": 155000
};

export function getXp(monster: any): number {
  if (!monster.cr) return 0;
  let crStr = typeof monster.cr === 'string' ? monster.cr : monster.cr.cr;
  return CR_TO_XP[crStr] || 0;
}
