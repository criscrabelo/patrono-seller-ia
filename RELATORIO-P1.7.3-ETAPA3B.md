# P1.7.3 — Etapa 3B: preparação completa para deploy imediato

**O projeto voltou a ser deployável — e descobri, ao tentar provar isso, que
ele não era, por um motivo diferente do que já conhecíamos.** O `next build`
falhava. Se a janela de manutenção tivesse começado sem esta etapa, as 11
migrations teriam sido aplicadas e o deploy seguinte teria falhado, deixando
banco novo e código antigo por tempo indeterminado.

Nenhum DDL novo em produção. Nenhum dado tocado. Nenhum deploy de produção.

Data: 24/09/2026 · Branch `claude/pronto-para-trabalhar-jiij19`

---

## 1. Os dois bloqueios de deploy

### 1.1 `vercel.json` — resolvido

A chave `crons` inteira saiu. O arquivo agora é `{}`.

Os cinco agendamentos removidos, e para onde foram:

| Rota | Antes | Agora |
|---|---|---|
| `/api/cron/publicar` | `0 12 * * *` | Actions, 12:00 UTC, **desligado por variável** |
| `/api/cron/oportunidades` | `0 5 * * *` | Actions, 05:00 UTC |
| `/api/cron/ml-janela-observacao` | `0 3 * * *` | Actions, 03:00 UTC |
| `/api/cron/sincronizar-catalogo` | `0 6,12,18 * * *` — **recusado pelo Hobby** | Actions, 06/12/18 UTC |
| `/api/cron/executar-fila` | `*/30 * * * *` — **recusado pelo Hobby** | Actions, **de hora em hora** |

Nada mais foi mexido no arquivo.

### 1.2 O `next build` falhava — este é novo

```
Type error: Type 'OmitWithTag<typeof import(".../app/api/cron/oportunidades/route")>'
does not satisfy the constraint '{ [x: string]: never; }'.
  Property 'compararFilas' is incompatible with index signature.
```

A causa era uma linha que parecia uma cortesia:

```ts
/** Reexportados para quem quiser comparar execuções fora do cron. */
export { compararFilas, capacidadesDeclaradas }
```

O App Router do Next só admite, num `route.ts`, os handlers HTTP e um
conjunto fixo de configs (`dynamic`, `maxDuration` e afins). **Qualquer
outro export vira erro de tipo no `next build` — e só lá.**

**Por que ninguém viu.** `npx tsc --noEmit` passa: o arquivo é TypeScript
válido. A suíte passa: ninguém importa aqueles símbolos da rota — os testes
os importam de `lib/`, que é onde moram. O erro só existe nos tipos que o
**próprio Next gera** durante o build, e o build não rodava há muitas
rodadas, porque o deploy estava travado pelo `vercel.json` — que era o outro
bloqueio. **Um bloqueio escondia o outro.**

**Correção:** a linha saiu, junto com os dois imports que só ela usava. As
funções continuam exportadas de `lib/motor-de-oportunidades.ts` e
`lib/ciclo-de-oportunidades.ts`, que é de onde todo mundo já as importava.

### 1.3 Dois testes novos, para isto não voltar

Em `tests/rodada47-arquitetura-invariantes.test.ts`, num bloco chamado
**"O projeto continua DEPLOYÁVEL"**:

- **`nenhum route.ts exporta coisa que o App Router não aceita`** — varre
  todos os `route.ts` sob `app/`, entende `export const`, `export function`,
  `export { … }` e `export default`, e exige que só sobrem os nomes
  permitidos. Tem guarda contra varredura vazia (`> 10` rotas).
- **`vercel.json não declara cron`** — porque é isso que mantém o projeto
  aceito no plano Hobby.

Mais dois de apoio: **todo cron do código está agendado no workflow** (a
mudança de casa não deixou nenhum para trás) e **o workflow não carrega
segredo e não opera sem ele**.

**Verifiquei que o primeiro não passa por vazio:** rodei a mesma detecção
contra a versão anterior do arquivo, vinda do git.

