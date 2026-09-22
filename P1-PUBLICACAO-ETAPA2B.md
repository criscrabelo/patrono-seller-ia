# P1.0 — Etapa 2.b: persistência da `Publicacao`

**Estado: proposta. A migration NÃO foi aplicada em nenhum banco.**

O arquivo está em `prisma/migrations/20260922120000_publicacao_entidade_de_distribuicao/migration.sql`.
`prisma generate` também **não** foi executado: o cliente gerado continua sem
`prisma.publicacao`, de propósito, para que o código compilado não conheça uma
tabela que o banco ainda não tem.

---

## 1. O que a cadeia passa a responder

```
Conteudo → Publicacao → LinkDinamico → EventoLink
                            ↓
                         Produto
```

Um clique passa a responder, sem inferência: **qual produto** (`LinkDinamico.produtoId`),
**qual publicação** (`LinkDinamico.publicacaoId`), **qual conteúdo**
(`Publicacao.contentId`), **qual canal** (`Publicacao.canal`) e **qual tentativa**
(`Publicacao.chaveDaTentativa`).

Hoje (Etapa 2.a) essa ligação é *derivada* recalculando o sufixo do slug. Funciona,
mas depende de recalcular a chave da tentativa — e uma publicação feita com chave
própria não é recalculável. Com a tabela, vira fato gravado.

---

## 2. Diff do `schema.prisma`

Três edições pequenas e um modelo novo. Tudo aditivo.

### 2.1 `Workspace`

```diff
   eventosLink       EventoLink[]
+  publicacoes       Publicacao[]
```

### 2.2 `Conteudo`

```diff
   sales               Sale[]
+  publicacoes         Publicacao[]

+  @@unique([id, workspaceId])
   @@index([workspaceId])
```

O `@@unique([id, workspaceId])` é redundante com a PK sozinha. Existe só para
servir de **alvo da FK composta** — é o que permite o banco recusar uma
`Publicacao` do workspace A apontando para `Conteudo` do B.

### 2.3 `LinkDinamico`

```diff
   eventos           EventoLink[]
   sales             Sale[]

+  publicacaoId String?
+  publicacao   Publicacao? @relation(fields: [publicacaoId, workspaceId], references: [id, workspaceId])

+  @@unique([publicacaoId, workspaceId])
   @@index([workspaceId])
```

A FK fica **deste** lado, e não como `Publicacao.linkId`, por dois motivos:

1. É aqui que a opcionalidade mora nos dois sentidos — uma publicação pode ir ao ar
   sem link rastreado, e um link pode existir sem publicação (os 18 por produto da
   tela "Meus Links").
2. Evita FK circular entre as duas tabelas.

Isso é um **desvio deliberado do contrato da Etapa 1**, que descrevia
`Publicacao.linkId`. Foi você quem pediu (`LinkDinamico recebe publicacaoId?`), e é
a escolha certa. O campo `linkId` do contrato vira um acessor derivado
(`publicacao.link?.id`), não uma coluna.

**Revisão desta rodada (seu item 3): o `@unique` simples em `publicacaoId` saiu.**
O composto sozinho já garante a cardinalidade — a prova está em §5.2.

### 2.4 Modelo novo

| coluna | tipo | nulo | origem |
|---|---|---|---|
| `id` | `String` cuid | não | PK |
| `workspaceId` | `String` | não | isolamento |
| `contentId` | `String` | não | contrato |
| `provider` | `String` | não | contrato (`destino.provider`) |
| `canal` | `String` | não | contrato (`destino.canal`) |
| `chaveDaTentativa` | `String` | não | contrato |
| `estado` | **`EstadoDaPublicacao`** (enum nativo) = `PREPARADA` | não | contrato |
| `publicacaoExternaId` | `String` | **sim** | contrato |
| `distribuidaEm` | `DateTime` | **sim** | contrato |
| `evidencia` | `Json` | **sim** | contrato |
| `dataOrigin` | `String` = `UNVERIFIED` | não | vocabulário do P0.2 |
| `createdAt` / `updatedAt` | `DateTime` | não | timestamps |

