<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 🚨 MANDATÓRIO: Protocolo State-Machine & Docs as Code (Execução Autônoma)

Qualquer agente de IA que iniciar uma sessão neste repositório DEVE executar este fluxo automaticamente, mesmo que o usuário não mencione na mensagem:

### 1. Leitura de Boot Obrigatória & Upstream Benchmarking
Antes de escrever qualquer código, leia silenciosamente:
1. `docs/PROJECT_STATE.md` (Estado atual e seção `## Context Handoff`).
2. `docs/ARCHITECTURE_EXPANSION.md` (Plano Mestre de Expansão em 5 Etapas, Tabela Oficial de Repositórios e especificações matemáticas).
3. **Regra Obrigatória de Upstream Benchmarking:** Antes de codificar, consulte a tabela de repositórios em `docs/ARCHITECTURE_EXPANSION.md`. Baixe temporariamente em `.benchmarks/` os arquivos de referência do repositório relacionado a este recurso para conferir a implementação oficial real antes de escrever o código, removendo `.benchmarks/` ao concluir.

### 2. Regras Inegociáveis de Arquitetura (Kitsune Finance)
- **Soberania Custo Zero ($0.00/mês):** Proibido introduzir bibliotecas, APIs ou serviços pagos.
- **Blindagem MSLR (Zero Alucinação Matemática):** É estritamente PROIBIDO pedir para LLMs (Gemini/Groq) calcularem saldos, juros, CDI, IR/IOF, amortizações ou divisões. Todo cálculo deve ser executado nos motores determinísticos em `src/utils/finance/engine/` e passado pronto via JSON/Tool Calling para a IA.
- **Precisão Monetária e Calendário:** Proibido usar aritmética flutuante ingênua que estoure `Number.MAX_SAFE_INTEGER` (53 bits). Datas sem hora devem usar `parseLocalDate` para evitar deslocamento UTC no dia 1º do mês.
- **Segurança & Multi-Tenancy:** Todas as rotas `/api/**` exigem `supabase.auth.getUser()`. Zero mocks (`MOCK_*` proibidos). Respeito absoluto ao `isPrivacyMode` (`hideValues`).
- **Design System Warm Obsidian:** Manter fundo `#0A0A0A`, cards `#121214`, subcontainers `#18181B`, bordas `#27272A` e acento `#FF8216`. Proibido usar tons azulados/marinho.

### 3. Sincronização Obrigatória Pós-Tarefa
Ao finalizar qualquer entrega:
1. Marque o status atualizado em `docs/ARCHITECTURE_EXPANSION.md` e `docs/PROJECT_STATE.md`.
2. Atualize o bloco `## Context Handoff` em `docs/PROJECT_STATE.md` para que o próximo chat saiba exatamente de onde continuar.
3. Registre no topo de `docs/CHANGELOG.md` uma entrada de 4 a 6 linhas (`[YYYY-MM-DD]`, Arquivos Afetados e Objetivo).