```
versao ANTERIOR (a que quebrava o build): ["compararFilas","capacidadesDeclaradas"]
versao ATUAL:                             []
```

Ele pega o defeito real e aprova a correção.

### 1.4 Dois testes existentes foram atualizados

`o cron está agendado` e `D — o cron da janela existe, exige segredo e está
agendado` liam o `vercel.json`. **A exigência não afrouxou — mudou de
arquivo.** Agora conferem o agendamento no workflow do GitHub Actions, e o
primeiro passou a exigir também a expressão de agenda.

## 2. Migrations 3–13 como janela única

| # | migration | efeito | compatível com o app antigo? | quando passa a exigir código novo |
|---|---|---|---|---|
| 3 | `sale_idempotency_key` | índice único em `Sale` (tabela nova e vazia) | **sim** | nunca — o app antigo não conhece `Sale` |
| 4 | `workspace_automation_controls` | `Workspace.automationPaused BOOLEAN NOT NULL DEFAULT true` e `automationMode TEXT NOT NULL DEFAULT 'MANUAL'` | **sim** | nunca — o app antigo não conhece `Workspace` |
| 5 | `digital_twin_persistence` | 6 tabelas novas | **sim** | nunca |
| 6 | `digital_twin_worker_and_prefs` | 1 tabela nova + colunas em tabelas novas | **sim** | nunca |
| 7 | `digital_twin_worker_pairing` | 1 tabela nova + colunas em tabelas novas | **sim** | nunca |
| 8 | `ml_engine` | 5 tabelas novas | **sim** | nunca |
| 9 | `ml_data_provenance` | colunas em tabelas de ML vazias | **sim** | nunca |
| 10 | `produto_identidade_externa` | `Produto` ganha `externalId`, `providerId`, `sincronizadoEm`, `removidoDaOrigemEm` (anuláveis) e `origemDados` (**default `'MANUAL'`**) + 2 índices | **sim** — leituras seguem; a inserção de `Produto` já estava quebrada desde a nº 2 | não piora nada |
| 11 | `venda_proveniencia_e_atribuicao_clique` | **`EventoLink` ganha `workspaceId`**: anulável → backfill a partir de `LinkDinamico` → `SET NOT NULL` + FK + índice. Mais colunas em `Sale` | **NÃO** | **aqui** |
| 12 | `publicacao_entidade_de_distribuicao` | cria `Publicacao`, enum `EstadoDaPublicacao`, `LinkDinamico.publicacaoId` (**anulável**), 5 índices únicos | **sim** | não piora nada |
| 13 | `automation_queue_persistente` | cria `AutomationJob` e enum `EstadoDoAutomationJob` | **sim** | nunca |

### O ponto sem retorno é a migration nº 11

**Correção ao que eu disse na Etapa 3A: é a nº 11, não a nº 12.** Eu havia
apontado a nº 12 como a que dá `workspaceId` a `EventoLink`. Conferi no SQL:
é a nº 11, `venda_proveniencia_e_atribuicao_clique`.

Depois dela, `app/api/l/[slug]/route.ts` da aplicação antiga não consegue
mais gravar o evento de clique — ele insere sem `workspaceId`.

**O redirecionamento continua funcionando**, porque a gravação é
fire-and-forget:

```ts
prisma.linkDinamico.update({ ... })
  .then(() => prisma.eventoLink.create({ ... }))
  .catch(() => {})            // <- engole o erro

return NextResponse.redirect(link.urlDestino)   // <- fora da cadeia
```

O incremento de `cliques` (um `UPDATE`) também segue funcionando. **O que
se perde é o registro do evento**, silenciosamente.

Com **0 cliques em 126 links**, o impacto prático hoje é nulo. Mas é o ponto
a partir do qual a janela deixa de ser inofensiva, e é por isso que ela deve
ser curta.

### Atenção especial à nº 4

`automationPaused` nasce `true` e `automationMode` nasce `'MANUAL'`, por
default — o workspace que já existe em produção recebe os dois valores
automaticamente. **O kill switch chega antes de qualquer coisa que pudesse
usá-lo:** `AutomationJob` só existe na nº 13.

