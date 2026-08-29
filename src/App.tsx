import { useState, useEffect } from 'react';
import { loadMonsters, findMonster, fetchSpells, findSpell, searchMonsters } from './api';
import {
  getHp, getAc, renderEntries, getXp, getCr, getSpeed,
  getMonsterType, getSizeLabel, getModifier, extractSpellDc,
  getSchoolName, parseEntry,
} from './utils';
import './styles.css';

type Combatant = {
  id: string;
  name: string;
  maxHp: number;
  currentHp: number;
  ac: number;
  data: any;
};

type RosterItem = {
  id: string;
  monster: any;
  count: number;
};

/* ============================================================
   APP ROOT
   ============================================================ */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [setupInput, setSetupInput] = useState('');
  const [setupSuggestions, setSetupSuggestions] = useState<any[]>([]);
  const [showSetupDropdown, setShowSetupDropdown] = useState(false);
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [screen, setScreen] = useState<'setup' | 'combat'>('setup');
  const [error, setError] = useState('');
  const [interactionCount, setInteractionCount] = useState(0);
  const [showNarrative, setShowNarrative] = useState(false);
  const [enableNarrative, setEnableNarrative] = useState(() => {
    return localStorage.getItem('combat_narrative') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('combat_narrative', String(enableNarrative));
  }, [enableNarrative]);

  useEffect(() => {
    Promise.all([loadMonsters(), fetchSpells()]).then(() => {
      setLoading(false);
      const fanatic = findMonster('cult fanatic');
      const ghoul = findMonster('ghoul');
      const initial: RosterItem[] = [];
      if (fanatic) initial.push({ id: `cult-fanatic-init`, monster: fanatic, count: 1 });
      if (ghoul) initial.push({ id: `ghoul-init`, monster: ghoul, count: 2 });
      setRoster(initial);
    });
  }, []);

  const handleInteraction = () => {
    setInteractionCount(prev => {
      const next = prev + 1;
      if (enableNarrative && next > 0 && next % 3 === 0) {
        setShowNarrative(true);
      }
      return next;
    });
  };

  const parseQuantityAndName = (text: string) => {
    const trimmed = text.trim();
    const match = trimmed.match(/^(\d+)\s*(.*)$/);
    if (match) {
      return {
        count: Math.max(1, parseInt(match[1], 10) || 1),
        query: match[2].trim(),
      };
    }
    return { count: 1, query: trimmed };
  };

  const handleSetupInputChange = (val: string) => {
    setSetupInput(val);
    setError('');
    const { query } = parseQuantityAndName(val);
    if (query.length >= 2) {
      const results = searchMonsters(query, 8);
      setSetupSuggestions(results);
      setShowSetupDropdown(results.length > 0);
    } else {
      setSetupSuggestions([]);
      setShowSetupDropdown(false);
    }
  };

  const addMonsterToRoster = (monster: any, countToAdd: number) => {
    setRoster(prev => {
      const existingIdx = prev.findIndex(item => item.monster.name.toLowerCase() === monster.name.toLowerCase());
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          count: updated[existingIdx].count + countToAdd,
        };
        return updated;
      }
      return [...prev, { id: `${monster.name}-${Date.now()}`, monster, count: countToAdd }];
    });
    setSetupInput('');
    setSetupSuggestions([]);
    setShowSetupDropdown(false);
    setError('');
  };

  const handleAddSubmit = () => {
    const { count, query } = parseQuantityAndName(setupInput);
    if (!query) {
      setError('Digite o nome da criatura (ex: 2 cultist ou goblin)');
      return;
    }
    const monster = findMonster(query);
    if (!monster) {
      setError(`Criatura não encontrada: "${query}"`);
      return;
    }
    addMonsterToRoster(monster, count);
  };

  const updateRosterCount = (id: string, delta: number) => {
    setRoster(prev => {
      return prev
        .map(item => item.id === id ? { ...item, count: item.count + delta } : item)
        .filter(item => item.count > 0);
    });
  };

  const removeRosterItem = (id: string) => {
    setRoster(prev => prev.filter(item => item.id !== id));
  };

  const startCombat = () => {
    if (roster.length === 0) {
      setError('Adicione pelo menos uma criatura ao encontro!');
      return;
    }
    setError('');
    const newCombatants: Combatant[] = [];
    let idCounter = 1;

    for (const item of roster) {
      const { monster, count } = item;
      for (let i = 0; i < count; i++) {
        newCombatants.push({
          id: `${monster.name}-${idCounter++}`,
          name: count > 1 ? `${monster.name} ${i + 1}` : monster.name,
          maxHp: getHp(monster),
          currentHp: getHp(monster),
          ac: getAc(monster),
          data: monster,
        });
      }
    }
    setCombatants(newCombatants);
    setScreen('combat');
    setInteractionCount(0);
    if (enableNarrative) setShowNarrative(true);
  };

  const totalRosterCreatures = roster.reduce((sum, item) => sum + item.count, 0);
  const totalRosterXp = roster.reduce((sum, item) => sum + (getXp(item.monster) * item.count), 0);

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="loading-screen">
        <i className="ra ra-dragon loading-icon" />
        <div className="loading-text">Summoning Creatures…</div>
        <div className="loading-bar"><div className="loading-bar-fill" /></div>
      </div>
    );
  }

  /* ---- Screens ---- */
  return (
    <div className="app-container">
      {screen === 'setup' ? (
        <div className="setup-screen">
          <h1 className="setup-title">
            <i className="ra ra-crossed-swords" />
            Combat Tracker
          </h1>
          <p className="setup-subtitle">Track your D&D 5e encounters with data from 5e.tools</p>

          <div className="setup-card">
            <label className="setup-label">
              <i className="ra ra-scroll-unfurled" />
              Adicionar Criaturas
            </label>

            {/* Input with Autocomplete & Quantity */}
            <div className="setup-search-row">
              <div className="autocomplete-container" style={{ flex: 1 }}>
                <input
                  type="text"
                  className="autocomplete-input"
                  value={setupInput}
                  onChange={e => handleSetupInputChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddSubmit();
                  }}
                  onFocus={() => {
                    const { query } = parseQuantityAndName(setupInput);
                    if (query.length >= 2) {
                      const results = searchMonsters(query, 8);
                      setSetupSuggestions(results);
                      setShowSetupDropdown(results.length > 0);
                    }
                  }}
                  placeholder="Ex: 2 cultist ou goblin..."
                />

                {showSetupDropdown && setupSuggestions.length > 0 && (
                  <div className="autocomplete-dropdown">
                    {setupSuggestions.map(m => {
                      const { count } = parseQuantityAndName(setupInput);
                      return (
                        <div
                          key={m.name + (m.source || '')}
                          className="autocomplete-item"
                          onClick={() => addMonsterToRoster(m, count)}
                        >
                          <div className="autocomplete-item-name">
                            + {count > 1 ? `${count}x ` : ''}{m.name}
                          </div>
                          <div className="autocomplete-item-meta">
                            <span>CR {getCr(m)}</span>
                            <span>•</span>
                            <span>{getMonsterType(m)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button className="btn-add-roster" onClick={handleAddSubmit}>
                <i className="ra ra-health" /> Inserir
              </button>
            </div>

            {error && (
              <div className="setup-error">
                <i className="ra ra-aware" /> {error}
              </div>
            )}

            {/* Roster List Header */}
            <label className="setup-label" style={{ marginTop: '10px' }}>
              <i className="ra ra-dragon" />
              Inimigos no Encontro ({totalRosterCreatures})
            </label>

            {/* Roster List */}
            {roster.length > 0 ? (
              <>
                <div className="roster-list">
                  {roster.map(item => {
                    const m = item.monster;
                    return (
                      <div key={item.id} className="roster-item">
                        <div className="roster-item-info">
                          <div className="roster-item-name">
                            <i className="ra ra-dragon" />
                            {m.name}
                          </div>
                          <div className="roster-item-meta">
                            <span className="cr">CR {getCr(m)}</span>
                            <span>•</span>
                            <span className="hp">{getHp(m)} HP</span>
                            <span>•</span>
                            <span className="ac">CA {getAc(m)}</span>
                            <span>•</span>
                            <span>{getSizeLabel(m.size)} {getMonsterType(m)}</span>
                          </div>
                        </div>

                        <div className="roster-item-controls">
                          <div className="roster-stepper">
                            <button
                              className="roster-btn-step"
                              onClick={() => updateRosterCount(item.id, -1)}
                              title="Diminuir"
                            >
                              -
                            </button>
                            <div className="roster-count">{item.count}</div>
                            <button
                              className="roster-btn-step"
                              onClick={() => updateRosterCount(item.id, 1)}
                              title="Aumentar"
                            >
                              +
                            </button>
                          </div>
                          <button
                            className="roster-btn-remove"
                            onClick={() => removeRosterItem(item.id)}
                            title="Remover"
                          >
                            <i className="ra ra-cancel" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                <div className="roster-summary">
                  <div>Total de Criaturas: <strong>{totalRosterCreatures}</strong></div>
                  <div>XP Total: <strong>{totalRosterXp.toLocaleString()} XP</strong></div>
                </div>
              </>
            ) : (
              <div className="roster-empty">
                <i className="ra ra-scroll-unfurled" />
                Nenhuma criatura adicionada ainda.<br />
                Digite o nome no campo acima (ex: <em>2 ghoul</em> ou <em>cultist</em>).
              </div>
            )}

            {/* Narrative Toggle */}
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="narrativeToggle"
                checked={enableNarrative}
                onChange={e => setEnableNarrative(e.target.checked)}
                style={{ accentColor: 'var(--orange)', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="narrativeToggle" style={{ fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Habilitar lembretes de Narrativa (a cada 3 interações)
              </label>
            </div>

            <button className="btn-start" onClick={startCombat} style={{ marginTop: '20px' }}>
              <i className="ra ra-sword" /> Iniciar Combate
            </button>
          </div>
        </div>
      ) : (
        <CombatScreen
          combatants={combatants}
          setCombatants={setCombatants}
          onBack={() => setScreen('setup')}
          onInteraction={handleInteraction}
        />
      )}

      {showNarrative && (
        <NarrativeModal 
          count={interactionCount} 
          onClose={() => setShowNarrative(false)}
          onDisable={() => {
            setEnableNarrative(false);
            setShowNarrative(false);
          }}
        />
      )}
    </div>
  );
}

/* ============================================================
   COMBAT SCREEN
   ============================================================ */
function CombatScreen({
  combatants, setCombatants, onBack, onInteraction,
}: {
  combatants: Combatant[];
  setCombatants: React.Dispatch<React.SetStateAction<Combatant[]>>;
  onBack: () => void;
  onInteraction: () => void;
}) {
  const [showReinforcements, setShowReinforcements] = useState(false);

  const addReinforcements = (name: string, count: number) => {
    const monster = findMonster(name);
    if (!monster) return;
    const existingCount = combatants.filter(c => c.data.name.toLowerCase() === monster.name.toLowerCase()).length;
    const newCombatants: Combatant[] = [];
    for (let i = 0; i < count; i++) {
      const idx = existingCount + i + 1;
      newCombatants.push({
        id: `${monster.name}-${Date.now()}-${i}`,
        name: (existingCount + count > 1) ? `${monster.name} ${idx}` : monster.name,
        maxHp: getHp(monster),
        currentHp: getHp(monster),
        ac: getAc(monster),
        data: monster,
      });
    }
    setCombatants(prev => [...prev, ...newCombatants]);
  };

  const updateHp = (id: string, delta: number) => {
    setCombatants(prev =>
      prev.map(c =>
        c.id === id
          ? { ...c, currentHp: Math.min(c.maxHp, Math.max(0, c.currentHp + delta)) }
          : c,
      ),
    );
    onInteraction();
  };

  const removeCombatant = (id: string) => {
    setCombatants(prev => prev.filter(c => c.id !== id));
  };

  const totalXp = combatants.reduce((sum, c) => sum + getXp(c.data), 0);
  const alive = combatants.filter(c => c.currentHp > 0).length;

  return (
    <>
      {/* Header */}
      <div className="combat-header">
        <div>
          <div className="combat-title">
            <i className="ra ra-crossed-swords" /> Combat Tracker
          </div>
          <div className="combat-stats">
            <div className="combat-stat">
              <i className="ra ra-gem" />
              <span className="value">{totalXp.toLocaleString()}</span> XP
            </div>
            <div className="combat-stat">
              <i className="ra ra-skull" />
              <span className="value">{alive}</span> / {combatants.length} alive
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-reinforcements" onClick={() => setShowReinforcements(true)}>
            <i className="ra ra-dragon" /> + Reforços
          </button>
          <button className="btn-back" onClick={onBack}>
            <i className="ra ra-arrow-cluster" /> Setup
          </button>
        </div>
      </div>

      {/* Cards */}
      {combatants.map(c => (
        <CombatantCard
          key={c.id}
          combatant={c}
          onUpdateHp={d => updateHp(c.id, d)}
          onRemove={() => removeCombatant(c.id)}
        />
      ))}

      {combatants.length === 0 && (
        <div className="empty-state">
          <i className="ra ra-skull-trophy" />
          <p>All Enemies Vanquished</p>
        </div>
      )}

      {showReinforcements && (
        <ReinforcementsModal
          onAdd={addReinforcements}
          onClose={() => setShowReinforcements(false)}
        />
      )}
    </>
  );
}

/* ============================================================
   COMBATANT CARD
   ============================================================ */
function CombatantCard({
  combatant, onUpdateHp, onRemove,
}: {
  combatant: Combatant;
  onUpdateHp: (delta: number) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [damageInput, setDamageInput] = useState('');
  const d = combatant.data;
  const isDead = combatant.currentHp <= 0;
  const hpPct = combatant.maxHp > 0 ? (combatant.currentHp / combatant.maxHp) * 100 : 0;

  const applyDelta = (sign: 1 | -1) => {
    const val = parseInt(damageInput, 10);
    if (!isNaN(val) && val > 0) {
      onUpdateHp(sign * val);
      setDamageInput('');
    }
  };

  return (
    <div className={`combatant-card${isDead ? ' dead' : ''}`}>
      <div className="card-main">
        <div className="card-content">
          {/* Top row: name + actions */}
          <div className="card-top-row">
            <div className="monster-identity">
              <div className="monster-name">
                <i className={`ra ${isDead ? 'ra-skull' : 'ra-dragon'}`} />
                {combatant.name}
              </div>
              <div className="monster-meta">
                {getSizeLabel(d.size)} {getMonsterType(d)}{d.alignment ? '' : ''}
              </div>
            </div>

            <div className="card-actions">
              <button
                className="btn-icon"
                onClick={() => setExpanded(!expanded)}
                title={expanded ? 'Collapse' : 'Expand details'}
              >
                <i className={`ra ${expanded ? 'ra-cancel' : 'ra-scroll-unfurled'}`} />
              </button>
              <button
                className="btn-icon danger"
                onClick={onRemove}
                title="Remove"
              >
                <i className="ra ra-burning-embers" />
              </button>
            </div>
          </div>

          {/* Stat badges */}
          <div className="stats-row">
            <div className={`stat-badge hp ${hpPct > 50 ? 'healthy' : 'critical'}`}>
              <i className="ra ra-hearts" />
              <span className="value">{combatant.currentHp}</span>
              <span style={{ opacity: 0.5 }}>/ {combatant.maxHp}</span>
            </div>
            <div className="stat-badge ac">
              <i className="ra ra-shield" />
              <span className="value">{combatant.ac}</span>
            </div>
            <div className="stat-badge speed">
              <i className="ra ra-boot-stomp" />
              <span className="value">{getSpeed(d)}</span>
            </div>
            <div className="stat-badge cr">
              <i className="ra ra-targeted" />
              CR <span className="value">{getCr(d)}</span>
            </div>
            <div className="stat-badge xp">
              <i className="ra ra-gem" />
              <span className="value">{getXp(d).toLocaleString()}</span> XP
            </div>
          </div>

          {/* Damage controls */}
          <div className="damage-controls">
            <input
              className="damage-input"
              type="number"
              min="0"
              value={damageInput}
              onChange={e => setDamageInput(e.target.value)}
              placeholder="HP"
              onKeyDown={e => { if (e.key === 'Enter') applyDelta(-1); }}
            />
            <button className="btn-damage hit" onClick={() => applyDelta(-1)}>
              <i className="ra ra-sword" /> Damage
            </button>
            <button className="btn-damage heal" onClick={() => applyDelta(1)}>
              <i className="ra ra-health" /> Heal
            </button>
          </div>
        </div>
      </div>

      {/* ---- Expanded Details ---- */}
      {expanded && <CardDetails data={d} />}
    </div>
  );
}

/* ============================================================
   CARD DETAILS (expanded section)
   ============================================================ */
function CardDetails({ data: d }: { data: any }) {
  const spellInfo = extractSpellDc(d.spellcasting);

  return (
    <div className="card-details">
      {/* Ability Scores */}
      <div className="ability-scores">
        {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(ab => (
          <div className="ability-score" key={ab}>
            <div className="label">{ab}</div>
            <div className="value">{d[ab] ?? '—'}</div>
            <div className="modifier">{d[ab] != null ? getModifier(d[ab]) : ''}</div>
          </div>
        ))}
      </div>

      {/* Immunities & Resistances */}
      {(d.immune || d.resist || d.conditionImmune || d.vulnerable) && (
        <div className="detail-section">
          <div className="detail-section-title traits"><i className="ra ra-aura" /> Defenses</div>
          {d.immune && (
            <div className="detail-entry">
              <strong>Damage Immunities: </strong>
              {d.immune.map((im: any) => typeof im === 'string' ? im : im.immune?.join(', ')).join(', ')}
            </div>
          )}
          {d.resist && (
            <div className="detail-entry">
              <strong>Damage Resistances: </strong>
              {d.resist.map((r: any) => typeof r === 'string' ? r : r.resist?.join(', ')).join(', ')}
            </div>
          )}
          {d.vulnerable && (
            <div className="detail-entry">
              <strong>Vulnerabilities: </strong>
              {d.vulnerable.map((v: any) => typeof v === 'string' ? v : '').join(', ')}
            </div>
          )}
          {d.conditionImmune && (
            <div className="detail-entry">
              <strong>Condition Immunities: </strong>{d.conditionImmune.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Senses */}
      {d.senses && (
        <div className="detail-section">
          <div className="detail-section-title traits"><i className="ra ra-eye-monster" /> Senses</div>
          <div className="detail-entry">{d.senses.join(', ')}{d.passive ? `, passive Perception ${d.passive}` : ''}</div>
        </div>
      )}

      {/* Traits */}
      {d.trait && (
        <div className="detail-section">
          <div className="detail-section-title traits"><i className="ra ra-player-dodge" /> Traits</div>
          {d.trait.map((t: any, i: number) => (
            <div key={i} className="detail-entry">
              <strong>{t.name}.</strong>{' '}
              <span dangerouslySetInnerHTML={{ __html: renderEntries(t.entries) }} />
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {d.action && (
        <div className="detail-section">
          <div className="detail-section-title actions"><i className="ra ra-sword" /> Actions</div>
          {d.action.map((a: any, i: number) => (
            <div key={i} className="detail-entry">
              <strong>{a.name}.</strong>{' '}
              <span dangerouslySetInnerHTML={{ __html: renderEntries(a.entries) }} />
            </div>
          ))}
        </div>
      )}

      {/* Bonus Actions */}
      {d.bonus && (
        <div className="detail-section">
          <div className="detail-section-title bonus"><i className="ra ra-lightning-bolt" /> Bonus Actions</div>
          {d.bonus.map((b: any, i: number) => (
            <div key={i} className="detail-entry">
              <strong>{b.name}.</strong>{' '}
              <span dangerouslySetInnerHTML={{ __html: renderEntries(b.entries) }} />
            </div>
          ))}
        </div>
      )}

      {/* Reactions */}
      {d.reaction && (
        <div className="detail-section">
          <div className="detail-section-title reactions"><i className="ra ra-circular-shield" /> Reactions</div>
          {d.reaction.map((r: any, i: number) => (
            <div key={i} className="detail-entry">
              <strong>{r.name}.</strong>{' '}
              <span dangerouslySetInnerHTML={{ __html: renderEntries(r.entries) }} />
            </div>
          ))}
        </div>
      )}

      {/* Legendary Actions */}
      {d.legendary && (
        <div className="detail-section">
          <div className="detail-section-title legendary"><i className="ra ra-crown" /> Legendary Actions</div>
          {d.legendaryHeader && (
            <div className="detail-entry" style={{ fontStyle: 'italic' }}
              dangerouslySetInnerHTML={{ __html: renderEntries(d.legendaryHeader) }}
            />
          )}
          {d.legendary.map((l: any, i: number) => (
            <div key={i} className="detail-entry">
              <strong>{l.name}.</strong>{' '}
              <span dangerouslySetInnerHTML={{ __html: renderEntries(l.entries) }} />
            </div>
          ))}
        </div>
      )}

      {/* ---- Spellcasting ---- */}
      {d.spellcasting && (
        <div className="detail-section">
          <div className="detail-section-title spells"><i className="ra ra-burning-book" /> Spellcasting</div>

          {/* DC + To Hit Banner */}
          {(spellInfo.dc || spellInfo.toHit) && (
            <div className="spell-dc-banner">
              {spellInfo.dc && (
                <div className="spell-dc-badge">
                  <span className="label">DC</span>
                  <span className="value">{spellInfo.dc}</span>
                </div>
              )}
              <div className="spell-dc-info">
                {spellInfo.ability && <><strong>{spellInfo.ability}</strong> based spellcaster<br /></>}
                {spellInfo.toHit && <>Spell attack: <strong>{spellInfo.toHit}</strong></>}
              </div>
            </div>
          )}

          {d.spellcasting.map((sc: any, i: number) => (
            <div key={i}>
              <div className="detail-entry" style={{ marginBottom: 12 }}
                dangerouslySetInnerHTML={{ __html: parseEntry((sc.headerEntries || []).join(' ')) }}
              />

              {/* Spell slots */}
              {sc.spells && Object.entries(sc.spells).map(([level, sData]: [string, any]) => (
                <div className="spell-level-group" key={level}>
                  <div className="spell-level-header">
                    <i className="ra ra-fire" />
                    {level === '0' ? 'Cantrips (at will)' : `Level ${level}`}
                    {sData.slots != null && <span className="slots">— {sData.slots} slot{sData.slots > 1 ? 's' : ''}</span>}
                  </div>
                  <div className="spell-tags">
                    {sData.spells.map((s: string) => (
                      <SpellTag key={s} raw={s} />
                    ))}
                  </div>
                </div>
              ))}

              {/* At will */}
              {sc.will && (
                <div className="spell-level-group">
                  <div className="spell-level-header"><i className="ra ra-fire" /> At Will</div>
                  <div className="spell-tags">
                    {sc.will.map((s: string) => <SpellTag key={s} raw={s} />)}
                  </div>
                </div>
              )}

              {/* Daily */}
              {sc.daily && Object.entries(sc.daily).map(([times, spells]: [string, any]) => (
                <div className="spell-level-group" key={times}>
                  <div className="spell-level-header"><i className="ra ra-fire" /> {times.replace('e', '')}× / day</div>
                  <div className="spell-tags">
                    {spells.map((s: string) => <SpellTag key={s} raw={s} />)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   SPELL TAG (clickable pill that opens the spell modal)
   ============================================================ */
function SpellTag({ raw }: { raw: string }) {
  const [open, setOpen] = useState(false);
  const cleanName = raw
    .replace(/{@spell (.*?)(?:\|.*?)?}/g, '$1')
    .replace(/{@.*?}/g, '')
    .trim();
  const spellData = findSpell(cleanName);

  if (!spellData) {
    return (
      <span className="spell-tag spell-tag-unknown">
        <i className="ra ra-crystal-ball" /> {cleanName}
      </span>
    );
  }

  return (
    <>
      <button className="spell-tag" onClick={() => setOpen(true)}>
        <i className="ra ra-crystal-ball" /> {spellData.name}
      </button>
      {open && <SpellModal spell={spellData} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ============================================================
   SPELL MODAL
   ============================================================ */
function SpellModal({ spell, onClose }: { spell: any; onClose: () => void }) {
  const levelLabel = spell.level === 0
    ? 'Cantrip'
    : `Level ${spell.level}`;

  const schoolName = getSchoolName(spell.school);

  const rangeText = (() => {
    const r = spell.range;
    if (!r) return '—';
    if (r.type === 'point') {
      if (r.distance?.type === 'self') return 'Self';
      if (r.distance?.type === 'touch') return 'Touch';
      return `${r.distance?.amount || ''} ${r.distance?.type || ''}`;
    }
    return `${r.distance?.amount || ''} ${r.distance?.type || ''}`;
  })();

  const durationText = (() => {
    const d = spell.duration?.[0];
    if (!d) return '—';
    if (d.type === 'instant') return 'Instantaneous';
    if (d.type === 'permanent') return 'Permanent';
    if (d.type === 'special') return 'Special';
    const conc = d.concentration ? 'Conc. ' : '';
    return `${conc}${d.duration?.amount || ''} ${d.duration?.type || ''}`;
  })();

  const castTime = spell.time?.[0]
    ? `${spell.time[0].number} ${spell.time[0].unit}`
    : '—';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="spell-modal" onClick={e => e.stopPropagation()}>
        <div className="spell-modal-header">
          <div>
            <div className="spell-modal-title">{spell.name}</div>
            <div className="spell-modal-subtitle">{levelLabel} • {schoolName}</div>
          </div>
          <button className="spell-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="spell-modal-meta">
          <span className="spell-meta-tag"><i className="ra ra-stopwatch" /> {castTime}</span>
          <span className="spell-meta-tag"><i className="ra ra-targeted" /> {rangeText}</span>
          <span className="spell-meta-tag"><i className="ra ra-hourglass" /> {durationText}</span>
          {spell.components?.v && <span className="spell-meta-tag">V</span>}
          {spell.components?.s && <span className="spell-meta-tag">S</span>}
          {spell.components?.m && (
            <span className="spell-meta-tag" title={typeof spell.components.m === 'string' ? spell.components.m : spell.components.m?.text}>
              M
            </span>
          )}
        </div>

        <div className="spell-modal-body"
          dangerouslySetInnerHTML={{
            __html: renderEntries(spell.entries)
              + (spell.entriesHigherLevel
                ? '<br/><br/><strong>At Higher Levels. </strong>' + renderEntries(spell.entriesHigherLevel)
                : '')
          }}
        />
      </div>
    </div>
  );
}

/* ============================================================
   NARRATIVE MODAL
   ============================================================ */
function NarrativeModal({ count, onClose, onDisable }: { count: number; onClose: () => void; onDisable: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="spell-modal" onClick={e => e.stopPropagation()} style={{ borderColor: 'var(--orange)', boxShadow: '0 8px 32px rgba(237, 137, 54, 0.2)' }}>
        <div className="spell-modal-header" style={{ borderBottomColor: 'rgba(237, 137, 54, 0.2)' }}>
          <div>
            <div className="spell-modal-title" style={{ color: 'var(--orange)' }}>
              <i className="ra ra-speech-bubble" /> Momento de Narrativa
            </div>
            <div className="spell-modal-subtitle">Interação #{count}</div>
          </div>
          <button className="spell-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="spell-modal-body" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <i className="ra ra-wyvern" style={{ fontSize: '48px', color: 'var(--orange)', opacity: 0.5, marginBottom: '20px', display: 'block' }} />
          <p style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '10px', fontWeight: 600 }}>
            O que o monstro faz ou diz?
          </p>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '30px' }}>
            Descreva um grito de dor, uma provocação, ou uma mudança de postura do inimigo antes de continuar rolando dados.
          </p>
          <button className="btn-start" onClick={onClose} style={{ width: '100%', background: 'var(--orange)' }}>
            Continuar Combate
          </button>
          <button
            onClick={onDisable}
            style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-secondary)', marginTop: '12px', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Desativar lembretes
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   REINFORCEMENTS MODAL (with Autocomplete)
   ============================================================ */
function ReinforcementsModal({
  onAdd,
  onClose,
}: {
  onAdd: (name: string, count: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(1);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState('');

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setError('');
    if (val.trim().length >= 2) {
      const results = searchMonsters(val, 8);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  };

  const handleSelectMonster = (monster: any) => {
    setQuery(monster.name);
    setShowDropdown(false);
  };

  const handleAdd = () => {
    if (!query.trim()) {
      setError('Por favor, informe o nome da criatura.');
      return;
    }
    const monster = findMonster(query.trim());
    if (!monster) {
      setError(`Criatura não encontrada: "${query}"`);
      return;
    }
    onAdd(monster.name, Math.max(1, count));
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="spell-modal" onClick={e => e.stopPropagation()} style={{ borderColor: 'var(--purple)', maxWidth: '440px' }}>
        <div className="spell-modal-header" style={{ borderBottomColor: 'rgba(167, 139, 250, 0.2)' }}>
          <div>
            <div className="spell-modal-title" style={{ color: 'var(--purple-glow)' }}>
              <i className="ra ra-dragon" /> + Adicionar Reforços
            </div>
            <div className="spell-modal-subtitle">Insira novas criaturas no combate em andamento</div>
          </div>
          <button className="spell-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="spell-modal-body" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Quantidade
            </label>
            <input
              type="number"
              min="1"
              max="99"
              value={count}
              onChange={e => setCount(parseInt(e.target.value, 10) || 1)}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '15px',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }} className="autocomplete-container">
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Nome da Criatura (com autocompletar)
            </label>
            <input
              type="text"
              className="autocomplete-input"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onFocus={() => {
                if (query.trim().length >= 2) {
                  const results = searchMonsters(query, 8);
                  setSuggestions(results);
                  setShowDropdown(results.length > 0);
                }
              }}
              placeholder="Ex: goblin, ghoul, adult red dragon..."
              autoFocus
            />

            {showDropdown && suggestions.length > 0 && (
              <div className="autocomplete-dropdown">
                {suggestions.map(m => (
                  <div
                    key={m.name + (m.source || '')}
                    className="autocomplete-item"
                    onClick={() => handleSelectMonster(m)}
                  >
                    <div className="autocomplete-item-name">{m.name}</div>
                    <div className="autocomplete-item-meta">
                      <span>CR {getCr(m)}</span>
                      <span>•</span>
                      <span>{getMonsterType(m)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="setup-error" style={{ marginBottom: '16px' }}>
              <i className="ra ra-aware" /> {error}
            </div>
          )}

          <button
            className="btn-start"
            onClick={handleAdd}
            style={{
              marginTop: '10px',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              boxShadow: '0 4px 20px rgba(168, 85, 247, 0.3)',
            }}
          >
            <i className="ra ra-crossed-swords" /> Inserir no Combate
          </button>
        </div>
      </div>
    </div>
  );
}


