# P1.7.3 — Verificação de restauração + Etapa 2 (baselining)

**O backup restaura de verdade: zero diferença material e conteúdo idêntico
por soma de verificação. O baselining foi executado: `_prisma_migrations`
criada com exatamente 1 registro e `applied_steps_count = 0`.**

Nenhuma tabela de negócio foi alterada. Nenhuma linha de negócio mudou.
Nenhum `Workspace` criado. Nenhuma das 12 migrations seguintes foi aplicada.

Data: 24/09/2026 · Commit `b8a00d9` · Branch `claude/pronto-para-trabalhar-jiij19`

---

# Parte 1 — Verificação de restauração

## 1. Ambiente

Um cluster **PostgreSQL 17.6** descartável, em `127.0.0.1:55433`, `timezone
= UTC` — a mesma versão e o mesmo fuso da produção.

Os binários do PostgreSQL 17.6 baixados na Etapa 1 trazem o **servidor
completo**, não só o cliente. Isso permitiu restaurar na mesma versão em que
o dump foi gerado, em vez de tentar encaixar um dump 17 num servidor 16 — o
que traria erros de sintaxe nova (`transaction_timeout`, por exemplo) e
tornaria o teste inconclusivo.

**Produção não foi tocada para escrita nesta parte.** As únicas consultas
foram as somas de verificação da seção 3, todas `SELECT`.

## 2. Restore

| | |
|---|---|
| Arquivo | `patrono-prod-20260924T162302Z-public.dump` |
| Tamanho | 60.711 bytes |
| SHA-256 conferido antes do restore | `c4d928781442e7ee2babb0a579f9a86adaf71c687901face41abf5995432d62b` — **bate com o da Etapa 1** |
| Cliente | `pg_restore` 17.6 |
| Destino | banco `patrono_restore`, vazio |
| Resultado | **exit 0**, com `--exit-on-error` |

### Uma coisa apareceu, e valeu a pena

A primeira tentativa falhou:

```
pg_restore: error: could not execute query: ERROR:  schema "public" already exists
Command was: CREATE SCHEMA public;
```

O dump inclui `CREATE SCHEMA public`, e um banco novo do PostgreSQL já vem
com esse schema. A correção foi `DROP SCHEMA public CASCADE` no banco vazio
antes de restaurar — assim **tudo**, inclusive o schema, veio do dump, e
nada veio de fora dele.

Isso importa para o futuro: **numa restauração de emergência, o passo de
apagar o `public` é obrigatório**, senão o restore aborta logo na primeira
instrução. Entra no plano de rollback.

## 3. Validação

### Contra o estado de produção no momento do dump

```
antes:  2026-09-24T16:23:43Z  (16 tabelas)   <- produção, antes da Etapa 1
depois: 2026-09-24T16:30:45Z  (16 tabelas)   <- banco restaurado

=== DIFERENÇAS (0) ===
  nenhuma
```

**Zero.** O retrato compara tabelas, número de colunas, número de linhas,
**índices e constraints** de cada tabela. Nada saiu do lugar.

| Tabela | Produção no dump | Restaurado |
|---|---|---|
| `User` | 1 linha, 8 colunas | **igual** |
| `Produto` | 25 linhas, 18 colunas | **igual** |
| `Conteudo` | 17 linhas, 45 colunas | **igual** |
| `LinkDinamico` | 126 linhas, 16 colunas | **igual** |
| `EventoLink` | 0 linhas, 6 colunas | **igual** |
| `Integracao` | 3 linhas, 12 colunas | **igual** |
| Total de tabelas | 16 | **16** |
| `ModuloPermissao` | não existia ainda | **não existe** |

### Contra o estado depois da Etapa 1

```
=== DIFERENÇAS (1) ===
  TABELA REMOVIDA    ModuloPermissao
```

**Uma diferença, e ela é a correta.** O backup foi tirado *antes* de criar
`ModuloPermissao` — de propósito, porque a função dele é ser o ponto de
retorno anterior à mudança. Se `ModuloPermissao` estivesse lá, o backup
estaria errado.

Todas as tabelas de negócio: idênticas nas duas comparações.

### O conteúdo voltou, não só a contagem

Contagem igual prova que nenhuma linha sumiu. **Não prova que nenhum valor
mudou.** Então comparei somas de verificação do dado, calculadas com a mesma
consulta nos dois bancos:

| Tabela | Linhas | Soma em produção | Soma no restaurado |
|---|---|---|---|
| `User` | 1 | `92abb4f3…4ae4ef2` | **idêntica** |
| `Produto` | 25 | `b0652129…7de338` | **idêntica** |
| `Conteudo` | 17 | `9245f25d…952f0d` | **idêntica** |
| `LinkDinamico` | 126 | `6bd8e57f…3a09cfd` | **idêntica** |
| `Integracao` | 3 | `0020de26…437a56` | **idêntica** |
| `EventoLink` | 0 | (vazia) | (vazia) |

`diff` das duas saídas: **idênticas, linha por linha.**

### Segurança

A consulta de soma (`scripts/conferir-integridade-dados.sql`) **não lê
nenhuma coluna sensível**: ficam de fora `accessToken`, `refreshToken` e
`extraData` de `Integracao`, e `password` e `email` de `User`. O que sai é
hash, não conteúdo.