## 3. Procedimento da janela — migrations + deploy

Nada disto foi executado.

```bash
# ── 0. PREPARO (fora da janela) ─────────────────────────────────────
export DATABASE_URL="<produção, pelo pooler IPv4>"
export DIRECT_URL="$DATABASE_URL"
PG="/c/Users/jurid/pgclient17/pgsql/bin"     # cliente 17.x é obrigatório

# ── 1. BACKUP NOVO (o da Etapa 1 é anterior à migration nº 2) ───────
TS=$(date -u +%Y%m%dT%H%M%SZ)
"$PG/pg_dump.exe" -Fc --no-owner --no-privileges -n public \
  -f "C:/Users/jurid/backups-patrono/patrono-prod-$TS-public.dump" "$DATABASE_URL"
"$PG/pg_restore.exe" --list "C:/Users/jurid/backups-patrono/patrono-prod-$TS-public.dump" | head -3
sha256sum "C:/Users/jurid/backups-patrono/patrono-prod-$TS-public.dump"

# ── 2. ESTADO DO BANCO ──────────────────────────────────────────────
npx prisma migrate status                    # espera-se: 11 pendentes
npx tsx scripts/snapshot-producao.ts gravar antes-3c.json
"$PG/psql.exe" -tA -F'|' -f scripts/conferir-integridade-dados.sql "$DATABASE_URL" > soma-antes.txt

# ── 3. AS 11 MIGRATIONS ─────────────────────────────────────────────
npx prisma migrate deploy                    # ~200 ms no ensaio
npx prisma migrate status                    # "Database schema is up to date!"

# ── 4. VALIDAR O BANCO ──────────────────────────────────────────────
npx tsx scripts/snapshot-producao.ts gravar depois-3c.json
npx tsx scripts/snapshot-producao.ts comparar antes-3c.json depois-3c.json
"$PG/psql.exe" -tA -F'|' -f scripts/conferir-integridade-dados.sql "$DATABASE_URL" > soma-depois.txt
diff soma-antes.txt soma-depois.txt          # tem de ser idêntico
npx prisma migrate diff --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma --script
#   esperado: só os DROPs do legado

# ── 5. DEPLOY, IMEDIATAMENTE ────────────────────────────────────────
npx vercel deploy --prod --yes

# ── 6. VALIDAR, SÓ LEITURA ──────────────────────────────────────────
curl -sS -o /dev/null -w "%{http_code}\n" "https://<domínio>/"            # 200
curl -sS "https://<domínio>/api/cron/oportunidades?modo=ensaio"           # 401 (fail-closed)
curl -sS -o /dev/null -w "%{http_code}\n" "https://<domínio>/api/l/<slug-real>"  # 307/308

# ── 7. SÓ DEPOIS: segredo e dry run ─────────────────────────────────
#   Vercel: CRON_SECRET (Production, Sensitive) -> redeploy
#   GitHub: secret CRON_SECRET + variable PATRONO_BASE_URL
npx tsx scripts/verificar-escrita-zero.ts antes
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://<domínio>/api/cron/oportunidades?modo=ensaio"
npx tsx scripts/verificar-escrita-zero.ts depois
```

**A etapa 5 vem colada na 4 de propósito.** É a janela que queremos curta.
No ensaio, as 11 migrations levaram ~200 ms; o deploy leva 1 a 2 minutos.
A janela realista é de **2 a 3 minutos**.

### Plano de contingência se o deploy falhar

O banco estará novo e o código, velho. Três respostas, em ordem de
preferência:

**A — consertar e redeployar (minutos).** É o caminho esperado: o build já
foi provado localmente e numa implantação de preview na infraestrutura da
Vercel. Uma falha aqui seria de infraestrutura ou de variável de ambiente,
não de código. `vercel logs <url>` diz qual.

**B — promover a implantação anterior (segundos).** Não resolve: a
implantação anterior é a de 61 dias atrás, que é justamente o código
incompatível. Só serve se o novo deploy estiver pior do que o antigo.

