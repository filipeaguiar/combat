## Context

O Combat Tracker é uma SPA React + TypeScript + Vite, deployada como PWA no GitHub Pages. Atualmente o app permite ao DM montar um roster de monstros a partir de dados do 5e.tools, iniciar combate e gerenciar HP/AC de cada criatura. Não existe suporte para personagens dos jogadores (PCs), nenhum sistema de iniciativa (combatentes são listados na ordem de inserção), e a única persistência em local storage é a preferência de lembretes narrativos.

O projeto já tem `react-beautiful-dnd` instalado mas não utilizado no código atual. Toda a lógica vive em `src/App.tsx` (~1076 linhas) como um componente monolítico com hooks de estado.

## Goals / Non-Goals

**Goals:**
- Permitir que o DM crie e gerencie uma lista de PCs persistidos em local storage
- Adicionar campo de iniciativa a todos os combatentes (PCs e monstros)
- Implementar ordenação automática por iniciativa e rastreamento de turno/rodada
- Permitir drag-and-drop para reordenar combatentes na lista de iniciativa
- Permitir edição inline de stats (Nome, HP, AC, Iniciativa) durante combate

**Non-Goals:**
- Sistema de rolagem automática de iniciativa (o DM ou jogadores rolam dados fisicamente e inserem o valor)
- Persistência do estado completo de combate entre sessões (apenas PCs são persistidos)
- Refatoração do monólito `App.tsx` em múltiplos arquivos/componentes (pode ser feito em change futura)
- Autenticação ou sincronização entre dispositivos
- Suporte a multi-classe, habilidades, ou inventário de PCs

## Decisions

### 1. Tipo `Combatant` expandido com campo `initiative`

**Decisão:** Adicionar um campo `initiative: number` ao tipo `Combatant` existente e um campo `isPlayer: boolean` para distinguir PCs de monstros.

**Alternativas consideradas:**
- Tipos separados `PlayerCombatant` e `MonsterCombatant` — rejeitado por adicionar complexidade desnecessária ao manuseio da lista unificada de combate.
- Union type com discriminant — over-engineering para dois campos extras.

**Rationale:** Manter um tipo unificado simplifica a renderização da lista, drag-and-drop, e ordenação. O campo `data` (raw monster object) já é `any` e fica `null` para PCs.

### 2. Local Storage para PCs com chave `combat_saved_pcs`

**Decisão:** Usar `localStorage.setItem('combat_saved_pcs', JSON.stringify(pcs))` para persistir a lista de PCs. Formato: array de `{ id, name, maxHp, ac }`.

**Alternativas consideradas:**
- IndexedDB — desnecessário para a escala de dados (< 1KB tipicamente).
- Sincronização com API externa — fora do escopo (Non-Goal).

**Rationale:** Local storage é suficiente, simples, e alinhado com o padrão já existente no projeto (usado para `combat_narrative`).

### 3. Drag-and-drop com `react-beautiful-dnd` existente

**Decisão:** Utilizar a dependência `react-beautiful-dnd` já instalada no `package.json` para reordenação manual da lista de iniciativa.

**Alternativas consideradas:**
- `@hello-pangea/dnd` (fork mantido) — melhor suporte a React 18, mas adicionaria nova dependência.
- HTML5 Drag and Drop API nativo — UX inferior em mobile.

**Rationale:** A dependência já está instalada e não precisa de mudança no `package.json`. Se problemas surgirem com React 18 strict mode, pode-se migrar para o fork em change futura.

### 4. Iniciativa como input manual, não rolagem automática

**Decisão:** O DM digita o valor de iniciativa para cada combatente. Não há rolagem automática.

**Rationale:** Mantém a simplicidade e é alinhado com o pedido do usuário. Muitos DMs preferem rolar dados físicos. Rolagem automática pode ser adicionada futuramente.

### 5. PCs adicionados ao combate a partir do roster salvo

**Decisão:** Na setup screen, exibir uma seção "Personagens dos Jogadores" com os PCs salvos. O DM marca quais participam do combate e insere a iniciativa de cada um ao iniciar.

**Alternativas consideradas:**
- PCs sempre incluídos automaticamente — limita flexibilidade (nem todo combate tem todos os PCs).
- Pop-up de seleção ao iniciar combate — friction adicional.

**Rationale:** Manter PCs visíveis na setup screen junto com o roster de monstros permite montagem rápida do encontro.

### 6. Ordenação por iniciativa com desempate manual via drag

**Decisão:** Ao iniciar combate, a lista é ordenada por `initiative` (decrescente). Empates podem ser resolvidos manualmente via drag-and-drop.

**Alternativas consideradas:**
- Desempate automático por DEX modifier — PCs não têm DEX no modelo simplificado.
- Desempate aleatório — inconsistente com regras da mesa.

**Rationale:** Drag-and-drop já resolve empates de forma intuitiva e flexível.

## Risks / Trade-offs

- **`react-beautiful-dnd` e React 18 Strict Mode** → Se strict mode causar warnings ou bugs visuais, desabilitar strict mode em dev ou migrar para `@hello-pangea/dnd`. Risco baixo em produção.
- **App.tsx ficará ainda maior (~1300+ linhas)** → Aceito como trade-off por simplicidade. Refatoração pode ser feita em change futura sem impacto funcional.
- **Local storage pode ser limpo pelo usuário** → Não há backup. Aceito — dados de PCs são simples e rápidos de recriar.
- **Sem validação de dados no local storage** → Se o formato for corrompido, o app pode quebrar. Mitigação: try/catch ao ler local storage com fallback para array vazio.