**Nomes preservados do contrato**, onde divergiam do seu pedido: `estado` (não
`status`), `distribuidaEm` (não `distribuidoEm`). `destino` foi achatado em
`provider` + `canal` — são coisas diferentes, um provider serve vários canais.

---

## 3. O que deliberadamente **não** virou coluna

| candidato | por quê não |
|---|---|
| `produtoId` | Derivado de `Conteudo.produtoId`. Duplicar cria duas verdades que divergem. |
| `estadoDeRastreamento` | Ver §4. Totalmente derivável. |
| `publicacaoId` em `Sale` | Derivável: `Sale.clickEventId → EventoLink.linkId → LinkDinamico.publicacaoId`. Ver `PROPOSTA_DE_ATRIBUICAO_DE_VENDA`. |
| `publicacaoId` em `EventoLink` | Derivável por `EventoLink.linkId → LinkDinamico.publicacaoId`. |
| `publicacaoId` em `Commission` | A comissão pertence à venda; a venda já deriva. Dois saltos, nenhuma verdade nova. |

---

## 4. Estado de rastreamento: **derivar, não persistir**

Sua pergunta do item 7. A recomendação é derivar, e a derivação cabe em duas
colunas que já existem:

| estado | condição |
|---|---|
| `NAO_PUBLICADA` | `estado <> 'DISTRIBUIDA'`, **ou** `DISTRIBUIDA` sem `distribuidaEm` |
| `RASTREADA` | `DISTRIBUIDA` **e** existe link **e** `link.createdAt <= distribuidaEm` |
| `NAO_RASTREADA_COM_FALLBACK` | `DISTRIBUIDA` e não `RASTREADA` |

**Confirmado com teste, não com promessa.** A regra virou a função pura
`derivarEstadoDaPublicacaoPersistida()` em `lib/rastreamento-da-publicacao.ts`, com
11 testes em `tests/rodada29-publicacao-schema.test.ts`. Ela ainda não é chamada por
ninguém — a tabela não existe. Está lá para a regra ser testável **antes** de virar
dado.

O caso que você mandou confirmar tem teste próprio: *"link criado DEPOIS da
distribuição NÃO vira rastreada"*. Também: `DISTRIBUIDA` sem `distribuidaEm` é
contradição no próprio registro e lê como `NAO_PUBLICADA`; data ilegível em qualquer
ponta nunca vira `RASTREADA`.

Persistir seria manter um cache capaz de contradizer as colunas de onde ele sai —
e um cache errado aqui envenena o ML, que é exatamente o que a microcorreção da
2.a acabou de blindar.

**A cláusula `link.createdAt <= distribuidaEm` importa.** Sem ela, anexar um link a
uma publicação antiga faria um post que saiu com link direto passar a ler como
rastreado — reescrevendo história em favor do número bonito. O link é criado *antes*
de publicar (a legenda precisa da URL), então na operação normal a condição é
sempre verdadeira; ela só morde no caso patológico, que é quando precisa morder.

**Única razão que mudaria essa decisão:** se um dia for preciso auditar o estado *no
instante da publicação* mesmo depois de o link ser apagado. Aí a coluna se justifica
como registro histórico, não como cache. Não é o caso hoje.

**`DISTRIBUIDA` ≠ `RASTREADA`.** Uma publicação pode perfeitamente estar
`DISTRIBUIDA` + `NAO_RASTREADA_COM_FALLBACK` — é literalmente o caso que a Etapa 2.a
mantém vivo de propósito.

---

## 5. Constraints e índices