**C — restaurar o banco (minutos, destrutivo).** Último recurso, e só se
alguma migration tiver corrompido algo:

```bash
"$PG/psql.exe" "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE;'
"$PG/pg_restore.exe" -d "$DATABASE_URL" --no-owner --no-privileges \
  --exit-on-error "patrono-prod-$TS-public.dump"
```

**O `DROP SCHEMA public CASCADE` é obrigatório** — sem ele o `pg_restore`
aborta em `schema "public" already exists`. Descobrimos isso na verificação
de restauração, e é a razão pela qual ela valeu a pena.

**Enquanto a contingência não resolve:** leituras funcionam, o
redirecionamento de link funciona (só o evento se perde), e as escritas
administrativas ficam indisponíveis. Com o app dormente há meses, isso é
tolerável por horas.

## 4. Validações feitas sem tocar produção

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| **Build de produção local** (`prisma generate && next build`) | **exit 0** — 42 rotas, sem aviso nem erro |
| Rotas de cron no build | as 5 presentes, como funções dinâmicas |
| `/api/l/[slug]` no build | presente |
| `vercel.json` é JSON válido | sim, chaves: `[]` |
| `vercel.json` sem `crons` | **sim** — nada para o Hobby recusar |
| Workflow sem TAB (YAML) | sim, 0 |
| Workflow usa `secrets.CRON_SECRET` | sim |
| Workflow contém segredo literal | **não** |
| Projeto Vercel | `patrono-seller-ia` — `prj_4cayueFe5iJ51swlj2LRUyMXVfTD` |
| Migration nova no repo | **nenhuma** — 13, `prisma/` sem alteração |
| `ADAPTADORES_LIGADOS` / `RENOVADORES_LIGADOS` | `{}` / `{}` |
| `PUBLICACAO_REAL_*` | não existe em `.env` nem em produção |
| Provider pago inalcançável por cron | provado por grafo de imports |
| ML sem treino/promoção | provado por grafo de imports |

### A implantação de preview

Como você permitiu, usei uma implantação de **preview** — que não roda cron,
não promove nada e não altera produção — para validar build e runtime na
infraestrutura da Vercel:

```
Deployment patrono-seller-m0dv3dc2u-... ready.
```

**O projeto foi aceito.** Sem a chave `crons`, não há o que o plano Hobby
recuse. É a prova direta de que o bloqueio de 60 dias acabou.

E validei o comportamento em tempo de execução, não só o build:

```
GET /api/cron/oportunidades?modo=ensaio
{"error":"Não autorizado"}
```

**Fail-closed funcionando na infraestrutura real**, sem `CRON_SECRET`.

**Removi a implantação de preview** logo depois. Ela apontava para o banco
de produção em meio à migração, e já tinha provado o que precisava.
Produção seguiu, o tempo todo, na implantação de 61 dias atrás.

## 5. GitHub Actions

`.github/workflows/patrono-crons.yml` — **inerte**. `schedule` do GitHub
Actions só dispara na branch padrão, e este arquivo está em branch de
trabalho.

### Cadências e consumo

| Rota | Cadência | Execuções/mês |
|---|---|---|
| `executar-fila` | de hora em hora | 720 |
| `oportunidades` | 05:00 UTC | 30 |
| `sincronizar-catalogo` | 06/12/18 UTC | 90 |
| `ml-janela-observacao` | 03:00 UTC | 30 |
| `publicar` | 12:00 UTC, **desligado** | 0 |

Um único workflow despachante, de hora em hora: **720 execuções/mês ≈ 720
minutos**, contra 2.000 da cota gratuita do repositório privado — **36%**.
Cinco workflows separados mantendo `*/30` custariam ~1.620 min (81%).

A única frequência reduzida é a do executor: `*/30` → de hora em hora.
Manter `*/30` custaria 1.440 min/mês sozinho, para ganhar meia hora de
latência numa fila idempotente e retomável.

### Não opera sem segredo, e não faz barulho à toa

