# P1.7.3 — Etapa 1: pré-condições, backup e ajuste aditivo inicial

**Concluída. `ModuloPermissao` criada em produção. Uma única diferença
antes/depois: a tabela nova. Nenhuma tabela de negócio foi tocada.**

Esta é a **primeira escrita em produção** de todo o esforço P1.7. Foram
dois comandos: `CREATE TABLE` e `CREATE UNIQUE INDEX`, ambos sobre uma
tabela que não existia.

Data: 24/09/2026 · Commit `044929d` · Branch `claude/pronto-para-trabalhar-jiij19`

---

## 1. Pré-condições — todas reconferidas antes de qualquer escrita

| Condição | Resultado |
|---|---|
| Projeto | `patrono-seller-ia` — `prj_4cayueFe5iJ51swlj2LRUyMXVfTD` |
| Organização | `cristiane-rabelo-s-projects` — `team_PLMmL1vXSAUjoIJ5bVQvNB7r` |
| Banco | `aftqchhuknsqijsengoo` · PostgreSQL 17.6 |
| Branch | `claude/pronto-para-trabalhar-jiij19` |
| Commit | `044929d` |
| Working tree | limpa |
| `prisma/` alterado desde o ensaio | **não** — nenhuma migration nova |
| Migrations no repo | 13, as mesmas do ensaio |
| `ADAPTADORES_LIGADOS` | `{}` |
| `RENOVADORES_LIGADOS` | `{}` |
| `PUBLICACAO_REAL_*` em `.env` | não existe |
| `PUBLICACAO_REAL_*` em produção | não existe |
| `CRON_SECRET` em produção | **ausente** — 11 variáveis, as mesmas |
| Última implantação | ainda a de **60 dias atrás** |

### O schema continuava no estado auditado

| Medida | Auditado (P1.7.1) | Agora |
|---|---|---|
| Tabelas em `public` | 16 | **16** |
| Tabelas ausentes | 21 | **21** |
| Tabelas legadas | 10 | **10** |
| `_prisma_migrations` | não existe | **não existe** |
| `Produto` | 25 linhas | **25** |
| `Conteudo` | 17 linhas | **17** |
| `LinkDinamico` | 126 linhas | **126** |
| `EventoLink` | 0 linhas | **0** |
| `Integracao` | 3 linhas | **3** |
| `User` | 1 linha | **1** |
| Pré-condições da reconciliação | sem bloqueio | **sem bloqueio** |

**Nada mudou desde o ensaio.** Seguiu-se em frente.

## 2. Backup

| | |
|---|---|
| **Concluído** | sim |
| **Timestamp (UTC)** | `2026-09-24T16:23:02Z` |
| **Arquivo principal** | `patrono-prod-20260924T162302Z-public.dump` |
| **Tamanho** | **60.711 bytes** (formato custom, comprimido) |
| **Arquivo auxiliar** | `patrono-prod-20260924T162302Z-schema.sql` — 21.918 bytes, legível |
| **Local** | `C:\Users\jurid\backups-patrono\` |
| **SHA-256 do dump** | `c4d928781442e7ee2babb0a579f9a86adaf71c687901face41abf5995432d62b` |

### Onde ficou, e por quê

**Fora do repositório** e **fora do OneDrive**, de propósito. O dump contém
a tabela `Integracao`, que tem colunas `accessToken` e `refreshToken` — não
convém sincronizar isso para a nuvem. `C:\Users\jurid\backups-patrono\` é
local e não sincronizado.

**Isso é uma decisão sua a partir de agora:** o arquivo é pequeno e é a
única rede de segurança das próximas etapas. Se quiser guardá-lo em outro
lugar, vale lembrar que ele carrega credenciais de integração.

### Integridade verificada

`pg_restore --list` lê o índice do dump sem erro: **89 entradas, 16 tabelas
com dado** — exatamente as 16 que a auditoria encontrou. `ModuloPermissao`
**não** está no dump, o que confirma que ele retrata o estado anterior à
mudança.

### Um obstáculo no caminho, e como foi resolvido

O `pg_dump` instalado nesta máquina é **16.14**, e o servidor é **17.6**.
O `pg_dump` recusa servidor de versão maior:

```
pg_dump: error: aborting because of server version mismatch
pg_dump: detail: server version: 17.6; pg_dump version: 16.14
```

O CLI do Supabase (`supabase db dump`) resolveria, mas exige Docker, que não
existe nesta máquina. Baixei então os **binários oficiais do PostgreSQL
17.6** (EnterpriseDB, 330 MB, gratuito, sem conta) e extraí só o cliente em
`C:\Users\jurid\pgclient17\`. Nenhuma instalação de sistema, nenhum
serviço novo, nada no PATH global.

**Isto entra no checklist:** qualquer backup futuro de produção precisa de
cliente 17.x.

## 3. O ajuste aditivo

Executado exatamente o arquivo revisado na P1.7.2,
`scripts/ensaio-reconciliacao/completar-baseline.sql`:

```sql
CREATE TABLE IF NOT EXISTS "ModuloPermissao" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "liberado" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModuloPermissao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ModuloPermissao_role_modulo_key"
    ON "ModuloPermissao"("role", "modulo");
