# Documentação — Patrono Seller (MVP Afiliada)

**Última atualização:** 13/09/2026 — Rodada 2 do P0 (fundação de dados: workspace, Programa×Operação×Integração, Venda×Comissão, auditoria).

Este documento registra o **estado real** do projeto. Nada aqui descreve algo planejado como se já existisse — o que está pendente é dito explicitamente.

---

## 1. Visão do produto

O Patrono Seller é uma plataforma para a proprietária atuar como **afiliada**: encontrar produtos, cadastrar-se em programas de afiliados, divulgar com conteúdo (hoje gerado por IA de texto e vídeo por API paga externa opcional) e acompanhar vendas/comissão. O protótipo de referência (`referencia-prototipo-legado/`) descreve um produto mais amplo (times, OKRs, lives IA, chatbot etc.) — esses módulos avançados existem como conceito futuro ("Mais módulos"), mas **não competem** com o objetivo central desta fase.

## 2. Objetivo do MVP Afiliada

Uma única meta: a proprietária realizar sua **primeira comissão** como afiliada, através do fluxo:

**Programa de afiliados → Produto → Link de afiliada → Criar conteúdo → Aprovar → Distribuir → Publicação manual assistida → Marcar como publicado → Resultados → Registrar venda/comissão → Primeira comissão.**

Este fluxo é a referência aprovada (`design_handoff` — ver zip de handoff recebido em 13/09/2026) e **não deve ser redesenhado** sem registrar antes uma "ALTERAÇÃO DE DESIGN NECESSÁRIA".

## 3. Arquitetura atual

- **Next.js 15** (App Router) + **TypeScript**, rodando na Vercel.
- **NextAuth v4** (Credentials Provider + JWT) para autenticação.
- **Prisma ORM** sobre **PostgreSQL** (Supabase Postgres em produção).
- **Supabase Storage** para upload direto de imagens/vídeos (contorna o limite de 4,5 MB de payload das Serverless Functions da Vercel).
- Vercel Cron chama `/api/cron/publicar` para publicação automática de conteúdos agendados.

Não existe fila/worker separado, cache externo, ou serviço de observabilidade — tudo roda dentro do próprio Next.js e do Postgres.

## 4. Stack atual (resumo — detalhe de custo em `STACK-CUSTO-ZERO.md`)

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript |
| Autenticação | NextAuth v4 (Credentials + JWT) |
| Banco | PostgreSQL (Supabase) |
| ORM | Prisma 5 |
| Storage de mídia | Supabase Storage |
| E-mail transacional | Resend (fluxo "esqueci a senha") |
| IA de texto | Anthropic Claude (`@anthropic-ai/sdk`) |
| IA de vídeo | fal.ai (Kling, Veo 3, Luma Ray 2) — **serviço pago**, ver `STACK-CUSTO-ZERO.md` |
| UI | Tailwind CSS, Radix UI, lucide-react |
| Hospedagem | Vercel |

## 5. Autenticação

- `lib/auth.ts` — `CredentialsProvider` com e-mail/senha (bcrypt), sessão JWT (30 dias).
- Login recusa contas com `status: 'pendente'` (aguardando aprovação) ou `status: 'bloqueado'`.
- Sessão carrega `id`, `role` e, desde esta rodada, **`workspaceId`** — usado em toda filtragem de dados.
- Sessões emitidas antes desta rodada (sem `workspaceId` no token) se auto-completam na próxima requisição (busca no banco pelo `id`), sem exigir novo login.
- Fluxo de recuperação de senha: token stateless HMAC-SHA256 (`lib/reset-token.ts`), sem tabela de tokens — invalidado automaticamente quando a senha muda.

## 6. Banco de dados / Prisma

Modelos hoje (`prisma/schema.prisma`):

| Modelo | Papel |
|---|---|
| `User` | conta de acesso; pertence a um `Workspace` |
| `Workspace` | fronteira de isolamento de dados (ver seção 8) |
| `ModuloPermissao` | quais telas cada papel (role) vê |
| `Produto` | produto cadastrado para divulgar |
| `LinkDinamico` | link de afiliada por produto/plataforma; contador de cliques/conversões |
| `EventoLink` | evento individual de clique num link |
| `Conteudo` | roteiro/legendas/vídeo gerado para um produto |
| `Integracao` | credencial de uma integração real (Instagram, Shopee, WhatsApp) por workspace |
| `AffiliateProgram` | **novo** — Programa × Operação × Integração (seção 9) |
| `Sale` | **novo** — venda, separada de comissão (seção 10) |
| `Commission` | **novo** — comissão, separada de venda (seção 10) |
| `AuditLog` | **novo** — auditoria de operações de escrita (seção 11) |

