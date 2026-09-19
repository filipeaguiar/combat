## ADDED Requirements

### Requirement: Criar personagem do jogador
O sistema SHALL permitir ao DM criar um novo personagem de jogador (PC) com os campos: Nome (string, obrigatório), HP Máximo (número, obrigatório, > 0), e Armor Class (número, obrigatório, > 0).

#### Scenario: Criação de PC com dados válidos
- **WHEN** o DM preenche Nome="Thorin", HP Máximo=45, AC=18 e clica em "Salvar"
- **THEN** o PC é adicionado à lista de PCs salvos com um ID único gerado automaticamente

#### Scenario: Criação de PC com campo obrigatório vazio
- **WHEN** o DM tenta salvar um PC sem preencher o Nome
- **THEN** o sistema não cria o PC e o campo com erro é destacado visualmente

### Requirement: Persistir PCs em local storage
O sistema SHALL salvar a lista de PCs em `localStorage` sob a chave `combat_saved_pcs` sempre que a lista for modificada (criação, edição, ou remoção).

#### Scenario: PCs persistem entre recarregamentos
- **WHEN** o DM cria um PC e recarrega a página
- **THEN** o PC aparece na lista de PCs salvos com os mesmos dados

#### Scenario: Local storage corrompido
- **WHEN** o conteúdo de `combat_saved_pcs` no local storage está corrompido ou com formato inválido
- **THEN** o sistema carrega uma lista vazia de PCs sem gerar erro visível ao usuário

### Requirement: Editar personagem do jogador
O sistema SHALL permitir ao DM editar Nome, HP Máximo e AC de um PC salvo existente.

#### Scenario: Edição de PC existente
- **WHEN** o DM clica em "Editar" em um PC salvo, altera o HP Máximo de 45 para 52 e clica em "Salvar"
- **THEN** o PC é atualizado na lista e no local storage com o novo HP Máximo

### Requirement: Remover personagem do jogador
O sistema SHALL permitir ao DM remover um PC salvo da lista.

#### Scenario: Remoção de PC
- **WHEN** o DM clica em "Remover" em um PC salvo
- **THEN** o PC é removido da lista e do local storage

### Requirement: Exibir lista de PCs salvos na setup screen
O sistema SHALL exibir uma seção "Personagens dos Jogadores" na setup screen mostrando todos os PCs salvos com seus stats (Nome, HP, AC).

#### Scenario: Lista de PCs visível ao abrir o app
- **WHEN** o DM abre o app e há PCs salvos no local storage
- **THEN** a seção "Personagens dos Jogadores" exibe todos os PCs com Nome, HP Máximo e AC

#### Scenario: Lista vazia
- **WHEN** o DM abre o app sem PCs salvos
- **THEN** a seção exibe uma mensagem indicando que nenhum PC foi cadastrado

### Requirement: Incluir PCs no combate
O sistema SHALL permitir ao DM selecionar quais PCs salvos participam do combate antes de iniciar.

#### Scenario: Selecionar PCs para combate
- **WHEN** o DM marca 3 de 5 PCs salvos e inicia o combate
- **THEN** apenas os 3 PCs selecionados aparecem na lista de combate junto com os monstros
