import { useState, useEffect } from 'react';
import { loadMonsters, findMonster, fetchSpells, findSpell } from './api';
import { getHp, getAc, renderEntries, getXp } from './utils';
import { Sword, Plus, Minus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

type Combatant = {
  id: string;
  name: string;
  maxHp: number;
  currentHp: number;
  ac: number;
  data: any;
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('1 cult fanatic\n2 ghoul');
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [screen, setScreen] = useState<'setup' | 'combat'>('setup');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([loadMonsters(), fetchSpells()]).then(() => setLoading(false));
  }, []);

  const startCombat = () => {
    setError('');
    const lines = input.split('\n').filter(l => l.trim() !== '');
    const newCombatants: Combatant[] = [];
    let idCounter = 1;

    for (const line of lines) {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (match) {
        const count = parseInt(match[1], 10);
        const name = match[2];
        const monster = findMonster(name);
        if (!monster) {
          setError(`Monster not found: ${name}`);
          return;
        }
        for (let i = 0; i < count; i++) {
          newCombatants.push({
            id: `${name}-${idCounter++}`,
            name: count > 1 ? `${monster.name} ${i + 1}` : monster.name,
            maxHp: getHp(monster),
            currentHp: getHp(monster),
            ac: getAc(monster),
            data: monster
          });
        }
      } else {
        const monster = findMonster(line.trim());
        if (!monster) {
          setError(`Monster not found: ${line}`);
          return;
        }
        newCombatants.push({
          id: `${line}-${idCounter++}`,
          name: monster.name,
          maxHp: getHp(monster),
          currentHp: getHp(monster),
          ac: getAc(monster),
          data: monster
        });
      }
    }
    setCombatants(newCombatants);
    setScreen('combat');
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center' }}>Loading monsters data...</div>;
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
      {screen === 'setup' ? (
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sword /> D&D Combat Tracker
          </h1>
          <p>Enter combatants (e.g., "1 cult fanatic" or "2 ghoul"):</p>
          <textarea
            style={{ width: '100%', height: 200, padding: 10, background: '#2a2a2a', color: '#fff', border: '1px solid #444', borderRadius: 8, fontSize: 16 }}
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          {error && <div style={{ color: '#ff6b6b', margin: '10px 0' }}>{error}</div>}
          <button
            style={{ marginTop: 20, padding: '12px 24px', background: '#e53e3e', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={startCombat}
          >
            <Sword size={20} /> Start Combat
          </button>
        </div>
      ) : (
        <CombatScreen combatants={combatants} setCombatants={setCombatants} onBack={() => setScreen('setup')} />
      )}
    </div>
  );
}

function CombatScreen({ combatants, setCombatants, onBack }: { combatants: Combatant[], setCombatants: any, onBack: () => void }) {
  const updateHp = (id: string, delta: number) => {
    setCombatants((prev: Combatant[]) => prev.map(c => 
      c.id === id ? { ...c, currentHp: Math.min(c.maxHp, Math.max(0, c.currentHp + delta)) } : c
    ));
  };

  const removeCombatant = (id: string) => {
    setCombatants((prev: Combatant[]) => prev.filter(c => c.id !== id));
  };

  const totalXp = combatants.reduce((acc, c) => acc + getXp(c.data), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Combat Tracker</h2>
          <div style={{ color: '#ecc94b', fontSize: 14, marginTop: 4 }}>
            Total XP: <strong>{totalXp.toLocaleString()}</strong>
          </div>
        </div>
        <button onClick={onBack} style={{ padding: '8px 16px', background: '#4a5568', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          Back to Setup
        </button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {combatants.map(c => (
          <CombatantCard key={c.id} combatant={c} onUpdateHp={(delta) => updateHp(c.id, delta)} onRemove={() => removeCombatant(c.id)} />
        ))}
        {combatants.length === 0 && <div style={{ textAlign: 'center', color: '#aaa' }}>All combatants defeated!</div>}
      </div>
    </div>
  );
}

function CombatantCard({ combatant, onUpdateHp, onRemove }: { combatant: Combatant, onUpdateHp: (delta: number) => void, onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [damageInput, setDamageInput] = useState('');
  
  const handleDamage = () => {
    const val = parseInt(damageInput, 10);
    if (!isNaN(val)) {
      onUpdateHp(-val);
      setDamageInput('');
    }
  };

  const isDead = combatant.currentHp <= 0;

  return (
    <div style={{ background: '#2d3748', borderRadius: 8, padding: 16, borderLeft: `4px solid ${isDead ? '#e53e3e' : '#48bb78'}`, opacity: isDead ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, textDecoration: isDead ? 'line-through' : 'none' }}>
            {combatant.name} 
            <span style={{ fontSize: 14, fontWeight: 'normal', color: '#a0aec0' }}>AC: {combatant.ac}</span>
          </h3>
          <div style={{ fontSize: 20, fontWeight: 'bold', marginTop: 8 }}>
            HP: <span style={{ color: combatant.currentHp <= combatant.maxHp / 2 ? '#e53e3e' : '#48bb78' }}>{combatant.currentHp}</span> / {combatant.maxHp}
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input 
              type="number" 
              placeholder="Dmg/Heal" 
              value={damageInput} 
              onChange={e => setDamageInput(e.target.value)}
              style={{ width: 80, padding: 8, borderRadius: 4, border: 'none', background: '#1a202c', color: 'white' }}
            />
            <button onClick={handleDamage} style={{ background: '#e53e3e', color: 'white', border: 'none', padding: 8, borderRadius: 4, cursor: 'pointer' }} title="Damage"><Minus size={16} /></button>
            <button onClick={() => {
              const val = parseInt(damageInput, 10);
              if (!isNaN(val)) {
                onUpdateHp(val);
                setDamageInput('');
              }
            }} style={{ background: '#48bb78', color: 'white', border: 'none', padding: 8, borderRadius: 4, cursor: 'pointer' }} title="Heal"><Plus size={16} /></button>
          </div>
          
          <button onClick={() => setExpanded(!expanded)} style={{ background: 'transparent', border: 'none', color: '#cbd5e0', cursor: 'pointer' }}>
            {expanded ? <ChevronUp /> : <ChevronDown />}
          </button>
          
          <button onClick={onRemove} style={{ background: 'transparent', border: 'none', color: '#fc8181', cursor: 'pointer' }}>
            <Trash2 />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #4a5568', fontSize: 14 }}>
          {combatant.data.trait && (
            <div style={{ marginBottom: 12 }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#ecc94b' }}>Traits</h4>
              {combatant.data.trait.map((t: any, i: number) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <strong>{t.name}.</strong> {renderEntries(t.entries)}
                </div>
              ))}
            </div>
          )}
          
          {combatant.data.action && (
            <div style={{ marginBottom: 12 }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#fc8181' }}>Actions</h4>
              {combatant.data.action.map((a: any, i: number) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <strong>{a.name}.</strong> {renderEntries(a.entries)}
                </div>
              ))}
            </div>
          )}

          {combatant.data.spellcasting && (
            <div style={{ marginBottom: 12 }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#63b3ed' }}>Spellcasting</h4>
              {combatant.data.spellcasting.map((sc: any, i: number) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <strong>{sc.name}.</strong> {renderEntries(sc.headerEntries)}
                  {sc.spells && Object.entries(sc.spells).map(([level, data]: any) => (
                    <div key={level} style={{ marginLeft: 16, marginTop: 4 }}>
                      <em>{level === '0' ? 'Cantrips' : `Level ${level}`}{data.slots ? ` (${data.slots} slots)` : ''}:</em> 
                      {data.spells.map((s: string) => <SpellInfo key={s} spellName={s} />)}
                    </div>
                  ))}
                  {sc.will && <div style={{ marginLeft: 16, marginTop: 4 }}><em>At will:</em> {sc.will.map((s: string) => <SpellInfo key={s} spellName={s} />)}</div>}
                  {sc.daily && Object.entries(sc.daily).map(([times, spells]: any) => (
                    <div key={times} style={{ marginLeft: 16, marginTop: 4 }}><em>{times}/day:</em> {spells.map((s: string) => <SpellInfo key={s} spellName={s} />)}</div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpellInfo({ spellName }: { spellName: string }) {
  const [open, setOpen] = useState(false);
  const cleanName = spellName.replace(/{@.*?}/g, '').replace(/{@spell (.*?)}/g, '$1').trim();
  const spellData = findSpell(cleanName);

  if (!spellData) return <span style={{ marginRight: 8, color: '#a0aec0' }}>{cleanName}</span>;

  return (
    <div style={{ display: 'inline-block', marginRight: 8, marginBottom: 8 }}>
      <button 
        onClick={() => setOpen(!open)}
        style={{ background: '#2b6cb0', color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}
      >
        {spellData.name}
      </button>
      {open && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#1a202c', border: '1px solid #4a5568', padding: 20, borderRadius: 8, zIndex: 100, maxWidth: 500, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>{spellData.name}</h3>
            <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fc8181', cursor: 'pointer' }}>X</button>
          </div>
          <div style={{ fontSize: 12, color: '#a0aec0', marginBottom: 12 }}>
            Level {spellData.level} {spellData.school}
            <br/><strong>Time:</strong> {spellData.time?.[0]?.number} {spellData.time?.[0]?.unit}
            <br/><strong>Range:</strong> {spellData.range?.distance?.type} {spellData.range?.distance?.amount || ''}
            <br/><strong>Duration:</strong> {spellData.duration?.[0]?.type === 'instant' ? 'Instantaneous' : `${spellData.duration?.[0]?.duration?.amount || ''} ${spellData.duration?.[0]?.duration?.type || ''}`}
          </div>
          <div style={{ fontSize: 14 }}>
            {renderEntries(spellData.entries)}
          </div>
        </div>
      )}
    </div>
  );
}
