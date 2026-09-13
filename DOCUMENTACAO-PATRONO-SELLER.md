# Documentação — Patrono Seller (MVP Afiliada)

**Última atualização:** 14/09/2026 — Rodada 4 do P0 (fechamento da fundação + princípio Automation First).

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
| `LinkDinamico` | link de afiliada por produto/plataforma; cliques ainda são fonte de tracking aqui, mas `conversoes`/`receitaTotal` são `DEPRECATED_LEGACY` (seção 10.1) |
| `EventoLink` | evento individual de clique num link |
| `Conteudo` | roteiro/legendas/vídeo gerado para um produto |
| `Integracao` | credencial de uma integração real (Instagram, Shopee, WhatsApp) por workspace |
| `AffiliateProgram` | Programa × Operação × Integração (seção 9) |
| `Sale` | venda, separada de comissão; `idempotencyKey` desde a Rodada 4 (seção 10.2) |
| `Commission` | comissão, separada de venda (seção 10) |
| `AuditLog` | auditoria de operações de escrita (seção 11) |

Migrations em `prisma/migrations/`, aplicadas com `prisma migrate deploy` (ver seção 13).

Arquitetura de automação (sem tabela própria ainda — só tipos/registros em memória): `lib/affiliate-provider-capabilities.ts`, `lib/channel-registry.ts`, `lib/tiktok-preflight.ts`, `lib/automation.ts`, `lib/affiliate-discovery.ts`, `lib/creative-factory.ts`, `lib/learning-engine.ts` — ver seção 18 (Princípio Automation First).

## 7. Middleware / rotas públicas e protegidas

`middleware.ts` usa política **negar por padrão**: tudo exige sessão exceto a lista explícita abaixo. (Antes da Rodada 1 do P0, era o oposto — uma lista de telas *protegidas*, e sete áreas ficaram de fora dela por esquecimento.)

**Rotas públicas** (não exigem sessão):
- Telas: `/login`, `/register`, `/esqueci-senha`, `/redefinir-senha`
- APIs: tudo sob `/api/auth/*` (NextAuth), `/api/l/*` (redirecionamento de link de afiliada), `/api/cron/*` (sem sessão de usuária, mas **não é pública de fato** — ver abaixo)

**`/api/cron/publicar` — segurança revisada na Rodada 3.** Não ter sessão de usuária não significa aceitar chamadas públicas. Antes, a checagem de `CRON_SECRET` só rodava `if (secret)` — ou seja, se a variável de ambiente não estivesse configurada em produção, a rota ficava **aberta por padrão**. Corrigido: agora a rota **recusa (401)** sempre que `CRON_SECRET` não está configurado, e sempre exige `Authorization: Bearer <CRON_SECRET>` correto (é o header que a própria Vercel Cron envia automaticamente quando a env var existe no projeto). Uma sessão de usuária comum autenticada não substitui o segredo. Testado em `tests/cron-seguranca.test.mjs`.

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

**Implementado na Rodada 3:** tela e API reais de "Meus Programas".
- `app/api/programas/route.ts` — `GET` lista os programas do workspace; `POST` cadastra/edita (usa `upsertPrograma`, sempre com `operationMode: 'MANUAL'` fixo — o campo nem é aceito no corpo da requisição, então a tela não tem como pedir integração real). Conta/link de acesso/observações vão para `notes` (o Design não pede senha da plataforma externa).
- `app/(dashboard)/programas/page.tsx` — lista os programas cadastrados (Programa/Operação/Integração sempre exibidos separadamente) e permite cadastrar um novo a partir do catálogo de providers.
- `lib/affiliate-providers.ts` — **`AffiliateProviderRegistry`**: catálogo de providers conhecidos (marketplaces, redes de afiliação, programas próprios de varejo/moda/beleza — não só as 5 plataformas originalmente citadas). Cada entrada carrega metadado público (categoria, país, URL oficial, tipo de programa, método de geração de link, disponibilidade de API/catálogo/tracking, restrições, canais permitidos, regras de conteúdo, fonte das regras, `lastVerifiedAt`). Adicionar um provider novo é só adicionar uma entrada no array — não exige mudar nenhuma outra parte do sistema. **Nenhum dado da usuária** (status da conta dela) mora aqui — isso é `AffiliateProgram`.
- `lib/affiliate-discovery.ts` — **arquitetura futura, não implementada.** Só os tipos (`AffiliateOpportunity`, `OpportunityScorer`, `AffiliateProgramDiscoveryEngine`) documentando o contrato para quando a descoberta automática de programas/oportunidades for construída de verdade — sem nenhuma lógica, sem chamada de rede. Direção registrada: descobrir programa → avaliar oportunidade → orientar/automatizar adesão → encontrar produtos → criar conteúdo → publicar → medir → vender → aprender. Regras já fixadas para quando isso for implementado: só fontes oficiais/autorizadas; nunca assumir que um programa continua disponível para sempre; nunca contornar aceite pessoal, CPF, dados bancários ou qualquer confirmação que só a usuária pode dar.