Migrations em `prisma/migrations/`, aplicadas com `prisma migrate deploy` (ver seção 13).

## 7. Middleware / rotas públicas e protegidas

`middleware.ts` usa política **negar por padrão**: tudo exige sessão exceto a lista explícita abaixo. (Antes da Rodada 1 do P0, era o oposto — uma lista de telas *protegidas*, e sete áreas ficaram de fora dela por esquecimento.)

**Rotas públicas** (não exigem sessão):
- Telas: `/login`, `/register`, `/esqueci-senha`, `/redefinir-senha`
- APIs: tudo sob `/api/auth/*` (NextAuth), `/api/l/*` (redirecionamento de link de afiliada), `/api/cron/*` (autenticado por `CRON_SECRET`, não por sessão)

**Todo o resto exige sessão.** Uma tela nova nasce protegida automaticamente — não é preciso lembrar de adicioná-la a uma lista.

Uma API sem sessão responde **401 em JSON** (`{ error: '...' }`); uma tela sem sessão redireciona para `/login?callbackUrl=...`.

## 8. Workspace — isolamento de dados

**Decisão tomada nesta rodada:** cada usuária é dona de exatamente **um** workspace, criado junto com a conta (relação 1:1 hoje). Não existe ainda o conceito de várias usuárias compartilhando o mesmo workspace (equipe/organização) — isso é uma evolução futura, não implementada.

- `Workspace.ownerId`: **proveniência apenas** ("quem fundou este workspace"), sem chave estrangeira — existe só para não criar uma referência circular entre `User` e `Workspace` na hora de criar a conta (ver `lib/workspace.ts`).
- `User.workspaceId`: a fronteira de isolamento de verdade, com chave estrangeira obrigatória.
- Toda usuária **deve** ser criada por `criarUsuarioComWorkspace()` (`lib/workspace.ts`) — nunca por `prisma.user.create` direto, ou ela ficaria sem workspace e toda leitura/escrita de dados operacionais quebraria.
- Todo registro operacional (`Produto`, `LinkDinamico`, `Integracao`, `Conteudo`, `AffiliateProgram`, `Sale`, `Commission`, `AuditLog`) tem `workspaceId` obrigatório.
- **O isolamento é reforçado no servidor**, filtrando toda consulta/gravação por `session.user.workspaceId` — nunca confiando em filtro de tela. Testado em `tests/isolamento-workspace.test.mjs` (leitura e escrita cruzada entre duas contas).
- O campo `userId` continua existindo nos modelos operacionais (para saber quem criou o registro / auditoria), mas **não é mais usado para isolar dados** — isso agora é `workspaceId`.

## 9. Programa × Operação × Integração

Distinção de negócio aprovada (`design_handoff` §6) — **não são sinônimos**. Modelada em `AffiliateProgram` (`lib/affiliate-program.ts`):

- **Programa** (`status`): a afiliada está cadastrada nesse programa?
  `NOT_REGISTERED | REQUESTED | WAITING_APPROVAL | ACTIVE | NEEDS_CONFIGURATION`
- **Operação** (`operationMode`): como o Patrono trabalha com esse programa hoje.
  `MANUAL | INTEGRATED` — nesta fase, sempre `MANUAL`.
- **Integração** (`integrationStatus`): existe conexão técnica real?
  `NOT_AVAILABLE | FUTURE | CONFIGURED | CONNECTED | ERROR`

`upsertPrograma()` **recusa** marcar `integrationStatus: 'CONNECTED'` a menos que já exista uma `Integracao` real com `status: 'conectado'` para a mesma plataforma no mesmo workspace — nunca finge uma conexão que não existe (testado em `tests/programa-venda-comissao.test.ts`).

**Pendência:** ainda não existe tela nem rota de API pública para "Meus Programas" — isso é P1, não desta rodada. O modelo e a função já estão prontos para quando essa tela for construída.

## 10. Venda × Comissão

Regra de negócio: **venda ≠ comissão**. Modelados como entidades separadas:

- **`Sale`**: `status` = `PENDING | CONFIRMED | CANCELLED`. Campos: `productId`, `affiliateProgramId`, `linkId`, `contentId` (todos opcionais — nem toda venda vem de um link/conteúdo específico), `date`, `amount`, `source` (`manual` hoje; `webhook` reservado para integrações futuras), `notes`.
- **`Commission`**: `status` = `EXPECTED | CONFIRMED | RECEIVED`. Campos: `expectedAmount`, `confirmedAmount`, `receivedAmount` (três valores independentes, não um só sendo sobrescrito), `expectedAt`/`confirmedAt`/`receivedAt`, `saleId` opcional (uma comissão pode não estar ligada a uma venda registrada individualmente).