| nome | tipo | o que garante |
|---|---|---|
| `Publicacao_pkey` | PK | — |
| `Publicacao_workspaceId_chaveDaTentativa_key` | UNIQUE | **Idempotência primária.** Retry reencontra a linha; republicação nasce outra. |
| `Publicacao_workspaceId_provider_publicacaoExternaId_key` | UNIQUE | **Idempotência externa**, só quando há id do provider. Ver §5.1. |
| `Publicacao_id_workspaceId_key` | UNIQUE | Alvo da FK composta de `LinkDinamico`. |
| `Conteudo_id_workspaceId_key` | UNIQUE | Alvo da FK composta de `Publicacao`. |
| `LinkDinamico_publicacaoId_workspaceId_key` | UNIQUE | Um link por publicação, no máximo. Ver §5.1 e §5.2. |
| `Publicacao_workspaceId_estado_idx` | índice | Fila operacional ("o que está DISTRIBUINDO?"). |
| `Publicacao_workspaceId_contentId_createdAt_idx` | índice | Histórico de publicações de um conteúdo, em ordem. |
| `Publicacao_workspaceId_fkey` | FK | isolamento |
| `Publicacao_contentId_workspaceId_fkey` | FK **composta** | conteúdo do MESMO workspace |
| `LinkDinamico_publicacaoId_workspaceId_fkey` | FK **composta**, `ON DELETE RESTRICT` | publicação do MESMO workspace; apagar publicação com link é recusado, não orfanado |

### 5.1 Sobre as UNIQUE com coluna nulável

Você pediu índice parcial se o Prisma não expressasse. **Ele expressa** — por
semântica do Postgres, e não por sorte: `UNIQUE` usa `NULLS DISTINCT` por padrão,
então uma constraint que inclui coluna nulável já vale *somente quando a coluna tem
valor*.

- `(workspaceId, provider, publicacaoExternaId)`: várias publicações sem id externo
  (manual, provider que não devolve id, processamento em curso) convivem; duas
  apontando para o mesmo post do mesmo provider são recusadas.
- `LinkDinamico(publicacaoId, workspaceId)`: vários links sem publicação convivem; um
  segundo link para a mesma publicação é recusado.

**A premissa que você mandou confirmar (item 5):** a chave
`workspaceId + provider + publicacaoExternaId` só está correta se o identificador
externo for único **dentro daquele provider**. Confirmei no contrato —
`chaveExternaDaPublicacao()` em `lib/publicacao-contrato.ts` monta exatamente
`workspaceId|provider|id` — e a premissa vale para os providers em jogo: media id da
Meta e video id do TikTok são únicos na plataforma inteira, inclusive quando o mesmo
workspace conecta duas contas do mesmo provider.

**Limitação registrada, sem coluna nova:** um provider cujo id só seja único *por
conta ou por loja* quebraria a premissa — duas contas poderiam repetir o mesmo
número e a segunda publicação seria recusada por engano. Nenhum provider atual é
assim, então não invento a coluna de conta agora. O aviso está escrito no bloco §7
da migration, que é onde alguém vai olhar quando precisar mexer.

Vale explicitar um efeito que **não** é defeito: a constraint é por workspace, então
dois workspaces diferentes podem registrar o mesmo post externo. Isso é o isolamento
funcionando, não um furo de idempotência.

Preferi a constraint declarada ao índice parcial escrito à mão porque o Prisma a
conhece — SQL fora do schema vira drift na próxima `migrate dev`. O efeito é
idêntico. O risco a conhecer está anotado no topo da migration: se algum dia essas
constraints forem recriadas com `NULLS NOT DISTINCT` (PG15+), viram outra coisa.

### 5.2 O índice que saiu (seu item 3)

A proposta anterior tinha **dois** índices em `LinkDinamico`:
`UNIQUE(publicacaoId)` e `UNIQUE(publicacaoId, workspaceId)`. Você perguntou se o
segundo era necessário. Testei as três configurações possíveis:

| configuração | `prisma validate` | índices | custo |
|---|---|---|---|
| só `@unique(publicacaoId)`, relação composta | **recusa** — "a one-to-one relation must use unique fields on the defining side" | — | — |
| `@unique` + `@@unique` composto | passa | 2 | índice duplicado |
| relação 1:N no Prisma, `@unique` simples no banco | passa | 1 | o tipo do cliente vira `links[]` e mente sobre a cardinalidade |
| **só `@@unique([publicacaoId, workspaceId])`** | **passa** | **1** | **nenhum** |

**Ficou a última.** O `@unique` simples era o redundante, e não o composto — o
inverso do que eu tinha escrito antes.

A garantia se mantém porque ela se apoia na FK composta: se dois links apontassem
para a mesma `Publicacao` P, a FK obrigaria os dois a terem o `workspaceId` de P.
Então o par `(publicacaoId, workspaceId)` seria idêntico nos dois, e a UNIQUE recusa
o segundo. Com `publicacaoId` NULL a FK não é checada, a UNIQUE vê NULL e permite
quantos houver — que é o desejado para os 18 links por produto de "Meus Links".

Um índice a menos, mesma garantia, e o Prisma continua modelando 1 → 0..1.

### 5.3 O `CHECK` virou enum (seu item 1)

Você concordou em não criar `CHECK` manual, e pediu para eu verificar antes se um
enum daria conta. **Dá, e sem complexidade nenhuma nesta migration.**

```prisma
enum EstadoDaPublicacao {
  PREPARADA
  DISTRIBUINDO
  DISTRIBUIDA
  FALHOU
  REMOVIDA
}
```

```sql
CREATE TYPE "EstadoDaPublicacao" AS ENUM ('PREPARADA', 'DISTRIBUINDO', 'DISTRIBUIDA', 'FALHOU', 'REMOVIDA');
```

É barato porque a **tabela é nova**: nenhuma linha para converter, nenhum dado
antigo capaz de violar o tipo. Não fosse assim — se estivéssemos convertendo uma
coluna `TEXT` existente — eu teria recomendado ficar com `String`, porque aí a
migration deixaria de ser aditiva.

**O que o enum garante é o vocabulário, não a máquina de estados.** Gravar
`'PUBLICADA'` passa a ser impossível; impedir `DISTRIBUIDA` vindo de `REMOVIDA`
continua sendo trabalho de `validarTransicao()`, no contrato. As duas defesas se
somam; nenhuma substitui a outra.

**Preço a assumir:** um estado novo no futuro exige
`ALTER TYPE "EstadoDaPublicacao" ADD VALUE '...'` numa migration. No PG12+ isso roda
dentro de transação desde que o valor novo não seja usado na mesma transação, e o
Prisma gera o `ALTER` sozinho.

**Segundo preço, e este é o que me incomodou mais:** o vocabulário passa a existir
em dois lugares — o enum e `ESTADOS_DA_PUBLICACAO` em `lib/publicacao-contrato.ts`.
Por isso há teste exigindo que o enum do schema, o `CREATE TYPE` do SQL e a
constante do contrato tenham **os mesmos valores, na mesma ordem**. Se alguém mexer
num, a suíte quebra.

`dataOrigin` **não** virou enum, de propósito: ela compartilha vocabulário com
`Sale.dataOrigin` e `Commission`, que são `TEXT`. Converter só esta fragmentaria o
vocabulário da proveniência em dois tipos diferentes.

Este é o primeiro enum do schema — até aqui o projeto usa `String` em todo status.
Vale saber que estamos abrindo esse precedente.

---

## 6. Compatibilidade

- Nenhuma coluna removida, renomeada, ou com tipo alterado.
- Nenhuma coluna existente vira `NOT NULL`.
- `LinkDinamico.publicacaoId` nasce nulável e fica nulo em **todos** os links atuais.
- Nenhuma linha existente muda de significado.
- Nenhum `UPDATE` na migration.

Os dois `CREATE UNIQUE INDEX` sobre tabelas existentes (`Conteudo_id_workspaceId_key`)
não podem falhar: `id` já é PK, logo o par `(id, workspaceId)` é único por construção.

