# P1.7.1 — Recuperação Segura do Ambiente de Produção

**Auditoria somente leitura concluída. Zero escrita em produção.**
Nenhum DDL, nenhum `INSERT`, `UPDATE`, `DELETE`, nenhum backfill, nenhum
`migrate deploy`, nenhum `migrate dev`. Nenhum deploy, nenhuma publicação,
nenhum merge, nenhum sync da `main`.

Data: 24/09/2026 · Banco: `aftqchhuknsqijsengoo` · PostgreSQL 17.6
Acesso: pooler IPv4 (`aws-1-sa-east-1`), porque o endpoint direto
`db.<ref>.supabase.co` só tem registro AAAA e esta máquina sai por IPv4.
Nenhuma connection string, senha ou segredo aparece neste relatório.

---

## 1. Estado real do schema de produção

**Produção nunca foi gerenciada por `prisma migrate`.** A tabela
`_prisma_migrations` **não existe**. Não é o caso de "está atrasada": ela
nunca entrou na história.

| Medida | Valor |
|---|---|
| Tabelas em `public` | **16** |
| Models no `schema.prisma` | **27** |
| Tabelas ausentes | **21** |
| Tabelas em produção fora do schema atual | **10** (legado) |
| Registros em `_prisma_migrations` | **0** — a tabela não existe |
| Migrations aplicadas | **0 de 13** |
| Migrations falhadas | **0** (nenhuma chegou a rodar) |
| Migrations divergentes | **0** (não há com o que divergir) |

### Tabelas críticas

| Tabela | Existe | Colunas | Linhas |
|---|---|---|---|
| `Workspace` | **não** | — | — |
| `Produto` | sim | 18 | **25** |
| `Conteudo` | sim | 45 | **17** |
| `Publicacao` | **não** | — | — |
| `AutomationJob` | **não** | — | — |
| `EventoLink` | sim | 6 | 0 |
| `LinkDinamico` | sim | 16 | **126** |
| `User` | sim | 8 | **1** |
| `Integracao` | sim | 12 | **3** |

**Há dado real em produção: 25 produtos, 17 conteúdos, 126 links
dinâmicos, 3 integrações, 1 usuária.** Qualquer caminho tem que preservar
isso.

### Ausentes (21)

`AffiliateProgram` · `AuditLog` · `AutomationJob` · `Commission` ·
`CreativeExperiment` · `DigitalTwinAsset` · `DigitalTwinJob` ·
`DigitalTwinProfile` · `GenerationWorkerHealth` · `IdentityConsent` ·
`MLFeatureSnapshot` · `MLModel` · `MLPrediction` · `MLTrainingRun` ·
`ModuloPermissao` · `Publicacao` · `Sale` · `VoiceConsent` ·
`VoiceProfile` · `WorkerToken` · `Workspace`

### Legado em produção, fora do schema atual (10)

`Creator` · `DecisaoMotor` · `EntregaUGC` · `Fornecedor` ·
`ImagemCriativo` · `LogCompliance` · `SerieFxa` · `TendenciaRadar` ·
`TermoJuridico` · `VideoAutorizado`

**Todas as dez estão vazias** — 0 linhas somadas. São resíduo de uma
encarnação anterior do produto.

### Índices e constraints hoje

O mínimo: só as chaves primárias e as FKs originais.

| Tabela | Índices | FKs |
|---|---|---|
| `Produto` | 1 (`_pkey`) | 1 |
| `Conteudo` | 1 (`_pkey`) | 2 |
| `EventoLink` | 1 (`_pkey`) | 1 |
| `LinkDinamico` | 2 | 2 |

O schema-alvo acrescenta **48 índices** (dos quais 16 únicos) e **46 chaves
estrangeiras**. Nenhum índice de `workspaceId` existe hoje, porque a coluna
não existe.

### Versão/schema esperado pelo código atual

O código na branch espera as 27 tabelas, mais dois enums que **não existem
em produção**: `EstadoDaPublicacao` e `EstadoDoAutomationJob`.

---

## 2. Reconciliação — a tabela pedida

Nenhuma das 13 está aplicada. A coluna "ordem" é a ordem de execução, que é
a cronológica do nome.