Nenhuma integração real foi criada nesta rodada (nenhum token, nenhum OAuth, nenhuma conexão simulada). Testado em `tests/isolamento-programas-vendas.test.mjs`.

## 10. Venda × Comissão

Regra de negócio: **venda ≠ comissão**. Modelados como entidades separadas:

- **`Sale`**: `status` = `PENDING | CONFIRMED | CANCELLED`. Campos: `productId`, `affiliateProgramId`, `linkId`, `contentId` (todos opcionais — nem toda venda vem de um link/conteúdo específico), `date`, `amount`, `source` (`manual` hoje; `webhook` reservado para integrações futuras), `notes`.
- **`Commission`**: `status` = `EXPECTED | CONFIRMED | RECEIVED`. Campos: `expectedAmount`, `confirmedAmount`, `receivedAmount` (três valores independentes, não um só sendo sobrescrito), `expectedAt`/`confirmedAt`/`receivedAt`, `saleId` opcional (uma comissão pode não estar ligada a uma venda registrada individualmente).

**`Sale`/`Commission` são a fonte única a partir da Rodada 3.** Nenhum indicador novo (Dashboard, "Resultados", "Vendas e Comissões", primeira comissão) soma o contador legado (`LinkDinamico.conversoes`/`receitaTotal`) — só `Sale`/`Commission`. Ver seção 10.1 (Fonte única e o contador legado) para o detalhe completo dessa decisão.

**Implementado na Rodada 3:**
- `POST /api/links/[id]/venda` (registrar venda a partir de um link) — agora transacional: `Sale`, `Commission` e o `AuditLog` são criados numa única transação (`prisma.$transaction`) — nunca existe `Commission` órfã de uma `Sale` que falhou. Tem proteção contra duplo clique: se uma `Sale` idêntica (mesmo link e valor) foi criada nos últimos 5 segundos, devolve ela em vez de criar outra.
- `POST /api/vendas` — "Registrar resultado" geral (produto + programa/link/conteúdo opcionais + data + valor + status + observações), usado pela tela "Vendas e Comissões". Mesma proteção contra duplo clique e mesma transação (`lib/vendas-comissoes.ts` → `registrarResultado()`).
- `PATCH /api/vendas` e `PATCH /api/comissoes` — alteram status de venda (`atualizarStatusVenda`) e de comissão (`atualizarComissao`), cada alteração gerando log de auditoria (`venda.alterada`/`venda.cancelada`, `comissao.confirmada`/`comissao.recebida`/`comissao.alterada`).
- `lib/vendas-comissoes.ts` — `resumoVendas()`, `resumoComissoes()` (já existiam), mais `lucroEscalaPorProduto()` (ranking por produto: cliques vêm de `LinkDinamico`/tracking, vendas e receita vêm de `Sale` `CONFIRMED` + `Commission` `CONFIRMED`/`RECEIVED` associada — nunca de venda `CANCELLED`) e `primeiraComissao()` (ver seção 15.1).

