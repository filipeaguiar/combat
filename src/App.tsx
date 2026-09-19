import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { loadMonsters, findMonster, findMonsterAsync, fetchSpells, findSpell, searchMonsters } from './api';
import {
  getHp, getAc, renderEntries, getXp, getCr, getSpeed,
  getMonsterType, getSizeLabel, getModifier, extractSpellDc,
  getSchoolName, parseEntry,
} from './utils';
import './styles.css';

/* ============================================================
   TYPES
   ============================================================ */
type Combatant = {
  id: string;
  name: string;
  maxHp: number;
  currentHp: number;
  ac: number;
  initiative: number;
  isPlayer: boolean;
  data: any; // null for PCs
};

type SavedPC = {
  id: string;
  name: string;
  maxHp: number;
  ac: number;
};

type RosterItem = {
  id: string;
  monster: any;
  count: number;
  initiative: number; // shared initiative for all instances of this monster type
};

/* ============================================================
   LOCAL STORAGE HELPERS
   ============================================================ */
const LS_PCS_KEY = 'combat_saved_pcs';

function loadSavedPCs(): SavedPC[] {
  try {
    const raw = localStorage.getItem(LS_PCS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function savePCs(pcs: SavedPC[]): void {
  try {
    localStorage.setItem(LS_PCS_KEY, JSON.stringify(pcs));
  } catch {
    // silently ignore storage errors
  }
}

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
  const [isSearching, setIsSearching] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [showNarrative, setShowNarrative] = useState(false);
  const [enableNarrative, setEnableNarrative] = useState(() => {
    return localStorage.getItem('combat_narrative') !== 'false';
  });

  // Player Characters state
  const [savedPCs, setSavedPCs] = useState<SavedPC[]>(() => loadSavedPCs());
  const [selectedPCIds, setSelectedPCIds] = useState<Set<string>>(new Set());
  const [pcInitiatives, setPcInitiatives] = useState<Record<string, number>>({});

  // Combat turn tracking
  const [currentTurn, setCurrentTurn] = useState(0);
  const [round, setRound] = useState(1);

  useEffect(() => {
    localStorage.setItem('combat_narrative', String(enableNarrative));
  }, [enableNarrative]);

  useEffect(() => {
    Promise.all([loadMonsters(), fetchSpells()]).then(() => {
      setLoading(false);
      const fanatic = findMonster('cult fanatic');
      const ghoul = findMonster('ghoul');
      const initial: RosterItem[] = [];
      if (fanatic) initial.push({ id: `cult-fanatic-init`, monster: fanatic, count: 1, initiative: 0 });
      if (ghoul) initial.push({ id: `ghoul-init`, monster: ghoul, count: 2, initiative: 0 });
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
      return [...prev, { id: `${monster.name}-${Date.now()}`, monster, count: countToAdd, initiative: 0 }];
    });
    setSetupInput('');
    setSetupSuggestions([]);
    setShowSetupDropdown(false);
    setError('');
  };

  const handleAddSubmit = async () => {
    const { count, query } = parseQuantityAndName(setupInput);
    if (!query) {
      setError('Digite o nome da criatura (ex: 2 cultist ou goblin)');
      return;
    }
    // Fast path: already in cache
    const cached = findMonster(query);
    if (cached) {
      addMonsterToRoster(cached, count);
      return;
    }
    // Slow path: search across all 5e.tools sources
    setIsSearching(true);
    setError('');
    try {
      const monster = await findMonsterAsync(query);
      if (!monster) {
        setError(`Criatura não encontrada: "${query}"`);
        return;
      }
      addMonsterToRoster(monster, count);
    } finally {
      setIsSearching(false);
    }
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

  const updateRosterInitiative = (id: string, initiative: number) => {
    setRoster(prev => prev.map(item => item.id === id ? { ...item, initiative } : item));
  };

  const startCombat = () => {
    const hasMonsters = roster.length > 0;
    const hasPlayers = selectedPCIds.size > 0;
    if (!hasMonsters && !hasPlayers) {
      setError('Adicione pelo menos uma criatura ou personagem ao encontro!');
      return;
    }
    setError('');
    const newCombatants: Combatant[] = [];
    let idCounter = 1;

    // Add monsters
    for (const item of roster) {
      const { monster, count, initiative } = item;
      for (let i = 0; i < count; i++) {
        newCombatants.push({
          id: `${monster.name}-${idCounter++}`,
          name: count > 1 ? `${monster.name} ${i + 1}` : monster.name,
          maxHp: getHp(monster),
          currentHp: getHp(monster),
          ac: getAc(monster),
          initiative,
          isPlayer: false,
          data: monster,
        });
      }
    }

    // Add selected PCs
    for (const pc of savedPCs) {
      if (selectedPCIds.has(pc.id)) {
        newCombatants.push({
          id: `pc-${pc.id}-${idCounter++}`,
          name: pc.name,
          maxHp: pc.maxHp,
          currentHp: pc.maxHp,
          ac: pc.ac,
          initiative: pcInitiatives[pc.id] ?? 0,
          isPlayer: true,
          data: null,
        });
      }
    }

    // Sort by initiative descending
    newCombatants.sort((a, b) => b.initiative - a.initiative);

    setCombatants(newCombatants);
    setCurrentTurn(0);
    setRound(1);
    setScreen('combat');
    setInteractionCount(0);
    if (enableNarrative) setShowNarrative(true);
  };

  const totalRosterCreatures = roster.reduce((sum, item) => sum + item.count, 0);
  const totalRosterXp = roster.reduce((sum, item) => sum + (getXp(item.monster) * item.count), 0);

  /* ---- Saved PC CRUD ---- */
  const [pcForm, setPcForm] = useState<{ name: string; maxHp: string; ac: string }>({ name: '', maxHp: '', ac: '' });
  const [pcFormError, setPcFormError] = useState('');
  const [editingPCId, setEditingPCId] = useState<string | null>(null);

  const handlePCFormSubmit = () => {
    const name = pcForm.name.trim();
    const maxHp = parseInt(pcForm.maxHp, 10);
    const ac = parseInt(pcForm.ac, 10);
    if (!name) { setPcFormError('Nome é obrigatório.'); return; }
    if (isNaN(maxHp) || maxHp <= 0) { setPcFormError('HP Máximo deve ser maior que 0.'); return; }
    if (isNaN(ac) || ac <= 0) { setPcFormError('Armor Class deve ser maior que 0.'); return; }
    setPcFormError('');

    if (editingPCId) {
      const updated = savedPCs.map(pc => pc.id === editingPCId ? { ...pc, name, maxHp, ac } : pc);
      setSavedPCs(updated);
      savePCs(updated);
      setEditingPCId(null);
    } else {
      const newPC: SavedPC = { id: `pc-${Date.now()}`, name, maxHp, ac };
      const updated = [...savedPCs, newPC];
      setSavedPCs(updated);
      savePCs(updated);
    }
    setPcForm({ name: '', maxHp: '', ac: '' });
  };

  const startEditPC = (pc: SavedPC) => {
    setEditingPCId(pc.id);
    setPcForm({ name: pc.name, maxHp: String(pc.maxHp), ac: String(pc.ac) });
    setPcFormError('');
  };

  const cancelEditPC = () => {
    setEditingPCId(null);
    setPcForm({ name: '', maxHp: '', ac: '' });
    setPcFormError('');
  };

  const removePC = (id: string) => {
    const updated = savedPCs.filter(pc => pc.id !== id);
    setSavedPCs(updated);
    savePCs(updated);
    setSelectedPCIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const togglePCSelected = (id: string) => {
    setSelectedPCIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const updatePCInitiative = (id: string, value: number) => {
    setPcInitiatives(prev => ({ ...prev, [id]: value }));
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

          {/* ===== PLAYER CHARACTERS SECTION ===== */}
          <div className="setup-card" style={{ marginBottom: '16px' }}>
            <label className="setup-label">
              <i className="ra ra-player" style={{ color: 'var(--blue)' }} />
              Personagens dos Jogadores
            </label>

            {/* PC List */}
            {savedPCs.length > 0 ? (
              <div className="roster-list" style={{ marginBottom: '16px' }}>
                {savedPCs.map(pc => (
                  <div key={pc.id} className={`roster-item pc-roster-item${selectedPCIds.has(pc.id) ? ' pc-selected' : ''}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <input
                        type="checkbox"
                        checked={selectedPCIds.has(pc.id)}
                        onChange={() => togglePCSelected(pc.id)}
                        style={{ accentColor: 'var(--blue)', width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
                        title="Incluir no combate"
                      />
                      {editingPCId === pc.id ? (
                        <div className="pc-edit-form" style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <input
                              type="text"
                              className="pc-input"
                              placeholder="Nome"
                              value={pcForm.name}
                              onChange={e => setPcForm(f => ({ ...f, name: e.target.value }))}
                              style={{ flex: '1 1 120px', minWidth: '100px' }}
                            />
                            <input
                              type="number"
                              className="pc-input"
                              placeholder="HP Máx"
                              value={pcForm.maxHp}
                              min="1"
                              onChange={e => setPcForm(f => ({ ...f, maxHp: e.target.value }))}
                              style={{ width: '80px' }}
                            />
                            <input
                              type="number"
                              className="pc-input"
                              placeholder="CA"
                              value={pcForm.ac}
                              min="1"
                              onChange={e => setPcForm(f => ({ ...f, ac: e.target.value }))}
                              style={{ width: '70px' }}
                            />
                            <button className="pc-btn-save" onClick={handlePCFormSubmit}>Salvar</button>
                            <button className="pc-btn-cancel" onClick={cancelEditPC}>Cancelar</button>
                          </div>
                          {pcFormError && <div className="pc-form-error">{pcFormError}</div>}
                        </div>
                      ) : (
                        <div className="roster-item-info">
                          <div className="roster-item-name">
                            <i className="ra ra-player" style={{ color: 'var(--blue)', fontSize: '14px' }} />
                            {pc.name}
                          </div>
                          <div className="roster-item-meta">
                            <span style={{ color: 'var(--green)' }}>{pc.maxHp} HP</span>
                            <span>•</span>
                            <span style={{ color: 'var(--blue)' }}>CA {pc.ac}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {editingPCId !== pc.id && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {selectedPCIds.has(pc.id) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Init</label>
                            <input
                              type="number"
                              className="pc-initiative-input"
                              value={pcInitiatives[pc.id] ?? 0}
                              onChange={e => updatePCInitiative(pc.id, parseInt(e.target.value, 10) || 0)}
                              title="Iniciativa"
                            />
                          </div>
                        )}
                        <button className="btn-icon" onClick={() => startEditPC(pc)} title="Editar">
                          <i className="ra ra-quill-ink" />
                        </button>
                        <button className="btn-icon danger" onClick={() => removePC(pc.id)} title="Remover">
                          <i className="ra ra-burning-embers" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="roster-empty" style={{ marginBottom: '16px' }}>
                <i className="ra ra-player" style={{ color: 'var(--blue)', opacity: 0.4 }} />
                Nenhum personagem cadastrado ainda.<br />
                Adicione os jogadores abaixo para salvá-los para sessões futuras.
              </div>
            )}

            {/* Add PC Form (only shown if not editing) */}
            {!editingPCId && (
              <div className="pc-add-form">
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <input
                    type="text"
                    className="pc-input"
                    placeholder="Nome do personagem"
                    value={pcForm.name}
                    onChange={e => setPcForm(f => ({ ...f, name: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handlePCFormSubmit(); }}
                    style={{ flex: '1 1 140px', minWidth: '120px' }}
                  />
                  <input
                    type="number"
                    className="pc-input"
                    placeholder="HP Máx"
                    value={pcForm.maxHp}
                    min="1"
                    onChange={e => setPcForm(f => ({ ...f, maxHp: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handlePCFormSubmit(); }}
                    style={{ width: '85px' }}
                  />
                  <input
                    type="number"
                    className="pc-input"
                    placeholder="CA"
                    value={pcForm.ac}
                    min="1"
                    onChange={e => setPcForm(f => ({ ...f, ac: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handlePCFormSubmit(); }}
                    style={{ width: '70px' }}
                  />
                  <button className="pc-btn-save" onClick={handlePCFormSubmit}>
                    <i className="ra ra-plus" /> Salvar PC
                  </button>
                </div>
                {pcFormError && <div className="pc-form-error">{pcFormError}</div>}
              </div>
            )}
          </div>

          {/* ===== MONSTERS SECTION ===== */}
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

              <button className="btn-add-roster" onClick={handleAddSubmit} disabled={isSearching}>
                {isSearching
                  ? <><i className="ra ra-hourglass" /> Buscando…</>
                  : <><i className="ra ra-health" /> Inserir</>
                }
              </button>
            </div>

            {isSearching && (
              <div className="setup-error" style={{ background: 'rgba(109, 159, 255, 0.08)', border: '1px solid rgba(109, 159, 255, 0.25)', color: 'var(--blue)' }}>
                <i className="ra ra-crystal-ball" /> Buscando em todas as fontes do 5e.tools…
              </div>
            )}
            {!isSearching && error && (
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
                          {/* Initiative input for monsters */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Init</label>
                            <input
                              type="number"
                              className="pc-initiative-input"
                              value={item.initiative}
                              onChange={e => updateRosterInitiative(item.id, parseInt(e.target.value, 10) || 0)}
                              title="Iniciativa"
                            />
                          </div>
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
          currentTurn={currentTurn}
          setCurrentTurn={setCurrentTurn}
          round={round}
          setRound={setRound}
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
  combatants, setCombatants, currentTurn, setCurrentTurn, round, setRound, onBack, onInteraction,
}: {
  combatants: Combatant[];
  setCombatants: React.Dispatch<React.SetStateAction<Combatant[]>>;
  currentTurn: number;
  setCurrentTurn: React.Dispatch<React.SetStateAction<number>>;
  round: number;
  setRound: React.Dispatch<React.SetStateAction<number>>;
  onBack: () => void;
  onInteraction: () => void;
}) {
  const [showReinforcements, setShowReinforcements] = useState(false);

  const addReinforcements = (name: string, count: number, initiative: number) => {
    const monster = findMonster(name);
    if (!monster) return;
    const existingCount = combatants.filter(c => c.data && c.data.name.toLowerCase() === monster.name.toLowerCase()).length;
    const newCombatants: Combatant[] = [];
    for (let i = 0; i < count; i++) {
      const idx = existingCount + i + 1;
      newCombatants.push({
        id: `${monster.name}-${Date.now()}-${i}`,
        name: (existingCount + count > 1) ? `${monster.name} ${idx}` : monster.name,
        maxHp: getHp(monster),
        currentHp: getHp(monster),
        ac: getAc(monster),
        initiative,
        isPlayer: false,
        data: monster,
      });
    }
    setCombatants(prev => {
      const updated = [...prev, ...newCombatants];
      updated.sort((a, b) => b.initiative - a.initiative);
      return updated;
    });
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

  const updateCombatant = (id: string, fields: Partial<Combatant>) => {
    setCombatants(prev => {
      const currentCombatantId = prev[currentTurn]?.id;
      let updated = prev.map(c => c.id === id ? { ...c, ...fields } : c);

      // If initiative changed, re-sort and adjust currentTurn
      if (fields.initiative !== undefined) {
        updated = [...updated].sort((a, b) => b.initiative - a.initiative);
        const newTurnIdx = updated.findIndex(c => c.id === currentCombatantId);
        if (newTurnIdx >= 0) setCurrentTurn(newTurnIdx);
      }
      return updated;
    });
  };

  const removeCombatant = (id: string) => {
    setCombatants(prev => {
      const currentId = prev[currentTurn]?.id;
      const filtered = prev.filter(c => c.id !== id);
      // Adjust currentTurn so it stays on the same combatant if possible
      const newIdx = filtered.findIndex(c => c.id === currentId);
      if (newIdx >= 0) setCurrentTurn(newIdx);
      else setCurrentTurn(Math.min(currentTurn, Math.max(0, filtered.length - 1)));
      return filtered;
    });
  };

  const nextTurn = () => {
    if (combatants.length === 0) return;
    const next = (currentTurn + 1) % combatants.length;
    if (next === 0) setRound(r => r + 1);
    setCurrentTurn(next);
  };

  const prevTurn = () => {
    if (combatants.length === 0) return;
    if (currentTurn === 0) {
      setCurrentTurn(combatants.length - 1);
      setRound(r => Math.max(1, r - 1));
    } else {
      setCurrentTurn(currentTurn - 1);
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const currentId = combatants[currentTurn]?.id;
    const reordered = Array.from(combatants);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    setCombatants(reordered);
    // Keep currentTurn pointing at same combatant
    const newIdx = reordered.findIndex(c => c.id === currentId);
    if (newIdx >= 0) setCurrentTurn(newIdx);
  };

  const totalXp = combatants.filter(c => !c.isPlayer).reduce((sum, c) => sum + getXp(c.data), 0);
  const alive = combatants.filter(c => c.currentHp > 0).length;
  const activeCombatant = combatants[currentTurn];

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
            {/* Round counter */}
            <div className="combat-stat">
              <i className="ra ra-stopwatch" />
              Rodada <span className="value">{round}</span>
            </div>
          </div>

          {/* Turn controls */}
          <div className="turn-controls">
            <button className="btn-turn btn-prev" onClick={prevTurn} title="Turno Anterior">
              <i className="ra ra-arrow-cluster" />
            </button>
            <div className="turn-indicator">
              {activeCombatant ? (
                <>
                  <span className="turn-label">Turno:</span>
                  <span className={`turn-name${activeCombatant.isPlayer ? ' turn-name-player' : ''}`}>
                    <i className={`ra ${activeCombatant.isPlayer ? 'ra-player' : 'ra-dragon'}`} />
                    {activeCombatant.name}
                  </span>
                  <span className="turn-initiative">Init {activeCombatant.initiative}</span>
                </>
              ) : (
                <span className="turn-label">Sem combatentes</span>
              )}
            </div>
            <button className="btn-turn btn-next" onClick={nextTurn} title="Próximo Turno">
              <i className="ra ra-arrow-cluster" style={{ transform: 'rotate(180deg)' }} />
            </button>
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

      {/* Drag-and-drop combatant list */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="combatants-list">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {combatants.map((c, index) => (
                <Draggable key={c.id} draggableId={c.id} index={index}>
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      style={{
                        ...dragProvided.draggableProps.style,
                        opacity: dragSnapshot.isDragging ? 0.85 : 1,
                      }}
                    >
                      <CombatantCard
                        combatant={c}
                        isCurrentTurn={index === currentTurn}
                        dragHandleProps={dragProvided.dragHandleProps}
                        onUpdateHp={d => updateHp(c.id, d)}
                        onRemove={() => removeCombatant(c.id)}
                        onUpdate={fields => updateCombatant(c.id, fields)}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

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
  combatant, isCurrentTurn, dragHandleProps, onUpdateHp, onRemove, onUpdate,
}: {
  combatant: Combatant;
  isCurrentTurn: boolean;
  dragHandleProps: any;
  onUpdateHp: (delta: number) => void;
  onRemove: () => void;
  onUpdate: (fields: Partial<Combatant>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [damageInput, setDamageInput] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(combatant.name);
  const [editCurrentHp, setEditCurrentHp] = useState(String(combatant.currentHp));
  const [editMaxHp, setEditMaxHp] = useState(String(combatant.maxHp));
  const [editAc, setEditAc] = useState(String(combatant.ac));
  const [editInitiative, setEditInitiative] = useState(String(combatant.initiative));

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

  const startEditing = () => {
    setEditName(combatant.name);
    setEditCurrentHp(String(combatant.currentHp));
    setEditMaxHp(String(combatant.maxHp));
    setEditAc(String(combatant.ac));
    setEditInitiative(String(combatant.initiative));
    setEditing(true);
  };

  const saveEdit = () => {
    const newCurrentHp = parseInt(editCurrentHp, 10);
    const newMaxHp = parseInt(editMaxHp, 10);
    const newAc = parseInt(editAc, 10);
    const newInitiative = parseInt(editInitiative, 10);
    onUpdate({
      name: editName.trim() || combatant.name,
      currentHp: isNaN(newCurrentHp) ? combatant.currentHp : Math.min(Math.max(0, newCurrentHp), isNaN(newMaxHp) ? combatant.maxHp : newMaxHp),
      maxHp: isNaN(newMaxHp) ? combatant.maxHp : Math.max(1, newMaxHp),
      ac: isNaN(newAc) ? combatant.ac : Math.max(1, newAc),
      initiative: isNaN(newInitiative) ? combatant.initiative : newInitiative,
    });
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  const cardClasses = [
    'combatant-card',
    isDead ? 'dead' : '',
    isCurrentTurn ? 'current-turn' : '',
    combatant.isPlayer ? 'player-card' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClasses}>
      <div className="card-main">
        {/* Drag Handle */}
        <div className="drag-handle" {...dragHandleProps} title="Arrastar para reordenar">
          <i className="ra ra-vertical-bars" />
        </div>

        <div className="card-content">
          {/* Top row: name + actions */}
          <div className="card-top-row">
            <div className="monster-identity">
              {editing ? (
                <input
                  type="text"
                  className="pc-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, width: '100%' }}
                />
              ) : (
                <div className="monster-name">
                  {isCurrentTurn && <span className="active-turn-dot" title="Turno atual" />}
                  <i className={`ra ${isDead ? 'ra-skull' : combatant.isPlayer ? 'ra-player' : 'ra-dragon'}`}
                    style={{ color: combatant.isPlayer ? 'var(--blue)' : isDead ? 'var(--text-muted)' : 'var(--red)' }}
                  />
                  {combatant.name}
                </div>
              )}
              {!editing && (
                <div className="monster-meta">
                  {combatant.isPlayer
                    ? <span style={{ color: 'var(--blue)', fontStyle: 'italic' }}>Personagem do Jogador</span>
                    : (d ? `${getSizeLabel(d.size)} ${getMonsterType(d)}` : '')
                  }
                  {' '}
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    Init: {combatant.initiative}
                  </span>
                </div>
              )}
            </div>

            <div className="card-actions">
              {editing ? (
                <>
                  <button className="btn-icon" onClick={saveEdit} title="Salvar">
                    <i className="ra ra-check" />
                  </button>
                  <button className="btn-icon" onClick={cancelEdit} title="Cancelar">
                    <i className="ra ra-cancel" />
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-icon" onClick={startEditing} title="Editar stats">
                    <i className="ra ra-quill-ink" />
                  </button>
                  {!combatant.isPlayer && d && (
                    <button
                      className="btn-icon"
                      onClick={() => setExpanded(!expanded)}
                      title={expanded ? 'Collapse' : 'Expand details'}
                    >
                      <i className={`ra ${expanded ? 'ra-cancel' : 'ra-scroll-unfurled'}`} />
                    </button>
                  )}
                  <button className="btn-icon danger" onClick={onRemove} title="Remove">
                    <i className="ra ra-burning-embers" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Edit fields for HP, AC, Initiative */}
          {editing && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '8px 0', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>HP Atual</label>
                <input type="number" className="pc-input" value={editCurrentHp} min="0"
                  onChange={e => setEditCurrentHp(e.target.value)} style={{ width: '75px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>HP Máx</label>
                <input type="number" className="pc-input" value={editMaxHp} min="1"
                  onChange={e => setEditMaxHp(e.target.value)} style={{ width: '75px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>CA</label>
                <input type="number" className="pc-input" value={editAc} min="1"
                  onChange={e => setEditAc(e.target.value)} style={{ width: '65px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Init</label>
                <input type="number" className="pc-input" value={editInitiative}
                  onChange={e => setEditInitiative(e.target.value)} style={{ width: '65px' }} />
              </div>
            </div>
          )}

          {/* Stat badges */}
          {!editing && (
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
              {!combatant.isPlayer && d && (
                <>
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
                </>
              )}
            </div>
          )}

          {/* Damage controls */}
          {!editing && (
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
          )}
        </div>
      </div>

      {/* ---- Expanded Details (monsters only) ---- */}
      {expanded && !combatant.isPlayer && d && <CardDetails data={d} />}
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
  onAdd: (name: string, count: number, initiative: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(1);
  const [initiative, setInitiative] = useState(0);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

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

  const handleAdd = async () => {
    if (!query.trim()) {
      setError('Por favor, informe o nome da criatura.');
      return;
    }
    // Fast path
    const cached = findMonster(query.trim());
    if (cached) {
      onAdd(cached.name, Math.max(1, count), initiative);
      onClose();
      return;
    }
    // Slow path: search all 5e.tools sources
    setIsSearching(true);
    setError('');
    try {
      const monster = await findMonsterAsync(query.trim());
      if (!monster) {
        setError(`Criatura não encontrada: "${query}"`);
        return;
      }
      onAdd(monster.name, Math.max(1, count), initiative);
      onClose();
    } finally {
      setIsSearching(false);
    }
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
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
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
            <div style={{ width: '90px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Iniciativa
              </label>
              <input
                type="number"
                value={initiative}
                onChange={e => setInitiative(parseInt(e.target.value, 10) || 0)}
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

          {isSearching && (
            <div className="setup-error" style={{ marginBottom: '16px', background: 'rgba(109, 159, 255, 0.08)', border: '1px solid rgba(109, 159, 255, 0.25)', color: 'var(--blue)' }}>
              <i className="ra ra-crystal-ball" /> Buscando em todas as fontes do 5e.tools…
            </div>
          )}
          {!isSearching && error && (
            <div className="setup-error" style={{ marginBottom: '16px' }}>
              <i className="ra ra-aware" /> {error}
            </div>
          )}

          <button
            className="btn-start"
            onClick={handleAdd}
            disabled={isSearching}
            style={{
              marginTop: '10px',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              boxShadow: '0 4px 20px rgba(168, 85, 247, 0.3)',
            }}
          >
            {isSearching
              ? <><i className="ra ra-hourglass" /> Buscando…</>
              : <><i className="ra ra-crossed-swords" /> Inserir no Combate</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