| # | migration | no repo | aplicada em produção | depende de | risco | ordem |
|---|---|---|---|---|---|---|
| 1 | `20260101000000_baseline_pre_workspace` | sim | **não** | banco vazio | **ALTO — colide** | 1 |
| 2 | `20260913220000_workspace_program_sale_commission_audit` | sim | **não** | #1 | médio (backfill) | 2 |
| 3 | `20260914000000_sale_idempotency_key` | sim | **não** | #2 (`Sale`) | baixo | 3 |
| 4 | `20260915000000_workspace_automation_controls` | sim | **não** | #2 (`Workspace`) | baixo | 4 |
| 5 | `20260916000000_digital_twin_persistence` | sim | **não** | #2 | baixo | 5 |
| 6 | `20260917000000_digital_twin_worker_and_prefs` | sim | **não** | #5 | baixo | 6 |
| 7 | `20260918000000_digital_twin_worker_pairing` | sim | **não** | #6 | baixo | 7 |
| 8 | `20260919000000_ml_engine` | sim | **não** | #2 | baixo | 8 |
| 9 | `20260920000000_ml_data_provenance` | sim | **não** | #8 | baixo | 9 |
| 10 | `20260920120000_produto_identidade_externa` | sim | **não** | #2 (`Produto.workspaceId`) | baixo | 10 |
| 11 | `20260921120000_venda_proveniencia_e_atribuicao_clique` | sim | **não** | #2, #3 | baixo | 11 |
| 12 | `20260922120000_publicacao_entidade_de_distribuicao` | sim | **não** | #2 | baixo | 12 |
| 13 | `20260923120000_automation_queue_persistente` | sim | **não** | #2 | baixo | 13 |

### Por migration: o que faz e o que arrisca

**#1 `baseline_pre_workspace`** — cria 7 tabelas (`User`,
`ModuloPermissao`, `LinkDinamico`, `EventoLink`, `Integracao`, `Produto`,
`Conteudo`), 4 índices únicos, 7 FKs. Aditiva. Não toca dado. Sem backfill.
**RISCO ALTO: seis dessas sete tabelas JÁ EXISTEM em produção.** Rodar esta
migration falha na primeira linha com `relation "User" already exists`.
Rollback: não chega a começar, então nada a desfazer.
**É por isso que aplicar as 13 em sequência é impossível.**

**#2 `workspace_program_sale_commission_audit`** — a migration central.
Cria `Workspace`, `AffiliateProgram`, `Sale`, `Commission`, `AuditLog`;
altera 9 tabelas; 17 FKs; 3 índices únicos. **Contém DML**: cria um
`Workspace` por `User` existente e preenche `workspaceId` em `User`,
`Produto`, `LinkDinamico`, `Integracao` e `Conteudo` a partir de `userId`.
**Toca dados existentes — de propósito, e corretamente.** Exige backfill, e
já o traz escrito. Bloqueia as tabelas durante o `ALTER` — com 172 linhas
no total, é instantâneo. Rollback: transacional; se falhar, o Postgres
desfaz tudo. **Risco médio, e só porque é a única que escreve em dado
real.**

**#3 `sale_idempotency_key`** — 1 índice único em `Sale`. `Sale` nasce
vazia em #2, então o único não pode colidir. Aditiva, sem backfill, risco
baixo.

**#4 `workspace_automation_controls`** — colunas de controle em
`Workspace` (`automationPaused` default **`true`**, `automationMode`
default `'MANUAL'`). Aditiva, com default, sem backfill. **Nota importante:
o workspace nasce PAUSADO e em modo manual — fail-closed.** Risco baixo.

**#5–#7 Digital Twin** — 8 tabelas novas, todas vazias, mais colunas em
tabelas novas. Aditivas. Não tocam dado existente. Risco baixo.

**#8 `ml_engine`** — 5 tabelas de ML, todas vazias. Aditiva. Risco baixo.

**#9 `ml_data_provenance`** — colunas de proveniência em tabelas de ML
recém-criadas e vazias. Aditiva. Risco baixo.

**#10 `produto_identidade_externa`** — adiciona `externalId`, `providerId`,
`origemDados` (default `'MANUAL'`), `sincronizadoEm`, `removidoDaOrigemEm`
em `Produto`, e o único `(workspaceId, providerId, externalId)`.
**Toca `Produto`, que tem 25 linhas.** As colunas novas ou têm default ou
são anuláveis, então não há backfill obrigatório. O índice único **não
pode colidir**: `providerId` e `externalId` nascem `NULL`, e no Postgres
`NULL` é distinto de `NULL` em índice único. Risco baixo.

