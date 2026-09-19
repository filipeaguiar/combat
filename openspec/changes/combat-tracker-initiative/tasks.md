## 1. Tipo de Dados e Local Storage

- [x] 1.1 Expandir o tipo `Combatant` adicionando os campos `initiative: number` e `isPlayer: boolean`
- [x] 1.2 Criar o tipo `SavedPC` com campos `id: string`, `name: string`, `maxHp: number`, `ac: number`
- [x] 1.3 Criar funções helper para ler e salvar PCs no local storage (`loadSavedPCs`, `savePCs`) com try/catch e fallback para array vazio em caso de dados corrompidos

## 2. Gerenciamento de PCs (Setup Screen)

- [x] 2.1 Criar estado `savedPCs` inicializado a partir do local storage via `loadSavedPCs()`
- [x] 2.2 Criar componente/seção "Personagens dos Jogadores" na setup screen com lista de PCs salvos exibindo Nome, HP Máximo e AC
- [x] 2.3 Implementar formulário de criação de PC com campos Nome, HP Máximo e AC, com validação (campos obrigatórios, valores > 0)
- [x] 2.4 Implementar edição inline de PC salvo (Nome, HP Máximo, AC) com botões Salvar/Cancelar
- [x] 2.5 Implementar remoção de PC salvo com atualização do local storage
- [x] 2.6 Exibir mensagem de estado vazio quando não há PCs cadastrados

## 3. Seleção de PCs para Combate

- [x] 3.1 Adicionar checkboxes nos PCs salvos para seleção de participantes do combate
- [x] 3.2 Adicionar campo de input de iniciativa para cada PC selecionado
- [x] 3.3 Ao iniciar combate, converter PCs selecionados em objetos `Combatant` com `isPlayer: true` e `data: null`

## 4. Iniciativa para Monstros

- [x] 4.1 Adicionar campo de input de iniciativa para cada grupo de monstros no roster (ou individualmente ao gerar instâncias)
- [x] 4.2 Garantir que ao gerar instâncias de combatentes, cada monstro receba o valor de iniciativa informado

## 5. Ordenação e Turno de Combate

- [x] 5.1 Ao iniciar combate, ordenar a lista unificada de combatentes (PCs + monstros) por iniciativa decrescente
- [x] 5.2 Implementar estado `currentTurn` (índice) e `round` (número da rodada, começando em 1)
- [x] 5.3 Implementar destaque visual do combatente cujo turno é o atual
- [x] 5.4 Implementar botão "Próximo Turno" que avança o turno e incrementa rodada ao completar o ciclo
- [x] 5.5 Implementar botão "Turno Anterior" que retrocede o turno

## 6. Drag-and-Drop na Lista de Iniciativa

- [x] 6.1 Envolver a lista de combatentes em `DragDropContext` e `Droppable` do `@hello-pangea/dnd`
- [x] 6.2 Tornar cada `CombatantCard` um `Draggable` com handle visual de arraste
- [x] 6.3 Implementar `onDragEnd` para reordenar o array de combatentes mantendo o turno no combatente correto (ajustar `currentTurn` se necessário)

## 7. Edição Inline Durante Combate

- [x] 7.1 Implementar edição inline de Nome, HP atual, HP máximo e AC para qualquer combatente na combat screen
- [x] 7.2 Implementar edição inline de Iniciativa com reordenação automática da lista ao salvar
- [x] 7.3 Ajustar `currentTurn` após reordenação por edição de iniciativa para manter o turno no combatente correto

## 8. Estilização e UX

- [x] 8.1 Estilizar a seção de PCs na setup screen seguindo o visual dark fantasy existente (Cinzel, cores #0f0d13, purple/amber)
- [x] 8.2 Estilizar indicador de turno atual e contador de rodadas na combat screen
- [x] 8.3 Diferenciar visualmente PCs de monstros na lista de combate (ex: borda ou ícone diferente)
- [x] 8.4 Adicionar visual feedback para drag-and-drop (item arrastado, placeholder)

## 9. Verificação e Build

- [x] 9.1 Testar fluxo completo: criar PC → salvar → recarregar → verificar persistência
- [x] 9.2 Testar fluxo de combate: adicionar PCs + monstros → ordenar por iniciativa → avançar turnos → drag-and-drop
- [x] 9.3 Rodar `npm run build` e verificar que não há erros de TypeScript ou build