```

Saída: `CREATE TABLE` · `CREATE INDEX` · exit 0.

## 4. Validação

### A tabela criada

| Coluna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | text | não | — |
| `role` | text | não | — |
| `modulo` | text | não | — |
| `liberado` | boolean | não | `true` |
| `updatedAt` | timestamp(3) sem fuso | não | — |

**Idêntica ao que o baseline declara.**

**Índices:** `ModuloPermissao_pkey` (único, sobre `id`) e
`ModuloPermissao_role_modulo_key` (único, sobre `role, modulo`).
**Constraints:** `ModuloPermissao_pkey`, tipo `p`. **Nenhuma chave
estrangeira**, nem para dentro nem para fora — a tabela é isolada.
**Linhas: 0.**

### Diferenças antes/depois

Retrato completo do banco — tabelas, colunas, linhas, índices e constraints
— tirado imediatamente antes e imediatamente depois:

```
antes:  2026-09-24T16:23:43Z  (16 tabelas)
depois: 2026-09-24T16:24:21Z  (17 tabelas)

=== DIFERENÇAS (1) ===
  TABELA NOVA        ModuloPermissao
```

**Uma diferença, e só uma.** Nenhuma coluna mudou em nenhuma tabela
existente, nenhum índice, nenhuma constraint.

### Tabelas de negócio — zero alteração, zero perda

| Tabela | Antes | Depois | |
|---|---|---|---|
| `User` | 1 | 1 | ok |
| `Produto` | 25 | 25 | ok |
| `Conteudo` | 17 | 17 | ok |
| `LinkDinamico` | 126 | 126 | ok |
| `EventoLink` | 0 | 0 | ok |
| `Integracao` | 3 | 3 | ok |

### Nenhuma migration subsequente foi aplicada

| Verificação | Resultado |
|---|---|
| `_prisma_migrations` existe | **não** — nenhum `migrate resolve` foi feito |
| `Workspace` existe | **não** |
| `AutomationJob` existe | **não** |
| `Publicacao` existe | **não** |
| Colunas `workspaceId` no banco | **0** |
| Enums criados | **0** |
| Total de tabelas | 17 (era 16) |

### O baseline agora está materialmente completo

```
tabelas do baseline que conferem      6
conferem com sobra conhecida          1
tabelas ausentes em produção          0
tabelas com divergência INESPERADA    0

Produção ESTÁ no estado do baseline. O baselining é seguro.
```

## 5. Um ajuste que fiz no gate, e por quê

O `comparar-producao-com-baseline.ts` marcava `Conteudo` como divergente
por causa das três colunas mortas — as mesmas que a P1.7.1 mediu como 100%
nulas, que nenhuma migration menciona, e que o ensaio da P1.7.2 reproduziu
antes de o baselining funcionar em cima delas.

Um gate que fica permanentemente vermelho por um motivo conhecido deixa de
ser gate: na hora que importar, ninguém vai olhar. Então ele passou a
distinguir **sobra conhecida** de **divergência inesperada**, com a lista
das três colunas escrita no código e comentada. Qualquer coluna fora dessa
lista volta a reprovar, e o `exit code` agora também reprova se faltar
tabela.

Antes da mudança ele saía 1 (reprovado) com a lista correta; depois, sai 0
com o mesmo diagnóstico. O que mudou foi a classificação, não o fato.

## 6. Riscos encontrados

| Risco | Situação |
|---|---|
| `pg_dump` 16 não fala com servidor 17.6 | **resolvido** — cliente 17.6 instalado em `C:\Users\jurid\pgclient17\`. Entra no checklist |
| O dump contém tokens de `Integracao` | **mitigado** — guardado fora do repo e fora do OneDrive. Custódia de longo prazo é decisão sua |
| Backup sem teste de restauração | **residual** — o TOC foi lido e confere, mas não houve `pg_restore` de verdade num banco vazio. Posso fazer isso no cluster descartável antes da Etapa 2, se você quiser |
| Código de 60 dias atrás × schema novo | **ainda não se aplica** — `ModuloPermissao` é tabela nova que ninguém usa. Passa a valer na Etapa 3 |
| `DIRECT_URL` ausente em produção | **conhecido** — necessário para o CLI do Prisma nas etapas 2 e 3; basta exportar na sessão |

**Nenhum risco novo apareceu.**

## 7. Confirmações finais

| | |
|---|---|
| Backup realizado | **sim** — 60.711 bytes, 2026-09-24T16:23:02Z, íntegro |
| Commit | **`044929d`** |
| `ModuloPermissao` criada | **sim**, vazia, com os 2 índices e 1 constraint corretos |
| Diferenças antes/depois | **1** — a tabela nova. Nada mais |
| Perda de dado | **zero** |
| Migrations subsequentes aplicadas | **nenhuma** |
| `migrate resolve` | **não executado** |
| `migrate deploy` | **não executado** |
| Deploy da aplicação | **não** — segue a implantação de 60 dias atrás |
| `CRON_SECRET` | **não criado** |
| `vercel.json` | **não alterado** |
| Merge / sync da `main` | **nenhum** |
| Publicação | **zero** |
| Adapter real | **nenhum** |
| Provider pago | **nenhum** |
| **Custo** | **R$ 0,00** |

---

## Próximo passo

A Etapa 2 é o `migrate resolve` — grava **uma linha** em
`_prisma_migrations` e não executa DDL nenhum:

```bash
export DATABASE_URL="<produção>"
export DIRECT_URL="$DATABASE_URL"
npx prisma migrate resolve --applied 20260101000000_baseline_pre_workspace
```

O gate que a autoriza está verde. Paro aqui para sua revisão.