Testado em `tests/programa-venda-comissao.test.ts` e `tests/fonte-unica-vendas.test.ts`: registrar venda não cria comissão recebida automaticamente; prevista≠confirmada≠recebida; venda cancelada não entra nos totais; contador legado nunca se soma ao total estruturado; duplo clique não duplica a venda; transação Sale+Commission é atômica.

### 10.1 Fonte única e o contador legado — finalizado na Rodada 4

`LinkDinamico.conversoes`/`receitaTotal` estão marcados **`DEPRECATED_LEGACY`** no schema (comentário no `prisma/schema.prisma`) desde a Rodada 4. O que mudou:

- **Nenhuma operação nova incrementa mais essas colunas.** `POST /api/links/[id]/venda` foi reescrito para chamar `registrarResultado()` (a mesma função de `POST /api/vendas`) — só grava em `Sale`/`Commission`.
- **As telas "Meus Links" (`/links`) e "Monetização" (`/monetizacao`) foram migradas.** `GET /api/links` agora sobrepõe os campos `conversoes`/`receitaTotal` da resposta com valores calculados a partir de `Sale` (`lib/vendas-comissoes.ts` → `resumoPorLink()`) — a tela não mudou visualmente (mesmos campos, mesmo layout), só a fonte dos números mudou por baixo.
- **A coluna não foi removida** — continua no schema, sem uso operacional, só para não quebrar quem eventualmente ainda dependa dela por fora do código (ex.: uma consulta manual ao banco). Não há indício de leitura remanescente no código.

Nenhum dado legado com valor > 0 foi encontrado ou transformado nesta rodada (o ambiente de desenvolvimento não tem acesso ao banco de produção). Se isso for encontrado depois, a regra permanece: **nunca** transformar automaticamente um número agregado em registros `Sale` individuais com datas/produtos/comissões inventadas — isso criaria dado falso. Um contador legado > 0 sem lastro estruturado deve ficar documentado como **DADO LEGADO AGREGADO**, nunca misturado com vendas estruturadas.

### 10.2 Idempotência persistente (Rodada 4)

A janela de 5 segundos da Rodada 3 (best-effort, por tempo) não é garantia financeira suficiente — retry de rede após 5s ou duas chamadas verdadeiramente concorrentes ainda poderiam duplicar. Substituída/complementada por idempotência persistente:

- `Sale.idempotencyKey` (nova coluna, `String?`, `@@unique([workspaceId, idempotencyKey])`) — a tela gera essa chave **uma vez por tentativa de envio** (`crypto.randomUUID()`) e reenvia a **mesma chave** em cada retry (clique repetido, timeout, refresh) até o servidor confirmar. Só troca de chave depois de um sucesso ou de a usuária cancelar o formulário (`app/(dashboard)/vendas-comissoes/page.tsx`, `app/(dashboard)/links/page.tsx`).
- `registrarResultado()` (`lib/vendas-comissoes.ts`) localiza a `Sale` já criada com a mesma chave em vez de criar outra. Sob concorrência real (duas chamadas simultâneas com a mesma chave), a constraint única do banco rejeita a segunda escrita — capturada (`Prisma.PrismaClientKnownRequestError`, código `P2002`) e tratada buscando a `Sale` que a primeira criou, nunca propagando erro para a usuária.
- Chamadas sem `idempotencyKey` continuam cobertas pela janela de 5s da Rodada 3, como camada extra — não como garantia principal.

Testado em `tests/idempotencia-vendas.test.ts`: mesma chave com corpos diferentes devolve a `Sale` original; chaves diferentes criam vendas diferentes; **concorrência real** (`Promise.all`, sem `await` entre as chamadas) cria só uma `Sale`; chamadas sem chave continuam funcionando pelo fallback.

## 11. Auditoria (`AuditLog`)

`lib/audit-log.ts` — `registrarAuditoria()`. Uma tabela simples no mesmo Postgres, sem serviço externo. Falha ao gravar o log **nunca** derruba a operação que está sendo registrada (só loga o erro no console).

