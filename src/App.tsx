import { useState, useEffect } from 'react';
import { loadMonsters, findMonster, fetchSpells, findSpell } from './api';
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

/* ============================================================
   APP ROOT
   ============================================================ */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('1 cult fanatic\n2 ghoul');
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
    Promise.all([loadMonsters(), fetchSpells()]).then(() => setLoading(false));
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
        if (!monster) { setError(`Monster not found: "${name}"`); return; }
        for (let i = 0; i < count; i++) {
          newCombatants.push({
            id: `${name}-${idCounter++}`,
            name: count > 1 ? `${monster.name} ${i + 1}` : monster.name,
            maxHp: getHp(monster),
            currentHp: getHp(monster),
            ac: getAc(monster),
            data: monster,
          });
        }
      } else {
        const monster = findMonster(line.trim());
        if (!monster) { setError(`Monster not found: "${line.trim()}"`); return; }
        newCombatants.push({
          id: `${line}-${idCounter++}`,
          name: monster.name,
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
              Encounter Roster
            </label>
            <textarea
              className="setup-textarea"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={'1 cult fanatic\n2 ghoul\n1 ogre'}
            />
            {error && (
              <div className="setup-error">
                <i className="ra ra-aware" /> {error}
              </div>
            )}
            
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
              <i className="ra ra-sword" /> Initiate Combat
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
        <button className="btn-back" onClick={onBack}>
          <i className="ra ra-arrow-cluster" /> Setup
        </button>
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