**Onde isso já está ligado:** `POST /api/links/[id]/venda` (registrar uma venda manual em um link) agora cria, além do contador que já existia em `LinkDinamico` (mantido por compatibilidade com o Dashboard/Lucro e Escala atual), um registro `Sale` (`CONFIRMED`) e um `Commission` (`EXPECTED`) de verdade.

`lib/vendas-comissoes.ts` fornece `resumoVendas()` e `resumoComissoes()` — leituras agregadas por status, já excluindo da soma qualquer comissão cuja venda foi cancelada. Ainda não estão ligadas a nenhuma tela (a tela "Vendas e Comissões" do design é P1).

Testado em `tests/programa-venda-comissao.test.ts`: registrar venda não cria comissão recebida automaticamente; prevista≠confirmada≠recebida; venda cancelada não entra nos totais.

## 11. Auditoria (`AuditLog`)

`lib/audit-log.ts` — `registrarAuditoria()`. Uma tabela simples no mesmo Postgres, sem serviço externo. Falha ao gravar o log **nunca** derruba a operação que está sendo registrada (só loga o erro no console).

**Eventos registrados hoje:** `produto.criado`, `produto.alterado`, `produto.descartado`, `link.criado`, `venda.registrada`, `conteudo.aprovado` (via PATCH de status), `publicacao.marcada` (via PATCH de status), `integracao.conectada`, `programa.criado`/`programa.alterado` (quando `upsertPrograma` recebe `actorUserId`).

**Nunca gravado:** senha, token, segredo — `metadata` carrega só campos como nomes, IDs, valores monetários. Testado em `tests/audit-log.test.mjs` (confere que a criação/alteração de um produto gera log, e que o `metadata` não contém as palavras senha/password/token/secret).

**Pendência:** eventos de aprovação de conteúdo/marcação de publicação são inferidos de um PATCH genérico que também serve para outras alterações — funciona, mas não é uma rota dedicada por ação.

## 12. Estrutura de dados existente (antes desta rodada)

7 modelos apenas: `User`, `ModuloPermissao`, `LinkDinamico`, `EventoLink`, `Integracao`, `Produto`, `Conteudo`. Nenhum conceito de `workspace`, `affiliate_program`, `sales`/`commissions` separadas, ou `audit_logs` existia — introduzidos nesta rodada.

## 13. Migrations

O projeto não usava `prisma migrate` até esta rodada — o schema ia para produção via `prisma db push` (sem histórico de migração, sem transformação de dados). Isso muda a partir daqui:

- `prisma/migrations/20260101000000_baseline_pre_workspace/` — baseline representando o schema de 7 modelos como ele já existia (gerado por diff, marcado como "já aplicado" via `prisma migrate resolve --applied`, sem executar nada — é só para o histórico de migração começar de um estado real).
- `prisma/migrations/20260913220000_workspace_program_sale_commission_audit/` — a migração desta rodada. Escrita à mão (não pelo autogerador), porque precisa popular dados existentes com segurança:
  1. Cria as tabelas novas (`Workspace`, `AffiliateProgram`, `Sale`, `Commission`, `AuditLog`).
  2. Adiciona as colunas `workspaceId` como **nulas** nas tabelas existentes.
  3. Cria **um workspace por usuária já existente** e preenche `workspaceId` em todas as tabelas a partir do dono.
  4. Só então torna as colunas `workspaceId` obrigatórias.
  5. Índices e chaves estrangeiras por último.

  **Nenhum dado existente é apagado.** Testado localmente contra um banco com dados reais (4 usuárias, 1 produto, 1 link) antes de aplicar — o backfill foi conferido linha a linha.

**Para aplicar em produção:** rodar `npx prisma migrate resolve --applied 20260101000000_baseline_pre_workspace` uma única vez (marca o estado atual como baseline, sem executar SQL), depois `npx prisma migrate deploy` (aplica a migração de verdade). Fazer backup do banco antes, como sempre.

## 14. Testes existentes

Framework: `node --test` (nativo do Node, zero dependência nova) para arquivos `.mjs`; `tsx --test` para os que importam módulos TypeScript diretamente. Todos rodam contra um Postgres de teste **isolado** (nunca produção).

| Arquivo | O que cobre | Testes |
|---|---|---|
| `tests/protecao-rotas.test.mjs` | Toda tela/API protegida exige sessão; públicas continuam abertas; link de afiliada nunca pede login | 35 |
| `tests/estado-zerado.test.mjs` | Conta nova nasce com tudo zerado (produtos, links, conteúdos, integrações, métricas) | 5 |
| `tests/isolamento-workspace.test.mjs` | Duas contas não conseguem ler nem escrever uma na outra (produtos) | 8 |
| `tests/audit-log.test.mjs` | Criar/alterar produto gera log de auditoria correto, sem dado sensível | 2 |
| `tests/programa-venda-comissao.test.ts` | Programa×Operação×Integração; venda≠comissão; venda cancelada não conta | 9 |