**Eventos registrados hoje:** `produto.criado`, `produto.alterado`, `produto.descartado`, `link.criado`, `venda.criada`, `venda.alterada`, `venda.cancelada`, `comissao.confirmada`, `comissao.recebida`, `comissao.alterada`, `conteudo.aprovado` (via PATCH de status), `publicacao.marcada` (via PATCH de status), `integracao.conectada`, `programa.criado`/`programa.alterado` (quando `upsertPrograma` recebe `actorUserId`).

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

**Para aplicar em produção:** rodar `npx prisma migrate resolve --applied 20260101000000_baseline_pre_workspace` uma única vez (marca o estado atual como baseline, sem executar SQL), depois `npx prisma migrate deploy` (aplica todas as migrações pendentes, incluindo a da Rodada 4 abaixo). Fazer backup do banco antes, como sempre.

- `prisma/migrations/20260914000000_sale_idempotency_key/` (Rodada 4) — adiciona `Sale.idempotencyKey` (nula) + índice único `(workspaceId, idempotencyKey)`. Aditiva e segura: coluna nova nula não afeta linhas existentes (Postgres trata múltiplos `NULL` como distintos entre si num índice único, então não há conflito com dados antigos). **Não aplicada em produção nesta rodada** — só testada localmente contra o banco de teste com dados reais (77 usuárias, 73 vendas já existentes no momento do teste).

## 14. Testes existentes

Framework: `node --test` (nativo do Node, zero dependência nova) para arquivos `.mjs`; `tsx --test` para os que importam módulos TypeScript diretamente. Todos rodam contra um Postgres de teste **isolado** (nunca produção).

| Arquivo | O que cobre | Testes |
|---|---|---|
| `tests/protecao-rotas.test.mjs` | Toda tela/API protegida exige sessão; públicas continuam abertas; link de afiliada nunca pede login | 35 |
| `tests/estado-zerado.test.mjs` | Conta nova nasce com tudo zerado (produtos, links, conteúdos, integrações, programas, vendas, comissões, métricas, primeira comissão) | 7 |
| `tests/isolamento-workspace.test.mjs` | Duas contas não conseguem ler nem escrever uma na outra (produtos) | 8 |
| `tests/audit-log.test.mjs` | Criar/alterar produto gera log de auditoria correto, sem dado sensível | 2 |
| `tests/programa-venda-comissao.test.ts` | Programa×Operação×Integração; venda≠comissão; venda cancelada não conta | 9 |
| `tests/cron-seguranca.test.mjs` | `/api/cron/publicar` recusa sem segredo, com segredo errado, e com sessão comum; executa só com o segredo certo; nunca ecoa o segredo | 6 |
| `tests/fonte-unica-vendas.test.ts` | `Sale`/`Commission` como fonte única; contador legado nunca se soma; duplo clique não duplica; transação Sale+Commission | 8 |
| `tests/isolamento-programas-vendas.test.mjs` | Isolamento de workspace estendido a Programas, Vendas e Comissões (leitura e escrita cruzada) | 6 |
| `tests/primeira-comissao.test.mjs` | Progresso da primeira comissão com dados reais; workspace vazio não concluído; reload não depende de localStorage | 3 |
| `tests/idempotencia-vendas.test.ts` | Idempotência persistente: mesma chave nunca duplica (mesmo com corpos diferentes); concorrência real (`Promise.all`) cria só uma `Sale`; fallback por janela de tempo continua funcionando | 4 |
| `tests/capabilities-e-automacao.test.ts` | Todo provider tem capability; nenhum permite scraping; toda capability tem fonte/data/confiança; provider desconhecido nunca é tratado como disponível; canais (TikTok exige consentimento e não hardcoda duração; Instagram já publica de verdade); constantes de automação (pipeline, modos, motivos de ação humana); Learning Engine com dados reais (workspace vazio vazio; venda ligada a conteúdo aparece no resumo) | 15 |

**Total: 103 testes, todos passando.** (Eram 84 no início desta rodada.)

