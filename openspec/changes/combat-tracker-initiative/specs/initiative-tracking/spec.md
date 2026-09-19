## ADDED Requirements

### Requirement: Campo de iniciativa para combatentes
O sistema SHALL incluir um campo de iniciativa (número inteiro) para cada combatente (PC e monstro) ao adicioná-lo ao combate.

#### Scenario: Inserir iniciativa ao adicionar monstro ao combate
- **WHEN** o DM inicia o combate com monstros no roster
- **THEN** cada monstro recebe um campo de iniciativa que o DM pode preencher

#### Scenario: Inserir iniciativa para PC
- **WHEN** o DM seleciona PCs para o combate
- **THEN** cada PC selecionado recebe um campo de iniciativa que o DM pode preencher

### Requirement: Ordenação automática por iniciativa
O sistema SHALL ordenar a lista de combatentes em ordem decrescente de iniciativa ao iniciar o combate.

#### Scenario: Combatentes ordenados ao iniciar
- **WHEN** o DM tem combatentes com iniciativas 20, 15, 8 e 3 e inicia o combate
- **THEN** a lista exibe os combatentes na ordem: 20, 15, 8, 3

#### Scenario: Empate de iniciativa
- **WHEN** dois combatentes têm a mesma iniciativa (ex: ambos 15)
- **THEN** ambos aparecem adjacentes na lista e o DM pode reordená-los manualmente via drag-and-drop

### Requirement: Rastreamento de turno atual
O sistema SHALL destacar visualmente o combatente cujo turno é o atual e permitir avançar/retroceder turnos.

#### Scenario: Turno inicial
- **WHEN** o combate é iniciado
- **THEN** o primeiro combatente da lista (maior iniciativa) é destacado como turno atual

#### Scenario: Avançar turno
- **WHEN** o DM clica em "Próximo Turno"
- **THEN** o destaque move para o próximo combatente na lista

#### Scenario: Avançar turno no último combatente
- **WHEN** o DM clica em "Próximo Turno" e o turno atual é do último combatente da lista
- **THEN** o turno volta ao primeiro combatente e o contador de rodadas incrementa em 1

#### Scenario: Retroceder turno
- **WHEN** o DM clica em "Turno Anterior"
- **THEN** o destaque move para o combatente anterior na lista

### Requirement: Contador de rodadas
O sistema SHALL exibir o número da rodada atual, começando em 1 ao iniciar o combate.

#### Scenario: Rodada inicial
- **WHEN** o combate é iniciado
- **THEN** o contador exibe "Rodada 1"

#### Scenario: Incremento de rodada
- **WHEN** todos os combatentes completam seus turnos
- **THEN** o contador incrementa para a próxima rodada

### Requirement: Drag-and-drop para reordenar iniciativa
O sistema SHALL permitir ao DM arrastar combatentes para reordenar a lista de iniciativa manualmente.

#### Scenario: Reordenar via drag-and-drop
- **WHEN** o DM arrasta o combatente na posição 3 para a posição 1
- **THEN** o combatente é movido para a posição 1 e a lista é atualizada

#### Scenario: Drag-and-drop mantém turno correto
- **WHEN** o DM reordena combatentes via drag-and-drop durante combate
- **THEN** o indicador de turno atual permanece no mesmo combatente (não muda de pessoa)

### Requirement: Edição inline de stats durante combate
O sistema SHALL permitir ao DM editar Nome, HP, AC e Iniciativa de qualquer combatente durante o combate.

#### Scenario: Editar HP de um combatente
- **WHEN** o DM clica em editar no combatente, altera o HP e salva
- **THEN** o HP do combatente é atualizado na lista

#### Scenario: Editar iniciativa e reordenar
- **WHEN** o DM edita a iniciativa de um combatente de 10 para 22
- **THEN** o combatente é reposicionado na lista de acordo com a nova iniciativa (posição mais alta)