**Total: 59 testes, todos passando.** (Eram 40 antes desta rodada.)

Comandos: `npm test` (tudo), ou `npm run test:rotas` / `test:zerado` / `test:isolamento` / `test:audit-log` / `test:programa-venda-comissao` individualmente.

## 15. Regra "zero significa zero"

Uma conta nova começa com 0 produtos, 0 links, 0 cliques, 0 vendas, R$ 0,00 de comissão (prevista/confirmada/recebida) e 0 publicações. `prisma/seed.ts` cria **só** o primeiro administrador — nada de produto/link/venda de exemplo (uma versão anterior criava dois produtos fictícios; removidos na Rodada 1). O seed se recusa a rodar contra um banco que não pareça local, a menos que `PERMITIR_SEED_PRODUCAO=sim` seja passado explicitamente.

## 16. Funcionamento manual é oficial

Cadastro manual de programa/produto/link, publicação manual assistida, registro manual de venda/comissão — são funcionalidades oficiais do MVP, não provisórias. `AffiliateProgram.operationMode` é `MANUAL` por padrão e hoje é a única opção usada; `INTEGRATED` existe no modelo para quando isso mudar, mas nada no código ativa isso ainda.

## 17. Módulos legados preservados

`referencia-prototipo-legado/` (movido para lá na Rodada 1) contém o protótipo React de alta fidelidade original (~360 KB de `.jsx`/`.html`). Confirmado por busca: **zero imports** a partir do app real (`app/`, `components/`, `lib/`, `hooks/`). Preservado como referência histórica de design, não executado.

Dentro do app real, telas avançadas como `/video-seller`, `/monetizacao`, `/whatsapp` já existem mas não fazem parte da jornada mínima do MVP Afiliada — continuam navegáveis, não foram removidas.

## 18. Riscos conhecidos

- **fal.ai é uma dependência paga** (vídeo por IA) — ver `STACK-CUSTO-ZERO.md`. Os motores Veo e Luma nunca foram verificados contra uma geração real (ambiente de desenvolvimento bloqueia acesso à internet externa).
- **`Sale`/`Commission` ainda não têm tela própria.** Só há um ponto de entrada (`POST /api/links/[id]/venda`), que grava nas duas tabelas novas e no contador antigo simultaneamente — funciona, mas é uma duplicação de fonte de verdade até a tela "Vendas e Comissões" migrar de vez para o novo modelo.
- **Homologação visual mobile (375/390/414px) continua pendente.** Não foi objetivo desta rodada.
- **Multi-usuária por workspace não existe.** Se duas pessoas precisarem compartilhar os mesmos dados (hoje cada conta é isolada por padrão), o modelo de `Workspace` já tem a estrutura (`members: User[]`), mas nada no fluxo de registro/convite usa isso ainda.
- **`Integracao.userId` continua sendo gravado** nas criações (para saber quem conectou), mas a leitura/atualização já é 100% por `workspaceId`.

## 19. Pendências (próximos itens do P0/P1)

- Tela e API de "Meus Programas" (usar `upsertPrograma`).
- Tela "Vendas e Comissões" migrando para `Sale`/`Commission` como fonte única (hoje o Dashboard ainda lê o contador de `LinkDinamico`).
- Homologação visual real em Desktop + 375/390/414px (Login, menu mobile, Vendas e Comissões, celebração da primeira comissão, Configurações — nunca inspecionados visualmente).
- Estados de carregamento/erro genéricos em todas as operações de escrita (o design já define o padrão; falta aplicar).
- Decidir e documentar a evolução para workspace com múltiplas usuárias (convite de equipe), se/quando isso for necessário.

## 20. Decisões já tomadas

- **Caminho A (adaptar o app real existente), não B (pivotar/recomeçar).** Confirmado pelo `design_handoff` (§H: "arquitetura evolutiva, sem reescrita destrutiva").
- **1 usuária = 1 workspace** nesta fase (não há workspace compartilhado por equipe ainda).
- **`Workspace.ownerId` sem chave estrangeira** (evita ciclo de criação); `User.workspaceId` é quem de fato isola os dados.
- **Contador de `LinkDinamico` mantido** ao lado de `Sale`/`Commission` — para não alterar o que o Dashboard já mostra até a tela migrar de vez.
- **Prisma Migrate a partir de agora**, não mais `db push`, para qualquer mudança que precise transformar dados existentes.