| Situação | Comportamento |
|---|---|
| Sem `CRON_SECRET` **e** sem `PATRONO_BASE_URL` | **encerra em silêncio, exit 0.** Não chama nada. É o estado de hoje |
| Com um e sem o outro | **falha alto, exit 1.** Isso é engano, não espera |
| Com os dois | opera |

A distinção é deliberada: um X vermelho de hora em hora vira ruído e
ninguém olha mais — mas configuração pela metade tem de gritar.

**Nada a criar agora.** Quando você aprovar: o secret `CRON_SECRET` e a
variable `PATRONO_BASE_URL`. `PATRONO_CRON_PUBLICAR_ATIVO` fica de fora.

## 6. Estado da aplicação antiga

A implantação no ar é de **26/07/2026**, e seu `schema.prisma` não tem
`model Workspace`.

### Funciona hoje

| Caminho | |
|---|---|
| Todas as leituras | o cliente antigo lista as colunas que conhece, e todas existem |
| `/api/l/:slug` — redirecionamento | **funciona** |
| incremento de `cliques` | `UPDATE` não toca `workspaceId` |
| `EventoLink.create` do clique | **funciona ainda** — a coluna chega na nº 11 |
| `Integracao.upsert` de plataforma já existente | ramo `update`, funciona |

### Já falha, desde a migration nº 2

| Rota | |
|---|---|
| `app/api/produtos/route.ts:56` | `produto.create` |
| `app/api/conteudos/gerar/route.ts:87,93` | `conteudo.create` |
| `app/api/links/route.ts:59` | `linkDinamico.create` |
| `app/api/integracoes/shopee/sincronizar/route.ts:73` | `linkDinamico.create` |
| `app/api/auth/register/route.ts:28` | `user.create` — cadastro de nova usuária |
| `app/api/integracoes/*` | `integracao.upsert` de plataforma **nova** |

### Passará a falhar depois da nº 11

| Rota | |
|---|---|
| `app/api/l/[slug]/route.ts:20` | `eventoLink.create` — **silenciosamente**. O redirecionamento segue |

### Impacto prático enquanto esperamos o deploy

| Sinal | Valor |
|---|---|
| Cliques em links rastreados | **0**, em 126 links |
| `EventoLink` registrados | **0** |
| Última linha em `LinkDinamico` | 10/05/2026 |
| Última linha em `Produto` | 26/05/2026 |
| Última linha em `Conteudo` | 26/07/2026 |
| Última atualização em `Integracao` | 09/09/2026 |

**A aplicação está dormente para escrita há meses.** O impacto real é: se
você tentar criar produto, gerar conteúdo, cadastrar usuária ou conectar uma
plataforma nova antes do deploy, vai tomar erro. Nada mais.

**Nenhuma tentativa de adaptar o código antigo**, como você pediu.

## 7. Testes

| | |
|---|---|
| Suíte completa | **1.768 testes, 1.768 passando, 0 falhas** — exit 0 |
| Suítes | 310 |
| Novos nesta etapa | **+4** (eram 1.764) |
| `npx tsc --noEmit` | **exit 0** |
| Build de produção | **exit 0** |
| Validação do `vercel.json` | ok |
| Validação do workflow | ok |

Toda escrita de teste foi no banco de teste autorizado
(`xntkypjmmdovrfbblbqb`), com verificação de ref antes de cada execução.
**Nenhum teste escreveu em produção.**

## 8. Confirmações

| | |
|---|---|
| Migrations 3–13 aplicadas | **não** — as 11 seguem pendentes |
| Deploy de produção | **não** — a implantação segue a de 61 dias atrás |
| `CRON_SECRET` criado | **não** |
| Publicação | **zero** |
| Adapters ligados | **nenhum** |
| Merge / sync da `main` | **nenhum** |
| Dados de produção alterados | **nenhum** |
| DDL novo em produção | **nenhum** |
| **Custo** | **R$ 0,00** |

---

## O que ficou pronto

O deploy pode acontecer imediatamente após as migrations, que é o que você
pediu. O que faltava para isso eram dois bloqueios — e o segundo só
apareceu porque fomos procurar.

Paro aqui para sua revisão.