**#11 `venda_proveniencia_e_atribuicao_clique`** — altera 2 tabelas, 2 FKs.
**Contém DML**, sobre `Sale`, que está vazia. Risco baixo.

**#12 `publicacao_entidade_de_distribuicao`** — cria `Publicacao`, o enum
`EstadoDaPublicacao`, 5 índices únicos, 3 FKs. Um dos únicos é
`LinkDinamico (publicacaoId, workspaceId)`, e **`LinkDinamico` tem 126
linhas**. Não colide: `publicacaoId` nasce `NULL` nas 126, e `NULL`s não
colidem entre si. Risco baixo.

**#13 `automation_queue_persistente`** — cria `AutomationJob` e o enum
`EstadoDoAutomationJob`, 1 índice único, 1 FK. Tabela nova e vazia. Risco
baixo.

---

## 3. Não dá para aplicar em bloco — e o porquê, item por item

Você pediu para eu não assumir. Não assumi; conferi cada categoria.

| Pergunta | Resposta |
|---|---|
| Migration que espera tabela inexistente? | **Não.** Cada uma só usa o que as anteriores criaram. |
| Migration que cria tabela **já existente**? | **Sim — a #1.** Seis colisões. É o bloqueio. |
| Migration que pressupõe dados? | **Sim — a #2**, que pressupõe `User` com linhas para gerar os workspaces. Produção tem 1 usuária: atendido. |
| Migration com `NOT NULL`? | **Sim**, várias — mas **nenhuma** com `ADD COLUMN NOT NULL` sem default sobre tabela com linhas. A #2 faz certo: adiciona anulável, preenche, e só então torna obrigatória. |
| Migration com enum? | **Sim — #12 e #13.** Enums novos, nomes que não existem em produção. Sem colisão. |
| Migration com FK? | **Sim — 46 no total.** Todas apontam para tabelas criadas na mesma migration ou em anterior. Nenhuma FK sobre dado que possa violar, porque o backfill da #2 vem antes. |
| Migration com `UNIQUE` que colida com dado real? | **Não.** Verificado contra o dado de verdade: nenhuma `plataforma` repetida em `Integracao`; `providerId`/`externalId` e `publicacaoId` nascem `NULL` e `NULL`s não colidem. |
| Migration que mudaria semântica existente? | **Sim, uma: a #2.** `Integracao` deixa de ser única por `(userId, plataforma)` e passa a ser única por `(workspaceId, plataforma)`. Com 1 usuária e 1 workspace, o efeito prático é nulo hoje; a mudança de significado é real e fica registrada. |

### Divergências entre produção e o baseline

Comparei **coluna a coluna** as 7 tabelas do baseline com produção:

| Tabela | Veredito |
|---|---|
| `User` | confere (8 colunas) |
| `LinkDinamico` | confere (16) |
| `EventoLink` | confere (6) |
| `Integracao` | confere (12) |
| `Produto` | confere (18) |
| `Conteudo` | **diverge**: produção tem 3 colunas a mais — `linkUrl`, `videoResultUrl`, `videoStatusUrl` |
| `ModuloPermissao` | **não existe em produção** |

As três colunas extras de `Conteudo` estão **100% nulas** nas 17 linhas, e
**nenhuma das 13 migrations as menciona** — são inertes, não atrapalham
nada. `ModuloPermissao` é uma tabela solta: sem FK, um índice único, e
ninguém depende dela.

**Conclusão: produção é o estado do baseline, com uma tabela faltando e
três colunas mortas sobrando.** Isso muda tudo — e para melhor.

### O caminho seguro: baselining, não bloco

A #1 não deve ser *executada*; deve ser **registrada como já aplicada**. É
exatamente para isso que existe o baselining do Prisma, e é o procedimento
documentado para um banco que já existia antes da história de migrations.

**Sequência proposta (nada disto foi executado):**

