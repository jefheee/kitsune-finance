<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 🚨 MANDATÓRIO: Protocolo Docs as Code (Documentação Autônoma)
Toda e qualquer alteração de código, endpoints, componentes, schema ou arquitetura no **Kitsune Finance** deve ser documentada autonomamente:
1. **Consulte** `docs/PROJECT_STATE.md` para entender o estado atual antes de modificações profundas.
2. **Atualize** `docs/PROJECT_STATE.md` quando novas rotas, tabelas ou recursos forem adicionados/concluídos.
3. **Registre** no topo de `docs/CHANGELOG.md` uma entrada curta (4 a 6 linhas) com data, objetivo e arquivos afetados.
Nenhum agente deve finalizar uma alteração no código sem manter a documentação sincronizada.
