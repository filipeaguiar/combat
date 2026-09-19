## Why

O Combat Tracker atualmente funciona apenas como tracker de monstros — não existe suporte para personagens dos jogadores (PCs), nem persistência de dados entre sessões. Ao iniciar um novo combate, o DM perde toda a configuração anterior. Além disso, não há rastreamento de iniciativa: combatentes são listados na ordem de inserção, sem turnos, rodadas, ou ordenação por iniciativa. Para funcionar como um tracker de combate completo no estilo D&D 5e, o app precisa suportar PCs salvos, ordem de iniciativa com drag-and-drop, e persistência via local storage.

## What Changes

- **Gerenciamento de PCs**: Adicionar uma seção dedicada para criar, editar e remover personagens dos jogadores com stats simples (Nome, HP Máximo, Armor Class).
- **Persistência em Local Storage**: PCs ficam salvos no navegador para uso em sessões futuras. O roster de combate atual também pode ser persistido opcionalmente.
- **Iniciativa e Ordem de Turno**: Cada combatente (PC e monstro) recebe um valor de iniciativa. A lista é ordenada por iniciativa, com rastreamento de turno atual e contador de rodadas.
- **Drag-and-drop para Iniciativa**: Os combatentes podem ser arrastados manualmente para ajustar a ordem de iniciativa (já existe `react-beautiful-dnd` no projeto, mas não é usado para esse propósito).
- **Edição Inline de Combatentes**: Permitir modificar Nome, HP, AC e Iniciativa de qualquer combatente durante o combate.

## Capabilities

### New Capabilities
- `player-characters`: Gerenciamento de personagens dos jogadores (CRUD) com persistência em local storage. Inclui formulário de criação/edição e lista de PCs salvos.
- `initiative-tracking`: Rastreamento de ordem de iniciativa com ordenação automática, turnos, rodadas, e reordenação via drag-and-drop.

### Modified Capabilities
_(nenhuma capability existente é modificada a nível de spec — as mudanças são adições)_

## Impact

- **`src/App.tsx`**: Componente principal será significativamente modificado para incluir novos estados, componentes de PC management, e lógica de iniciativa/turnos.
- **Local Storage**: Nova dependência de persistência — PCs salvos e potencialmente estado do combate.
- **`react-beautiful-dnd`**: Já instalado como dependência, será utilizado para drag-and-drop na lista de iniciativa.
- **UX**: Nova seção/painel no setup screen para gerenciar PCs salvos. Combat screen ganha indicadores de turno, rodada e ordenação por iniciativa.