| Etapa | O que faz | Escreve? |
|---|---|---|
| **0** | Ensaiar tudo num Postgres descartável com o schema real de produção | não toca produção |
| **1** | `CREATE TABLE "ModuloPermissao"` + seu índice único, como o baseline declara | DDL aditivo; nenhuma tabela com dado é tocada |
| **2** | `prisma migrate resolve --applied 20260101000000_baseline_pre_workspace` | só cria `_prisma_migrations` e grava 1 linha. **Nenhum DDL de aplicação** |
| **3** | `prisma migrate deploy` | aplica #2 a #13, incluindo o backfill do `workspaceId` |
| **4** | `prisma migrate diff --from-url <prod> --to-schema-datamodel` deve sair vazio | leitura |
| **5** | *(opcional, depois)* derrubar as 10 tabelas legadas vazias e as 3 colunas nulas | destrutivo sobre 0 linhas |

A etapa 5 é separada de propósito: é a única destrutiva, não é necessária
para o sistema funcionar, e pode esperar semanas sem custo.

**Por que não usar o `migrate diff` direto.** Eu gerei o DDL que leva
produção ao schema-alvo de uma vez (741 linhas). **Ele não roda:** adiciona
`workspaceId TEXT NOT NULL` sem default em cinco tabelas que já têm linhas,
e o Postgres recusa. Além disso, derruba as 10 tabelas legadas e as 3
colunas no mesmo fôlego, sem separar o aditivo do destrutivo. O caminho do
baselining é melhor porque reusa o backfill que a #2 já traz escrito e
testado.

### Riscos encontrados — consolidado

| Risco | Gravidade | Situação |
|---|---|---|
| Aplicar as 13 em sequência falha na #1 | **alto** | resolvido pelo baselining |
| `ADD COLUMN NOT NULL` sobre tabela com linhas | alto **se** feito pelo `migrate diff` | evitado; a #2 faz anulável → backfill → `SET NOT NULL` |
| `UNIQUE` colidindo com dado real | alto se ocorresse | **verificado contra o dado: não ocorre** |
| Perda de dado no descarte do legado | alto se ocorresse | **as 10 tabelas e as 3 colunas estão vazias** |
| `ModuloPermissao` ausente | médio | criar antes do baselining |
| Semântica de `Integracao` muda | baixo hoje | 1 usuária, 1 workspace; registrado |
| Migration parcial em caso de falha | médio | cada migration é transacional; o passo 0 (ensaio) reduz a chance |
| `Workspace` nasce operando sozinho | — | **não nasce**: `automationPaused` default `true`, `automationMode` `MANUAL` |

---

## 4. Agendamentos — proposta

### O que sai do `vercel.json`

**Proposta: remover a chave `crons` inteira**, deixando o arquivo assim:

```json
{}
```

Não é só tirar os dois sub-diários. Com **nenhum** cron no `vercel.json`:

- o deploy deixa de ser recusado pelo limite do Hobby, hoje e no futuro;
- a cadência para de depender do plano de hospedagem;
- e — isto importa — **criar `CRON_SECRET` deixa de ligar cinco crons de
  uma vez**, que é o que me travou na P1.7.

Os cinco agendamentos removidos:

| Rota | Agenda atual | Hobby | Vai para |
|---|---|---|---|
| `/api/cron/publicar` | `0 12 * * *` | ok | Actions, **desligado** por variável |
| `/api/cron/oportunidades` | `0 5 * * *` | ok | Actions, 05:00 UTC |
| `/api/cron/ml-janela-observacao` | `0 3 * * *` | ok | Actions, 03:00 UTC |
| `/api/cron/sincronizar-catalogo` | `0 6,12,18 * * *` | **recusado** | Actions, 06/12/18 UTC |
| `/api/cron/executar-fila` | `*/30 * * * *` | **recusado** | Actions, **de hora em hora** |

### O workflow

Já escrito, em `.github/workflows/patrono-crons.yml`. **Ele está inerte:**
`schedule` do GitHub Actions só dispara na branch padrão, e este arquivo
está em branch de trabalho. Não roda, não chama nada, não gasta minuto até
o merge.

**Um despachante, não cinco workflows.** O repositório é privado, então
minuto de Actions é cota (2.000/mês no Free) e cada job é cobrado
arredondado ao minuto:

| Desenho | Execuções/mês | Minutos/mês | % da cota |
|---|---|---|---|
| Cinco workflows, mantendo `*/30` | 1.620 | ~1.620 | **81%** |
| Despachante a cada 30 min | 1.440 | ~1.440 | 72% |
| **Despachante de hora em hora** | **720** | **~720** | **36%** |

**A única frequência reduzida é a do executor: de `*/30` para de hora em
hora.** É a menor frequência segura: manter `*/30` custaria 1.440 min/mês
sozinho — 72% da cota para ganhar meia hora de latência. Trabalho
enfileirado às 05:00 sai às 06:00 no pior caso, e a fila é idempotente e
retomável, então nada se perde. Todos os outros horários ficam idênticos.

**Horários preservados, em UTC** — igual à Vercel, para não mudar
comportamento sem querer. **Uma pergunta para você:** 05:00 UTC é 02:00 em
Brasília. Se a intenção era 05:00 no horário do Brasil, o certo é `08` UTC.
Não mudei: é decisão, não ajuste.

**`publicar` fica desligado.** No workflow ele só roda se a variável
`PATRONO_CRON_PUBLICAR_ATIVO` for exatamente `true`. Ausente — que é o
estado de hoje — ele não roda. Fail-closed, igual ao resto do sistema.

**Duas coisas a criar no GitHub quando você aprovar:**

| Nome | Tipo | Conteúdo |
|---|---|---|
| `CRON_SECRET` | **Secret** | o segredo (ver seção 5) |
| `PATRONO_BASE_URL` | Variable | a URL de produção, ex. `https://patrono-seller-ia.vercel.app` |
| `PATRONO_CRON_PUBLICAR_ATIVO` | Variable | **não criar agora** |

**Limitações do Actions, ditas de frente:** agendamento atrasa (5 a 15
minutos é comum, e sob pico o GitHub pode pular execuções), e workflow
agendado é **desabilitado automaticamente após 60 dias sem atividade no
repositório**. Nenhuma das duas é grave aqui — as rotas são idempotentes e
o repositório tem commits toda semana —, mas é melhor saber antes.

---

## 5. `CRON_SECRET` — estratégia

**Não criei. Não gerei. Não há valor neste relatório, nem em lugar nenhum
que eu tenha escrito.**

| Item | Definição |
|---|---|
| **Nome** | `CRON_SECRET` — mantido. O código já lê `process.env.CRON_SECRET` em cinco rotas; renomear seria mudança de código sem ganho. |
| **Onde na Vercel** | Project Settings → Environment Variables → ambiente **Production**, marcada como **Sensitive**. Nunca em arquivo versionado. |
| **Onde no GitHub** | Settings → Secrets and variables → **Actions** → New **repository secret**, mesmo nome. Secret, não Variable — Variable aparece em log. |
| **Como gerar** | Na sua máquina, nunca aqui: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. 48 bytes de entropia. Cole nos dois lugares e feche o terminal. |
| **Como é usado** | Só no header `Authorization: Bearer …`. **Nunca na query string** — URL entra em log de acesso, de proxy e de CDN; header não. |
| **Como não vaza em log** | O Actions mascara automaticamente qualquer valor vindo de `secrets.*`. O workflow passa por `env:`, nunca por `echo`, e não usa `set -x`. Do lado do código, já auditado: os `console.error` citam o **nome** da variável ("CRON_SECRET não configurado"), nunca o valor. |
| **Rotação** | Gerar novo valor → atualizar na Vercel → **redeploy** (variável de ambiente só vale a partir do próximo deploy) → atualizar no GitHub. Entre os dois passos há uma janela de minutos em que a chamada falha com 401; as rotas são idempotentes e a execução seguinte se recupera sozinha. |
| **Rotação sem janela** *(opcional)* | Fazer as rotas aceitarem também `CRON_SECRET_ANTERIOR` durante a troca. É mudança pequena de código, com teste. Só vale a pena se a rotação virar rotina. |
| **Quando criar** | **Depois** de tirar os crons do `vercel.json` e deployar. Na ordem inversa, criar o segredo liga os cinco crons da Vercel de uma vez — inclusive o de escrita das 05:00 e o de publicar. |

---

## 6. O que foi executado nesta rodada

**Em produção: somente leitura.** Quatro scripts, todos novos, todos com
guarda:

| Script | O que faz |
|---|---|
| `scripts/auditar-schema-producao.ts` | tabelas, `_prisma_migrations`, reconciliação, índices, FKs, volumes. Tem guarda que **recusa qualquer SQL que não comece com `SELECT`** |
| `scripts/auditar-dados-legados-producao.ts` | mede quanto dado real existe no que uma reconciliação ingênua apagaria |
| `scripts/verificar-precondicoes-reconciliacao.ts` | procura colisão de índice único e afere a viabilidade do backfill, antes de qualquer escrita |
| `scripts/comparar-producao-com-baseline.ts` | compara coluna a coluna produção × baseline |
| `scripts/analisar-migrations.ts` | classifica as 13 migrations; não toca banco nenhum |

`npx prisma migrate diff` foi usado uma vez, com `--script`: ele **lê** o
banco e **imprime** DDL. Não aplica. A saída ficou em diretório temporário,
fora do repositório.

`npx tsc --noEmit`: **exit 0**.

---

## 7. Resumo

**Estado real do schema de produção.** 16 tabelas, nenhuma sob controle de
migrations, `_prisma_migrations` inexistente. Faltam 21 das 27 tabelas,
incluindo `Workspace`, `Publicacao` e `AutomationJob`. Sobram 10 tabelas
legadas, todas vazias. Há dado real: 25 produtos, 126 links, 17 conteúdos,
3 integrações, 1 usuária.

**Migrations presentes e ausentes.** 13 no repo, **0 aplicadas**, 0
falhadas, 0 divergentes.

**É seguro aplicar em sequência?** **Não.** A #1 morre na primeira linha,
porque seis das sete tabelas que ela cria já existem. Mas a descoberta boa
é que **produção É o estado do baseline** — falta só `ModuloPermissao` e
sobram três colunas mortas. Então o caminho não é forçar: é **baselining**,
em cinco etapas, com a única etapa destrutiva isolada e adiável.

**Riscos.** O único de verdade é a migration #2, a que mexe em dado real —
e ela já vem com o backfill escrito e correto. Verifiquei contra o dado
concreto que nenhum índice único novo colide, que nenhum `NOT NULL` cai
sobre tabela com linhas sem tratamento, e que nada do que seria apagado tem
conteúdo. O `Workspace` nasce pausado e em modo manual.

**Proposta GitHub Actions.** Um despachante de hora em hora,
`.github/workflows/patrono-crons.yml`, inerte até o merge. ~720 min/mês,
36% da cota gratuita. Todos os horários preservados; só o executor cai de
`*/30` para de hora em hora. `publicar` desligado por variável.

**O que sai do `vercel.json`.** A chave `crons` inteira — os cinco. Isso
destrava o deploy e desacopla o segredo dos agendamentos.

**Estratégia do `CRON_SECRET`.** Nome mantido; Sensitive na Vercel
(Production), repository secret no GitHub; gerado por você, nunca por mim;
usado só em header; criado **por último**, depois do `vercel.json` limpo e
deployado.

**Confirmação de zero escrita em produção.** Nenhum DDL, `INSERT`,
`UPDATE`, `DELETE`, backfill, `migrate deploy`, `migrate dev`, `migrate
resolve`. Nenhuma variável de ambiente criada ou alterada. Nenhum deploy —
a implantação mais recente continua a de 60 dias atrás. Nenhuma publicação,
nenhum adapter real, nenhum merge, nenhum sync da `main`. Custo R$ 0,00.

### Próximo passo mínimo

**Ensaiar a reconciliação num Postgres descartável**, local, com o schema
real de produção reproduzido a partir do que a auditoria levantou. Roda as
cinco etapas do início ao fim e mede o resultado sem que produção participe.
Não precisa da sua autorização e é o que mais reduz risco — posso fazer em
seguida.

**O que precisa da sua autorização, e só depois disso:**

1. `CREATE TABLE "ModuloPermissao"` em produção (aditivo, nenhuma tabela com dado é tocada);
2. `migrate resolve --applied` do baseline (grava 1 linha em `_prisma_migrations`);
3. `migrate deploy` das 12 restantes — **é aqui que a #2 escreve no dado real**;
4. remover `crons` do `vercel.json` e deployar;
5. criar `CRON_SECRET` na Vercel e no GitHub;
6. só então o dry run que a P1.7 não pôde fazer.

Paro aqui para sua revisão.