---

## 7. Sem backfill

Nenhuma `Publicacao` nasce para conteúdo antigo. O banco atual não consegue provar
quantas vezes um conteúdo foi publicado, em que canal de cada vez, nem qual link
pertenceu a qual publicação. Derivar do slug produziria um histórico plausível e
falso.

Conteúdo antigo fica sem `Publicacao`, e isso é o registro honesto de que a
informação não existe. Depois da migration, publicação nova registra corretamente.

---

## 8. Impacto esperado

| onde | efeito |
|---|---|
| Runtime | Zero imediato. Nada lê nem escreve a tabela até a rodada seguinte. |
| Suíte | Deve continuar em 1141/1141. A tabela existe e fica vazia. |
| Métricas de clique | Inalteradas nesta rodada. |
| ML | Inalterado. `FEATURE_VERSION` não muda. |
| Derivação por slug (2.a) | Continua valendo e continua sendo a fonte enquanto o código não migrar. |

---

## 9. Riscos

| risco | gravidade | mitigação |
|---|---|---|
| `NULLS NOT DISTINCT` recriado por engano transforma as duas UNIQUE | alto se acontecer | anotado no topo da migration; teste que insere duas publicações sem id externo |
| Duas publicações concorrentes com a mesma `chaveDaTentativa` | baixo | a UNIQUE recusa a segunda; o caminho de escrita precisa tratar o conflito como *idempotência*, não como erro |
| FK composta exige que quem escreve passe `workspaceId` coerente | baixo | é o ponto — o banco recusa o incoerente |
| `ON DELETE RESTRICT` bloqueia limpeza de fixture de teste | médio, só em teste | ordem de limpeza: `eventoLink` → `linkDinamico` → `publicacao` → `conteudo` |
| Cliente Prisma regenerado antes de a migration ser aplicada | médio | `prisma generate` só depois do `migrate deploy`; não rodei generate |
| Índice `Publicacao_workspaceId_provider_publicacaoExternaId_key` não cobre provider case-insensitive | baixo | normalizar `provider` na escrita, como já se faz com canal |
| Enum e `ESTADOS_DA_PUBLICACAO` se afastarem | médio | teste exige os dois idênticos, na mesma ordem, junto com o `CREATE TYPE` do SQL |
| Estado novo no futuro exige `ALTER TYPE ... ADD VALUE` | baixo | PG12+ aceita em transação; o Prisma gera o ALTER |
| Provider com id externo único só por conta | baixo hoje | limitação registrada no §7 da migration; nenhum provider atual é assim |

---

## 10. Rollback

A migration é aditiva, então o rollback é uma remoção limpa e **sem perda de dado
pré-existente** — só se perde o que tiver sido gravado na tabela nova.

```sql
ALTER TABLE "LinkDinamico" DROP CONSTRAINT "LinkDinamico_publicacaoId_workspaceId_fkey";
DROP INDEX "LinkDinamico_publicacaoId_workspaceId_key";
ALTER TABLE "LinkDinamico" DROP COLUMN "publicacaoId";

DROP TABLE "Publicacao";  -- leva junto os índices e as FKs dela

DROP INDEX "Conteudo_id_workspaceId_key";

DROP TYPE "EstadoDaPublicacao";  -- so depois que a tabela sumiu
```

Ordem importa em dois pontos: a FK de `LinkDinamico` sai antes da tabela
(`DROP TABLE "Publicacao"` falha se algum link ainda apontar para ela), e o
`DROP TYPE` só funciona depois que a tabela que usa o enum já não existe.

Janela de rollback seguro: **enquanto nenhuma publicação real tiver sido gravada**.
Depois disso, remover a tabela apaga histórico de distribuição que não se
reconstrói — a partir daí o caminho é parar de escrever, não reverter.

---

## 11. Arquivos que mudam **depois** da aprovação

Nenhum deles foi tocado nesta rodada.