Comandos: `npm test` (tudo), ou os `npm run test:<nome>` individuais listados em `package.json`. O teste de cron precisa da mesma `CRON_SECRET` no ambiente do servidor e do teste (ex.: `CRON_SECRET=algum-valor npm run test:cron`, com o servidor também subido com essa variável).

## 15. Regra "zero significa zero"

Uma conta nova começa com 0 produtos, 0 links, 0 cliques, 0 vendas, R$ 0,00 de comissão (prevista/confirmada/recebida), 0 publicações, 0 programas cadastrados e nenhuma etapa de "primeira comissão" concluída. `prisma/seed.ts` cria **só** o primeiro administrador — nada de produto/link/venda de exemplo (uma versão anterior criava dois produtos fictícios; removidos na Rodada 1). O seed (e agora também os scripts de fixture em `scripts/`, unificados em `lib/seed-guard.ts` nesta rodada) se recusam a rodar contra um banco que não pareça local, a menos que `PERMITIR_SEED_PRODUCAO=sim` seja passado explicitamente.

### 15.1 Primeira comissão (card real, sem hardcode)

`lib/vendas-comissoes.ts` → `primeiraComissao(workspaceId)`. O `design_handoff` nomeia a etapa final do fluxo ("...Registrar venda/comissão → **Primeira comissão**") mas não dá uma regra numérica exata além disso. Decisão registrada (não é um número inventado, é a leitura mais conservadora do texto disponível — revisável se o Design especificar outra regra): a etapa se completa quando existe **ao menos uma `Commission` `CONFIRMED` ou `RECEIVED`** — uma comissão apenas `EXPECTED` ainda é previsão, não é "a comissão" que a etapa nomeia.

O card `PrimeiraComissaoCard` (`components/dashboard/PrimeiraComissao.tsx`, no Dashboard) mostra valor/produto/plataforma/data reais da comissão encontrada — nunca hardcoded, nunca inventado quando não existe. Testado em `tests/primeira-comissao.test.mjs`.

## 16. Funcionamento manual é oficial

Cadastro manual de programa/produto/link, publicação manual assistida, registro manual de venda/comissão — são funcionalidades oficiais do MVP, não provisórias. `AffiliateProgram.operationMode` é `MANUAL` por padrão e hoje é a única opção usada; `INTEGRATED` existe no modelo para quando isso mudar, mas nada no código ativa isso ainda.

## 17. Módulos legados preservados

`referencia-prototipo-legado/` (movido para lá na Rodada 1) contém o protótipo React de alta fidelidade original (~360 KB de `.jsx`/`.html`). Confirmado por busca: **zero imports** a partir do app real (`app/`, `components/`, `lib/`, `hooks/`). Preservado como referência histórica de design, não executado.

Dentro do app real, telas avançadas como `/video-seller`, `/monetizacao`, `/whatsapp` já existem mas não fazem parte da jornada mínima do MVP Afiliada — continuam navegáveis, não foram removidas.

## 18. Princípio Automation First (Rodada 4)

O objetivo do produto é a usuária **não precisar operar a plataforma no dia a dia** — a experiência principal deve, no futuro, ser automática. O modo manual **permanece como fallback permanente**, nunca removido: ele é o que já funciona hoje e o que continua funcionando quando uma automação ainda não existe, falha, ou a própria plataforma externa exige uma pessoa.

Nesta rodada, nada disso passou a rodar sozinho — é a fundação: tipos, interfaces, registros de capability e uma métrica determinística real, para que a automação de verdade (rodadas futuras) tenha uma arquitetura já pensada em vez de decidir tudo às pressas.

### 18.1 Provider Capability Registry (`lib/affiliate-provider-capabilities.ts`)

Estende o `AffiliateProviderRegistry` (Rodada 3) com o que cada provider **realmente permite automatizar hoje** — separado do catálogo básico porque muda com frequência e precisa de reverificação. Campos: `affiliateProgramAvailable`, `productCatalogAccess`, `bestSellerData`, `trendData`, `commissionData`, `affiliateLinkGeneration`, `salesImport`, `commissionImport`, `webhook`, `officialApi`, `authorizedImport`, `automatedDiscovery`, `automatedPublishing`, `requiresUserConsent`, `scrapingAllowed` (**sempre `false`**, tipado como literal `false` — nunca uma automação lê "true" daqui), `commercialContentRules`, `lastVerifiedAt`, `sourceType`, `status`, `confidence`.

