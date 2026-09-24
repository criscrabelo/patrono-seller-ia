# P1.7.3 — Etapa 3A: migration nº 2 aplicada em produção

**Aplicada. 237 ms. Um workspace criado, 172 linhas preenchidas, zero
`workspaceId` nulo, zero divergente, e as somas de verificação do dado
saíram idênticas às de antes.**

Esta foi a primeira migration a escrever em dado real. As 11 restantes
continuam pendentes.

Data: 24/09/2026 · Commit `67e1b8d` · Branch `claude/pronto-para-trabalhar-jiij19`

---

## 1. Pré-condições — todas reconfirmadas

| Condição | Resultado |
|---|---|
| Backup íntegro | **sim** — `patrono-prod-20260924T162302Z-public.dump`, 60.711 bytes, sha256 `c4d9287814…5432d62b` **bate**; TOC legível com 16 tabelas |
| `_prisma_migrations` | 1 registro: baseline, `steps=0`, `rolled_back=NULL` |
| Migrations pendentes | **12** |
| Tabelas em produção | 18 |
| `Workspace` / `AutomationJob` | não existiam |
| Colunas `workspaceId` | 0 |
| Contagens | `User=1 Produto=25 Conteudo=17 LinkDinamico=126 Integracao=3 EventoLink=0` |
| Repositório | limpo, 13 migrations, `prisma/` sem alteração |
| `ADAPTADORES_LIGADOS` / `RENOVADORES_LIGADOS` | `{}` / `{}` |
| `PUBLICACAO_REAL_*` | não existe |
| `CRON_SECRET` em produção | **ausente** |
| Aplicação em produção | ainda a de **60 dias atrás** |

Nenhum ponto divergiu.

## 2. Como apliquei só uma migration

`prisma migrate deploy` aplica **todas** as pendentes — não existe flag para
uma só. Em vez de mexer no repositório movendo pastas, montei um diretório
temporário fora dele contendo apenas `schema.prisma`, o baseline e a
migration nº 2, e apontei o Prisma para lá:

```bash
npx prisma migrate deploy --schema "<temp>/prisma-3a/schema.prisma"
```

O `sha256` do `migration.sql` copiado foi conferido contra o do repositório
antes de executar — **idênticos**
(`c553f7db745145c7…817eba2c`). O repositório ficou limpo o tempo todo, e o
diretório temporário foi apagado ao final.

Assim o Prisma fez o trabalho nativamente: sua própria transação, sua
própria contabilidade. `applied_steps_count = 1`, como numa aplicação
normal — diferente do baseline, que ficou em `0` por ter sido só registrado.

## 3. Execução

```
2 migrations found
Applying migration `20260913220000_workspace_program_sale_commission_audit`
All migrations have been successfully applied.
```

| | |
|---|---|
| **Aplicada** | **sim**, exit 0 |
| **Duração medida no banco** | **237 ms** |
| Tempo de parede do comando | 4.088 ms (inclui carregar o CLI e conectar) |
| `applied_steps_count` | **1** |
| `rolled_back_at` | `NULL` |

No ensaio da P1.7.2 a mesma migration levou 59 ms num Postgres local. Os
237 ms em produção são a diferença esperada de rede — o pooler fica em
`sa-east-1`.

## 4. Validação

### O workspace criado

| | |
|---|---|
| Workspaces | **1** |
| `id` | `ws_05a6d536ef185f39b738` |
| `ownerId` | `cmoyrhzq30000bj6j6fp3792t` — a usuária existente |
| `name` | `Cristiane Rabelo — Workspace` |

Um workspace, para a única usuária, com o nome derivado dela. Exatamente o
que a migration declara.

### Linhas tocadas: 172

| Tabela | Linhas | `workspaceId` nulo | Apontando para workspace errado |
|---|---|---|---|
| `User` | 1 | **0** | — |
| `Produto` | 25 | **0** | **0** |
| `Conteudo` | 17 | **0** | **0** |
| `LinkDinamico` | 126 | **0** | **0** |
| `Integracao` | 3 | **0** | **0** |
| **Total** | **172** | **0** | **0** |

"Apontando para workspace errado" compara, linha a linha, o `workspaceId`
gravado com o workspace cujo `ownerId` é o `userId` da própria linha. Zero
divergências.

`workspaceId` é `NOT NULL` em todas as nove tabelas que a têm:
`AffiliateProgram`, `AuditLog`, `Commission`, `Conteudo`, `Integracao`,
`LinkDinamico`, `Produto`, `Sale`, `User`.

### Nenhum dado perdido, nenhum valor alterado

Somas de verificação calculadas antes e depois, com a mesma consulta:

| Tabela | Linhas | Soma antes | Soma depois |
|---|---|---|---|
| `User` | 1 | `92abb4f3…4ae4ef2` | **idêntica** |
| `Produto` | 25 | `b0652129…7de338` | **idêntica** |
| `Conteudo` | 17 | `9245f25d…952f0d` | **idêntica** |
| `LinkDinamico` | 126 | `6bd8e57f…3a09cfd` | **idêntica** |
| `Integracao` | 3 | `0020de26…437a56` | **idêntica** |
| `EventoLink` | 0 | (vazia) | (vazia) |

`diff` das duas saídas: **idênticas**. Contagem igual prova que nenhuma
linha sumiu; hash igual prova que nenhum valor mudou.

### A semântica de `Integracao`

**Antes:** `Integracao_userId_plataforma_key` sobre `(userId, plataforma)`
**Depois:** `Integracao_workspaceId_plataforma_key` sobre `(workspaceId, plataforma)`

E ele **recusa de verdade**, não só está declarado. Testei inserindo uma
duplicata do par `(workspaceId, plataforma)` de uma linha existente:

```
ERROR: duplicate key value violates unique constraint
       "Integracao_workspaceId_plataforma_key"
```

O teste rodou dentro de `BEGIN … ROLLBACK`: `Integracao` continua com 3
linhas e a linha de teste não existe. **Nenhuma fixture ficou em produção.**

### Isolamento entre workspaces

Só existe um workspace em produção, então o isolamento não pode ser
exercitado aqui sem **criar** um segundo — o que seria inventar dado. A
estrutura que o garante está no lugar: `workspaceId` obrigatório e com
chave estrangeira em nove tabelas, índices por `workspaceId` em `Produto`,
`Conteudo` e `LinkDinamico`, e o único de `Integracao` agora por workspace.

O comportamento foi provado com escritas reais no ensaio da P1.7.2: um
segundo workspace aceitou `instagram` convivendo com o do primeiro, e
recusou `instagram` duas vezes no mesmo workspace.

### Diferenças estruturais antes/depois

20 diferenças, **todas declaradas pela migration nº 2**:

- **5 tabelas novas:** `Workspace`, `AffiliateProgram`, `Sale`,
  `Commission`, `AuditLog`
- **+1 coluna** (`workspaceId`) em `User`, `Produto`, `Conteudo`,
  `LinkDinamico`, `Integracao`
- **índices novos:** `Produto_workspaceId_idx`, `Conteudo_workspaceId_idx`,
  `LinkDinamico_workspaceId_idx`, `Integracao_userId_idx`
- **FKs novas:** `*_workspaceId_fkey` nas cinco tabelas
- **índice trocado** em `Integracao`
- `_prisma_migrations`: 1 → 2 registros

**Zero mudança de linhas em qualquer tabela de negócio.**

## 5. Uma correção ao enunciado da rodada

Você listou, como parte da migration nº 2, `automationPaused = true` e
`automationMode = MANUAL`. **Essas duas colunas não são dela** — vêm da
migration nº 4, `workspace_automation_controls`.

Depois da nº 2, `Workspace` tem exatamente cinco colunas: `id`, `name`,
`ownerId`, `createdAt`, `updatedAt`.

**Isso não abre risco nenhum agora**, e por três motivos somados: não há
`CRON_SECRET`, então nenhum cron autentica; não há `AutomationJob`, então
não há fila; e a aplicação no ar não conhece `Workspace`. Não existe
caminho por onde automação possa começar. O kill switch chega na nº 4,
antes de qualquer coisa que pudesse usá-lo.

Registro porque a diferença entre "o que eu esperava" e "o que a migration
faz" é o tipo de coisa que, silenciada, vira surpresa três etapas adiante.

## 6. Compatibilidade com a aplicação antiga — medida, não estimada

A implantação no ar é de **26/07/2026**. Conferi no repositório: o
`schema.prisma` daquele commit **não tem `model Workspace`** — o cliente
Prisma em produção não conhece `workspaceId`.

### O que continua funcionando

| Caminho | Situação |
|---|---|
| **Leituras** | **funcionam.** O cliente antigo lista explicitamente as colunas que conhece, e todas continuam existindo. Testei com as listas de colunas antigas de `LinkDinamico` e `Produto`: ambas retornam normalmente |
| **`/api/l/:slug` — o redirecionamento de link rastreado** | **funciona inteiro** |
| — incremento de `cliques` | `UPDATE` não toca `workspaceId`: funciona |
| — `EventoLink.create` do clique | **funciona** — `EventoLink` ainda **não** ganhou `workspaceId` (vem em migration posterior). Testei a inserção: sucesso |
| `Integracao.upsert` de plataforma **já existente** | funciona — cai no ramo `update` |

**O caminho de receita está intacto.** É o que mais importava.

### O que passaria a falhar

Inserções que não informam `workspaceId`, todas em rotas autenticadas:

| Rota (código de 26/07) | Efeito |
|---|---|
| `app/api/produtos/route.ts:56` — `produto.create` | **falha** — testado: `null value in column "workspaceId" violates not-null constraint` |
| `app/api/conteudos/gerar/route.ts:87,93` — `conteudo.create` | **falha** — testado, mesmo erro |
| `app/api/links/route.ts:59` — `linkDinamico.create` | falha (mesma causa) |
| `app/api/integracoes/shopee/sincronizar/route.ts:73` — `linkDinamico.create` | falha |
| `app/api/auth/register/route.ts:28` — `user.create` | falha — **cadastro de nova usuária** |
| `app/api/integracoes/route.ts:63` e `shopee/route.ts:72` — `integracao.upsert` | falha **só** ao conectar uma plataforma nova |

Os dois testes de escrita rodaram em `BEGIN … ROLLBACK`. Estado final
conferido: `EventoLink=0 Produto=25 Conteudo=17` — **nada ficou**.

### O tamanho real da janela

Fui atrás de quanto isso pesa, em vez de supor:

| Sinal | Valor |
|---|---|
| Cliques em links rastreados | **0**, em 126 links |
| `EventoLink` registrados | **0** |
| Linha mais recente em `LinkDinamico` | 10/05/2026 — 4 meses e meio |
| Linha mais recente em `Produto` | 26/05/2026 — 4 meses |
| Linha mais recente em `Conteudo` | 26/07/2026 — 60 dias, a data do último deploy |
| Atualização mais recente em `Integracao` | **09/09/2026** — 15 dias |

**A aplicação está dormente para escrita.** Nada foi criado em meses. O
único toque recente foi uma atualização de integração, e `update` continua
funcionando — só conectar uma plataforma **nova** falharia.

**Conclusão: o risco da janela é baixo e nenhuma escrita crítica quebra.**
O que quebra são ações administrativas que ninguém está executando, e que
voltam a funcionar com o deploy do código novo. Se você for criar produto,
gerar conteúdo ou conectar uma plataforma nova antes do deploy, vai tomar
erro — e é só isso.

### Testes

Nenhuma suíte foi apontada para produção. As verificações foram `SELECT`, e
as três escritas de teste rodaram dentro de transações que sempre desfazem,
com o estado final conferido depois.

## 7. Migrations 3–13 continuam pendentes

```
13 migrations found in prisma/migrations
Following migrations have not yet been applied:
20260914000000_sale_idempotency_key
20260915000000_workspace_automation_controls
20260916000000_digital_twin_persistence
20260917000000_digital_twin_worker_and_prefs
20260918000000_digital_twin_worker_pairing
20260919000000_ml_engine
20260920000000_ml_data_provenance
20260920120000_produto_identidade_externa
20260921120000_venda_proveniencia_e_atribuicao_clique
20260922120000_publicacao_entidade_de_distribuicao
20260923120000_automation_queue_persistente
```

**11 pendentes**, 2 aplicadas (baseline + nº 2). `AutomationJob`,
`Publicacao` e os enums continuam não existindo.

## 8. Confirmações

| | |
|---|---|
| Migration nº 2 aplicada | **sim** |
| Duração | **237 ms** |
| Linhas tocadas | **172** |
| Workspaces criados | **1** |
| `workspaceId` nulos | **0** |
| `Integracao` | índice passou a `(workspaceId, plataforma)`, e recusa duplicata |
| Dado perdido | **nenhum** — somas idênticas |
| Risco da aplicação antiga | **baixo** — leituras e caminho de clique intactos; só escritas administrativas falham, e o app está dormente |
| Migrations 3–13 | **pendentes**, todas as 11 |
| `migrate deploy` completo | **não executado** |
| Deploy da aplicação | **não** |
| `CRON_SECRET` | **não criado** |
| `vercel.json` | **intocado** |
| Merge / sync da `main` | **nenhum** |
| Publicação | **zero** |
| Provider externo chamado | **nenhum** |
| **Custo** | **R$ 0,00** |

---

## Próximo passo

A Etapa 3B seriam as 11 restantes. Todas são aditivas sobre tabelas novas e
vazias, com duas exceções pequenas e já medidas no ensaio: a nº 10
(`produto_identidade_externa`) toca as 25 linhas de `Produto` acrescentando
colunas anuláveis ou com default, e a nº 12 acrescenta uma coluna anulável
às 126 de `LinkDinamico`.

Duas coisas que valem decisão sua antes:

1. A nº 4 traz o kill switch (`automationPaused = true`). Depois dela, o
   workspace nasce explicitamente pausado.
2. A nº 12 é a que dá `workspaceId` a `EventoLink` — **é a partir dela que
   o registro de clique do app antigo passa a falhar**. O redirecionamento
   continua funcionando (o `.catch(() => {})` engole o erro), mas o evento
   se perde. Com zero cliques em 126 links, o impacto prático hoje é nulo.

Paro aqui para sua revisão.