Nenhum token, senha ou connection string foi exibido. O dump **não** foi
copiado para o repositório nem para nuvem — continua só em
`C:\Users\jurid\backups-patrono\`, local e não sincronizado. O cluster de
restauração foi **desligado e apagado** ao final.

**Veredito: o backup é restaurável. A rede de segurança existe de verdade.**

---

# Parte 2 — Etapa 2: baselining

Como o restore passou, segui direto, conforme autorizado.

## 4. O gate antes de executar

```
tabelas ausentes em produção          0
tabelas com divergência INESPERADA    0

Produção ESTÁ no estado do baseline. O baselining é seguro.
```

Exit 0.

## 5. O comando

```bash
export DATABASE_URL="<produção>"
export DIRECT_URL="$DATABASE_URL"
npx prisma migrate resolve --applied 20260101000000_baseline_pre_workspace
```

Saída:

```
Migration 20260101000000_baseline_pre_workspace marked as applied.
```

Exit 0. O `DIRECT_URL` foi necessário, como previsto na P1.7.2 — sem ele o
CLI do Prisma não inicia.

## 6. Validação

### `_prisma_migrations`

| Verificação | Resultado |
|---|---|
| Tabela criada | **sim**, pelo mecanismo do próprio Prisma |
| Registros | **exatamente 1** |
| `migration_name` | `20260101000000_baseline_pre_workspace` |
| **`applied_steps_count`** | **`0`** — registrada, não executada |
| `finished_at` | `2026-09-24 16:32:11.302666+00` |
| `rolled_back_at` | `NULL` |
| `checksum` | `edb1040ee1fa7e5c…` |

`applied_steps_count = 0` é exatamente o que o `resolve` deve produzir, e é
o mesmo valor que o ensaio da P1.7.2 gerou. **Nenhum DDL da migration
inicial foi executado** — se tivesse sido, o contador seria 1 e as tabelas
teriam sido recriadas (o que falharia, porque já existem).

### Nenhuma migration subsequente foi executada

| Verificação | Resultado |
|---|---|
| `Workspace` existe | **não** |
| `AutomationJob` existe | **não** |
| `Publicacao` existe | **não** |
| Colunas `workspaceId` no banco | **0** |
| Enums criados | **0** |

### Diferenças antes/depois da Etapa 2

```
antes:  2026-09-24T16:31:57Z  (17 tabelas)
depois: 2026-09-24T16:32:42Z  (18 tabelas)

=== DIFERENÇAS (1) ===
  TABELA NOVA        _prisma_migrations
```

**Uma diferença: a tabela de controle do Prisma.** Nenhuma tabela de
negócio ganhou ou perdeu coluna, índice ou constraint.

| Tabela | Antes | Depois | |
|---|---|---|---|
| `User` | 1 | 1 | ok |
| `Produto` | 25 | 25 | ok |
| `Conteudo` | 17 | 17 | ok |
| `LinkDinamico` | 126 | 126 | ok |
| `EventoLink` | 0 | 0 | ok |
| `Integracao` | 3 | 3 | ok |

### `prisma migrate status`

```
13 migrations found in prisma/migrations
Following migrations have not yet been applied:
20260913220000_workspace_program_sale_commission_audit
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

**12 pendentes, o baseline reconhecido como aplicado.** É exatamente o
estado que a Etapa 3 espera encontrar.

## 7. Estado de produção agora

| | |
|---|---|
| Tabelas | 18 (16 originais + `ModuloPermissao` + `_prisma_migrations`) |
| Migrations registradas | 1 de 13 |
| Migrations pendentes | 12 |
| Dado de negócio | intacto: 1 / 25 / 17 / 126 / 3 / 0 |
| `Workspace` | ainda não existe |

## 8. Confirmações

| | |
|---|---|
| Restore verificado | **sim** — zero diferença material, somas idênticas |
| `_prisma_migrations` criada | **sim**, pelo mecanismo do Prisma |
| Migrations registradas | **exatamente 1** |
| `applied_steps_count` | **0** |
| DDL da migration inicial executado | **não** |
| Tabela de negócio alterada | **nenhuma** |
| Linha de negócio alterada | **nenhuma** |
| `Workspace` criado | **não** |
| Migration subsequente executada | **nenhuma** |
| `migrate deploy` | **não executado** |
| Deploy da aplicação | **não** — segue a implantação de 60 dias atrás |
| `CRON_SECRET` | **não criado** |
| `vercel.json` | **intocado** |
| Merge / sync da `main` | **nenhum** |
| Publicação | **zero** |
| Adapter real | **nenhum** |
| Provider pago | **nenhum** |
| **Custo** | **R$ 0,00** |

---

## Próximo passo

A Etapa 3 é o `prisma migrate deploy` — as 12 migrations restantes. **É a
primeira etapa que escreve em dado real:** a migration nº 2 cria o
`Workspace` e preenche `workspaceId` em 172 linhas.

O ensaio da P1.7.2 mediu essa etapa inteira: 194 ms, dado preservado byte a
byte, workspace nascendo pausado e em modo manual.

**Um ponto que precisa da sua decisão antes:** depois da Etapa 3, a
aplicação que está no ar — a de 60 dias atrás — passa a conversar com um
schema onde `workspaceId` é obrigatório. Leituras continuam funcionando;
**escritas quebram**. O ideal é fazer a Etapa 3 e o deploy do código novo na
mesma sessão, para encurtar a janela.

Paro aqui para sua revisão.