`status` usa a nomenclatura pedida: `SUPPORTED_MANUAL | OFFICIAL_API_AVAILABLE | AUTHORIZATION_REQUIRED | PARTNER_ACCESS_REQUIRED | NOT_VERIFIED | NOT_AVAILABLE | BLOCKED_BY_POLICY`. Cadastrado para os 19 providers do catálogo (Amazon Associados, Mercado Livre, Shopee, TikTok Shop, Hotmart, Renner, Riachuelo, Netshoes, Sephora/Rakuten, Rakuten Advertising, Awin, Impact, CJ Affiliate, Lomadee, Monetizze, Eduzz, Kiwify, Magalu Parceiro, Outro). **Nenhum campo foi confirmado contra uma chamada de API ao vivo** (ambiente sem acesso à internet externa) — por isso nenhuma entrada tem `sourceType: OFFICIAL_API`, e a maioria tem `confidence: LOW` ou `MEDIUM`. Detalhe por provider em `REGRAS-PROVIDERS-E-CANAIS.md`.

`capacidadeOuDesconhecida()` garante que um provider sem capability cadastrada nunca é tratado como disponível — tudo `false`/`NOT_VERIFIED` por padrão.

`GET /api/programas/providers` expõe o catálogo já com a capability embutida; a tela "Meus Programas" só **traduz** o `status` num rótulo (`CAPABILITY_LABEL`), nunca decide sozinha se um provider "tem API".

### 18.2 Channel Registry (`lib/channel-registry.ts`)