| arquivo | mudança |
|---|---|
| `lib/publicacao-repositorio.ts` | **novo.** `abrirPublicacao()`, `marcarDistribuida()`, `registrarFalha()`, todos idempotentes pela chave da tentativa |
| `lib/link-de-publicacao.ts` | `obterLinkRastreavelDaPublicacao()` passa a receber `publicacaoId` e gravá-lo no link |
| `lib/rastreamento-da-publicacao.ts` | derivação por slug → leitura de `Publicacao` + link; `sufixosDerivaveisDaPublicacao()` vira fallback só para publicação anterior à migration |
| `app/api/conteudos/[id]/publicar/route.ts` | abre `Publicacao` antes, marca `DISTRIBUIDA` com `publicacaoExternaId` depois |
| `app/api/cron/publicar/route.ts` | idem, pelo caminho agendado |
| `lib/atribuicao-clique.ts` | a cadeia do clique passa a resolver publicação e conteúdo |
| `lib/metricas-clique.ts` | destrava granularidade `CONTEUDO` e `CANAL`; `LIMITACAO_DE_ATRIBUICAO` é revista |
| `lib/dossie-operacao.ts` | o dossiê passa a mostrar a publicação de origem |
| `lib/ml-captura-publicacao.ts` | amostra por `Publicacao` — **só na rodada do ML**, com `featureVersion` nova |

### Ordem sugerida das rodadas seguintes

1. **2.b-ii** — repositório + escrita nas duas rotas de publicação. Nada lê ainda.
2. **2.b-iii** — leitura: rastreamento, atribuição do clique, dossiê.
3. **2.b-iv** — métricas por conteúdo/canal, que é o que destrava receita.
4. **2.c** — ML: `entityType` `Conteudo` → `Publicacao`, `featureVersion`
   `ml-features-v1-rodada9` → `ml-features-v2-publicacao`. Sem backfill; snapshots
   antigos ficam. As duas gerações **não se somam** para prontidão, e o relógio do
   readiness recomeça — o preço honesto de trocar a unidade de observação. Já está
   escrito em `TRANSICAO_DE_ML`, em `lib/publicacao-contrato.ts`.

---

---

## 11-A. O que esta revisão mudou

| ponto | antes | agora |
|---|---|---|
| 1 — status | `String` + máquina de estados | **enum nativo** `EstadoDaPublicacao`, gerenciado pelo Prisma, + máquina de estados + teste de sincronia |
| 2 — rastreamento | regra descrita no documento | **função pura testada**, `derivarEstadoDaPublicacaoPersistida()`, 11 testes |
| 3 — índices de `LinkDinamico` | 2 índices | **1** — o `@unique` simples saiu, era ele o redundante |
| 4 — FKs compostas | afirmadas | **testadas**, inclusive a ordem (alvo criado antes da FK) |
| 5 — id externo | premissa implícita | premissa confirmada no contrato + limitação por conta/loja registrada |
| 6 — idempotência | preservada | preservada, com teste |
| 7 — backfill | ausente | ausente, com teste (`nenhum INSERT`, `nenhum SELECT`) |

Nenhuma mudança de campo, nome ou cardinalidade. Só um índice a menos, um tipo mais
forte, e as afirmações viraram testes.

Arquivos desta revisão, todos ainda **não commitados**:

- `prisma/schema.prisma` — enum + o índice removido
- `prisma/migrations/20260922120000_publicacao_entidade_de_distribuicao/migration.sql`
- `lib/rastreamento-da-publicacao.ts` — `derivarEstadoDaPublicacaoPersistida()`, inerte
- `tests/rodada29-publicacao-schema.test.ts` — 31 testes
- este documento

---

## 12. Para aprovar

```bash
# 1. aplicar (banco de TESTE primeiro, com autorização explícita)
npx prisma migrate deploy

# 2. só então regenerar o cliente
npx prisma generate
```

Nada disso foi executado.