Conceito separado de provider de afiliados: canal é **para onde publico**, não **onde encontro o produto**. Cobre Instagram, TikTok, YouTube, Facebook, Pinterest, com `ChannelCapability` (post de imagem/carrossel/vídeo curto/Reel/Story, publicação automática, upload como rascunho, analytics, exigência de consentimento explícito, disclosure comercial, tamanho/proporção/codec/duração de mídia, política de marca d'água). Instagram é o único com `autoPublish: true` — é o único canal com integração real já implementada (`lib/instagram.ts`, rodadas anteriores). TikTok tem `durationRulesSeconds: null` **de propósito**: a duração permitida varia por conta e deve vir da própria API quando implementada, nunca de um número fixo no código.

### 18.3 TikTok Preflight (`lib/tiktok-preflight.ts`)

`TikTokPreflightValidator` — interface real (`TikTokPreflightNotConfigured` como implementação atual, sempre devolvendo `NOT_VERIFIED` porque nenhuma credencial está configurada). Existe para nunca inventar limite de duração/formato: quando implementado de verdade, consulta a própria API (creator info) antes de publicar.

### 18.4 Pipeline de validação e o termo `PREVALIDATED` (`lib/automation.ts`)

`STATUS_PIPELINE`: `DRAFT → GENERATED → TECHNICALLY_VALID → COMMERCIAL_RULES_VALID → CHANNEL_VALID → READY_TO_PUBLISH → REQUIRES_USER_CONSENT / BLOCKED_BY_POLICY → PUBLISHING → PUBLISHED → FAILED`. Regra fixada: nunca dizer "validado pelo TikTok" (ou qualquer canal) antes de uma resposta real da API oficial — a nossa própria pré-validação interna se chama `PREVALIDATED`, termo diferente de propósito.

### 18.5 Modo de automação e fila de exceção

`AutomationMode`: `MANUAL | ASSISTED | AUTOMATIC`. O objetivo é `AUTOMATIC`; uma tarefa pode cair para `ASSISTED` quando a própria plataforma exige consentimento (nunca cai para `MANUAL` silenciosamente — sempre registra o motivo).

`HumanActionRequired`: fila só para o que realmente precisa de uma pessoa — `TIKTOK_CONSENT`, `TOKEN_EXPIRED`, `EXTERNAL_APPROVAL`, `PROGRAM_REGISTRATION`, `IDENTITY_VERIFICATION`, `ACCOUNT_SUSPENDED`, `AMBIGUOUS_RULE`, `MISSING_AUTHORIZED_MEDIA`. A Home futura deve mostrar "Preciso de você em 1 item" — nunca transformar a usuária em operadora do dia a dia.

`AutomationJob`/`AutomationOrchestrator`: tipos para o ciclo completo (descobrir → pontuar → selecionar → gerar → validar → publicar → coletar métricas → aprender → repetir). Nesta rodada, **nenhum ciclo roda de verdade** — só a interface, reaproveitando a stack existente (Postgres + Vercel Cron) quando isso for implementado, sem contratar scheduler externo.

### 18.6 Opportunity Radar (`lib/affiliate-discovery.ts`, ampliado)

`OpportunitySource.getCandidates()`, `OpportunityScorer.score()/rank()`, `AffiliateOpportunity` com origem tipada — `OrigemOportunidade`: `OFFICIAL_API | AUTHORIZED_PARTNER_API | AFFILIATE_PORTAL_IMPORT | USER_PROVIDED | MANUAL`. **`SCRAPED_UNOFFICIAL` não existe de propósito** — nunca é uma fonte aceita. Campos desconhecidos ficam `null`/`undefined`, nunca um número inventado.

### 18.7 Creative Factory (`lib/creative-factory.ts`)

`ImageGeneratorProvider`, `VideoGeneratorProvider`, `TextGeneratorProvider`, `VoiceGeneratorProvider`, `RendererProvider` — interfaces desacopladas; nenhuma contrata gerador pago, nenhuma faz Anthropic/fal.ai dependência obrigatória (ambos continuam existindo como recursos **opcionais** já usados no projeto). `MediaAsset` registra proveniência/autorização de cada mídia (`PRIORIDADE_FONTE_MIDIA`: oficial autorizada → API oficial → mídia do programa de afiliados → enviada pela usuária → gerada legitimamente). `textoDisclosure()` gera o texto de "conteúdo de afiliado" configurável por tipo. **Nenhuma prova de conceito de renderização foi implementada nesta rodada** — decisão deliberada para não aumentar o escopo sem necessidade (o próprio pedido permitia isso).

### 18.8 Learning Engine (`lib/learning-engine.ts`) — com dados reais

Diferente dos itens acima, este **já calcula de verdade**, com os dados que já existem: `resumoPorConteudo()` e `resumoPorCanal()` usam `Sale.contentId` (já existente desde a Rodada 3) para somar cliques (`Conteudo.cliquesLink`), vendas confirmadas e comissão reconhecida por conteúdo e por canal (`Conteudo.redeSocial`). **Não é machine learning** — são métricas determinísticas simples, documentadas assim de propósito. Resultado por formato/hook/CTA fica pendente: o `Conteudo` ainda não guarda esses campos de forma estruturada.

### 18.9 Não implementado nesta rodada (por decisão explícita do pedido)

Nenhuma integração real (Amazon PA-API, Mercado Livre, Shopee, TikTok, Instagram além do que já existia, redes de afiliação); nenhum ciclo de automação rodando; nenhuma renderização de vídeo/imagem programática; nenhum cadastro automático em programa de afiliados. Tudo isso é arquitetura pronta para ser preenchida, não simulação de que já funciona.

## 19. Riscos conhecidos

- **Auditoria de segredos hardcoded (Rodada 3):** revisado o projeto por padrões de chave/token/senha embutidos no código. Não foi encontrada nenhuma credencial de serviço real hardcoded. Encontrados: três scripts de fixture em `scripts/` (`seed-teste-*.ts`) que criavam usuária/produto de teste sem a mesma trava de produção do `prisma/seed.ts` — corrigido, agora todos usam `lib/seed-guard.ts` (`verificarAmbienteDeSeed`) e se recusam a rodar contra um banco que não pareça local.
- **fal.ai é uma dependência paga** (vídeo por IA) — ver `STACK-CUSTO-ZERO.md`. Os motores Veo e Luma nunca foram verificados contra uma geração real (ambiente de desenvolvimento bloqueia acesso à internet externa).
- **O contador legado de `LinkDinamico` continua no schema**, marcado `DEPRECATED_LEGACY`, sem uso operacional (ver seção 10.1). Não removido por segurança, não por necessidade real identificada.
- **Multi-usuária por workspace não existe.** Se duas pessoas precisarem compartilhar os mesmos dados (hoje cada conta é isolada por padrão), o modelo de `Workspace` já tem a estrutura (`members: User[]`), mas nada no fluxo de registro/convite usa isso ainda.
- **`Integracao.userId` continua sendo gravado** nas criações (para saber quem conectou), mas a leitura/atualização já é 100% por `workspaceId`.
- **A regra de "primeira comissão" (CONFIRMED ou RECEIVED) é uma interpretação, não um número confirmado pelo Design.** Ver seção 15.1 — revisável.
- **Nenhuma capability de provider/canal foi verificada contra uma chamada de API ao vivo.** Ver `REGRAS-PROVIDERS-E-CANAIS.md` — todo `sourceType`/`confidence` reflete isso; reconferir antes de qualquer automação real.

## 20. Pendências (próximos itens do P0/P1)

- Registrar credenciais e implementar de fato ao menos um provider com API oficial documentada (Hotmart e Amazon Associados são os candidatos mais claros) e um canal (TikTok Content Posting API).
- Implementar o `AutomationOrchestrator`/`AutomationJob` de verdade (hoje só a interface) reaproveitando Postgres + Vercel Cron.
- Prova de conceito de `RendererProvider` gratuito (FFmpeg/templates) — deliberadamente não feita nesta rodada.
- Resultado por formato/hook/CTA no Learning Engine — precisa de campos estruturados novos em `Conteudo` (Design ainda não pediu isso).
- Evoluir o cadastro de "Meus Programas" com o restante dos campos do Design que não foram confirmados linha a linha.
- Decidir e documentar a evolução para workspace com múltiplas usuárias (convite de equipe), se/quando isso for necessário.
- Aplicar em produção a migração `20260914000000_sale_idempotency_key` (não aplicada nesta rodada — só testada localmente).

## 21. Decisões já tomadas

- **Caminho A (adaptar o app real existente), não B (pivotar/recomeçar).** Confirmado pelo `design_handoff` (§H: "arquitetura evolutiva, sem reescrita destrutiva").
- **`/api/cron/publicar` recusa por padrão sem `CRON_SECRET`** (Rodada 3).
- **`Sale`/`Commission` são a fonte única de vendas/comissões**; o contador legado de `LinkDinamico` foi finalizado — nenhuma operação nova o incrementa, `/links` e `/monetizacao` migraram para ler dele via `Sale` (Rodada 4).
- **Idempotência de vendas é persistente (`Sale.idempotencyKey`), não só por janela de tempo** (Rodada 4).
- **"Primeira comissão" = primeira `Commission` `CONFIRMED` ou `RECEIVED`** — decisão registrada, revisável (Rodada 3, seção 15.1).
- **Catálogo de providers de afiliação não se limita a 5 marketplaces**, e agora tem capability própria por provider — `scrapingAllowed` é sempre `false` (Rodada 3/4).
- **Scraping nunca é uma automação aceita**, em nenhum provider, nenhuma exceção (Rodada 4).
- **Automação nunca contorna consentimento pessoal, CPF, dados bancários ou aprovação externa** — vira item de `HumanActionRequired` (Rodada 4).
- **1 usuária = 1 workspace** nesta fase (não há workspace compartilhado por equipe ainda).
- **`Workspace.ownerId` sem chave estrangeira** (evita ciclo de criação); `User.workspaceId` é quem de fato isola os dados.
- **Prisma Migrate a partir de agora**, não mais `db push`, para qualquer mudança que precise transformar dados existentes.
